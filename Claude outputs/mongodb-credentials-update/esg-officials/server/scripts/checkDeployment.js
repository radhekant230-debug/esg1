/**
 * Post-deploy / post-rotation check against a running backend (e.g. Render).
 *
 *   HEALTH_URL=https://<your-service>.onrender.com npm run health:check
 *
 * 1. Waits (up to CHECK_TIMEOUT_SEC, default 300) for GET /api/health to report ready.
 * 2. Confirms the health response does not contain anything that looks like a secret.
 * 3. Optional API smoke tests — only if you provide TEST accounts (never production
 *    admin passwords in CI):
 *      SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD     -> GET /api/admin/overview
 *      SMOKE_MANAGER_EMAIL / SMOKE_MANAGER_PASSWORD -> GET /api/sales/businesses, /api/planner/summary
 *      SMOKE_CLIENT_EMAIL / SMOKE_CLIENT_PASSWORD   -> GET /api/portal/profile, /api/portal/analytics/monthly
 *
 * Exit code 0 = healthy, 1 = not healthy (roll back — see docs/MONGODB_CREDENTIALS.md).
 * Uses the global fetch of Node 18+.
 */
require("dotenv").config();

const base = String(process.env.HEALTH_URL || process.argv[2] || "http://localhost:5000").replace(/\/+$/, "");
const timeoutSec = Number(process.env.CHECK_TIMEOUT_SEC) || 300;
// A connection string, a password field, or a long hex/base64 blob would be a leak.
const SECRETISH = /mongodb(\+srv)?:\/\/|"password"\s*:|"uri"\s*:|[A-Fa-f0-9]{48,}|[A-Za-z0-9+/]{60,}={0,2}/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const report = (ok, name, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

async function getJson(path, token) {
  const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body, text };
}

async function waitReady() {
  const until = Date.now() + timeoutSec * 1000;
  let last = null;
  while (Date.now() < until) {
    try {
      last = await getJson("/api/health");
      if (last.status === 200 && last.body && last.body.ready) return last;
    } catch (e) {
      last = { status: 0, body: { status: `unreachable (${e.cause ? e.cause.code || e.message : e.message})` } };
    }
    process.stdout.write(`… waiting for readiness (status ${last.status} ${last.body ? last.body.status : ""})\n`);
    await sleep(5000);
  }
  return last;
}

async function smoke(role, emailVar, passVar, portal, paths) {
  const email = process.env[emailVar];
  const password = process.env[passVar];
  if (!email || !password) return console.log(`SKIP  ${role} API smoke test (set ${emailVar} / ${passVar} to a TEST account)`);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, portal }),
  });
  const body = await res.json().catch(() => ({}));
  report(res.status === 200 && Boolean(body.token), `${role} login`, `HTTP ${res.status}`);
  if (!body.token) return;
  for (const p of paths) {
    const r = await getJson(p, body.token);
    report(r.status === 200, `${role} GET ${p}`, `HTTP ${r.status}`);
  }
}

(async () => {
  console.log(`Checking ${base}`);
  const live = await getJson("/api/health/live").catch(() => ({ status: 0 }));
  report(live.status === 200, "liveness /api/health/live", `HTTP ${live.status}`);

  const ready = await waitReady();
  report(Boolean(ready && ready.status === 200 && ready.body && ready.body.ready), "readiness /api/health (database connected)",
    ready && ready.body ? `status=${ready.body.status} db=${ready.body.checks ? ready.body.checks.database.status : "?"} latencyMs=${ready.body.checks ? ready.body.checks.database.latencyMs : "?"}` : "");
  report(!(ready && SECRETISH.test(ready.text || "")), "health response contains no secrets");

  await smoke("admin", "SMOKE_ADMIN_EMAIL", "SMOKE_ADMIN_PASSWORD", "admin", ["/api/admin/overview"]);
  await smoke("manager", "SMOKE_MANAGER_EMAIL", "SMOKE_MANAGER_PASSWORD", "manager", ["/api/sales/businesses", "/api/planner/summary"]);
  await smoke("client", "SMOKE_CLIENT_EMAIL", "SMOKE_CLIENT_PASSWORD", "client", ["/api/portal/profile", "/api/portal/analytics/monthly"]);

  console.log(failures ? `\nRESULT: ${failures} check(s) failed — follow the rollback steps.` : "\nRESULT: deployment healthy.");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("Check crashed:", e.message);
  process.exit(1);
});
