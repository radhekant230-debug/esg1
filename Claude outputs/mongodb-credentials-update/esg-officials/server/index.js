const dotenv = require("dotenv");

dotenv.config();

const db = require("./config/db");

// ==========================================
// REQUIRED CONFIGURATION
// Fail fast with a clear message (never printing the values themselves).
// ==========================================
const problems = [];
const uriCheck = db.validateMongoUri(process.env.MONGO_URI);
if (!uriCheck.ok) problems.push(...uriCheck.errors);
if (!process.env.JWT_SECRET) problems.push("JWT_SECRET is not set.");
if (problems.length > 0) {
    problems.forEach((p) => console.error(`[startup] ${p}`));
    console.error("[startup] Locally: copy server/.env.example to server/.env and fill in the values. On Render: set them under the service's Environment tab.");
    process.exit(1);
}
uriCheck.warnings.forEach((w) => console.warn(`[startup] WARNING: ${w}`));
if (process.env.JWT_SECRET.length < 32) {
    console.warn("[startup] WARNING: JWT_SECRET is shorter than 32 characters. Generate a longer random secret (see .env.example).");
}

if (!process.env.RESEND_API_KEY) {
    console.warn("[startup] WARNING: RESEND_API_KEY is not set — OTP and email features will not work.");
}

const { ensureAdminAccount } = require("./utils/adminBootstrap");
const { ensureManagerAccount } = require("./utils/managerBootstrap");
const { ensureSalesData } = require("./utils/salesBootstrap");
const { ensureRiskData } = require("./utils/riskBootstrap");
const { startAutoApprovalScheduler, stopAutoApprovalScheduler } = require("./services/autoApprovalScheduler");
const { startPlannerScheduler, stopPlannerScheduler } = require("./services/planner/scheduler");
const whatsappService = require("./services/whatsappService");

const app = require("./app");

// ==========================================
// SERVER FIRST, THEN DATABASE
// The port opens immediately so /api/health/live answers and Render sees the
// service start; /api/health and every database-backed API return 503 until
// MongoDB is connected and the startup tasks have finished.
// ==========================================
const PORT = process.env.PORT || 5000;
db.requireBootstrap();

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Liveness: /api/health/live · Readiness: /api/health`);
});

async function start() {
    try {
        await db.connectDB();
    } catch (err) {
        // err.message is already redacted and explains what to fix.
        console.error(`[startup] Could not connect to MongoDB: ${err.message}`);
        // Exit so Render marks this deploy as failed and keeps the previous
        // healthy instance serving traffic (important during credential rotation).
        await shutdown("db-connect-failed", 1);
        return;
    }

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
    db.markBootstrapped(true);
    db.log("info", "ready", { note: "database connected and startup tasks complete" });
}

// ==========================================
// GRACEFUL SHUTDOWN (Render sends SIGTERM on deploy/restart)
// ==========================================
let shuttingDown = false;
async function shutdown(reason, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    db.markBootstrapped(false); // health check reports not-ready while draining
    console.log(`[shutdown] ${reason}: closing server and database connection`);
    const force = setTimeout(() => process.exit(code || 1), 10000);
    force.unref();
    try {
        stopPlannerScheduler();
        stopAutoApprovalScheduler();
    } catch (e) {
        console.error("[shutdown] scheduler stop failed:", e.message);
    }
    await new Promise((resolve) => server.close(() => resolve()));
    try {
        await db.closeDB();
    } catch (e) {
        console.error("[shutdown] database close failed:", db.redact(e.message));
    }
    process.exit(code);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    console.error("[process] Unhandled promise rejection:", db.redact(reason && reason.message ? reason.message : reason));
});

start();
