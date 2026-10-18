const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

// ==========================================
// REQUIRED ENV VAR VALIDATION
// Fail fast at startup rather than silently at runtime.
// ==========================================
const REQUIRED_VARS = ["MONGO_URI", "JWT_SECRET"];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
    console.error("[startup] Copy server/.env.example to server/.env and fill in all required values.");
    process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
    console.warn("[startup] WARNING: RESEND_API_KEY is not set — OTP and email features will not work.");
}

const { ensureAdminAccount } = require("./utils/adminBootstrap");
const { ensureManagerAccount } = require("./utils/managerBootstrap");
const { ensureSalesData } = require("./utils/salesBootstrap");
const { ensureRiskData } = require("./utils/riskBootstrap");
const { startAutoApprovalScheduler } = require("./services/autoApprovalScheduler");
const { startPlannerScheduler } = require("./services/planner/scheduler");
const whatsappService = require("./services/whatsappService");

const app = require("./app");

// ==========================================
// DATABASE + SERVER
// Mongoose dbName option ensures we always target esg-official-clients
// even if the MONGO_URI connection string omits the database path segment.
// ==========================================
const PORT = process.env.PORT || 5000;

// Email configuration check (never prints secret values)
try {
    const { checkEmailConfig } = require("./utils/email");
    checkEmailConfig().forEach((p) => console.warn(`[email] ${p}`));
} catch (e) {
    console.warn("[email] configuration check skipped:", e.message);
}

mongoose
    .connect(process.env.MONGO_URI, { dbName: "esg-official-clients" })
    .then(async () => {
        console.log("MongoDB connected → database: esg-official-clients");
        await ensureAdminAccount();
        await ensureManagerAccount();
        await ensureSalesData();
        await ensureRiskData();
        startAutoApprovalScheduler();
        startPlannerScheduler();
        const wa = whatsappService.getStatus();
        if (!wa.configured) {
            console.warn(
                `[startup] WhatsApp notifications NOT configured (missing: ${wa.missing.join(", ")}). ` +
                "Reminders and escalations will be delivered in-app only."
            );
        }
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        if (err.message && err.message.includes("tlsv1 alert internal error")) {
            console.error(
                "[Atlas Diagnostic] SSL alert 80 indicates MongoDB Atlas Network Access rejected this IP. " +
                "Verify your Atlas Network Access IP allowlist."
            );
        }
        process.exit(1);
    });
