/**
 * Email diagnostics. Never prints the API key or any code.
 *
 *   # 1. Configuration only (no email, no database)
 *   node scripts/testOtpEmail.js --check
 *
 *   # 2. Does an account exist for this email? (read-only database lookup)
 *   node scripts/testOtpEmail.js --check-account someone@example.com
 *
 *   # 3. Real forgot-password test: only if the account exists, runs the actual
 *   #    reset-request flow once (stores a hashed code, sends ONE email) and
 *   #    prints Resend's response
 *   node scripts/testOtpEmail.js --forgot-password someone@example.com
 *
 *   # 4. Plain delivery test with a throwaway code (no database)
 *   node scripts/testOtpEmail.js --send someone@example.com
 */
require("dotenv").config();
const email = require("../utils/email");
const { generateOtp, normalizeEmail } = require("../services/auth/loginOtp");
const { otpConfig } = require("../utils/otpConfig");

const argv = process.argv.slice(2);
const mode = argv[0] || "--check";
const target = normalizeEmail(argv[1]);
const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, "").trim();

function printConfig() {
  const key = clean(process.env.RESEND_API_KEY);
  const c = otpConfig();
  console.log(`RESEND_API_KEY:     ${key ? `set (${key.length} chars${key.startsWith("re_") ? "" : ", does NOT start with re_"})` : "MISSING"}`);
  console.log(`EMAIL_FROM:         ${clean(process.env.EMAIL_FROM) || "(not set, default ESG Officials <noreply@esgofficials.com>)"}`);
  console.log(`EMAIL_TEST_RECIPIENT: ${clean(process.env.EMAIL_TEST_RECIPIENT) || "(not set — no test restriction)"}`);
  console.log(`OTP:                ${c.length} digits, expires in ${c.expiryMinutes} min`);
  const cu = clean(process.env.CLIENT_URL);
  if (cu && !/^https?:\/\//.test(cu.split(",")[0])) console.log(`CLIENT_URL:         "${cu}" is not a URL — it must be the frontend address (e.g. https://your-app.vercel.app); CORS uses it`);
  const problems = email.checkEmailConfig();
  problems.forEach((p) => console.log(`WARNING: ${p}`));
  return problems;
}

function printResendError(e) {
  console.log(`RESULT: NOT accepted — ${e.message}`);
  if (e.resend) console.log(`Resend error: name=${e.resend.name || "?"} HTTP=${e.resend.statusCode || "?"}`);
  if (e.code === "EMAIL_CONFIG") console.log("Fix EMAIL_FROM in server/.env; nothing was sent to Resend.");
  if (e.code === "TEST_RECIPIENT_ONLY") console.log("Blocked by EMAIL_TEST_RECIPIENT; nothing was sent to Resend.");
}

async function withDb(fn) {
  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  try {
    return await fn();
  } finally {
    await mongoose.disconnect();
  }
}

(async () => {
  console.log("== Email configuration ==");
  printConfig();
  if (mode === "--check") return;
  if (!target) throw new Error("Pass an email address after the mode.");

  if (mode === "--send") {
    console.log(`\n== Sending one test email to ${email.maskEmail(target)} ==`);
    try {
      const data = await email.sendOTPEmail(target, generateOtp(), "login");
      console.log(`RESULT: Resend ACCEPTED the request (HTTP 200). Message id: ${data && data.id ? data.id : "(none)"}`);
      console.log("Accepted is not delivered: check Resend dashboard > Emails for this id (Delivered / Bounced).");
    } catch (e) {
      printResendError(e);
      process.exitCode = 1;
    }
    return;
  }

  await withDb(async () => {
    const User = require("../models/User");
    const u = await User.findOne({ email: target }).select("role isActive isVerified").lean();
    console.log(`\n== Account lookup ==`);
    if (!u) {
      console.log(`No account is registered with ${email.maskEmail(target)}. Nothing was sent.`);
      console.log("Create an authorized test account via Admin -> Clients (or Managers) using this email, then re-run.");
      process.exitCode = 2;
      return;
    }
    console.log(`Account found: role=${u.role}, active=${u.isActive}, verified=${u.isVerified}`);
    if (mode === "--check-account") return;
    if (!u.isActive) {
      console.log("The account is disabled, so no reset email would be sent. Nothing was sent.");
      process.exitCode = 2;
      return;
    }

    if (mode === "--forgot-password") {
      // run the real reset-request flow, but capture Resend's answer
      const bcrypt = require("bcryptjs");
      const OTP = require("../models/OTP");
      const { createPasswordReset } = require("../services/auth/passwordReset");
      let response = null;
      let failure = null;
      const svc = createPasswordReset({
        User,
        OTP,
        hash: (c) => bcrypt.hash(c, 10),
        compare: (c, h) => bcrypt.compare(c, h),
        hashPassword: (p) => bcrypt.hash(p, 10),
        sendEmail: async (to, code, type) => {
          try {
            response = await email.sendOTPEmail(to, code, type);
            return response;
          } catch (e) {
            failure = e;
            throw e;
          }
        },
        log: { error() {} },
      });
      console.log(`\n== Forgot-password request for ${email.maskEmail(target)} ==`);
      const r = await svc.request({ email: target });
      if (r.sent) {
        console.log(`RESULT: Resend ACCEPTED the request (HTTP 200). Message id: ${response && response.id ? response.id : "(none)"}`);
        console.log("Accepted is not delivered: check Resend dashboard > Emails for this id (Delivered / Bounced).");
        console.log("The code in that email works on the Forgot password page for the configured expiry time.");
      } else if (failure) {
        printResendError(failure);
        process.exitCode = 1;
      } else {
        console.log(`RESULT: not sent (${r.reason}). ${r.reason === "cooldown" ? "Wait 60 seconds and try again." : ""}`);
        process.exitCode = 1;
      }
      return;
    }
    throw new Error(`Unknown mode ${mode}`);
  });
})().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
});
