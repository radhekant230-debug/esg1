const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createLoginOtp, generateOtp, MAX_ATTEMPTS } = require("../../services/auth/loginOtp");

// ---- in-memory stand-ins for the User and OTP models ----
function makeWorld() {
  let clock = Date.parse("2026-10-16T10:00:00Z");
  const now = () => clock;
  const advance = (ms) => (clock += ms);
  let seq = 0;
  const otps = [];
  const sent = [];
  const users = [
    { _id: "u-client", email: "radhekant230@gmail.com", role: "client", isActive: true, isVerified: false },
    { _id: "u-admin", email: "admin@esg.com", role: "admin", isActive: true, isVerified: true },
    { _id: "u-off", email: "off@esg.com", role: "manager", isActive: false, isVerified: true },
    { _id: "u-maya", email: "maya-2040.biz@client-portal.invalid", role: "client", isActive: true, isVerified: true },
  ].map((u) => ({ ...u, async save() { this.saved = true; } }));

  const cmp = (v, c) => {
    if (c && typeof c === "object" && !(c instanceof Date)) {
      return Object.entries(c).every(([op, a]) =>
        op === "$gt" ? v > a : op === "$lt" ? v < a : op === "$gte" ? v >= a : op === "$lte" ? v <= a : false
      );
    }
    return String(v) === String(c);
  };
  const match = (d, f) => Object.entries(f).every(([k, c]) => cmp(d[k], c));
  const query = (result) => ({ sort: async () => result, then: (res, rej) => Promise.resolve(result).then(res, rej) });

  const OTP = {
    findOne(f) {
      const list = otps.filter((o) => match(o, f)).sort((a, b) => b.createdAt - a.createdAt);
      return query(list[0] || null);
    },
    async create(doc) {
      const d = { _id: `o${++seq}`, attempts: 0, ...doc };
      otps.push(d);
      return d;
    },
    async deleteMany(f) {
      for (let i = otps.length - 1; i >= 0; i--) if (match(otps[i], f)) otps.splice(i, 1);
    },
    async findOneAndUpdate(f, u) {
      const d = otps.find((o) => match(o, f));
      if (!d) return null;
      d.attempts += u.$inc.attempts;
      return { ...d };
    },
  };
  const User = { findOne: async (f) => users.find((u) => match(u, f)) || null };
  const hash = async (c) => crypto.createHash("sha256").update(`salt:${c}`).digest("hex");
  const compare = async (c, h) => (await hash(c)) === h;
  const sendEmail = async (to, code, type) => sent.push({ to, code, type });
  const svc = createLoginOtp({ User, OTP, hash, compare, sendEmail, now, log: { error() {} } });
  return { svc, otps, sent, users, advance };
}

test("codes are six random digits", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const c = generateOtp();
    assert.match(c, /^\d{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 190, "codes should not repeat in a small sample");
});

test("request: sends to a known active user and stores only a hash", async () => {
  const w = makeWorld();
  const r = await w.svc.request({ email: " RadheKant230@gmail.com " });
  assert.equal(r.sent, true);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].to, "radhekant230@gmail.com");
  assert.equal(w.sent[0].type, "login");
  assert.equal(w.otps.length, 1);
  assert.notEqual(w.otps[0].otp, w.sent[0].code, "plaintext code is never stored");
  assert.match(w.otps[0].otp, /^[0-9a-f]{64}$/);
});

test("request: unknown, inactive, wrong-portal and mailbox-less accounts get nothing sent", async () => {
  const w = makeWorld();
  assert.equal((await w.svc.request({ email: "nobody@x.com" })).sent, false);
  assert.equal((await w.svc.request({ email: "off@esg.com" })).sent, false);
  assert.equal((await w.svc.request({ email: "admin@esg.com", portal: "client" })).sent, false);
  assert.equal((await w.svc.request({ email: "maya-2040.biz@client-portal.invalid" })).sent, false);
  assert.equal((await w.svc.request({ email: "not-an-email" })).invalidInput, true);
  assert.equal(w.sent.length, 0);
});

