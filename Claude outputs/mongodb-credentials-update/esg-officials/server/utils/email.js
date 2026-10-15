const { Resend } = require("resend");

// Lazily initialise so the module can be imported even before dotenv runs,
// as long as the env var is present by the time a function is called.
let _resend = null;
const getResend = () => {
    if (!_resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is not set. Email delivery is unavailable.");
        }
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
};

// Sender address — override via EMAIL_FROM in .env once your domain is verified.
// Without a verified domain the safe default for testing is: onboarding@resend.dev
// (Resend restricts unverified senders to the account's own email address only.)
const FROM_ADDRESS =
    process.env.EMAIL_FROM || "ESG Officials <onboarding@resend.dev>";

// ==========================================
// SEND OTP EMAIL
// ==========================================
const sendOTPEmail = async (userEmail, otp, type) => {
    const isAccountVerification = type === "account_verification";

    const title = isAccountVerification
        ? "Verify Your Client Portal Account"
        : "Client Portal Verification Code";

    const message = isAccountVerification
        ? "Use the following OTP to verify your account."
        : "Use the following OTP to complete your verification.";

    const { error } = await getResend().emails.send({
        from: FROM_ADDRESS,
        to: userEmail,
        subject: title,
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

    if (error) {
        console.error("Resend — OTP email error:", error);
        throw new Error(error.message || "Failed to send OTP email");
    }

    console.log(`OTP sent successfully to ${userEmail}`);
};

// ==========================================
// SEND CLIENT ACCOUNT CREATED EMAIL
// ==========================================
const sendClientCredentialsEmail = async (userEmail, userName, clientId, password) => {
    const { error } = await getResend().emails.send({
        from: FROM_ADDRESS,
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

    if (error) {
        console.error("Resend — credentials email error:", error);
        throw new Error(error.message || "Failed to send credentials email");
    }

    console.log(`Client credentials email sent successfully to ${userEmail}`);
};

// ==========================================
// SEND PROJECT UPDATE NOTIFICATION EMAIL
// ==========================================
const sendProjectUpdateEmail = async (userEmail, userName, projectName, updateTitle) => {
    const { error } = await getResend().emails.send({
        from: FROM_ADDRESS,
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

    if (error) {
        // Project update emails are best-effort — log but don't throw
        console.error("Resend — project update email error:", error);
        return;
    }

    console.log(`Project update email sent successfully to ${userEmail}`);
};

module.exports = {
    sendOTPEmail,
    sendClientCredentialsEmail,
    sendProjectUpdateEmail,
};
