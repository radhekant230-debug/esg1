/**
 * Notification preferences, WhatsApp number verification, integration status,
 * cron trigger and the WhatsApp delivery-status webhook.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const whatsapp = require("../services/whatsappService");
const { audit } = require("../services/audit");
const { runPlannerTick, getSchedulerHealth } = require("../services/planner/scheduler");
const { applyProviderStatuses } = require("../services/planner/notifications");
const rules = require("../services/planner/rules");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashCode = (userId, code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET || "planner").update(`${userId}:${code}`).digest("hex");

function publicSettings(user) {
  return {
    whatsappNumber: user.whatsappNumber || "",
    whatsappNumberMasked: whatsapp.maskPhone(user.whatsappNumber),
    whatsappVerified: Boolean(user.whatsappVerified),
    whatsappVerifiedAt: user.whatsappVerifiedAt,
    whatsappVerificationMethod: user.whatsappVerificationMethod || "",
    notificationPreferences: {
      inApp: true, // in-app notifications are always on
      whatsapp: Boolean(user.notificationPreferences && user.notificationPreferences.whatsapp),
      uploadReminders: user.notificationPreferences ? user.notificationPreferences.uploadReminders !== false : true,
      escalations: user.notificationPreferences ? user.notificationPreferences.escalations !== false : true,
    },
    supervisor: user.supervisor || null,
  };
}

exports.getMySettings = async (req, res) => {
  const user = await User.findById(req.user._id).populate("supervisor", "name email");
  return res.json({ settings: publicSettings(user), whatsapp: whatsapp.getStatus() });
};

exports.updateMySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const before = publicSettings(user);
    const body = req.body || {};

    if (body.whatsappNumber !== undefined) {
      if (!body.whatsappNumber) {
        user.whatsappNumber = "";
        user.whatsappVerified = false;
        user.whatsappVerifiedAt = null;
        user.whatsappVerificationMethod = "";
      } else {
        const normalized = whatsapp.normalizePhone(body.whatsappNumber);
        if (!normalized) {
          return res.status(400).json({ message: "Enter a valid WhatsApp number with country code, e.g. +91 98765 43210." });
        }
        if (normalized !== user.whatsappNumber) {
          user.whatsappNumber = normalized;
          user.whatsappVerified = false; // a changed number must be verified again
          user.whatsappVerifiedAt = null;
          user.whatsappVerificationMethod = "";
        }
      }
    }

    const prefs = body.notificationPreferences || {};
    user.notificationPreferences = user.notificationPreferences || {};
    ["whatsapp", "uploadReminders", "escalations"].forEach((k) => {
      if (prefs[k] !== undefined) user.notificationPreferences[k] = Boolean(prefs[k]);
    });
    user.notificationPreferences.inApp = true;

    await user.save();
    await audit({
      entityType: "User",
      entityId: user._id,
      action: "NOTIFICATION_SETTINGS_UPDATED",
      actor: req.user,
      before,
      after: publicSettings(user),
    });
    return res.json({ message: "Notification settings saved.", settings: publicSettings(user) });
  } catch (err) {
    console.error("Update notification settings error:", err);
    return res.status(500).json({ message: "Failed to save notification settings." });
  }
};

/** Sends a 6-digit code through the approved WhatsApp authentication template. */
exports.sendVerificationCode = async (req, res) => {
  try {
    const status = whatsapp.getStatus();
    if (!status.canSendOtp) {
      return res.status(503).json({
        message:
          "WhatsApp verification codes are not configured on the server (WhatsApp credentials and WHATSAPP_OTP_TEMPLATE are required). Ask an administrator to verify your number instead.",
        whatsapp: status,
      });
    }
    const user = await User.findById(req.user._id);
    if (!user.whatsappNumber) return res.status(400).json({ message: "Save your WhatsApp number first." });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const cfg = whatsapp.getConfig();
    const result = await whatsapp.sendTemplate({
      to: user.whatsappNumber,
      templateName: cfg.otpTemplate,
      params: [{ name: "code", value: code }],
      buttonParam: cfg.otpTemplateHasButton ? code : null,
    });

    await audit({
      entityType: "User",
      entityId: user._id,
      action: result.ok ? "WHATSAPP_OTP_ACCEPTED" : "WHATSAPP_OTP_FAILED",
      actor: req.user,
      metadata: { providerMessageId: result.messageId || "", error: result.error || "" },
    });

    if (!result.ok) {
      return res.status(502).json({ message: `WhatsApp did not accept the verification message: ${result.error}` });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          "whatsappVerification.codeHash": hashCode(user._id, code),
          "whatsappVerification.expiresAt": new Date(Date.now() + OTP_TTL_MS),
          "whatsappVerification.attempts": 0,
        },
      }
    );
    return res.json({
      message: `Verification code sent to ${whatsapp.maskPhone(user.whatsappNumber)} (accepted by WhatsApp). It expires in 10 minutes.`,
    });
  } catch (err) {
    console.error("Send WhatsApp code error:", err);
    return res.status(500).json({ message: "Failed to send verification code." });
  }
};

