/**
 * Sales planning calendar: scheduled uploads, campaigns, deadlines, approvals.
 * One ScheduledActivity collection feeds both the manager and client views,
 * so both dashboards always show the same dates.
 */
const mongoose = require("mongoose");
const ScheduledActivity = require("../models/planner/ScheduledActivity");
const NotificationJob = require("../models/planner/NotificationJob");
const AuditLog = require("../models/AuditLog");
const Counter = require("../models/Counter");
const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const rules = require("../services/planner/rules");
const access = require("../services/planner/access");
const { syncReminderJobs } = require("../services/planner/notifications");
const { audit, snapshot } = require("../services/audit");
const { runInTransaction } = require("../utils/transaction");
const ist = require("../utils/istDate");
const { getManagerAuthorizedBusinessQuery } = require("../services/salesAccess");

const AUDIT_FIELDS = [
  "title", "activityType", "status", "scheduledAt", "deadline", "escalationStartAt",
  "assignedManager", "client", "business", "businessName", "priority",
  "requiresClientApproval", "visibleToClient", "approval.decision",
];

const POPULATE = [
  { path: "assignedManager", select: "name email phone" },
  { path: "client", select: "name companyName email" },
  { path: "business", select: "name code city state category" },
  { path: "supervisor", select: "name email" },
  { path: "createdBy", select: "name role" },
];

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

const sendError = (res, err, fallback) => {
  if (err && err.name === "VersionError") {
    return res.status(409).json({ message: "This activity was changed by someone else. Reload and try again." });
  }
  if (err && err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(" ") });
  }
  if (err && err.status) return res.status(err.status).json({ message: err.message, ...(err.fields ? { fields: err.fields } : {}) });
  console.error(fallback, err);
  return res.status(500).json({ message: fallback });
};

const isValidId = (v) => v && mongoose.Types.ObjectId.isValid(v);

