/**
 * Forgot password: email a one-time code to the registered address, then let
 * the holder of that code set a new password.
 *
 * - Same code rules as sign-in codes (hashed, expiring, 5 attempts, single use,
 *   60 s resend cooldown, identical answer for unknown emails).
 * - The new password is hashed with the app's existing bcrypt setting.
 * - On success every outstanding reset code and sign-in code for the account is
 *   deleted.
 */
const { createEmailOtp } = require("./loginOtp");

const MIN_PASSWORD_LENGTH = 8;

function validatePassword(pw) {
  const p = String(pw || "");
  if (p.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (p.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password must contain letters and numbers.";
  return null;
}

function createPasswordReset({ User, OTP, hash, compare, hashPassword, sendEmail, now, log }) {
  const otp = createEmailOtp({ action: "password_reset", User, OTP, hash, compare, sendEmail, now, log });

  async function reset({ email, otp: code, newPassword }) {
    const problem = validatePassword(newPassword);
    if (problem) return { ok: false, error: "weak_password", message: problem };

    const r = await otp.verify({ email, otp: code });
    if (!r.ok) return r;

    r.user.password = await hashPassword(String(newPassword));
    await r.user.save();
    await OTP.deleteMany({ email: r.user.email, action: { $in: ["password_reset", "login"] } });
    return { ok: true, user: r.user };
  }

  return { request: otp.request, reset };
}

module.exports = { createPasswordReset, validatePassword, MIN_PASSWORD_LENGTH };
