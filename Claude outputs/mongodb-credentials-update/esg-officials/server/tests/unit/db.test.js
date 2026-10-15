/**
 * MongoDB connection module (config/db.js) and health endpoint.
 * Runs without a database: mongoose and express are replaced by small fakes,
 * so these tests never touch production (or any) credentials.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const path = require("path");
const { EventEmitter } = require("events");
const { spawnSync } = require("child_process");

// ---- fakes ---------------------------------------------------------------
const conn = new EventEmitter();
conn.readyState = 0;
conn.name = "esg-official-clients";
conn.db = { admin: () => ({ ping: async () => (fake.pingFails ? Promise.reject(new Error("x")) : { ok: 1 }) }) };
conn.close = async () => {
  conn.readyState = 0;
};
const fake = { connectCalls: [], connectImpl: null, pingFails: false };
const fakeMongoose = {
  connection: conn,
  connect: async (uri, opts) => {
    fake.connectCalls.push({ uri, opts });
    await fake.connectImpl(uri, opts);
    conn.readyState = 1;
  },
};
const routes = {};
const fakeExpress = { Router: () => ({ get: (p, h) => (routes[p] = h) }) };
const realLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (req === "mongoose") return fakeMongoose;
  if (req === "express") return fakeExpress;
  return realLoad.call(this, req, parent, ...rest);
};
const SERVER = path.join(__dirname, "..", "..");
const db = require(path.join(SERVER, "config/db"));
require(path.join(SERVER, "routes/health"));

const PASSWORD = "S3cr3t-Pa55word-xyz";
const GOOD = `mongodb+srv://app_user:${PASSWORD}@cluster0.abcde.mongodb.net/esg-official-clients?retryWrites=true&w=majority`;

function captureLogs(fn) {
  const out = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => out.push(a.join(" "));
  process.env.DB_LOG_IN_TESTS = "1";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Object.assign(console, orig);
      delete process.env.DB_LOG_IN_TESTS;
    })
    .then((r) => ({ result: r, logs: out.join("\n") }));
}
const resMock = () => {
  const r = { statusCode: 200, headers: {}, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.setHeader = (k, v) => (r.headers[k] = v);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const authError = () => Object.assign(new Error(`bad auth : Authentication failed. uri=${GOOD}`), { code: 8000, name: "MongoServerError" });
const netError = () => Object.assign(new Error("Server selection timed out after 10000 ms"), { name: "MongoServerSelectionError" });

// ---- 1. configuration ----------------------------------------------------
test("missing / invalid MONGO_URI is rejected with a clear message and no secret", () => {
  assert.equal(db.validateMongoUri(undefined).ok, false);
  assert.match(db.validateMongoUri("").errors[0], /MONGO_URI is not set/);
  assert.match(db.validateMongoUri("http://example.com").errors[0], /not a valid MongoDB connection string/);
  assert.match(db.validateMongoUri("mongodb+srv://user:<password>@<cluster>.mongodb.net/db").errors.join(" "), /placeholders/);
  const tlsOff = db.validateMongoUri(`mongodb+srv://u:${PASSWORD}@c.mongodb.net/db?tls=false`);
  assert.equal(tlsOff.ok, false);
  assert.match(tlsOff.errors.join(" "), /TLS must stay enabled/);
  const insecure = db.validateMongoUri(`mongodb+srv://u:${PASSWORD}@c.mongodb.net/db?tlsAllowInvalidCertificates=true`);
  assert.match(insecure.errors.join(" "), /certificate verification/);
  assert.equal(db.validateMongoUri("mongodb+srv://u@c.mongodb.net/db").ok, false, "user without password");
  for (const r of [tlsOff, insecure]) assert.ok(!JSON.stringify(r).includes(PASSWORD), "validation output never contains the password");
  const ok = db.validateMongoUri(GOOD);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.info, { scheme: "mongodb+srv", hasCredentials: true, hostCount: 1, local: false });
  assert.equal(db.validateMongoUri("mongodb://127.0.0.1:27017/esg").ok, true, "local dev without credentials is allowed");
});

test("connectDB refuses to connect with a missing URI", async () => {
  fake.connectCalls.length = 0;
  await assert.rejects(db.connectDB({ uri: "" }), (e) => e.code === "INVALID_CONFIG");
  assert.equal(fake.connectCalls.length, 0);
});

// ---- 2. invalid credentials --------------------------------------------
test("invalid credentials fail fast (no retry loop) and the error/logs never contain the password", async () => {
  conn.readyState = 0;
  fake.connectCalls.length = 0;
  fake.connectImpl = async () => {
    throw authError();
  };
  const { logs } = await captureLogs(() =>
    assert.rejects(db.connectDB({ uri: GOOD, retries: 5, baseDelayMs: 1 }), (e) => {
      assert.equal(e.code, "AUTH_FAILED");
      assert.ok(!e.message.includes(PASSWORD));
      assert.match(e.message, /credentials were rejected/);
      return true;
    })
  );
  assert.equal(fake.connectCalls.length, 1, "authentication errors are not retried");
  assert.ok(!logs.includes(PASSWORD) && !logs.includes("cluster0.abcde"), "logs contain neither the password nor the host");
});

// ---- 3 + 4. success, transient failure, disconnect/reconnect -------------
test("transient failures are retried, then the shared connection is used (single pool)", async () => {
  conn.readyState = 0;
  fake.connectCalls.length = 0;
  let n = 0;
  fake.connectImpl = async () => {
    if (++n < 3) throw netError();
  };
  const { logs } = await captureLogs(() => db.connectDB({ uri: GOOD, retries: 5, baseDelayMs: 1 }));
  assert.equal(fake.connectCalls.length, 3);
  assert.equal(db.dbState().connected, true);
  assert.match(logs, /connect_retry_scheduled/);
  const opts = fake.connectCalls[2].opts;
  assert.equal(opts.dbName, "esg-official-clients");
  assert.ok(opts.maxPoolSize >= 1 && opts.serverSelectionTimeoutMS > 0);
  // already connected -> no second pool
  await db.connectDB({ uri: GOOD });
  assert.equal(fake.connectCalls.length, 3, "an existing connection is reused");
});

test("disconnect -> 503 for API routes; reconnect -> requests flow again; events are logged safely", async () => {
  const { logs } = await captureLogs(async () => {
    conn.readyState = 0;
    conn.emit("disconnected");
    const res = resMock();
    let passed = false;
    db.requireDatabase({}, res, () => (passed = true));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "DATABASE_UNAVAILABLE");
    conn.emit("error", Object.assign(new Error(`connection to ${GOOD} closed`), { name: "MongoNetworkError" }));
    conn.readyState = 1;
    conn.emit("reconnected");
    let ok = false;
    db.requireDatabase({}, resMock(), () => (ok = true));
    assert.equal(ok, true);
  });
  assert.match(logs, /"event":"disconnected"/);
  assert.match(logs, /"event":"reconnected"/);
  assert.ok(!logs.includes(PASSWORD), "error events are redacted");
});

// ---- 5. restart after changing the secret --------------------------------
test("after the secret changes, a restart connects with the NEW value (nothing cached)", async () => {
  const NEW = GOOD.replace(PASSWORD, "Br4nd-New-Pa55");
  conn.readyState = 0;
  fake.connectCalls.length = 0;
  fake.connectImpl = async (uri) => {
    if (uri.includes(PASSWORD)) throw authError(); // old password revoked in Atlas
  };
  const saved = process.env.MONGO_URI;
  try {
    process.env.MONGO_URI = GOOD;
    await captureLogs(() => assert.rejects(db.connectDB({ retries: 0 }), /AUTH_FAILED/));
    process.env.MONGO_URI = NEW; // Render: Environment -> save -> redeploy
    await captureLogs(() => db.connectDB({ retries: 0 }));
    assert.equal(db.dbState().connected, true);
    assert.equal(fake.connectCalls.at(-1).uri, NEW);
  } finally {
    if (saved === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = saved;
  }
});

// ---- 6. health endpoint --------------------------------------------------
test("health: live always 200; ready 200/503 with no secret in either body", async () => {
  const env = { MONGO_URI: process.env.MONGO_URI, JWT_SECRET: process.env.JWT_SECRET };
  process.env.MONGO_URI = GOOD;
  process.env.JWT_SECRET = "j".repeat(64);
  try {
    const live = resMock();
    routes["/live"]({}, live);
    assert.equal(live.body.status, "ok");

    conn.readyState = 1;
    fake.pingFails = false;
    db.markBootstrapped(true);
    const ok = resMock();
    await routes["/"]({}, ok);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body.ready, true);
    assert.equal(ok.body.checks.database.reachable, true);
    assert.equal(typeof ok.body.checks.database.latencyMs, "number");
    assert.deepEqual(ok.body.checks.config, { MONGO_URI: true, MONGO_URI_valid: true, JWT_SECRET: true });

    conn.readyState = 0;
    const down = resMock();
    await routes["/ready"]({}, down);
    assert.equal(down.statusCode, 503);
    assert.equal(down.body.ready, false);

    process.env.MONGO_URI = "";
    const mis = resMock();
    await routes["/"]({}, mis);
    assert.equal(mis.statusCode, 503);
    assert.equal(mis.body.status, "misconfigured");

    for (const r of [live, ok, down, mis]) {
      const text = JSON.stringify(r.body);
      assert.ok(!text.includes(PASSWORD) && !text.includes("mongodb") && !text.includes("cluster0") && !text.includes("jjjjjjjj"), "no secrets in health output");
    }
  } finally {
    Object.assign(process.env, { MONGO_URI: env.MONGO_URI || "", JWT_SECRET: env.JWT_SECRET || "" });
    if (!env.MONGO_URI) delete process.env.MONGO_URI;
    if (!env.JWT_SECRET) delete process.env.JWT_SECRET;
  }
});

test("redact() masks credentials in any message", () => {
  assert.equal(db.redact(`failed ${GOOD}`, GOOD).includes(PASSWORD), false);
  assert.match(db.redact(`failed ${GOOD}`, GOOD), /mongodb\+srv:\/\/\*\*\*:\*\*\*@/);
  assert.equal(db.redact(`pw=${PASSWORD}`, GOOD), "pw=***");
});

test("classifyError separates retryable outages from credential problems", () => {
  assert.deepEqual([db.classifyError(authError()).code, db.classifyError(authError()).retryable], ["AUTH_FAILED", false]);
  assert.deepEqual([db.classifyError(netError()).code, db.classifyError(netError()).retryable], ["UNREACHABLE", true]);
  assert.equal(db.classifyError(new Error("querySrv ENOTFOUND _mongodb._tcp.x")).code, "DNS_LOOKUP_FAILED");
  assert.equal(db.classifyError(new Error("tlsv1 alert internal error")).code, "NETWORK_ACCESS_DENIED");
});

// ---- startup (real index.js in a child process) ----------------------------
test("server startup exits with a clear error when MONGO_URI is missing or a placeholder", (t) => {
  try {
    require.resolve("dotenv", { paths: [SERVER] });
    require.resolve("express", { paths: [SERVER] });
    require.resolve("mongoose", { paths: [SERVER] });
  } catch {
    return t.skip("server dependencies not installed (run npm install)");
  }
  const os = require("os");
  const cwd = require("fs").mkdtempSync(path.join(os.tmpdir(), "esg-noenv-")); // no .env here
  const base = { PATH: process.env.PATH, JWT_SECRET: "x".repeat(64), PORT: "0", NODE_ENV: "test" };
  const run = (env) => spawnSync(process.execPath, [path.join(SERVER, "index.js")], { cwd, env: { ...base, ...env }, encoding: "utf8", timeout: 15000 });
  const missing = run({});
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /MONGO_URI is not set/);
  const placeholder = run({ MONGO_URI: `mongodb+srv://user:<password>@<cluster>.mongodb.net/x` });
  assert.equal(placeholder.status, 1);
  assert.match(placeholder.stderr, /placeholders/);
  const tlsOff = run({ MONGO_URI: `mongodb+srv://u:${PASSWORD}@c.mongodb.net/x?tls=false` });
  assert.equal(tlsOff.status, 1);
  assert.ok(!(tlsOff.stdout + tlsOff.stderr).includes(PASSWORD), "startup output never prints the password");
});