exports.confirmVerificationCode = async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "Enter the 6-digit code." });
    const user = await User.findById(req.user._id).select(
      "+whatsappVerification.codeHash +whatsappVerification.expiresAt +whatsappVerification.attempts whatsappNumber"
    );
    const v = user.whatsappVerification || {};
    if (!v.codeHash || !v.expiresAt || new Date(v.expiresAt) < new Date()) {
      return res.status(400).json({ message: "No active code. Request a new one." });
    }
    if ((v.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many attempts. Request a new code." });
    }
    const ok = crypto.timingSafeEqual(Buffer.from(hashCode(user._id, code)), Buffer.from(v.codeHash));
    if (!ok) {
      await User.updateOne({ _id: user._id }, { $inc: { "whatsappVerification.attempts": 1 } });
      return res.status(400).json({ message: "Incorrect code." });
    }
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          whatsappVerified: true,
          whatsappVerifiedAt: new Date(),
          whatsappVerificationMethod: "otp",
          "whatsappVerification.codeHash": "",
          "whatsappVerification.expiresAt": null,
          "whatsappVerification.attempts": 0,
        },
      }
    );
    await audit({ entityType: "User", entityId: user._id, action: "WHATSAPP_NUMBER_VERIFIED_OTP", actor: req.user });
    return res.json({ message: "WhatsApp number verified." });
  } catch (err) {
    console.error("Confirm WhatsApp code error:", err);
    return res.status(500).json({ message: "Failed to verify code." });
  }
};

/** Admin: list managers with their notification setup (for the settings screen). */
exports.listManagerNotificationSetup = async (req, res) => {
  const managers = await User.find({ role: { $in: ["manager", "admin"] } })
    .select("name email role whatsappNumber whatsappVerified whatsappVerificationMethod notificationPreferences supervisor isActive")
    .populate("supervisor", "name")
    .sort({ role: 1, name: 1 })
    .lean();
  return res.json({
    users: managers.map((m) => ({ ...m, whatsappNumberMasked: whatsapp.maskPhone(m.whatsappNumber) })),
  });
};

/** Admin: confirm (or revoke) a user's WhatsApp number after checking it out of band. */
exports.adminSetWhatsappVerification = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid user." });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    const verified = Boolean(req.body && req.body.verified);
    if (verified && !user.whatsappNumber) return res.status(400).json({ message: "User has no WhatsApp number saved." });
    user.whatsappVerified = verified;
    user.whatsappVerifiedAt = verified ? new Date() : null;
    user.whatsappVerificationMethod = verified ? "admin" : "";
    await user.save();
    await audit({
      entityType: "User",
      entityId: user._id,
      action: verified ? "WHATSAPP_NUMBER_VERIFIED_ADMIN" : "WHATSAPP_NUMBER_UNVERIFIED_ADMIN",
      actor: req.user,
    });
    return res.json({ message: verified ? "Number marked as verified." : "Verification removed." });
  } catch (err) {
    console.error("Admin WhatsApp verification error:", err);
    return res.status(500).json({ message: "Failed to update verification." });
  }
};

