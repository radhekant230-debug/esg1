/**
 * Centralised MongoDB connection for the backend (Admin, Manager and Client
 * Portal APIs all share this one Mongoose connection pool).
 *
 *  - Reads MONGO_URI (and optional MONGO_DB_NAME / MONGO_MAX_POOL_SIZE) from the
 *    backend environment only. The frontend never receives it.
 *  - Validates the URI before connecting and fails with a clear, secret-free error.
 *  - Retries transient start-up failures with backoff, but stops immediately on
 *    authentication failures (a wrong password never fixes itself).
 *  - Logs disconnects / reconnects as structured JSON lines without the URI,
 *    user name, password or host.
 *  - Exposes readiness + a ping for the health endpoint and a middleware that
 *    returns 503 instead of hanging while the database is unavailable.
 *
 * TLS and certificate verification are never disabled here; URIs that try to
 * disable them are rejected.
 */
const mongoose = require("mongoose");

const DEFAULT_DB_NAME = "esg-official-clients";
const STATES = ["disconnected", "connected", "connecting", "disconnecting"];

const state = {
  bootstrapRequired: false, // index.js sets this; tests that mount app.js directly don't
  bootstrapped: false, // set by index.js after startup tasks finish
  lastError: null, // { code, at } — classification only, never the raw message
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnects: 0,
  listenersAttached: false,
};

// ---------------------------------------------------------------- logging ---

/** Removes credentials (and the password value, if known) from any text. */
function redact(text, uri = process.env.MONGO_URI) {
  let out = String(text == null ? "" : text);
  out = out.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]*@/gi, "$1***:***@");
  const parts = parseCredentials(uri);
  if (parts) {
    for (const secret of [parts.password, decodeSafe(parts.password)]) {
      if (secret && secret.length >= 3) out = out.split(secret).join("***");
    }
  }
  return out;
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseCredentials(uri) {
  const m = /^mongodb(?:\+srv)?:\/\/([^:@/]*)(?::([^@/]*))?@/i.exec(String(uri || ""));
  return m ? { username: m[1], password: m[2] || "" } : null;
}

function log(level, event, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, component: "mongodb", event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "test" || process.env.DB_LOG_IN_TESTS) console.log(line);
}

// ------------------------------------------------------------- validation ---

/**
 * Validates a MongoDB URI WITHOUT returning any part of it.
 * Returns { ok, errors: [..], warnings: [..], info: { scheme, hasCredentials, hostCount, local } }.
 */
