/**
 * Verifies a MongoDB connection string WITHOUT printing it.
 *
 * Use it before and after a credential rotation:
 *
 *   npm run db:verify                       # checks MONGO_URI from server/.env
 *   npm run db:verify -- --candidate        # asks for a NEW connection string (hidden input)
 *   npm run db:verify -- --candidate --write-check
 *
 * --candidate    Reads the URI to test from a hidden prompt (or the
 *                MONGO_URI_CANDIDATE variable) so it never lands in shell history
 *                or in .env before it is proven to work.
 * --write-check  Also inserts and deletes one document in the "_connection_checks"
 *                collection to prove the user can write. No application data is touched.
 * --json         Machine-readable output.
 *
 * Output: validation result, connect/ping latency, the user's role NAMES and a
 * least-privilege warning. Never the URI, user name, password or host.
 * Exit code 0 = usable, 1 = not usable.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const db = require("../config/db");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const BROAD_ROLES = new Set(["root", "atlasAdmin", "readWriteAnyDatabase", "dbAdminAnyDatabase", "userAdminAnyDatabase", "clusterAdmin", "dbOwner", "userAdmin"]);

function promptHidden(question) {
  return new Promise((resolve) => {
    if (process.env.MONGO_URI_CANDIDATE) return resolve(process.env.MONGO_URI_CANDIDATE);
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function (s) {
      if (!rl.stdoutMuted || s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const report = { target: args.has("--candidate") ? "candidate" : "MONGO_URI", ok: false, steps: [] };
  const step = (name, ok, extra = {}) => {
    report.steps.push({ name, ok, ...extra });
    if (!asJson) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${Object.keys(extra).length ? "  " + JSON.stringify(extra) : ""}`);
  };

  const uri = args.has("--candidate") ? await promptHidden("Paste the NEW MongoDB connection string (input hidden): ") : process.env.MONGO_URI;
  const v = db.validateMongoUri(uri);
  step("connection string format", v.ok, v.ok ? { scheme: v.info.scheme, warnings: v.warnings } : { errors: v.errors });
  if (!v.ok) return finish(report);

  try {
    const t0 = Date.now();
    await db.connectDB({ uri, retries: 0, options: { serverSelectionTimeoutMS: 15000 } });
    step("connect + authenticate", true, { ms: Date.now() - t0, database: mongoose.connection.name });
  } catch (err) {
    step("connect + authenticate", false, { code: err.code, hint: err.message });
    return finish(report);
  }

  const ping = await db.pingDB(5000);
  step("ping", ping.ok, { latencyMs: ping.latencyMs });

  try {
    const status = await mongoose.connection.db.admin().command({ connectionStatus: 1 });
    const roles = (status.authInfo && status.authInfo.authenticatedUserRoles) || [];
    const roleNames = roles.map((r) => `${r.role}@${r.db}`);
    const broad = roles.filter((r) => BROAD_ROLES.has(r.role)).map((r) => r.role);
    step("database user roles", true, { roles: roleNames });
    if (broad.length) {
      report.leastPrivilegeWarning = `This user has broad roles (${broad.join(", ")}). The app only needs readWrite on "${mongoose.connection.name}".`;
      if (!asJson) console.warn(`WARN  ${report.leastPrivilegeWarning}`);
    }
  } catch {
    step("database user roles", true, { roles: "not visible to this user (fine)" });
  }

  try {
    const n = await mongoose.connection.db.collection("users").estimatedDocumentCount();
    step("read application data", true, { usersCollectionHasDocuments: n > 0 });
  } catch (err) {
    step("read application data", false, { code: db.classifyError(err).code });
  }

  if (args.has("--write-check")) {
    try {
      const col = mongoose.connection.db.collection("_connection_checks");
      const { insertedId } = await col.insertOne({ at: new Date(), purpose: "credential rotation verification" });
      await col.deleteOne({ _id: insertedId });
      step("write permission (temporary document)", true);
    } catch (err) {
      step("write permission (temporary document)", false, { code: db.classifyError(err).code });
    }
  }

  report.ok = report.steps.every((s) => s.ok);
  return finish(report);
}

async function finish(report) {
  report.ok = report.steps.length > 0 && report.steps.every((s) => s.ok);
  db.log(report.ok ? "info" : "error", "credential_verification", { target: report.target, ok: report.ok, failed: report.steps.filter((s) => !s.ok).map((s) => s.name) });
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else console.log(report.ok ? "\nRESULT: this connection string works." : "\nRESULT: do NOT use this connection string yet.");
  await db.closeDB().catch(() => {});
  process.exit(report.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Verification crashed:", db.redact(err && err.message));
  await db.closeDB().catch(() => {});
  process.exit(1);
});
