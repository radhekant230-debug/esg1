/**
 * Express application (routes + middleware). Split from index.js so tests can
 * mount the real app without connecting/listening. Behaviour is unchanged.
 */
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/project");
const clientRoutes = require("./routes/client");
const taskRoutes = require("./routes/task");
const projectUpdateRoutes = require("./routes/projectUpdate");
const approvalRoutes = require("./routes/approval");
const messageRoutes = require("./routes/message");
const notificationRoutes = require("./routes/notification");
const documentRoutes = require("./routes/document");
const activityRoutes = require("./routes/activity");
const contactRoutes = require("./routes/contact");
const bizRoutes = require("./routes/biz/index");
const portalRoutes = require("./routes/portal");
const adminRoutes = require("./routes/admin");
const salesRoutes = require("./routes/sales");
const riskRoutes = require("./routes/risk");
const plannerRoutes = require("./routes/planner");
const whatsappWebhookRoutes = require("./routes/whatsappWebhook");

const app = express();

// ==========================================
// CORS
// Allows Vercel production & preview deployments,
// Render deployments, local development across ports,
// and any explicitly configured environment URLs.
// ==========================================
const isAllowedOrigin = (origin) => {
    // Allow non-browser requests (curl, mobile, server-to-server, Render health checks, file://)
    if (!origin || origin === "null") return true;

    const normalizedOrigin = origin.replace(/\/+$/, "");

    // 1. Explicitly configured origins (supports comma-separated list)
    const envOrigins = [
        process.env.CLIENT_URL,
        process.env.FRONTEND_URL,
        process.env.STATIC_SITE_URL,
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
    ]
        .filter(Boolean)
        .map((o) => o.trim().replace(/\/+$/, ""));

    if (envOrigins.includes(normalizedOrigin)) {
        return true;
    }

    // 2. Local development on localhost or 127.0.0.1 on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
        return true;
    }

    // 3. Vercel deployments (*.vercel.app)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(normalizedOrigin)) {
        return true;
    }

    // 4. Render deployments (*.onrender.com)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*onrender\.com$/.test(normalizedOrigin)) {
        return true;
    }

    return false;
};

const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Cron-Secret"],
};

app.use(cors(corsOptions));

// Keep the raw body so the WhatsApp webhook signature (X-Hub-Signature-256) can be verified
app.use(
    express.json({
        limit: "5mb",
        verify: (req, res, buf) => {
            req.rawBody = buf;
        },
    })
);

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
    res.json({ message: "Client Management Portal API is running" });
});

// ==========================================
// API ROUTE NORMALIZER
// Prevents 404s when frontend or external clients call
// without /api (e.g. /auth/login) or with duplicate /api/api
// ==========================================
app.use((req, res, next) => {
    if (req.url.startsWith("/api/api/")) {
        req.url = req.url.replace(/^\/api\/api\//, "/api/");
    } else if (
        !req.url.startsWith("/api") &&
        req.url !== "/" &&
        !req.url.startsWith("/uploads")
    ) {
        req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
    next();
});

// ==========================================
// ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/updates", projectUpdateRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/biz/businesses", bizRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/webhooks/whatsapp", whatsappWebhookRoutes);

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    if (err.name === "MulterError") {
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "File size must not exceed 20 MB."
            : "Invalid file upload.";
        return res.status(400).json({ message });
    }

    console.error("Server Error:", err.message);
    res.status(err.status || 500).json({
        message: err.status ? err.message : "Internal Server Error",
    });
});

module.exports = app;
