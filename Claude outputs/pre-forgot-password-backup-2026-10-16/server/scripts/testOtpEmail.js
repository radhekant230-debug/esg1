/**
 * Sends one test sign-in email through Resend and prints Resend's actual
 * response. Reads RESEND_API_KEY, EMAIL_FROM and EMAIL_TEST_RECIPIENT from
 * server/.env; never prints the key. The code in the email is random and
 * cannot be used to sign in.
 *
 *   node scripts/testOtpEmail.js                      # sends to EMAIL_TEST_RECIPIENT
 *   node scripts/testOtpEmail.js radhekant230@gmail.com
 */
require("dotenv").config();
const { sendOTPEmail } = require("../utils/email");
const { generateOtp } = require("../services/auth/loginOtp");

const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, "").trim();

(async () => {
  const key = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.EMAIL_FROM) || "ESG Officials <onboarding@resend.dev> (default)";
  const testOnly = clean(process.env.EMAIL_TEST_RECIPIENT);
  const to = clean(process.argv[2]) || testOnly;

  console.log(`RESEND_API_KEY:       ${key ? `set (${key.length} chars, ${key.startsWith("re_") ? "starts with re_" : "does NOT start with re_ — check it"})` : "MISSING"}`);
  console.log(`EMAIL_FROM:           ${from}`);
  console.log(`EMAIL_TEST_RECIPIENT: ${testOnly || "(not set — test-mode restriction is off)"}`);
  if (!to) throw new Error("No recipient: pass one or set EMAIL_TEST_RECIPIENT.");
  console.log(`Sending to:           ${to}\n`);

  const data = await sendOTPEmail(to, generateOtp(), "login");
  console.log(`RESULT: Resend ACCEPTED the email. Message id: ${data && data.id ? data.id : "(none returned)"}`);
  console.log("Check the inbox (and spam) of", to);
})().catch((e) => {
  console.error(`RESULT: NOT sent — ${e.message}`);
  if (e.resend) console.error(`Resend error: ${e.resend.name || "?"} (HTTP ${e.resend.statusCode || "?"})`);
  console.error("Hints: 401/403 → wrong or revoked key; 'validation_error' about testing emails → onboarding@resend.dev can only send to your Resend account email.");
  process.exitCode = 1;
});
