/**
 * Reminder / escalation notification jobs.
 *
 * Every notification is a NotificationJob row with a unique dedupeKey, so:
 *   - creating the same reminder twice is a no-op,
 *   - each job is claimed atomically before sending (safe with several
 *     server instances or an external cron running at the same time),
 *   - every attempt, provider message id and failure is recorded.
 */
const os = require("os");
const mongoose = require("mongoose");
const ScheduledActivity = require("../../models/planner/ScheduledActivity");
const NotificationJob = require("../../models/planner/NotificationJob");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const whatsapp = require("../whatsappService");
const { audit } = require("../audit");
const rules = require("./rules");
const { formatISTDate, formatISTTime, formatISTDateTime } = require("../../utils/istDate");

const LOCK_OWNER = `${os.hostname()}:${process.pid}`;
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];

function appBaseUrl() {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.CLIENT_URL ||
    (process.env.ALLOWED_ORIGINS || "").split(",")[0] ||
    "http://localhost:5173";
  return raw.trim().replace(/\/+$/, "");
}

const managerTaskPath = (activityId) => `/manager/dashboard?tab=uploads&activity=${activityId}`;
const managerEscalationPath = (activityId) => `/manager/dashboard?tab=escalations&activity=${activityId}`;
const taskLink = (path) => `${appBaseUrl()}${path}`;

function reminderKeyBase(activity) {
  const at = new Date(activity.scheduledAt).toISOString();
  return `rem:${activity._id}:${at}:${String(activity.assignedManager._id || activity.assignedManager)}`;
}

async function upsertJob(doc, session) {
  const res = await NotificationJob.updateOne(
    { dedupeKey: doc.dedupeKey },
    { $setOnInsert: doc },
    { upsert: true, session }
  );
  return res.upsertedCount > 0;
}

/**
 * Makes the reminder jobs of an activity match its current date/manager/status.
 * Mutates activity.reminder (caller saves the activity).
 */
async function syncReminderJobs(activity, { session = null, now = new Date() } = {}) {
  const leadHours = rules.getReminderLeadHours();
  const pendingStatuses = ["pending", "processing"];
  activity.reminder = activity.reminder || {};
  activity.reminder.leadHours = leadHours;

  const reminder = rules.computeReminder(activity.scheduledAt, now, leadHours);

  if (rules.isTerminal(activity.status) || !reminder.required) {
    const reason = rules.isTerminal(activity.status)
      ? `Activity ${activity.status.toLowerCase()}`
      : "Scheduled time already passed";
    await NotificationJob.updateMany(
      { activity: activity._id, kind: "upload_reminder", status: { $in: pendingStatuses } },
      { $set: { status: "cancelled", cancelReason: reason, lockedUntil: null } },
      { session }
    );
    if (activity.reminder.status !== "sent" && activity.reminder.status !== "partially_sent") {
      activity.reminder.status = rules.isTerminal(activity.status) ? "cancelled" : "not_required";
    }
    activity.reminder.dueAt = reminder.dueAt;
    return { created: 0 };
  }

  const keyBase = reminderKeyBase(activity);
  const keys = [`${keyBase}:in_app`, `${keyBase}:whatsapp`];

  // Old date / old manager -> cancel those reminders.
  await NotificationJob.updateMany(
    {
      activity: activity._id,
      kind: "upload_reminder",
      status: { $in: pendingStatuses },
      dedupeKey: { $nin: keys },
    },
    { $set: { status: "cancelled", cancelReason: "Activity rescheduled or reassigned", lockedUntil: null } },
    { session }
  );

  const base = {
    kind: "upload_reminder",
    activity: activity._id,
    recipient: activity.assignedManager._id || activity.assignedManager,
    dueAt: reminder.dueAt,
    status: "pending",
    payload: { scheduledAt: activity.scheduledAt, late: reminder.late },
  };
  let created = 0;
  if (await upsertJob({ ...base, dedupeKey: keys[0], channel: "in_app" }, session)) created++;
  if (await upsertJob({ ...base, dedupeKey: keys[1], channel: "whatsapp", maxAttempts: 5 }, session)) created++;

  const existing = await NotificationJob.find({ dedupeKey: { $in: keys } }).session(session);
  const allDone = existing.length > 0 && existing.every((j) => !["pending", "processing"].includes(j.status));
  if (!allDone) activity.reminder.status = "scheduled";
  activity.reminder.dueAt = reminder.dueAt;
  activity.reminder.late = reminder.late;
  return { created, dueAt: reminder.dueAt, late: reminder.late };
}

