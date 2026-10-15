const express = require("express");
const router = express.Router();
const { protect, admin, adminOrManager } = require("../middlewares/auth");
const riskController = require("../controllers/riskController");

// ==========================================
// 1. RISK LIST & CRUD
// ==========================================
router.get("/", protect, riskController.getRisks);
router.post("/", protect, adminOrManager, riskController.createRisk);

// ==========================================
// 2. APPROVALS CENTER & CALENDAR (BEFORE :id)
// ==========================================
router.get("/approvals/center", protect, riskController.getApprovalsCenter);
router.get("/calendar/events", protect, riskController.getCalendarEvents);
router.post("/calendar/events", protect, adminOrManager, riskController.createCalendarEvent);
router.get("/policy", protect, riskController.getRiskPolicy);
router.put("/policy", protect, admin, riskController.updateRiskPolicy);

// ==========================================
// 3. SINGLE RISK & WORKFLOW ACTIONS
// ==========================================
router.get("/:id", protect, riskController.getRiskById);
router.get("/:id/audit-logs", protect, riskController.getRiskAuditLogs);
router.post("/:id/comments", protect, riskController.addComment);

// Manager workflow transitions
router.put("/:id/review", protect, adminOrManager, riskController.reviewRisk);
router.put("/:id/mitigation", protect, adminOrManager, riskController.proposeMitigation);
router.put("/:id/submit-approval", protect, adminOrManager, riskController.submitForClientApproval);
router.put("/:id/postpone", protect, adminOrManager, riskController.postponeRisk);
router.put("/:id/escalate", protect, adminOrManager, riskController.escalateRisk);
router.put("/:id/resolve", protect, adminOrManager, riskController.resolveRisk);

// Client approval decision (Client or Admin)
router.put("/:id/decide", protect, riskController.clientDecideMitigation);

module.exports = router;