// ---------------------------------------------------------------------------
// Serialization (same shape for manager & client; clients get fewer internals)
// ---------------------------------------------------------------------------
function serialize(activity, user, now = new Date()) {
  const a = typeof activity.toObject === "function" ? activity.toObject() : activity;
  const deadline = rules.effectiveDeadline(a);
  const base = {
    _id: a._id,
    activityId: a.activityId,
    title: a.title,
    description: a.description,
    activityType: a.activityType,
    priority: a.priority,
    status: a.status,
    displayState: rules.displayState(a, now),
    isOverdue: rules.isOverdue(a, now),
    scheduledAt: a.scheduledAt,
    deadline,
    timezone: ist.TIMEZONE,
    scheduledDateLabel: ist.formatISTDate(a.scheduledAt),
    scheduledTimeLabel: ist.formatISTTime(a.scheduledAt),
    deadlineLabel: ist.formatISTDateTime(deadline),
    dayKey: ist.istDayKey(a.scheduledAt),
    businessName: a.businessName,
    client: a.client || null,
    business: a.business || null,
    assignedManager: a.assignedManager
      ? { _id: a.assignedManager._id || a.assignedManager, name: a.assignedManager.name || "" }
      : null,
    requiresClientApproval: a.requiresClientApproval,
    approval: {
      decision: a.approval ? a.approval.decision : "",
      decidedAt: a.approval ? a.approval.decidedAt : null,
      notes: a.approval ? a.approval.notes : "",
    },
    completedAt: a.completedAt,
    cancelledAt: a.cancelledAt,
    escalated: a.status === "Escalated",
    escalationCount: a.escalation ? a.escalation.count : 0,
    updatedAt: a.updatedAt,
    createdAt: a.createdAt,
  };
  if (user.role === "client") return base;

  const escalationDue = rules.escalationDueAt(a);
  const events = (a.escalation && a.escalation.events) || [];
  return {
    ...base,
    visibleToClient: a.visibleToClient,
    supervisor: a.supervisor || null,
    escalationStartAt: a.escalationStartAt,
    escalationDueAt: rules.isTerminal(a.status) ? null : escalationDue,
    escalationDueLabel: rules.isTerminal(a.status) ? "" : ist.formatISTDateTime(escalationDue),
    escalation: {
      count: a.escalation ? a.escalation.count : 0,
      lastEscalatedAt: a.escalation ? a.escalation.lastEscalatedAt : null,
      current: events.length ? events[events.length - 1] : null,
      events,
    },
    statusBeforeEscalation: a.statusBeforeEscalation,
    reminder: a.reminder
      ? {
          ...a.reminder,
          dueLabel: a.reminder.dueAt ? ist.formatISTDateTime(a.reminder.dueAt) : "",
        }
      : null,
    rescheduleHistory: a.rescheduleHistory || [],
    cancelReason: a.cancelReason,
    createdBy: a.createdBy || null,
  };
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------
function parseDates(body, { partial = false, existing = null } = {}) {
  const fields = {};
  const out = {};

  const hasScheduled = body.scheduledDate !== undefined || body.scheduledAt !== undefined;
  if (hasScheduled || !partial) {
    const scheduledAt = body.scheduledAt
      ? ist.parseISTDateTime(body.scheduledAt)
      : ist.parseISTDateTime(body.scheduledDate, body.scheduledTime || "10:00");
    if (!scheduledAt) fields.scheduledDate = "A valid scheduled date (YYYY-MM-DD) and time (HH:mm, IST) is required.";
    else out.scheduledAt = scheduledAt;
  }

  const hasDeadline = body.deadlineDate !== undefined || body.deadline !== undefined;
  if (hasDeadline && (body.deadlineDate || body.deadline)) {
    const deadline = body.deadline
      ? ist.parseISTDateTime(body.deadline)
      : ist.parseISTDateTime(body.deadlineDate, body.deadlineTime || body.scheduledTime || "23:59");
    if (!deadline) fields.deadlineDate = "Deadline must be a valid date/time.";
    else out.deadline = deadline;
  } else if (out.scheduledAt && (!partial || !existing)) {
    out.deadline = out.scheduledAt;
  } else if (out.scheduledAt && existing) {
    // keep the same gap between scheduled time and deadline when only the date moves
    const gap = new Date(existing.deadline).getTime() - new Date(existing.scheduledAt).getTime();
    out.deadline = new Date(out.scheduledAt.getTime() + Math.max(0, gap));
  }

  if (body.escalationStartDate !== undefined) {
    if (!body.escalationStartDate) out.escalationStartAt = null;
    else {
      const esc = ist.parseISTDateTime(body.escalationStartDate, body.escalationStartTime || "00:00");
      if (!esc) fields.escalationStartDate = "Escalation start must be a valid date/time.";
      else out.escalationStartAt = esc;
    }
  }

  const sched = out.scheduledAt || (existing && existing.scheduledAt);
  const dl = out.deadline || (existing && existing.deadline);
  if (sched && dl && new Date(dl).getTime() < new Date(sched).getTime()) {
    fields.deadlineDate = "Deadline cannot be before the scheduled date/time.";
  }

  if (Object.keys(fields).length) throw httpError(400, Object.values(fields)[0], { fields });
  return out;
}

async function resolveAssignee(user, managerId) {
  if (!managerId) {
    if (user.role === "manager") return user._id;
    throw httpError(400, "Assign the activity to a manager.");
  }
  if (!isValidId(managerId)) throw httpError(400, "Invalid manager.");
  const manager = await User.findOne({ _id: managerId, role: "manager", isActive: { $ne: false } }).select("_id name");
  if (!manager) throw httpError(400, "Selected manager does not exist or is inactive.");
  return manager._id;
}

const pick = (body, keys) =>
  keys.reduce((acc, k) => {
    if (body[k] !== undefined) acc[k] = body[k];
    return acc;
  }, {});

function cleanText(value, max) {
  if (value === undefined) return undefined;
  return String(value || "").trim().slice(0, max);
}

async function loadForManage(req) {
  if (!isValidId(req.params.id)) throw httpError(400, "Invalid activity id.");
  const activity = await ScheduledActivity.findById(req.params.id);
  if (!activity) throw httpError(404, "Activity not found.");
  if (!(await access.canManageActivity(req.user, activity))) {
    throw httpError(403, "You are not authorized to manage this activity.");
  }
  return activity;
}

async function saveWithJobs(activity, user, action, before, metadata = {}) {
  const { result } = await runInTransaction(async (session) => {
    await syncReminderJobs(activity, { session });
    activity.updatedBy = user._id;
    await activity.save({ session });
    await audit(
      {
        entityType: "ScheduledActivity",
        entityId: activity._id,
        action,
        actor: user,
        before,
        after: snapshot(activity, AUDIT_FIELDS),
        metadata,
      },
      { session, strict: Boolean(session) }
    );
    return activity;
  });
  return result;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
function buildRange(q) {
  const startMonth = Number(process.env.QUARTER_START_MONTH) === 4 ? 4 : 1;
  if (q.year && q.quarter) {
    const r = ist.quarterRange(Number(q.year), Number(q.quarter), startMonth);
    if (!r) throw httpError(400, "Quarter must be 1-4.");
    return r;
  }
  if (q.year && q.month) {
    const m = Number(q.month);
    if (!(m >= 1 && m <= 12)) throw httpError(400, "Month must be 1-12.");
    return ist.istMonthRange(Number(q.year), m);
  }
  if (q.start || q.end) {
    const start = q.start ? ist.parseISTDateTime(q.start) : null;
    const endRaw = q.end ? ist.parseISTDateTime(q.end) : null;
    if ((q.start && !start) || (q.end && !endRaw)) throw httpError(400, "Invalid start/end date.");
    // A date-only end is inclusive of that whole IST day
    const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(String(q.end)) ? ist.endOfISTDay(endRaw) : endRaw;
    return { start, end };
  }
  return null;
}

exports.listActivities = async (req, res) => {
  try {
    const extra = {};
    const range = buildRange(req.query);
    if (range) {
      const cond = {};
      if (range.start) cond.$gte = range.start;
      if (range.end) cond.$lte = range.end;
      extra.$or = [{ scheduledAt: cond }, { deadline: cond }];
    }
    if (req.query.status && rules.STATUSES.includes(req.query.status)) extra.status = req.query.status;
    if (req.query.type && rules.ACTIVITY_TYPES.includes(req.query.type)) extra.activityType = req.query.type;
    if (isValidId(req.query.clientId)) extra.client = req.query.clientId;
    if (isValidId(req.query.businessId)) extra.business = req.query.businessId;
    if (isValidId(req.query.managerId) && req.user.role !== "client") extra.assignedManager = req.query.managerId;
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80), "i");
      extra.$and = [{ $or: [{ title: rx }, { businessName: rx }, { activityId: rx }] }];
    }

    const filter = await access.scopedFilter(req.user, extra);
    const limit = Math.min(Number(req.query.limit) || 1000, 2000);
    const docs = await ScheduledActivity.find(filter).populate(POPULATE).sort({ scheduledAt: 1 }).limit(limit);

    const now = new Date();
    let items = docs.map((d) => serialize(d, req.user, now));
    if (req.query.state) items = items.filter((i) => i.displayState === req.query.state);

    return res.json({
      timezone: ist.TIMEZONE,
      range: range ? { start: range.start, end: range.end, months: range.months || null } : null,
      count: items.length,
      activities: items,
    });
  } catch (err) {
    return sendError(res, err, "Failed to load scheduled activities.");
  }
};

