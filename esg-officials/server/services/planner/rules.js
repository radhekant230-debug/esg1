/**
 * Pure scheduling rules for ScheduledActivity records.
 * No database access here so the rules can be unit-tested in isolation
 * and reused by controllers, the scheduler and tests.
 */

const HOUR_MS = 60 * 60 * 1000;

const ACTIVITY_TYPES = [
  "Scheduled Upload",
  "Business Activity",
  "Campaign",
  "Deadline",
  "Approval",
  "Meeting",
];

const STATUSES = [
  "Scheduled",
  "In Progress",
  "Pending Approval",
  "Completed",
  "Cancelled",
  "Escalated",
];

const TERMINAL_STATUSES = ["Completed", "Cancelled"];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const toPositiveNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Hours before scheduledAt at which the reminder fires (default 24). */
const getReminderLeadHours = () => toPositiveNumber(process.env.REMINDER_LEAD_HOURS, 24);

/** Hours after the deadline / escalation start before a task escalates (default 24). */
const getEscalationHours = () => toPositiveNumber(process.env.ESCALATION_HOURS, 24);

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

const asDate = (v) => (v ? new Date(v) : null);

/** The deadline is the scheduled date/time unless an explicit deadline was set. */
function effectiveDeadline(activity) {
  return asDate(activity.deadline) || asDate(activity.scheduledAt);
}

/** Escalation clock starts at the explicit escalationStartAt, else at the deadline. */
function escalationStart(activity) {
  return asDate(activity.escalationStartAt) || effectiveDeadline(activity);
}

function escalationDueAt(activity, hours = getEscalationHours()) {
  const start = escalationStart(activity);
  return start ? new Date(start.getTime() + hours * HOUR_MS) : null;
}

/**
 * Reminder due time = scheduled time minus lead hours.
 * e.g. scheduled 26 Oct 2026 10:00 IST -> reminder 25 Oct 2026 10:00 IST.
 * If that moment is already past when the activity is created/rescheduled,
 * the reminder is due immediately (flagged `late`), unless the activity time
 * itself has passed, in which case no reminder is sent.
 */
function computeReminder(scheduledAt, now = new Date(), leadHours = getReminderLeadHours()) {
  const at = asDate(scheduledAt);
  if (!at) return { dueAt: null, late: false, required: false };
  const ideal = new Date(at.getTime() - leadHours * HOUR_MS);
  if (at.getTime() <= now.getTime()) {
    return { dueAt: ideal, late: false, required: false, reason: "scheduled time already passed" };
  }
  if (ideal.getTime() < now.getTime()) {
    return { dueAt: new Date(now.getTime()), idealDueAt: ideal, late: true, required: true };
  }
  return { dueAt: ideal, late: false, required: true };
}

function isOverdue(activity, now = new Date()) {
  if (isTerminal(activity.status)) return false;
  const deadline = effectiveDeadline(activity);
  return Boolean(deadline && deadline.getTime() < now.getTime());
}

/**
 * Whether the escalation sweep should escalate this activity now.
 * Escalates once per escalation due time: if the deadline is not changed after
 * an escalation is resolved, it will not escalate again for the same deadline.
 */
function shouldEscalate(activity, now = new Date(), hours = getEscalationHours()) {
  if (isTerminal(activity.status)) return false;
  if (activity.status === "Escalated") return false;
  const due = escalationDueAt(activity, hours);
  if (!due || due.getTime() > now.getTime()) return false;
  const last = asDate(activity.escalation && activity.escalation.lastEscalatedDueAt);
  if (last && last.getTime() === due.getTime()) return false;
  return true;
}

/**
 * Display state used to colour calendar entries identically on every dashboard.
 */
function displayState(activity, now = new Date()) {
  if (activity.status === "Completed") return "completed";
  if (activity.status === "Cancelled") return "cancelled";
  if (activity.status === "Escalated") return "escalated";
  if (activity.status === "Pending Approval") return isOverdue(activity, now) ? "overdue" : "pending-approval";
  if (isOverdue(activity, now)) return "overdue";
  return "upcoming";
}

/**
 * Status transitions a role may request through the generic status endpoint.
 * Escalation / cancellation / approval have dedicated endpoints.
 */
const MANAGER_STATUS_TRANSITIONS = {
  Scheduled: ["In Progress", "Pending Approval", "Completed"],
  "In Progress": ["Scheduled", "Pending Approval", "Completed"],
  "Pending Approval": ["In Progress", "Completed"],
  Escalated: [], // must go through acknowledge/resolve
  Completed: [],
  Cancelled: [],
};

function canTransition(from, to, role, { requiresClientApproval = false } = {}) {
  if (role === "admin") {
    if (to === "Escalated" || to === "Cancelled") return false; // dedicated endpoints
    if (from === to) return false;
    return STATUSES.includes(to);
  }
  if (role === "manager") {
    const allowed = MANAGER_STATUS_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) return false;
    // When the client must approve, a manager cannot mark it Completed directly.
    if (to === "Completed" && requiresClientApproval) return false;
    return true;
  }
  return false;
}

module.exports = {
  HOUR_MS,
  ACTIVITY_TYPES,
  STATUSES,
  TERMINAL_STATUSES,
  PRIORITIES,
  getReminderLeadHours,
  getEscalationHours,
  isTerminal,
  effectiveDeadline,
  escalationStart,
  escalationDueAt,
  computeReminder,
  isOverdue,
  shouldEscalate,
  displayState,
  canTransition,
};
