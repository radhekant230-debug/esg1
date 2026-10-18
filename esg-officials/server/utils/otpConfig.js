/**
 * OTP settings from server/.env, validated with safe bounds:
 *   OTP_EXPIRY_MINUTES  1–60, default 10
 *   OTP_LENGTH          4–8,  default 6
 */
const intIn = (raw, min, max, fallback) => {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

const otpConfig = () => {
  const expiryMinutes = intIn(process.env.OTP_EXPIRY_MINUTES, 1, 60, 10);
  const length = intIn(process.env.OTP_LENGTH, 4, 8, 6);
  return { expiryMinutes, ttlMs: expiryMinutes * 60 * 1000, length };
};

module.exports = { otpConfig };