/** Atomically claims the next due job. */
async function claimNextJob(now) {
  return NotificationJob.findOneAndUpdate(
    {
      dueAt: { $lte: now },
      $and: [
        {
          $or: [
            { status: "pending", $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
            // a previous worker crashed mid-send
            { status: "processing", lockedUntil: { $lt: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedUntil: new Date(now.getTime() + 2 * 60 * 1000),
        lockOwner: LOCK_OWNER,
      },
      $inc: { attempts: 1 },
    },
    { sort: { dueAt: 1 }, returnDocument: "after" }
  );
}

function buildMessage(job, activity) {
  const business = activity.businessName || "your client";
  const date = formatISTDate(activity.scheduledAt);
  const time = `${formatISTTime(activity.scheduledAt)} IST`;
  const isUpload = activity.activityType === "Scheduled Upload";

  if (job.kind === "upload_reminder") {
    const label = isUpload ? "Upload Reminder" : `${activity.activityType} Reminder`;
    const path = managerTaskPath(activity._id);
    return {
      type: "reminder",
      title: `${label}: ${business}`,
      message: `${isUpload ? "Your scheduled upload" : `"${activity.title}"`} for ${business} is due on ${date} at ${time}. Task: ${activity.title}. Please review and complete it before the deadline.`,
      path,
      template: "reminder",
      params: [
        { name: "business_name", value: business },
        { name: "scheduled_date", value: date },
        { name: "scheduled_time", value: time },
        { name: "task_link", value: taskLink(path) },
      ],
    };
  }

  const path = managerEscalationPath(activity._id);
  const deadline = formatISTDateTime(rules.effectiveDeadline(activity));
  const forSupervisor = job.kind === "escalation_supervisor";
  return {
    type: "escalation",
    title: `${forSupervisor ? "Team escalation" : "Escalated"}: ${activity.title}`,
    message: `"${activity.title}" for ${business} was due on ${deadline} and is still incomplete after ${rules.getEscalationHours()} hours. It has been escalated${forSupervisor ? " to you as supervisor" : ""}.`,
    path,
    template: "escalation",
    params: [
      { name: "task_title", value: activity.title },
      { name: "business_name", value: business },
      { name: "deadline", value: deadline },
      { name: "task_link", value: taskLink(path) },
    ],
  };
}

function isJobStillRelevant(job, activity) {
  if (!activity) return { ok: false, reason: "Activity no longer exists" };
  if (job.kind === "upload_reminder") {
    if (rules.isTerminal(activity.status)) return { ok: false, reason: `Activity ${activity.status.toLowerCase()}` };
    const expectedPrefix = reminderKeyBase(activity);
    if (!job.dedupeKey.startsWith(expectedPrefix)) return { ok: false, reason: "Activity rescheduled or reassigned" };
    return { ok: true };
  }
  // escalation notifications
  if (activity.status === "Cancelled") return { ok: false, reason: "Activity cancelled" };
  return { ok: true };
}

async function finishJob(job, result, now) {
  const update = { $set: { lockedUntil: null }, $push: { attemptLog: result.attempt } };
  if (result.outcome === "sent") {
    update.$set.status = "sent";
    update.$set.sentAt = now;
    update.$set.lastError = "";
    if (result.notification) update.$set.notification = result.notification;
  } else if (result.outcome === "accepted") {
    update.$set.status = "accepted";
    update.$set.sentAt = now;
    update.$set.provider = "whatsapp_cloud";
    update.$set.providerMessageId = result.messageId;
    update.$set.providerStatus = "accepted";
    update.$set.providerStatusAt = now;
    update.$set.lastError = "";
  } else if (result.outcome === "skipped") {
    update.$set.status = "skipped";
    update.$set.skipReason = result.reason;
  } else if (result.outcome === "cancelled") {
    update.$set.status = "cancelled";
    update.$set.cancelReason = result.reason;
  } else {
    // failed
    update.$set.lastError = result.error;
    if (result.retryable && job.attempts < job.maxAttempts) {
      const minutes = BACKOFF_MINUTES[Math.min(job.attempts - 1, BACKOFF_MINUTES.length - 1)];
      update.$set.status = "pending";
      update.$set.nextAttemptAt = new Date(now.getTime() + minutes * 60 * 1000);
    } else {
      update.$set.status = "failed";
      update.$set.failedAt = now;
    }
  }
  return NotificationJob.findOneAndUpdate({ _id: job._id, lockOwner: LOCK_OWNER }, update, { returnDocument: "after" });
}

async function deliverInApp(job, activity, msg) {
  try {
    const notification = await Notification.create({
      recipient: job.recipient,
      type: msg.type,
      title: msg.title,
      message: msg.message,
      link: msg.path,
      activity: activity._id,
      relatedId: activity._id,
      dedupeKey: job.dedupeKey,
    });
    return { outcome: "sent", notification: notification._id, attempt: { outcome: "accepted" } };
  } catch (err) {
    if (err && err.code === 11000) {
      // Already created by an earlier attempt -> idempotent success, no duplicate.
      const existing = await Notification.findOne({ dedupeKey: job.dedupeKey }).select("_id");
      return { outcome: "sent", notification: existing && existing._id, attempt: { outcome: "accepted", error: "already existed" } };
    }
    return { outcome: "failed", retryable: true, error: err.message, attempt: { outcome: "failed", error: err.message, retryable: true } };
  }
}

async function deliverWhatsApp(job, activity, msg, { fetchImpl } = {}) {
  const status = whatsapp.getStatus();
  const cfg = whatsapp.getConfig();
  const templateName = msg.template === "reminder" ? cfg.reminderTemplate : cfg.escalationTemplate;
  const skip = (reason) => ({ outcome: "skipped", reason, attempt: { outcome: "skipped", error: reason } });

  if (!status.configured || !templateName) {
    return skip(
      !status.configured
        ? `WhatsApp not configured (missing ${status.missing.join(", ")})`
        : "WhatsApp escalation template not configured"
    );
  }

  const recipient = await User.findById(job.recipient).select(
    "name whatsappNumber whatsappVerified notificationPreferences isActive"
  );
  if (!recipient || recipient.isActive === false) return skip("Recipient inactive or missing");
  const prefs = recipient.notificationPreferences || {};
  if (!prefs.whatsapp) return skip("Recipient has WhatsApp notifications turned off");
  if (job.kind === "upload_reminder" && prefs.uploadReminders === false) return skip("Recipient turned off upload reminders");
  if (job.kind !== "upload_reminder" && prefs.escalations === false) return skip("Recipient turned off escalation alerts");
  if (!recipient.whatsappNumber) return skip("Recipient has no WhatsApp number");
  if (!recipient.whatsappVerified) return skip("Recipient WhatsApp number is not verified");

  const res = await whatsapp.sendTemplate({
    to: recipient.whatsappNumber,
    templateName,
    params: msg.params,
    fetchImpl,
  });
  if (res.ok) {
    return {
      outcome: "accepted",
      messageId: res.messageId,
      attempt: { outcome: "accepted", httpStatus: res.httpStatus, providerMessageId: res.messageId },
    };
  }
  if (res.notConfigured) return skip(res.error);
  return {
    outcome: "failed",
    retryable: res.retryable,
    error: res.error,
    attempt: { outcome: "failed", httpStatus: res.httpStatus || null, error: res.error, retryable: res.retryable },
  };
}

/** Recomputes activity.reminder.status from the current reminder jobs. */
async function refreshReminderStatus(activityId) {
  const activity = await ScheduledActivity.findById(activityId);
  if (!activity) return;
  const keyBase = reminderKeyBase(activity);
  const jobs = await NotificationJob.find({ dedupeKey: { $in: [`${keyBase}:in_app`, `${keyBase}:whatsapp`] } });
  if (!jobs.length) return;
  const inApp = jobs.find((j) => j.channel === "in_app");
  const wa = jobs.find((j) => j.channel === "whatsapp");
  if (jobs.some((j) => ["pending", "processing"].includes(j.status))) return;

  let status = "sent";
  if (inApp && inApp.status === "failed") status = wa && ["accepted", "sent", "delivered", "read"].includes(wa.status) ? "partially_sent" : "failed";
  else if (wa && wa.status === "failed") status = "partially_sent";

  await ScheduledActivity.updateOne(
    { _id: activityId },
    { $set: { "reminder.status": status, "reminder.lastSentAt": new Date() } }
  );
}

/** Processes all due jobs. Returns a summary. */
async function processDueJobs({ now = new Date(), limit = 200, fetchImpl } = {}) {
  const summary = { processed: 0, sent: 0, accepted: 0, skipped: 0, failed: 0, retrying: 0, cancelled: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob(now);
    if (!job) break;
    summary.processed++;

    let result;
    try {
      const activity = await ScheduledActivity.findById(job.activity);
      const relevance = isJobStillRelevant(job, activity);
      if (!relevance.ok) {
        result = { outcome: "cancelled", reason: relevance.reason, attempt: { outcome: "skipped", error: relevance.reason } };
      } else {
        const msg = buildMessage(job, activity);
        result =
          job.channel === "in_app"
            ? await deliverInApp(job, activity, msg)
            : await deliverWhatsApp(job, activity, msg, { fetchImpl });
      }
    } catch (err) {
      result = { outcome: "failed", retryable: true, error: err.message, attempt: { outcome: "failed", error: err.message, retryable: true } };
    }

    const updated = await finishJob(job, result, now);
    const finalStatus = updated ? updated.status : "unknown";
    if (finalStatus === "sent") summary.sent++;
    else if (finalStatus === "accepted") summary.accepted++;
    else if (finalStatus === "skipped") summary.skipped++;
    else if (finalStatus === "cancelled") summary.cancelled++;
    else if (finalStatus === "pending") summary.retrying++;
    else if (finalStatus === "failed") summary.failed++;

    await audit({
      entityType: "NotificationJob",
      entityId: job._id,
      action: `NOTIFICATION_${String(finalStatus).toUpperCase()}`,
      metadata: {
        kind: job.kind,
        channel: job.channel,
        activity: job.activity,
        recipient: job.recipient,
        attempt: job.attempts,
        providerMessageId: result.messageId || "",
        error: result.error || result.reason || "",
      },
    });

    if (job.kind === "upload_reminder") await refreshReminderStatus(job.activity);
  }
  return summary;
}

/** Resolves supervisors: activity override > manager's supervisor > all active admins. */
async function resolveSupervisors(activity) {
  if (activity.supervisor) return [activity.supervisor];
  const manager = await User.findById(activity.assignedManager).select("supervisor");
  if (manager && manager.supervisor) return [manager.supervisor];
  const admins = await User.find({ role: "admin", isActive: { $ne: false } }).distinct("_id");
  return admins.filter((id) => String(id) !== String(activity.assignedManager));
}

/**
 * Escalates every incomplete activity whose escalation time has passed.
 * Each activity escalates at most once per escalation due time.
 */
async function runEscalationSweep({ now = new Date() } = {}) {
  const hours = rules.getEscalationHours();
  const cutoff = new Date(now.getTime() - hours * rules.HOUR_MS);
  const summary = { checked: 0, escalated: 0 };

  const candidates = await ScheduledActivity.find({
    status: { $nin: ["Completed", "Cancelled", "Escalated"] },
    $or: [
      { escalationStartAt: null, deadline: { $lte: cutoff } },
      { escalationStartAt: { $ne: null, $lte: cutoff } },
    ],
  }).limit(500);

  for (const activity of candidates) {
    summary.checked++;
    if (!rules.shouldEscalate(activity, now, hours)) continue;
    const dueAt = rules.escalationDueAt(activity, hours);
    const supervisors = await resolveSupervisors(activity);
    const eventId = new mongoose.Types.ObjectId();

    // Atomic: only escalates if nobody changed the status meanwhile and this
    // due time has not escalated before -> no duplicate escalation events.
    const updated = await ScheduledActivity.findOneAndUpdate(
      {
        _id: activity._id,
        status: activity.status,
        "escalation.lastEscalatedDueAt": { $ne: dueAt },
      },
      {
        $set: {
          status: "Escalated",
          statusBeforeEscalation: activity.status,
          "escalation.lastEscalatedAt": now,
          "escalation.lastEscalatedDueAt": dueAt,
        },
        $inc: { "escalation.count": 1, __v: 1 },
        $push: {
          "escalation.events": {
            _id: eventId,
            escalatedAt: now,
            dueAt,
            deadline: rules.effectiveDeadline(activity),
            reason: `Incomplete ${hours}h after ${activity.escalationStartAt ? "escalation start" : "deadline"}`,
            previousStatus: activity.status,
            manager: activity.assignedManager,
            supervisors,
          },
        },
      },
      { returnDocument: "after" }
    );
    if (!updated) continue;
    summary.escalated++;

    await audit({
      entityType: "ScheduledActivity",
      entityId: activity._id,
      action: "ESCALATED",
      before: { status: activity.status },
      after: { status: "Escalated" },
      metadata: { escalationEventId: eventId, dueAt, supervisors, hours },
    });

    const jobs = [];
    const push = (kind, recipient) => {
      ["in_app", "whatsapp"].forEach((channel) => {
        jobs.push({
          dedupeKey: `esc:${activity._id}:${eventId}:${recipient}:${channel}`,
          kind,
          channel,
          activity: activity._id,
          recipient,
          escalationEventId: eventId,
          dueAt: now,
          status: "pending",
        });
      });
    };
    push("escalation_manager", activity.assignedManager);
    supervisors
      .filter((s) => String(s) !== String(activity.assignedManager))
      .forEach((s) => push("escalation_supervisor", s));
    for (const job of jobs) await upsertJob(job, null);

    // The reminder for this activity is no longer useful.
    await NotificationJob.updateMany(
      { activity: activity._id, kind: "upload_reminder", status: "pending" },
      { $set: { status: "cancelled", cancelReason: "Activity escalated" } }
    );
  }
  return summary;
}

const STATUS_RANK = { accepted: 1, sent: 2, delivered: 3, read: 4 };

/** Applies WhatsApp webhook status updates to the matching jobs. */
async function applyProviderStatuses(statuses = []) {
  let updated = 0;
  for (const s of statuses) {
    if (!s.messageId) continue;
    const job = await NotificationJob.findOne({ providerMessageId: s.messageId });
    if (!job) continue;
    const set = { providerStatus: s.status, providerStatusAt: s.timestamp || new Date() };
    if (s.status === "failed") {
      set.status = "failed";
      set.failedAt = s.timestamp || new Date();
      set.lastError = (s.errors || []).join("; ") || "Delivery failed (reported by WhatsApp)";
    } else if (STATUS_RANK[s.status] && STATUS_RANK[s.status] >= (STATUS_RANK[job.status] || 0)) {
      set.status = s.status;
      if (s.status === "delivered") set.deliveredAt = s.timestamp;
      if (s.status === "read") set.readAt = s.timestamp;
    } else {
      continue; // out-of-order (older) status — ignore
    }
    await NotificationJob.updateOne({ _id: job._id }, { $set: set });
    await audit({
      entityType: "NotificationJob",
      entityId: job._id,
      action: `PROVIDER_STATUS_${String(s.status).toUpperCase()}`,
      metadata: { providerMessageId: s.messageId, errors: s.errors || [] },
    });
    if (job.kind === "upload_reminder") await refreshReminderStatus(job.activity);
    updated++;
  }
  return updated;
}

module.exports = {
  appBaseUrl,
  managerTaskPath,
  reminderKeyBase,
  syncReminderJobs,
  processDueJobs,
  runEscalationSweep,
  resolveSupervisors,
  applyProviderStatuses,
  buildMessage,
  LOCK_OWNER,
};