test("resend: blocked for 60 s, then the new code replaces the old one", async () => {
  const w = makeWorld();
  await w.svc.request({ email: "radhekant230@gmail.com" });
  const first = w.sent[0].code;
  assert.equal((await w.svc.request({ email: "radhekant230@gmail.com" })).reason, "cooldown");
  w.advance(61 * 1000);
  await w.svc.request({ email: "radhekant230@gmail.com" });
  assert.equal(w.otps.length, 1, "previous code invalidated");
  const second = w.sent[1].code;
  if (first !== second) assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: first })).ok, false);
  assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: second })).ok, true);
});

test("verify: correct code logs in once, marks the client verified, and cannot be reused", async () => {
  const w = makeWorld();
  await w.svc.request({ email: "radhekant230@gmail.com", portal: "client" });
  const code = w.sent[0].code;
  const r = await w.svc.verify({ email: "radhekant230@gmail.com", otp: code, portal: "client" });
  assert.equal(r.ok, true);
  assert.equal(r.user._id, "u-client");
  assert.equal(r.user.isVerified, true);
  assert.ok(r.user.lastLogin);
  assert.equal(w.otps.length, 0);
  assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: code })).ok, false, "single use");
});

test("verify: expires after five minutes", async () => {
  const w = makeWorld();
  await w.svc.request({ email: "radhekant230@gmail.com" });
  w.advance(5 * 60 * 1000 + 1);
  const r = await w.svc.verify({ email: "radhekant230@gmail.com", otp: w.sent[0].code });
  assert.deepEqual([r.ok, r.error], [false, "invalid"]);
});

test("verify: five wrong attempts burn the code, even the right one afterwards", async () => {
  const w = makeWorld();
  await w.svc.request({ email: "radhekant230@gmail.com" });
  const code = w.sent[0].code;
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    const r = await w.svc.verify({ email: "radhekant230@gmail.com", otp: wrong });
    assert.equal(r.remaining, MAX_ATTEMPTS - i);
  }
  assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: wrong })).error, "too_many");
  assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: code })).ok, false);
  assert.equal(w.otps.length, 0);
});

test("verify: malformed input and wrong portal are rejected", async () => {
  const w = makeWorld();
  assert.equal((await w.svc.verify({ email: "radhekant230@gmail.com", otp: "12345" })).error, "invalid");
  assert.equal((await w.svc.verify({ email: "x", otp: "123456" })).error, "invalid");
  await w.svc.request({ email: "radhekant230@gmail.com" });
  const r = await w.svc.verify({ email: "radhekant230@gmail.com", otp: w.sent[0].code, portal: "admin" });
  assert.deepEqual([r.ok, r.error], [false, "account"]);
});

test("send failure removes the stored code", async () => {
  const w = makeWorld();
  const svc = createLoginOtp({
    User: { findOne: async () => w.users[0] },
    OTP: { findOne: () => ({ sort: async () => null }), create: async (d) => (w.otps.push({ _id: "x", ...d }), { _id: "x" }), deleteMany: async () => w.otps.splice(0) },
    hash: async () => "h",
    compare: async () => false,
    sendEmail: async () => {
      throw new Error("domain not verified");
    },
    log: { error() {} },
  });
  const r = await svc.request({ email: "radhekant230@gmail.com" });
  assert.deepEqual([r.sent, r.reason], [false, "send_failed"]);
  assert.equal(w.otps.length, 0);
});

test("rate limiter returns 429 with Retry-After after the limit", async () => {
  const { rateLimit } = require("../../utils/rateLimit");
  const mw = rateLimit({ name: "t", windowMs: 60000, max: 2 });
  const req = { ip: "1.2.3.4" };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = 0;
  for (let i = 0; i < 3; i++) mw(req, res, () => passed++);
  assert.equal(passed, 2);
  assert.equal(res.code, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
});
