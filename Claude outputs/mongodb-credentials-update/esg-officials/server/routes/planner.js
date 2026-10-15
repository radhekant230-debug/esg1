const express = require("express");
const router = express.Router();
const { protect, admin, adminOrManager } = require("../middlewares/auth");
const planner = require("../controllers/plannerController");
const settings = require("../controllers/plannerSettingsController");

// External cron trigger (authenticated by CRON_SECRET header, not JWT)
router.post("/cron/run", settings.cronRun);

router.use(protect);

// Calendar / quarter data (admin, manager, client — scoped server-side)
router.get("/activities", planner.listActivities);
router.get("/activities/:id", planner.getActivity);
router.get("/activities/:id/audit", planner.getActivityAudit);
router.get("/summary", planner.getSummary);

// Client approval (client owner or admin)
router.patch("/activities/:id/approval", planner.decideApproval);

// Manager / admin actions
router.get("/options", adminOrManager, planner.getFormOptions);
router.get("/reminders", adminOrManager, planner.listReminders);
router.get("/escalations", adminOrManager, planner.listEscalations);
router.post("/activities", adminOrManager, planner.createActivity);
router.put("/activities/:id", adminOrManager, planner.updateActivity);
router.patch("/activities/:id/reschedule", adminOrManager, planner.rescheduleActivity);
router.patch("/activities/:id/cancel", adminOrManager, planner.cancelActivity);
router.patch("/activities/:id/assign", adminOrManager, planner.assignActivity);
router.patch("/activities/:id/status", adminOrManager, planner.updateStatus);
router.patch("/activities/:id/escalation/acknowledge", adminOrManager, planner.acknowledgeEscalation);
router.patch("/activities/:id/escalation/resolve", adminOrManager, planner.resolveEscalation);

// Notification settings
router.get("/settings/notifications", adminOrManager, settings.getMySettings);
router.put("/settings/notifications", adminOrManager, settings.updateMySettings);
router.post("/settings/whatsapp/send-code", adminOrManager, settings.sendVerificationCode);
router.post("/settings/whatsapp/verify", adminOrManager, settings.confirmVerificationCode);
router.get("/integrations/status", adminOrManager, settings.getIntegrationStatus);

// Admin tools
router.get("/admin/notification-setup", admin, settings.listManagerNotificationSetup);
router.put("/admin/users/:id/whatsapp-verification", admin, settings.adminSetWhatsappVerification);
router.put("/admin/users/:id/supervisor", admin, settings.adminSetSupervisor);
router.post("/admin/run-scheduler", admin, settings.runSchedulerNow);

module.exports = router;
