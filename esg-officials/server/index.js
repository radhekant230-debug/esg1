const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
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

const app = express();

// ==========================================
// CORS
// ==========================================
const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:5173",
    process.env.STATIC_SITE_URL || "http://localhost:5500",
    // Allow null origin so the static site works when opened directly from the filesystem (file://)
    null,
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS policy: origin ${origin} is not allowed`));
            }
        },
        credentials: true,
    })
);

app.use(express.json());

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/", (req, res) => {
    res.json({ message: "Client Management Portal API is running" });
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
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// ==========================================
// DATABASE + SERVER
// Mongoose dbName option ensures we always target esg-official-clients
// even if the MONGO_URI connection string omits the database path segment.
// ==========================================
const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI, { dbName: "esg-official-clients" })
    .then(() => {
        console.log("MongoDB connected → database: esg-official-clients");
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    });
