/**
 * Email one-time codes (sign-in and password reset share this engine).
 *
 * - Codes come from crypto.randomInt and are stored only as bcrypt hashes in the
 *   OTP collection, with an expiry time (OTP_EXPIRY_MINUTES, default 10).
 * - A wrong guess uses one of 5 attempts; each attempt is claimed atomically
 *   before comparing, so parallel guesses cannot exceed the limit.
 * - Requesting a new code deletes earlier codes of the same kind; a 60 s cooldown
 *   applies between requests.
 * - A used code is deleted (single use).
 * - Callers get the same answer whether or not the email exists.
 */
const crypto = require("crypto");
const { otpConfig } = require("../../utils/otpConfig");

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateOtp = (length = otpConfig().length) => String(crypto.randomInt(0, 10 ** length)).padStart(length, "0");
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

/** Same portal rules as the password login. */
function portalAllows(portal, role) {
  if (!portal) return true;
  const p = String(portal).toLowerCase().trim();
  if (p === "admin") return role === "admin";
  if (p === "manager") return role === "manager" || role === "admin";
  if (p === "client") return role === "client";
  return true;
}

function createEmailOtp({ action, User, OTP, hash, compare, sendEmail, now = () => Date.now(), log = console, config = otpConfig }) {
  const settings = () => config();

  async function request({ email, portal }) {
    const addr = normalizeEmail(email);
    if (!EMAIL_RE.test(addr)) return { sent: false, reason: "invalid_email", invalidInput: true };

    const user = await User.findOne({ email: addr });
    if (!user) return { sent: false, reason: "unknown_email" };
    if (!user.isActive) return { sent: false, reason: "inactive" };
    if (!portalAllows(portal, user.role)) return { sent: false, reason: "wrong_portal" };
    if (addr.endsWith(".invalid")) return { sent: false, reason: "no_mailbox" };

    const last = await OTP.findOne({ email: addr, action }).sort({ createdAt: -1 });
    if (last && now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_MS) return { sent: false, reason: "cooldown" };

    const { ttlMs, length } = settings();
    const code = generateOtp(length);
    const otpHash = await hash(code);
    await OTP.deleteMany({ email: addr, action }); // invalidate earlier codes
    const issued = new Date(now());
    const rec = await OTP.create({ email: addr, otp: otpHash, action, attempts: 0, createdAt: issued, expiresAt: new Date(issued.getTime() + ttlMs) });
    try {
      await sendEmail(addr, code, action);
    } catch (err) {
      await OTP.deleteMany({ _id: rec._id });
      log.error(`[otp:${action}] email delivery failed: ${err.message}`);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true, reason: "sent" };
  }

  /** { ok:true, user } or { ok:false, error: "invalid" | "too_many" | "account", remaining? }. Does not consume on failure. */
  async function verify({ email, otp, portal, consume = true }) {
    const addr = normalizeEmail(email);
    const code = String(otp || "").trim();
    const { ttlMs, length } = settings();
    if (!EMAIL_RE.test(addr) || !new RegExp(`^\\d{${length}}$`).test(code)) return { ok: false, error: "invalid" };

    const fresh = { email: addr, action, createdAt: { $gt: new Date(now() - ttlMs) } };
    const rec = await OTP.findOneAndUpdate({ ...fresh, attempts: { $lt: MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true });
    if (!rec) {
      const exhausted = await OTP.findOne({ ...fresh, attempts: { $gte: MAX_ATTEMPTS } });
      if (exhausted) {
        await OTP.deleteMany({ email: addr, action });
        return { ok: false, error: "too_many" };
      }
      return { ok: false, error: "invalid" };
    }

    const match = await compare(code, rec.otp);
    if (!match) {
      if (rec.attempts >= MAX_ATTEMPTS) {
        await OTP.deleteMany({ email: addr, action });
        return { ok: false, error: "too_many" };
      }
      return { ok: false, error: "invalid", remaining: MAX_ATTEMPTS - rec.attempts };
    }

    if (consume) await OTP.deleteMany({ email: addr, action }); // single use

    const user = await User.findOne({ email: addr });
    if (!user || !user.isActive || !portalAllows(portal, user.role)) return { ok: false, error: "account" };
    return { ok: true, user };
  }

  return { request, verify };
}

/** Passwordless sign-in. */
function createLoginOtp(deps) {
  const otp = createEmailOtp({ ...deps, action: "login" });
  const now = deps.now || (() => Date.now());
  return {
    request: otp.request,
    async verify(args) {
      const r = await otp.verify(args);
      if (!r.ok) return r;
      if (r.user.role === "client" && !r.user.isVerified) r.user.isVerified = true; // the code proves the mailbox
      r.user.lastLogin = new Date(now());
      await r.user.save();
      return r;
    },
  };
}

module.exports = { createEmailOtp, createLoginOtp, generateOtp, portalAllows, normalizeEmail, MAX_ATTEMPTS, RESEND_COOLDOWN_MS };