exports.getActivity = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw httpError(400, "Invalid activity id.");
    const filter = await access.scopedFilter(req.user, { _id: req.params.id });
    const activity = await ScheduledActivity.findOne(filter).populate(POPULATE);
    if (!activity) throw httpError(404, "Activity not found.");

    const payload = { activity: serialize(activity, req.user) };
    if (req.user.role !== "client") {
      payload.notifications = await NotificationJob.find({ activity: activity._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("recipient", "name")
        .select("-payload -lockOwner")
        .lean();
    }
    return res.json(payload);
  } catch (err) {
    return sendError(res, err, "Failed to load activity.");
  }
};

exports.getActivityAudit = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw httpError(400, "Invalid activity id.");
    const filter = await access.scopedFilter(req.user, { _id: req.params.id });
    const activity = await ScheduledActivity.findOne(filter).select("_id");
    if (!activity) throw httpError(404, "Activity not found.");
    const jobIds = await NotificationJob.find({ activity: activity._id }).distinct("_id");
    const logs = await AuditLog.find({
      $or: [
        { entityType: "ScheduledActivity", entityId: activity._id },
        { entityType: "NotificationJob", entityId: { $in: jobIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return res.json({ logs });
  } catch (err) {
    return sendError(res, err, "Failed to load audit trail.");
  }
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
exports.createActivity = async (req, res) => {
  try {
    const body = req.body || {};
    const title = cleanText(body.title, 200);
    if (!title) throw httpError(400, "Title is required.", { fields: { title: "Title is required." } });

    const activityType = body.activityType || "Scheduled Upload";
    if (!rules.ACTIVITY_TYPES.includes(activityType)) throw httpError(400, "Invalid activity type.");
    const priority = body.priority || "Medium";
    if (!rules.PRIORITIES.includes(priority)) throw httpError(400, "Invalid priority.");

    const dates = parseDates(body);
    // Only admins may back-date (e.g. to record work that already happened).
    if (dates.scheduledAt.getTime() < Date.now() - 5 * 60 * 1000 && !(body.allowPastDate && req.user.role === "admin")) {
      throw httpError(400, "The scheduled date/time is in the past.", { fields: { scheduledDate: "Choose a future date/time." } });
    }

    const target = await access.resolveTarget(req.user, { clientId: body.clientId, businessId: body.businessId });
    const assignedManager = await resolveAssignee(req.user, body.assignedManager);

    let supervisor = null;
    if (body.supervisor && req.user.role === "admin") {
      if (!isValidId(body.supervisor)) throw httpError(400, "Invalid supervisor.");
      supervisor = body.supervisor;
    }

    const { result } = await runInTransaction(async (session) => {
      const seq = await Counter.next("scheduledActivity", session);
      const year = ist.toISTParts(new Date()).year;
      const activity = new ScheduledActivity({
        activityId: `SA-${year}-${String(seq).padStart(4, "0")}`,
        title,
        description: cleanText(body.description, 5000) || "",
        activityType,
        priority,
        ...dates,
        assignedManager,
        supervisor,
        client: target.client ? target.client._id : null,
        business: target.business ? target.business._id : null,
        businessName: target.businessName,
        status: "Scheduled",
        visibleToClient: body.visibleToClient !== false,
        requiresClientApproval: Boolean(body.requiresClientApproval),
        createdBy: req.user._id,
      });
      await syncReminderJobs(activity, { session });
      await activity.save({ session });
      await audit(
        {
          entityType: "ScheduledActivity",
          entityId: activity._id,
          action: "CREATED",
          actor: req.user,
          after: snapshot(activity, AUDIT_FIELDS),
        },
        { session, strict: Boolean(session) }
      );
      return activity;
    });

    await result.populate(POPULATE);
    return res.status(201).json({
      message: `${result.activityType} scheduled for ${ist.formatISTDate(result.scheduledAt)} at ${ist.formatISTTime(result.scheduledAt)} IST.`,
      activity: serialize(result, req.user),
    });
  } catch (err) {
    return sendError(res, err, "Failed to create scheduled activity.");
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (rules.isTerminal(activity.status)) throw httpError(400, `A ${activity.status.toLowerCase()} activity cannot be edited.`);
    const before = snapshot(activity, AUDIT_FIELDS);
    const body = req.body || {};

    const fields = pick(body, ["title", "description", "activityType", "priority", "visibleToClient", "requiresClientApproval"]);
    if (fields.title !== undefined) {
      fields.title = cleanText(fields.title, 200);
      if (!fields.title) throw httpError(400, "Title is required.");
    }
    if (fields.description !== undefined) fields.description = cleanText(fields.description, 5000);
    if (fields.activityType && !rules.ACTIVITY_TYPES.includes(fields.activityType)) throw httpError(400, "Invalid activity type.");
    if (fields.priority && !rules.PRIORITIES.includes(fields.priority)) throw httpError(400, "Invalid priority.");
    if (fields.visibleToClient !== undefined) fields.visibleToClient = Boolean(fields.visibleToClient);
    if (fields.requiresClientApproval !== undefined) fields.requiresClientApproval = Boolean(fields.requiresClientApproval);
    Object.assign(activity, fields);

    if (body.clientId !== undefined || body.businessId !== undefined) {
      const target = await access.resolveTarget(req.user, {
        clientId: body.clientId !== undefined ? body.clientId : activity.client,
        businessId: body.businessId !== undefined ? body.businessId : activity.business,
      });
      activity.client = target.client ? target.client._id : null;
      activity.business = target.business ? target.business._id : null;
      activity.businessName = target.businessName;
    }

    if (body.supervisor !== undefined && req.user.role === "admin") {
      activity.supervisor = body.supervisor && isValidId(body.supervisor) ? body.supervisor : null;
    }

    // Date edits are recorded exactly like a reschedule.
    const dateKeys = ["scheduledDate", "scheduledAt", "deadlineDate", "deadline", "escalationStartDate"];
    if (dateKeys.some((k) => body[k] !== undefined)) {
      const dates = parseDates(body, { partial: true, existing: activity });
      recordReschedule(activity, dates, req.user, body.reason || "Edited");
    }

    await saveWithJobs(activity, req.user, "UPDATED", before);
    await activity.populate(POPULATE);
    return res.json({ message: "Activity updated.", activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to update activity.");
  }
};

function recordReschedule(activity, dates, user, reason) {
  const changed =
    (dates.scheduledAt && dates.scheduledAt.getTime() !== new Date(activity.scheduledAt).getTime()) ||
    (dates.deadline && dates.deadline.getTime() !== new Date(activity.deadline).getTime());
  if (changed) {
    activity.rescheduleHistory.push({
      fromScheduledAt: activity.scheduledAt,
      toScheduledAt: dates.scheduledAt || activity.scheduledAt,
      fromDeadline: activity.deadline,
      toDeadline: dates.deadline || activity.deadline,
      reason: cleanText(reason, 500) || "",
      by: user._id,
      at: new Date(),
    });
  }
  Object.assign(activity, dates);
  return changed;
}

exports.rescheduleActivity = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (rules.isTerminal(activity.status)) throw httpError(400, `A ${activity.status.toLowerCase()} activity cannot be rescheduled.`);
    const before = snapshot(activity, AUDIT_FIELDS);
    const dates = parseDates(req.body || {}, { partial: true, existing: activity });
    if (!dates.scheduledAt && !dates.deadline && dates.escalationStartAt === undefined) {
      throw httpError(400, "Provide a new scheduled date and/or deadline.");
    }
    if (dates.scheduledAt && dates.scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) {
      throw httpError(400, "The new scheduled date/time is in the past.");
    }
    const changed = recordReschedule(activity, dates, req.user, req.body.reason);
    await saveWithJobs(activity, req.user, "RESCHEDULED", before, { reason: req.body.reason || "", changed });
    await activity.populate(POPULATE);
    return res.json({
      message: `Rescheduled to ${ist.formatISTDate(activity.scheduledAt)} at ${ist.formatISTTime(activity.scheduledAt)} IST.`,
      activity: serialize(activity, req.user),
    });
  } catch (err) {
    return sendError(res, err, "Failed to reschedule activity.");
  }
};

exports.cancelActivity = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (rules.isTerminal(activity.status)) throw httpError(400, `Activity is already ${activity.status.toLowerCase()}.`);
    const reason = cleanText(req.body && req.body.reason, 500);
    if (!reason) throw httpError(400, "A cancellation reason is required.");
    const before = snapshot(activity, AUDIT_FIELDS);
    activity.status = "Cancelled";
    activity.cancelledAt = new Date();
    activity.cancelledBy = req.user._id;
    activity.cancelReason = reason;
    await saveWithJobs(activity, req.user, "CANCELLED", before, { reason });
    await activity.populate(POPULATE);
    return res.json({ message: "Activity cancelled. Pending reminders were cancelled.", activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to cancel activity.");
  }
};

exports.assignActivity = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (rules.isTerminal(activity.status)) throw httpError(400, `A ${activity.status.toLowerCase()} activity cannot be reassigned.`);
    const before = snapshot(activity, AUDIT_FIELDS);
    const managerId = await resolveAssignee(req.user, req.body && req.body.managerId);
    if (String(managerId) === String(activity.assignedManager)) throw httpError(400, "Activity is already assigned to this manager.");
    activity.assignedManager = managerId;
    await saveWithJobs(activity, req.user, "REASSIGNED", before, { notes: cleanText(req.body.notes, 500) || "" });
    await activity.populate(POPULATE);
    return res.json({ message: `Assigned to ${activity.assignedManager.name}.`, activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to assign activity.");
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    const to = req.body && req.body.status;
    if (!rules.STATUSES.includes(to)) throw httpError(400, "Invalid status.");
    if (!rules.canTransition(activity.status, to, req.user.role, { requiresClientApproval: activity.requiresClientApproval })) {
      const hint =
        activity.status === "Escalated"
          ? " Use Acknowledge / Resolve for escalated tasks."
          : to === "Completed" && activity.requiresClientApproval
            ? " This activity needs client approval: move it to Pending Approval."
            : "";
      throw httpError(400, `Cannot change status from ${activity.status} to ${to}.${hint}`);
    }
    const before = snapshot(activity, AUDIT_FIELDS);
    activity.status = to;
    if (to === "Completed") {
      activity.completedAt = new Date();
      activity.completedBy = req.user._id;
    }
    if (to === "Pending Approval") {
      activity.approval = { decision: "Pending", requestedAt: new Date(), decidedAt: null, decidedBy: null, notes: "" };
    }
    await saveWithJobs(activity, req.user, `STATUS_${to.toUpperCase().replace(/\s+/g, "_")}`, before, {
      notes: cleanText(req.body.notes, 500) || "",
    });
    await activity.populate(POPULATE);
    return res.json({ message: `Status changed to ${to}.`, activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to update status.");
  }
};

/** Client (owner) or admin approves / rejects an activity waiting for approval. */
exports.decideApproval = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw httpError(400, "Invalid activity id.");
    const activity = await ScheduledActivity.findById(req.params.id);
    if (!activity) throw httpError(404, "Activity not found.");
    const allowed = req.user.role === "admin" || (await access.clientOwnsActivity(req.user, activity));
    if (!allowed) throw httpError(403, "Only the client (or an administrator) can approve this activity.");
    if (activity.status !== "Pending Approval") throw httpError(400, "This activity is not waiting for approval.");

    const decision = req.body && req.body.decision;
    if (!["Approved", "Rejected"].includes(decision)) throw httpError(400, "Decision must be Approved or Rejected.");
    const notes = cleanText(req.body.notes, 1000) || "";
    if (decision === "Rejected" && !notes) throw httpError(400, "Please explain what needs to change.");

    const before = snapshot(activity, AUDIT_FIELDS);
    activity.approval.decision = decision;
    activity.approval.decidedAt = new Date();
    activity.approval.decidedBy = req.user._id;
    activity.approval.notes = notes;
    if (decision === "Approved") {
      activity.status = "Completed";
      activity.completedAt = new Date();
      activity.completedBy = req.user._id;
    } else {
      activity.status = "In Progress";
    }
    await saveWithJobs(activity, req.user, decision === "Approved" ? "APPROVED" : "APPROVAL_REJECTED", before, { notes });

    // Tell the manager
    const Notification = require("../models/Notification");
    await Notification.create({
      recipient: activity.assignedManager,
      type: "approval",
      title: `${decision}: ${activity.title}`,
      message: `${activity.businessName || "Client"} ${decision.toLowerCase()} "${activity.title}".${notes ? ` Notes: ${notes}` : ""}`,
      link: `/manager/dashboard?tab=approvals&activity=${activity._id}`,
      activity: activity._id,
      relatedId: activity._id,
    }).catch((e) => console.error("[planner] approval notification failed:", e.message));

    await activity.populate(POPULATE);
    return res.json({ message: `Activity ${decision.toLowerCase()}.`, activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to record approval decision.");
  }
};

exports.acknowledgeEscalation = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (activity.status !== "Escalated") throw httpError(400, "This activity is not currently escalated.");
    const event = activity.escalation.events[activity.escalation.events.length - 1];
    if (!event) throw httpError(400, "No escalation event found.");
    if (event.acknowledgedAt) throw httpError(400, "Escalation already acknowledged.");
    const before = snapshot(activity, AUDIT_FIELDS);
    event.acknowledgedAt = new Date();
    event.acknowledgedBy = req.user._id;
    if (req.body && req.body.notes) event.resolutionNotes = cleanText(req.body.notes, 1000);
    await saveWithJobs(activity, req.user, "ESCALATION_ACKNOWLEDGED", before, { eventId: event._id });
    await activity.populate(POPULATE);
    return res.json({ message: "Escalation acknowledged.", activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to acknowledge escalation.");
  }
};

/**
 * Resolve an escalation:
 *  - completed   -> task done
 *  - resumed     -> back to previous status (will NOT re-escalate for the same deadline)
 *  - reassigned  -> new manager (+ optional new dates)
 *  - rescheduled -> new dates (a new escalation can happen for the new deadline)
 *  - cancelled   -> cancel task
 */
exports.resolveEscalation = async (req, res) => {
  try {
    const activity = await loadForManage(req);
    if (activity.status !== "Escalated") throw httpError(400, "This activity is not currently escalated.");
    const body = req.body || {};
    const resolution = body.resolution;
    if (!["completed", "resumed", "reassigned", "rescheduled", "cancelled"].includes(resolution)) {
      throw httpError(400, "Resolution must be completed, resumed, reassigned, rescheduled or cancelled.");
    }
    const notes = cleanText(body.notes, 1000) || "";
    const before = snapshot(activity, AUDIT_FIELDS);
    const event = activity.escalation.events[activity.escalation.events.length - 1];
    const previous = activity.statusBeforeEscalation && activity.statusBeforeEscalation !== "Escalated"
      ? activity.statusBeforeEscalation
      : "In Progress";

    if (resolution === "completed") {
      if (activity.requiresClientApproval && req.user.role !== "admin") {
        throw httpError(400, "This activity needs client approval; resolve as 'resumed' and move it to Pending Approval.");
      }
      activity.status = "Completed";
      activity.completedAt = new Date();
      activity.completedBy = req.user._id;
    } else if (resolution === "cancelled") {
      if (!notes) throw httpError(400, "A reason is required to cancel.");
      activity.status = "Cancelled";
      activity.cancelledAt = new Date();
      activity.cancelledBy = req.user._id;
      activity.cancelReason = notes;
    } else {
      activity.status = previous === "Pending Approval" ? "Pending Approval" : previous === "Scheduled" ? "Scheduled" : "In Progress";
      if (resolution === "reassigned") {
        const managerId = await resolveAssignee(req.user, body.managerId);
        activity.assignedManager = managerId;
      }
      const dateKeys = ["scheduledDate", "deadlineDate", "escalationStartDate"];
      if (dateKeys.some((k) => body[k] !== undefined)) {
        const dates = parseDates(body, { partial: true, existing: activity });
        recordReschedule(activity, dates, req.user, notes || "Escalation resolution");
      } else if (resolution === "rescheduled") {
        throw httpError(400, "Provide the new scheduled date and/or deadline.");
      }
    }

    if (event) {
      event.resolvedAt = new Date();
      event.resolvedBy = req.user._id;
      event.resolution = resolution;
      event.resolutionNotes = notes;
      if (!event.acknowledgedAt) {
        event.acknowledgedAt = event.resolvedAt;
        event.acknowledgedBy = req.user._id;
      }
    }

    await saveWithJobs(activity, req.user, `ESCALATION_RESOLVED_${resolution.toUpperCase()}`, before, {
      eventId: event && event._id,
      notes,
    });
    await activity.populate(POPULATE);
    return res.json({ message: `Escalation resolved (${resolution}).`, activity: serialize(activity, req.user) });
  } catch (err) {
    return sendError(res, err, "Failed to resolve escalation.");
  }
};

// ---------------------------------------------------------------------------
// Dashboard summary / lists
// ---------------------------------------------------------------------------
exports.getSummary = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = ist.startOfISTDay(now);
    const todayEnd = ist.endOfISTDay(now);
    const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000 - 1);

    const open = { status: { $nin: ["Completed", "Cancelled"] } };
    const [upcoming, overdue, pendingApprovals, escalated, todayItems, statusCounts] = await Promise.all([
      ScheduledActivity.find(await access.scopedFilter(req.user, { ...open, deadline: { $gte: now, $lte: weekEnd } }))
        .populate(POPULATE).sort({ deadline: 1 }).limit(50),
      ScheduledActivity.find(await access.scopedFilter(req.user, { ...open, deadline: { $lt: now } }))
        .populate(POPULATE).sort({ deadline: 1 }).limit(100),
      ScheduledActivity.find(await access.scopedFilter(req.user, { status: "Pending Approval" }))
        .populate(POPULATE).sort({ deadline: 1 }).limit(100),
      ScheduledActivity.find(await access.scopedFilter(req.user, { status: "Escalated" }))
        .populate(POPULATE).sort({ "escalation.lastEscalatedAt": -1 }).limit(100),
      ScheduledActivity.find(await access.scopedFilter(req.user, { scheduledAt: { $gte: todayStart, $lte: todayEnd } }))
        .populate(POPULATE).sort({ scheduledAt: 1 }),
      ScheduledActivity.aggregate([
        { $match: await access.scopedFilter(req.user, {}) },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    let remindersDueToday = [];
    let reminderStats = null;
    if (req.user.role !== "client") {
      const scopeIds = await ScheduledActivity.find(await access.scopedFilter(req.user, {})).distinct("_id");
      const jobFilter = {
        activity: { $in: scopeIds },
        kind: "upload_reminder",
        dueAt: { $gte: todayStart, $lte: todayEnd },
      };
      if (req.user.role === "manager") jobFilter.recipient = req.user._id;
      remindersDueToday = await NotificationJob.find(jobFilter)
        .populate({ path: "activity", select: "title businessName scheduledAt activityId" })
        .sort({ dueAt: 1 })
        .limit(100)
        .lean();
      const statsAgg = await NotificationJob.aggregate([
        { $match: { activity: { $in: scopeIds }, ...(req.user.role === "manager" ? { recipient: req.user._id } : {}) } },
        { $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } },
      ]);
      reminderStats = statsAgg.map((s) => ({ channel: s._id.channel, status: s._id.status, count: s.count }));
    }

    const ser = (list) => list.map((a) => serialize(a, req.user, now));
    return res.json({
      timezone: ist.TIMEZONE,
      now,
      todayLabel: ist.formatISTDate(now),
      counts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      upcomingDeadlines: ser(upcoming),
      overdue: ser(overdue.filter((a) => a.status !== "Escalated")),
      pendingApprovals: ser(pendingApprovals),
      escalated: ser(escalated),
      scheduledToday: ser(todayItems),
      remindersDueToday: remindersDueToday.map((j) => ({
        ...j,
        dueLabel: ist.formatISTDateTime(j.dueAt),
      })),
      reminderStats,
    });
  } catch (err) {
    return sendError(res, err, "Failed to load planner summary.");
  }
};

exports.listReminders = async (req, res) => {
  try {
    const scopeIds = await ScheduledActivity.find(await access.scopedFilter(req.user, {})).distinct("_id");
    const filter = { activity: { $in: scopeIds } };
    if (req.user.role === "manager" && req.query.all !== "true") filter.recipient = req.user._id;
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.kind) filter.kind = req.query.kind;
    const jobs = await NotificationJob.find(filter)
      .populate({ path: "activity", select: "title businessName scheduledAt activityId status activityType" })
      .populate("recipient", "name")
      .select("-payload -lockOwner")
      .sort({ dueAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 300, 1000))
      .lean();
    return res.json({
      jobs: jobs.map((j) => ({
        ...j,
        dueLabel: ist.formatISTDateTime(j.dueAt),
        sentLabel: j.sentAt ? ist.formatISTDateTime(j.sentAt) : "",
      })),
    });
  } catch (err) {
    return sendError(res, err, "Failed to load reminders.");
  }
};

exports.listEscalations = async (req, res) => {
  try {
    const filter = await access.scopedFilter(
      req.user,
      req.query.history === "true" ? { "escalation.count": { $gt: 0 } } : { status: "Escalated" }
    );
    const docs = await ScheduledActivity.find(filter)
      .populate(POPULATE)
      .populate("escalation.events.supervisors", "name")
      .populate("escalation.events.acknowledgedBy", "name")
      .populate("escalation.events.resolvedBy", "name")
      .sort({ "escalation.lastEscalatedAt": -1 })
      .limit(300);
    return res.json({ activities: docs.map((d) => serialize(d, req.user)) });
  } catch (err) {
    return sendError(res, err, "Failed to load escalations.");
  }
};

/** Options for the create/edit form, restricted to what the user may use. */
exports.getFormOptions = async (req, res) => {
  try {
    const managersQuery = User.find({ role: "manager", isActive: { $ne: false } }).select("name email").sort({ name: 1 });
    let clientsQuery;
    let businessFilter;
    if (req.user.role === "admin") {
      clientsQuery = User.find({ role: "client" }).select("name companyName email").sort({ name: 1 });
      businessFilter = {};
    } else {
      clientsQuery = User.find({ role: "client", assignedManager: req.user._id }).select("name companyName email").sort({ name: 1 });
      businessFilter = await getManagerAuthorizedBusinessQuery(req.user);
    }
    const [managers, clients, businesses] = await Promise.all([
      managersQuery,
      clientsQuery,
      SalesBusiness.find({ ...businessFilter, isActive: { $ne: false } }).select("name code city state clientAccount").sort({ name: 1 }),
    ]);
    return res.json({
      timezone: ist.TIMEZONE,
      activityTypes: rules.ACTIVITY_TYPES,
      statuses: rules.STATUSES,
      priorities: rules.PRIORITIES,
      reminderLeadHours: rules.getReminderLeadHours(),
      escalationHours: rules.getEscalationHours(),
      quarterStartMonth: Number(process.env.QUARTER_START_MONTH) === 4 ? 4 : 1,
      managers,
      clients,
      businesses,
    });
  } catch (err) {
    return sendError(res, err, "Failed to load form options.");
  }
};
