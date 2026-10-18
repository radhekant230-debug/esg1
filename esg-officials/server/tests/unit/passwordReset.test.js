const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createPasswordReset, validatePassword } = require("../../services/auth/passwordReset");

// In-memory User / OTP stand-ins (same query shapes as Mongoose)
function world({ sendFails = false } = {}) {
  let clock = Date.parse("2026-10-16T10:00:00Z");
  const now = () => clock;
  const advance = (ms) => (clock += ms);
  const otps = [];
  const sent = [];
  const logs = [];
  const users = [
    { _id: "u1", email: "client@example.com", role: "client", isActive: true, password: "OLD-HASH" },
    { _id: "u2", email: "off@example.com", role: "client", isActive: false, password: "OLD-HASH-2" },
  ].map((u) => ({ ...u, async save() { this.saved = (this.saved || 0) + 1; } }));
  const cmp = (v, c) =>
    c && typeof c === "object" && !(c instanceof Date)
      ? Object.entries(c).every(([op, a]) => (op === "$gt" ? v > a : op === "$lt" ? v < a : op === "$gte" ? v >= a : op === "$in" ? a.includes(v) : false))
      : String(v) === String(c);
  const match = (d, f) => Object.entries(f).every(([k, c]) => cmp(d[k], c));
  const q = (r) => ({ sort: async () => r, then: (a, b) => Promise.resolve(r).then(a, b) });
  let seq = 0;
  const OTP = {
    findOne: (f) => q(otps.filter((o) => match(o, f)).sort((a, b) => b.createdAt - a.createdAt)[0] || null),
    create: async (d) => (otps.push({ _id: `o${++seq}`, ...d }), otps[otps.length - 1]),
    deleteMany: async (f) => {
      for (let i = otps.length - 1; i >= 0; i--) if (match(otps[i], f)) otps.splice(i, 1);
    },
    findOneAndUpdate: async (f, u) => {
      const d = otps.find((o) => match(o, f));
      if (!d) return null;
      d.attempts += u.$inc.attempts;
      return { ...d };
    },
  };
  const User = { findOne: async (f) => users.find((u) => match(u, f)) || null };
  const hash = async (c) => crypto.createHash("sha256").update(`s:${c}`).digest("hex");
  const svc = createPasswordReset({
    User,
    OTP,
    hash,
    compare: async (c, h) => (await hash(c)) === h,
    hashPassword: async (p) => `bcrypt(${p})`,
    sendEmail: async (to, code, type) => {
      if (sendFails) throw Object.assign(new Error("validation_error: domain not verified"), { resend: { statusCode: 403 } });
      sent.push({ to, code, type });
      return { id: "email_1" };
    },
    now,
    log: { error: (m) => logs.push(m) },
  });
  return { svc, otps, sent, users, advance, logs };
}

test("request: sends a reset code to the registered email and stores only a hash", async () => {
  const w = world();
  const r = await w.svc.request({ email: "Client@Example.com" });
  assert.equal(r.sent, true);
  assert.deepEqual([w.sent[0].to, w.sent[0].type], ["client@example.com", "password_reset"]);
  assert.match(w.sent[0].code, /^\d{6}$/);
  assert.equal(w.otps[0].action, "password_reset");
  assert.notEqual(w.otps[0].otp, w.sent[0].code);
  assert.ok(w.otps[0].expiresAt - w.otps[0].createdAt === 10 * 60 * 1000, "10-minute expiry stored");
});

test("unknown and disabled emails: nothing sent, same outcome for the caller", async () => {
  const w = world();
  assert.equal((await w.svc.request({ email: "nobody@example.com" })).sent, false);
  assert.equal((await w.svc.request({ email: "off@example.com" })).sent, false);
  assert.equal(w.sent.length, 0);
  assert.equal(w.otps.length, 0);
});

test("Resend failure: no usable code is left behind and the code is not logged", async () => {
  const w = world({ sendFails: true });
  const r = await w.svc.request({ email: "client@example.com" });
  assert.deepEqual([r.sent, r.reason], [false, "send_failed"]);
  assert.equal(w.otps.length, 0);
  assert.ok(w.logs.join(" ").includes("domain not verified"));
  assert.ok(!/\b\d{6}\b/.test(w.logs.join(" ")), "no 6-digit code in logs");
});

test("reset: correct code changes the password (hashed) and is single use", async () => {
  const w = world();
  await w.svc.request({ email: "client@example.com" });
  const code = w.sent[0].code;
  const r = await w.svc.reset({ email: "client@example.com", otp: code, newPassword: "NewPass2026" });
  assert.equal(r.ok, true);
  assert.equal(w.users[0].password, "bcrypt(NewPass2026)");
  assert.equal(w.otps.length, 0, "all reset codes invalidated");
  const again = await w.svc.reset({ email: "client@example.com", otp: code, newPassword: "Another2026" });
  assert.equal(again.ok, false);
  assert.equal(w.users[0].password, "bcrypt(NewPass2026)");
});

test("reset: expired code is rejected", async () => {
  const w = world();
  await w.svc.request({ email: "client@example.com" });
  w.advance(10 * 60 * 1000 + 1);
  const r = await w.svc.reset({ email: "client@example.com", otp: w.sent[0].code, newPassword: "NewPass2026" });
  assert.deepEqual([r.ok, r.error], [false, "invalid"]);
  assert.equal(w.users[0].password, "OLD-HASH");
});

test("unauthorized reset attempts: no code, wrong code, another user's code, too many guesses", async () => {
  const w = world();
  // nobody requested a code
  assert.equal((await w.svc.reset({ email: "client@example.com", otp: "123456", newPassword: "NewPass2026" })).ok, false);
  await w.svc.request({ email: "client@example.com" });
  const code = w.sent[0].code;
  // the right code for a different email
  assert.equal((await w.svc.reset({ email: "off@example.com", otp: code, newPassword: "NewPass2026" })).ok, false);
  // wrong guesses until the code is burned
  const wrong = code === "000000" ? "111111" : "000000";
  let last;
  for (let i = 0; i < 5; i++) last = await w.svc.reset({ email: "client@example.com", otp: wrong, newPassword: "NewPass2026" });
  assert.equal(last.error, "too_many");
  assert.equal((await w.svc.reset({ email: "client@example.com", otp: code, newPassword: "NewPass2026" })).ok, false, "burned code no longer works");
  assert.equal(w.users[0].password, "OLD-HASH");
});

test("weak passwords are refused before the code is used", async () => {
  const w = world();
  await w.svc.request({ email: "client@example.com" });
  const r = await w.svc.reset({ email: "client@example.com", otp: w.sent[0].code, newPassword: "short" });
  assert.equal(r.error, "weak_password");
  assert.equal(w.otps.length, 1, "code still valid for a proper attempt");
  assert.equal(validatePassword("lettersonly"), "Password must contain letters and numbers.");
  assert.equal(validatePassword("Abcdef12"), null);
});

test("resend cooldown, then a new code replaces the old one", async () => {
  const w = world();
  await w.svc.request({ email: "client@example.com" });
  assert.equal((await w.svc.request({ email: "client@example.com" })).reason, "cooldown");
  w.advance(61 * 1000);
  await w.svc.request({ email: "client@example.com" });
  assert.equal(w.otps.length, 1);
  assert.equal(w.sent.length, 2);
});
