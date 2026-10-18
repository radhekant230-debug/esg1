const { Resend } = require("resend");

// Values are read when an email is sent (not at require time), so the order of
// dotenv.config() and require() cannot leave them empty. Whitespace, a stray
// Windows "\r" or surrounding quotes in .env are removed.
const envValue = (name) => String(process.env[name] || "").trim().replace(/^["']|["']$/g, "").trim();

let _resend = null;
let _resendKey = null;
const getResend = () => {
    const key = envValue("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY is not set. Email delivery is unavailable.");
    if (!_resend || _resendKey !== key) {
        _resend = new Resend(key);
        _resendKey = key;
    }
    return _resend;
};

// Sender. onboarding@resend.dev works without a verified domain, but Resend then
// only delivers to the email address the Resend account was registered with.
const DEFAULT_FROM = "ESG Officials <onboarding@resend.dev>";
const fromAddress = () => envValue("EMAIL_FROM") || DEFAULT_FROM;

// Test phase: when EMAIL_TEST_RECIPIENT is set, every email to any other
// address is refused before it reaches Resend (nothing is redirected).
const testRecipient = () => envValue("EMAIL_TEST_RECIPIENT").toLowerCase();

// "radhekant230@gmail.com" -> "ra***@gmail.com" for logs
const maskEmail = (e) => {
    const [user, domain] = String(e || "").split("@");
    return domain ? `${user.slice(0, 2)}***@${domain}` : "***";
};

/** Single path to Resend: applies the test-recipient rule and reports Resend's answer. */
const deliver = async ({ to, subject, html, text, kind }) => {
    const recipient = String(to || "").trim().toLowerCase();
    const only = testRecipient();
    if (only && recipient !== only) {
        const err = new Error(`Email blocked in test mode: only ${maskEmail(only)} may receive email (EMAIL_TEST_RECIPIENT).`);
        err.code = "TEST_RECIPIENT_ONLY";
        console.warn(`[email] ${kind} to ${maskEmail(recipient)} blocked (test mode)`);
        throw err;
    }
    const { data, error } = await getResend().emails.send({ from: fromAddress(), to: [recipient], subject, html, text });
    if (error) {
        // Resend's error object (name, message, statusCode) — never contains the key or the code
        console.error(`[email] Resend rejected ${kind} to ${maskEmail(recipient)}: ${error.name || "error"} ${error.statusCode || ""} ${error.message || ""}`.trim());
        const err = new Error(error.message || `Failed to send ${kind} email`);
        err.resend = { name: error.name || null, statusCode: error.statusCode || null };
        throw err;
    }
    console.log(`[email] ${kind} accepted by Resend for ${maskEmail(recipient)} (id ${data && data.id ? data.id : "n/a"})`);
    return data;
};

// ==========================================
// SEND OTP EMAIL
// ==========================================
const sendOTPEmail = async (userEmail, otp, type) => {
    const isAccountVerification = type === "account_verification";
    const isLogin = type === "login";

    const title = isLogin
        ? "Your ESG Officials sign-in code"
        : isAccountVerification
        ? "Verify Your Client Portal Account"
        : "Client Portal Verification Code";

    const message = isLogin
        ? "Use this code to sign in. Never share it with anyone, including ESG Officials staff."
        : isAccountVerification
        ? "Use the following OTP to verify your account."
        : "Use the following OTP to complete your verification.";

    return deliver({
        kind: "OTP",
        to: userEmail,
        subject: title,
        text: `${title}\n\n${message}\n\nCode: ${otp}\n\nThis code expires in 5 minutes. If you did not request it, ignore this email.`,
        html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background: #f5f5f5;
        ">

          <div style="
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
          ">

            <h2 style="color: #111827; margin-bottom: 10px;">
              ${title}
            </h2>

            <p style="
              color: #6b7280;
              font-size: 16px;
              margin-bottom: 25px;
            ">
              ${message}
            </p>

            <div style="
              display: inline-block;
              padding: 15px 30px;
              background: #111827;
              color: #ffffff;
              border-radius: 8px;
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 8px;
            ">
              ${otp}
            </div>

            <p style="
              color: #9ca3af;
              font-size: 13px;
              margin-top: 25px;
            ">
              This OTP will expire in 5 minutes.
            </p>

            <p style="
              color: #9ca3af;
              font-size: 13px;
            ">
              If you did not request this code, you can safely ignore
              this email.
            </p>

          </div>

        </div>
      `,
    });

};

// ==========================================
// SEND CLIENT ACCOUNT CREATED EMAIL
// ==========================================
const sendClientCredentialsEmail = async (userEmail, userName, clientId, password) => {
    await deliver({
        kind: "credentials",
        to: userEmail,
        subject: "Your Client Portal Account",
        html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background: #f5f5f5;
        ">

          <div style="
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
          ">

            <h2 style="color: #111827;">
              Welcome, ${userName}!
            </h2>

            <p style="color: #4b5563;">
              Your Client Management Portal account has been created.
            </p>

            <div style="
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            ">

              <p>
                <strong>Client ID:</strong> ${clientId}
              </p>

              <p>
                <strong>Temporary Password:</strong> ${password}
              </p>

            </div>

            <p style="color: #6b7280;">
              Please change your password after your first login.
            </p>

          </div>

        </div>
      `,
    });

};

// ==========================================
// SEND PROJECT UPDATE NOTIFICATION EMAIL
// ==========================================
const sendProjectUpdateEmail = async (userEmail, userName, projectName, updateTitle) => {
  // best-effort: failures are logged by deliver() and never thrown
  try {
    await deliver({
        kind: "project update",
        to: userEmail,
        subject: `New Update - ${projectName}`,
        html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background: #f5f5f5;
        ">

          <div style="
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
          ">

            <h2 style="color: #111827;">
              Hello ${userName},
            </h2>

            <p style="color: #4b5563;">
              A new update has been posted for your project.
            </p>

            <div style="
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            ">

              <p>
                <strong>Project:</strong> ${projectName}
              </p>

              <p>
                <strong>Update:</strong> ${updateTitle}
              </p>

            </div>

            <p style="color: #6b7280;">
              Please log in to your Client Portal to view the complete
              update.
            </p>

          </div>

        </div>
      `,
    });

  } catch (err) {
    // already logged
  }
};

module.exports = {
    deliver,
    maskEmail,
    sendOTPEmail,
    sendClientCredentialsEmail,
    sendProjectUpdateEmail,
};