function validateMongoUri(uri) {
  const errors = [];
  const warnings = [];
  const info = { scheme: null, hasCredentials: false, hostCount: 0, local: false };
  if (!uri || !String(uri).trim()) {
    errors.push("MONGO_URI is not set. Add it to server/.env locally or to the backend service's environment variables on Render.");
    return { ok: false, errors, warnings, info };
  }
  const value = String(uri).trim();
  if (value !== uri) warnings.push("MONGO_URI has leading/trailing whitespace (it was trimmed).");
  const m = /^(mongodb(?:\+srv)?):\/\/(?:([^@/]*)@)?([^/?]+)(\/[^?]*)?(\?.*)?$/i.exec(value);
  if (!m) {
    errors.push("MONGO_URI is not a valid MongoDB connection string (expected mongodb:// or mongodb+srv://).");
    return { ok: false, errors, warnings, info };
  }
  info.scheme = m[1].toLowerCase();
  info.hasCredentials = Boolean(m[2]);
  const hosts = m[3].split(",").filter(Boolean);
  info.hostCount = hosts.length;
  info.local = hosts.every((h) => /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i.test(h));

  if (/[<>]/.test(value) || /<password>|<username>|<cluster>|user:pass@|username:password@/i.test(value)) {
    errors.push("MONGO_URI still contains template placeholders (e.g. <password> or <cluster>). Paste the real connection string.");
  }
  if (info.scheme === "mongodb+srv" && hosts.length !== 1) errors.push("mongodb+srv:// URIs must contain exactly one host name.");
  if (info.scheme === "mongodb+srv" && /:\d+$/.test(hosts[0] || "")) errors.push("mongodb+srv:// URIs must not include a port.");
  if (m[2]) {
    const pw = m[2].includes(":") ? m[2].slice(m[2].indexOf(":") + 1) : "";
    if (!m[2].includes(":") || !pw) errors.push("MONGO_URI has a user name but no password.");
    // Unencoded reserved characters break parsing in confusing ways.
    if (/[@/?#[\]]/.test(pw)) errors.push("The password in MONGO_URI contains characters that must be URL-encoded (@ / ? # [ ]). Encode it or choose a password without them.");
  } else if (!info.local) {
    warnings.push("MONGO_URI has no credentials; MongoDB Atlas requires a database user.");
  }
  const query = (m[5] || "").toLowerCase();
  if (/(^|[?&])(tls|ssl)=false(&|$)/.test(query) && !info.local) {
    errors.push("MONGO_URI disables TLS (tls=false). TLS must stay enabled for remote databases.");
  }
  if (/(tlsallowinvalidcertificates|tlsallowinvalidhostnames|tlsinsecure|sslvalidate)=(true|false)/.test(query)) {
    if (/(tlsallowinvalidcertificates|tlsallowinvalidhostnames|tlsinsecure)=true|sslvalidate=false/.test(query)) {
      errors.push("MONGO_URI disables certificate verification. Remove tlsAllowInvalidCertificates / tlsInsecure options.");
    }
  }
  return { ok: errors.length === 0, errors, warnings, info };
}

/** Which required settings are present (booleans only — safe to expose). */
function configStatus(env = process.env) {
  return {
    MONGO_URI: Boolean(env.MONGO_URI && String(env.MONGO_URI).trim()),
    MONGO_URI_valid: validateMongoUri(env.MONGO_URI).ok,
    JWT_SECRET: Boolean(env.JWT_SECRET && String(env.JWT_SECRET).trim()),
  };
}

// ---------------------------------------------------------- error classes ---

/** Maps a driver error to a stable, secret-free code and a human hint. */
function classifyError(err) {
  const msg = String((err && (err.message || err.codeName)) || "");
  const code = err && err.code;
  if (code === 18 || code === 8000 || /auth(entication)? failed|bad auth|authentication fail/i.test(msg)) {
    return { code: "AUTH_FAILED", retryable: false, hint: "Database credentials were rejected. Check the user name/password in MONGO_URI (Render → service → Environment) and that the Atlas database user exists." };
  }
  if (/tlsv1 alert internal error|alert number 80|ssl routines/i.test(msg)) {
    return { code: "NETWORK_ACCESS_DENIED", retryable: true, hint: "Atlas rejected the TLS handshake — usually this server's IP is not in Atlas → Network Access." };
  }
  if (/ENOTFOUND|querySrv|ENODATA|EAI_AGAIN/i.test(msg)) {
    return { code: "DNS_LOOKUP_FAILED", retryable: true, hint: "The cluster host name could not be resolved. Check the cluster address in MONGO_URI." };
  }
  if (/not authorized|unauthorized|code 13\b/i.test(msg) || code === 13) {
    return { code: "NOT_AUTHORIZED", retryable: false, hint: "The database user lacks permission on this database. Grant readWrite on the application database." };
  }
  if (/Server selection timed out|ECONNREFUSED|ETIMEDOUT|ECONNRESET|topology|connection .* closed|MongoNetwork/i.test(msg) || /MongoServerSelectionError|MongoNetworkError/.test(err && err.name)) {
    return { code: "UNREACHABLE", retryable: true, hint: "MongoDB is unreachable right now (network, Atlas Network Access, or a paused cluster)." };
  }
  if (/Invalid scheme|URI malformed|Invalid connection string|MongoParseError/i.test(msg + (err && err.name))) {
    return { code: "INVALID_URI", retryable: false, hint: "MONGO_URI could not be parsed." };
  }
  return { code: "UNKNOWN", retryable: true, hint: "Unexpected database error." };
}

// ---------------------------------------------------------------- connect ---

function attachListeners(conn) {
  if (state.listenersAttached) return;
  state.listenersAttached = true;
  conn.on("connected", () => {
    state.lastConnectedAt = new Date();
    log("info", "connected", { db: conn.name });
  });
  conn.on("disconnected", () => {
    state.lastDisconnectedAt = new Date();
    log("warn", "disconnected", { note: "driver will reconnect automatically" });
  });
  conn.on("reconnected", () => {
    state.reconnects += 1;
    state.lastConnectedAt = new Date();
    state.lastError = null;
    log("info", "reconnected", { reconnects: state.reconnects });
  });
  conn.on("error", (err) => {
    const c = classifyError(err);
    state.lastError = { code: c.code, at: new Date() };
    log("error", "connection_error", { code: c.code, hint: c.hint, detail: redact(err && err.message) });
  });
}

function connectionOptions(overrides = {}) {
  return {
    dbName: process.env.MONGO_DB_NAME || DEFAULT_DB_NAME,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    appName: process.env.MONGO_APP_NAME || "esg-officials-api",
    ...overrides,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Connects the shared Mongoose connection (idempotent).
 * opts: { uri, retries (default 5), baseDelayMs (default 2000), options }
 * Throws an Error with .code (AUTH_FAILED, INVALID_CONFIG, UNREACHABLE, …) and
 * a redacted message.
 */
async function connectDB(opts = {}) {
  const uri = opts.uri || process.env.MONGO_URI;
  const v = validateMongoUri(uri);
  v.warnings.forEach((w) => log("warn", "config_warning", { message: w }));
  if (!v.ok) {
    const e = new Error(v.errors.join(" "));
    e.code = "INVALID_CONFIG";
    log("error", "config_invalid", { errors: v.errors });
    throw e;
  }
  const conn = mongoose.connection;
  attachListeners(conn);
  if (conn.readyState === 1) return conn;

  const retries = opts.retries ?? (Number(process.env.MONGO_CONNECT_RETRIES) || 5);
  const baseDelay = opts.baseDelayMs ?? 2000;
  for (let attempt = 1; ; attempt++) {
    try {
      log("info", "connecting", { attempt, scheme: v.info.scheme, pool: connectionOptions(opts.options).maxPoolSize });
      await mongoose.connect(String(uri).trim(), connectionOptions(opts.options));
      state.lastError = null;
      return conn;
    } catch (err) {
      const c = classifyError(err);
      state.lastError = { code: c.code, at: new Date() };
      log("error", "connect_failed", { attempt, code: c.code, retryable: c.retryable, hint: c.hint });
      if (!c.retryable || attempt > retries) {
        const e = new Error(`${c.hint} (${c.code})`);
        e.code = c.code;
        throw e;
      }
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30000);
      log("warn", "connect_retry_scheduled", { inMs: delay, attempt: attempt + 1 });
      await sleep(delay);
    }
  }
}

// ------------------------------------------------------- health/readiness ---

function dbState() {
  const rs = mongoose.connection.readyState;
  return { readyState: rs, status: STATES[rs] || "unknown", connected: rs === 1 };
}

function isReady() {
  return dbState().connected && (!state.bootstrapRequired || state.bootstrapped);
}

/** index.js: the app is not ready until startup tasks (account bootstrap, schedulers) finish. */
function requireBootstrap() {
  state.bootstrapRequired = true;
}

function markBootstrapped(value = true) {
  state.bootstrapped = value;
}

/** Pings the database with a timeout. Never returns error details. */
async function pingDB(timeoutMs = 2000) {
  if (!dbState().connected || !mongoose.connection.db) return { ok: false, latencyMs: null };
  const started = Date.now();
  let timer;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error("ping timeout")), timeoutMs);
      }),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

function healthSnapshot() {
  return {
    ...dbState(),
    bootstrapped: state.bootstrapped,
    lastErrorCode: state.lastError ? state.lastError.code : null,
    reconnects: state.reconnects,
    lastConnectedAt: state.lastConnectedAt,
  };
}

/**
 * Express middleware: answers 503 quickly while the database is not ready
 * (instead of letting requests hang in Mongoose's command buffer).
 */
function requireDatabase(req, res, next) {
  if (isReady()) return next();
  res.setHeader("Retry-After", "10");
  return res.status(503).json({ message: "Service temporarily unavailable. Please try again shortly.", code: "DATABASE_UNAVAILABLE" });
}

async function closeDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close(false);
  log("info", "closed");
}

module.exports = {
  connectDB,
  closeDB,
  pingDB,
  dbState,
  isReady,
  requireBootstrap,
  markBootstrapped,
  healthSnapshot,
  requireDatabase,
  validateMongoUri,
  configStatus,
  classifyError,
  redact,
  log,
  DEFAULT_DB_NAME,
  _state: state,
};