/** Admin: set the supervisor who receives a manager's escalations. */
exports.adminSetSupervisor = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.body && req.body.supervisorId;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid user." });
    const user = await User.findOne({ _id: id, role: "manager" });
    if (!user) return res.status(404).json({ message: "Manager not found." });
    if (supervisorId) {
      if (!mongoose.Types.ObjectId.isValid(supervisorId) || String(supervisorId) === String(id)) {
        return res.status(400).json({ message: "Invalid supervisor." });
      }
      const sup = await User.findOne({ _id: supervisorId, role: { $in: ["manager", "admin"] }, isActive: { $ne: false } });
      if (!sup) return res.status(400).json({ message: "Supervisor must be an active manager or admin." });
    }
    const before = { supervisor: user.supervisor };
    user.supervisor = supervisorId || null;
    await user.save();
    await audit({ entityType: "User", entityId: user._id, action: "SUPERVISOR_SET", actor: req.user, before, after: { supervisor: user.supervisor } });
    return res.json({ message: "Supervisor updated." });
  } catch (err) {
    console.error("Set supervisor error:", err);
    return res.status(500).json({ message: "Failed to set supervisor." });
  }
};

exports.getIntegrationStatus = async (req, res) => {
  const scheduler = await getSchedulerHealth();
  const staleAfterMs = Math.max(3 * scheduler.intervalMs, 30 * 60 * 1000);
  const lastRun = scheduler.lastRunAt ? new Date(scheduler.lastRunAt).getTime() : 0;
  return res.json({
    whatsapp: whatsapp.getStatus(),
    scheduler: {
      ...scheduler,
      healthy: Boolean(lastRun && Date.now() - lastRun < staleAfterMs && !scheduler.lastError),
      cronEndpointEnabled: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16),
    },
    rules: {
      reminderLeadHours: rules.getReminderLeadHours(),
      escalationHours: rules.getEscalationHours(),
      timezone: "Asia/Kolkata",
    },
  });
};

/** Admin: run the reminder/escalation scheduler now (useful for testing). */
exports.runSchedulerNow = async (req, res) => {
  const result = await runPlannerTick({ source: `manual:${req.user.email}` });
  return res.json({ result });
};

/** External cron trigger: POST /api/planner/cron/run with header x-cron-secret. */
exports.cronRun = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const given = String(req.headers["x-cron-secret"] || "");
  if (secret.length < 16) return res.status(503).json({ message: "CRON_SECRET is not configured (min 16 characters)." });
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: "Invalid cron secret." });
  const result = await runPlannerTick({ source: "cron-endpoint" });
  return res.json({ result });
};

// ---------------------------------------------------------------------------
// WhatsApp webhook (delivery statuses). Mounted without JWT auth.
// ---------------------------------------------------------------------------
exports.webhookVerify = (req, res) => {
  const { webhookVerifyToken } = whatsapp.getConfig();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && webhookVerifyToken && token === webhookVerifyToken) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
};

exports.webhookReceive = async (req, res) => {
  if (!whatsapp.verifyWebhookSignature(req.rawBody, req.headers["x-hub-signature-256"])) {
    return res.sendStatus(401);
  }
  // Acknowledge quickly, then process.
  res.sendStatus(200);
  try {
    const statuses = whatsapp.extractStatuses(req.body);
    if (statuses.length) await applyProviderStatuses(statuses);
  } catch (err) {
    console.error("[WhatsApp webhook] Failed to apply statuses:", err);
  }
};
