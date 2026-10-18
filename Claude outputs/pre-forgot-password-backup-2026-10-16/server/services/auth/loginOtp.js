/**
 * Passwordless sign-in with a six-digit code sent by email.
 *
 * - The code is generated with crypto.randomInt and stored only as a bcrypt hash
 *   (OTP collection, action "login").
 * - It expires after five minutes (checked in the query and by the TTL index).
 * - Five wrong attempts burn the code; each attempt is claimed atomically before
 *   the comparison, so parallel guesses cannot exceed the limit.
 * - Requesting a new code deletes every earlier login code for that email.
 * - Callers always get the same answer whether or not the email exists.
 */
const crypto = require("crypto");

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
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

function createLoginOtp({ User, OTP, hash, compare, sendEmail, now = () => Date.now(), log = console }) {
  /** Returns { sent, reason } — the reason is for server logs only, never for the response. */
  async function request({ email, portal }) {
    const addr = normalizeEmail(email);
    if (!EMAIL_RE.test(addr)) return { sent: false, reason: "invalid_email", invalidInput: true };

    const user = await User.findOne({ email: addr });
    if (!user) return { sent: false, reason: "unknown_email" };
    if (!user.isActive) return { sent: false, reason: "inactive" };
    if (!portalAllows(portal, user.role)) return { sent: false, reason: "wrong_portal" };
    if (addr.endsWith(".invalid")) return { sent: false, reason: "no_mailbox" };

    const last = await OTP.findOne({ email: addr, action: "login" }).sort({ createdAt: -1 });
    if (last && now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_MS) return { sent: false, reason: "cooldown" };

    const code = generateOtp();
    const otpHash = await hash(code);
    await OTP.deleteMany({ email: addr, action: "login" }); // invalidate earlier codes
    const rec = await OTP.create({ email: addr, otp: otpHash, action: "login", attempts: 0, createdAt: new Date(now()) });
    try {
      await sendEmail(addr, code, "login");
    } catch (err) {
      await OTP.deleteMany({ _id: rec._id });
      log.error(`[login-otp] email delivery failed: ${err.message}`);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true, reason: "sent" };
  }

  /** Returns { ok, user } or { ok:false, error: "invalid" | "too_many" | "account" }. */
  async function verify({ email, otp, portal }) {
    const addr = normalizeEmail(email);
    const code = String(otp || "").trim();
    if (!EMAIL_RE.test(addr) || !/^\d{6}$/.test(code)) return { ok: false, error: "invalid" };

    const fresh = { email: addr, action: "login", createdAt: { $gt: new Date(now() - OTP_TTL_MS) } };
    // claim one attempt atomically before comparing
    const rec = await OTP.findOneAndUpdate({ ...fresh, attempts: { $lt: MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true });
    if (!rec) {
      const exhausted = await OTP.findOne({ ...fresh, attempts: { $gte: MAX_ATTEMPTS } });
      if (exhausted) {
        await OTP.deleteMany({ email: addr, action: "login" });
        return { ok: false, error: "too_many" };
      }
      return { ok: false, error: "invalid" };
    }

    const match = await compare(code, rec.otp);
    if (!match) {
      if (rec.attempts >= MAX_ATTEMPTS) {
        await OTP.deleteMany({ email: addr, action: "login" });
        return { ok: false, error: "too_many" };
      }
      return { ok: false, error: "invalid", remaining: MAX_ATTEMPTS - rec.attempts };
    }

    await OTP.deleteMany({ email: addr, action: "login" }); // single use

    const user = await User.findOne({ email: addr });
    if (!user || !user.isActive || !portalAllows(portal, user.role)) return { ok: false, error: "account" };
    if (user.role === "client" && !user.isVerified) user.isVerified = true; // the code proves the mailbox
    user.lastLogin = new Date(now());
    await user.save();
    return { ok: true, user };
  }

  return { request, verify };
}

module.exports = { createLoginOtp, generateOtp, portalAllows, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS };
