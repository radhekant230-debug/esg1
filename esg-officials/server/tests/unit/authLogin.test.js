/**
 * POST /auth/login (controllers/authController.loginUser) with in-memory users.
 * Real bcrypt and JWT; database models are replaced by fakes.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";
const PW = "Correct-Horse-42";
let users = [];
const sentOtps = [];
const makeUser = (o) => ({ _id: `u${users.length + 1}`, isActive: true, isVerified: true, async save() { this.saved = true; }, ...o });
const matches = (u, q) => q.$or.some((c) => Object.entries(c).every(([k, v]) => u[k] === v));
const fakes = {
  "models/User": {
    findOne: async (q) => users.find((u) => matches(u, q)) || null,
    findById: (id) => ({ select: async () => users.find((u) => u._id === id) || null }),
  },
  "models/OTP": { deleteMany: async () => {}, create: async () => {} },
  "utils/email": { sendOTPEmail: async (to) => sentOtps.push(to) },
};
const realLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (req.startsWith(".")) {
    const abs = path.resolve(path.dirname(parent.filename), req).replace(/\\/g, "/");
    const key = Object.keys(fakes).find((k) => abs.endsWith(`/server/${k}`) || abs.endsWith(`/server/${k}.js`));
    if (key) return fakes[key];
  }
  return realLoad.call(this, req, parent, ...rest);
};
const auth = require("../../controllers/authController");
const { protect, adminOrManager } = require("../../middlewares/auth");

const login = async (body) => {
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await auth.loginUser({ body }, res);
  return res;
};

test.before(async () => {
  const hash = await bcrypt.hash(PW, 10);
  users = [];
  users.push(makeUser({ name: "Manager", email: "manager@test.local", role: "manager", password: hash }));
  users.push(makeUser({ name: "Off", email: "off@test.local", role: "manager", password: hash, isActive: false }));
  users.push(makeUser({ name: "Unverified Mgr", email: "unv@test.local", role: "manager", password: hash, isVerified: false }));
  users.push(makeUser({ name: "Admin", email: "admin@test.local", role: "admin", password: hash }));
  users.push(makeUser({ name: "Client", email: "client@test.local", role: "client", clientId: "CLI-2026-0099", password: hash }));
  users.push(makeUser({ name: "New Client", email: "newclient@test.local", role: "client", password: hash, isVerified: false }));
});

test("1. valid manager credentials log in (email trimmed, case-insensitive) and get a working token", async () => {
  const r = await login({ email: "  Manager@Test.Local ", password: PW, portal: "manager" });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.role, "manager");
  const decoded = jwt.verify(r.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.role, "manager");
  // 8. the token opens manager routes
  const req = { headers: { authorization: `Bearer ${r.body.token}` } };
  const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  await protect(req, res, () => adminOrManager(req, res, () => (passed = true)));
  assert.equal(passed, true, JSON.stringify(res.body));
});

test("2-3. wrong password and unknown email give the same 401, revealing nothing", async () => {
  const wrong = await login({ email: "manager@test.local", password: "nope", portal: "manager" });
  const unknown = await login({ email: "ghost@test.local", password: "nope", portal: "manager" });
  assert.deepEqual([wrong.code, wrong.body.message], [401, "Invalid credentials"]);
  assert.deepEqual([unknown.code, unknown.body.message], [401, "Invalid credentials"]);
  // before the fix a wrong portal answered 403 "reserved for Clients only" without checking the password
  const probe = await login({ email: "manager@test.local", password: "nope", portal: "client" });
  assert.deepEqual([probe.code, probe.body.message], [401, "Invalid credentials"]);
  const disabledProbe = await login({ email: "off@test.local", password: "nope", portal: "manager" });
  assert.equal(disabledProbe.code, 401, "a disabled account is not revealed by a wrong password");
});

test("4. inactive manager is rejected even with the right password", async () => {
  const r = await login({ email: "off@test.local", password: PW, portal: "manager" });
  assert.equal(r.code, 403);
  assert.match(r.body.message, /disabled/);
});

test("5. unverified manager: email verification applies to clients only (existing policy)", async () => {
  const r = await login({ email: "unv@test.local", password: PW, portal: "manager" });
  assert.equal(r.code, 200);
  const c = await login({ email: "newclient@test.local", password: PW, portal: "client" });
  assert.equal(c.code, 400);
  assert.equal(c.body.requiresVerification, true);
  assert.deepEqual(sentOtps, ["newclient@test.local"]);
});

test("6. admin keeps admin access and may use the manager portal; a manager cannot use the admin portal", async () => {
  assert.equal((await login({ email: "admin@test.local", password: PW, portal: "admin" })).code, 200);
  assert.equal((await login({ email: "admin@test.local", password: PW, portal: "manager" })).code, 200);
  assert.equal((await login({ email: "manager@test.local", password: PW, portal: "admin" })).code, 403);
});

test("7. client logs in by client ID; client portal only", async () => {
  const r = await login({ clientId: "CLI-2026-0099", loginId: "CLI-2026-0099", password: PW, portal: "client" });
  assert.equal(r.code, 200);
  assert.equal(r.body.role, "client");
  assert.equal((await login({ email: "client@test.local", password: PW, portal: "manager" })).code, 403);
});

test("legacy plaintext password is accepted once and re-stored as bcrypt", async () => {
  users.push(makeUser({ name: "Legacy", email: "legacy@test.local", role: "manager", password: "old-plain-pass" }));
  const r = await login({ email: "legacy@test.local", password: "old-plain-pass", portal: "manager" });
  assert.equal(r.code, 200);
  const u = users.find((x) => x.email === "legacy@test.local");
  assert.ok(u.password.startsWith("$2"), "stored as bcrypt now");
});

test("missing fields → 400", async () => {
  assert.equal((await login({ email: "manager@test.local", portal: "manager" })).code, 400);
});
