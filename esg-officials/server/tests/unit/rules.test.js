const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../../services/planner/rules");
const ist = require("../../utils/istDate");

const at = (d, t) => ist.parseISTDateTime(d, t);

test("Scenario 2: upload on 26 Oct 2026 -> reminder due 25 Oct 2026 (same time, IST)", () => {
  const scheduled = at("2026-10-26", "10:00");
  const r = rules.computeReminder(scheduled, at("2026-10-14", "12:00"), 24);
  assert.equal(r.required, true);
  assert.equal(r.late, false);
  assert.equal(ist.formatISTDate(r.dueAt), "25 October 2026");
  assert.equal(ist.formatISTTime(r.dueAt), "10:00 AM");
});

test("reminder is sent immediately (late) when scheduled less than 24h ahead", () => {
  const now = at("2026-10-26", "08:00");
  const r = rules.computeReminder(at("2026-10-26", "10:00"), now, 24);
  assert.equal(r.required, true);
  assert.equal(r.late, true);
  assert.equal(r.dueAt.getTime(), now.getTime());
});

test("no reminder when the scheduled time already passed", () => {
  const r = rules.computeReminder(at("2026-10-26", "10:00"), at("2026-10-27", "10:00"), 24);
  assert.equal(r.required, false);
});

test("Scenario 4: incomplete task escalates exactly 24h after the deadline", () => {
  const a = { status: "In Progress", scheduledAt: at("2026-10-26", "10:00"), deadline: at("2026-10-26", "18:00"), escalation: {} };
  assert.equal(rules.shouldEscalate(a, at("2026-10-27", "17:59"), 24), false);
  assert.equal(rules.shouldEscalate(a, at("2026-10-27", "18:00"), 24), true);
  assert.equal(ist.formatISTDateTime(rules.escalationDueAt(a, 24)), "27 October 2026, 6:00 PM IST");
});

test("escalation start time overrides the deadline", () => {
  const a = { status: "Scheduled", scheduledAt: at("2026-10-26", "10:00"), deadline: at("2026-10-26", "10:00"), escalationStartAt: at("2026-10-28", "09:00"), escalation: {} };
  assert.equal(rules.shouldEscalate(a, at("2026-10-28", "10:00"), 24), false);
  assert.equal(rules.shouldEscalate(a, at("2026-10-29", "09:00"), 24), true);
});

test("Scenario 5: completed and cancelled tasks never escalate", () => {
  const base = { scheduledAt: at("2026-10-20", "10:00"), deadline: at("2026-10-20", "10:00"), escalation: {} };
  const later = at("2026-11-30", "10:00");
  assert.equal(rules.shouldEscalate({ ...base, status: "Completed" }, later), false);
  assert.equal(rules.shouldEscalate({ ...base, status: "Cancelled" }, later), false);
  assert.equal(rules.shouldEscalate({ ...base, status: "Escalated" }, later), false);
});

test("same escalation due time never escalates twice; a new deadline can", () => {
  const a = { status: "In Progress", scheduledAt: at("2026-10-20", "10:00"), deadline: at("2026-10-20", "10:00"), escalation: {} };
  const due = rules.escalationDueAt(a, 24);
  a.escalation.lastEscalatedDueAt = due;
  assert.equal(rules.shouldEscalate(a, at("2026-11-01", "10:00"), 24), false);
  a.deadline = at("2026-10-25", "10:00");
  assert.equal(rules.shouldEscalate(a, at("2026-11-01", "10:00"), 24), true);
});

test("display state / overdue", () => {
  const now = at("2026-10-27", "12:00");
  const a = { status: "Scheduled", scheduledAt: at("2026-10-26", "10:00"), deadline: at("2026-10-26", "10:00") };
  assert.equal(rules.displayState(a, now), "overdue");
  assert.equal(rules.displayState({ ...a, status: "Completed" }, now), "completed");
  assert.equal(rules.displayState({ ...a, deadline: at("2026-10-30", "10:00"), status: "Pending Approval" }, now), "pending-approval");
  assert.equal(rules.displayState({ ...a, deadline: at("2026-10-30", "10:00") }, now), "upcoming");
});

test("status transitions", () => {
  assert.equal(rules.canTransition("Scheduled", "Completed", "manager"), true);
  assert.equal(rules.canTransition("Scheduled", "Completed", "manager", { requiresClientApproval: true }), false);
  assert.equal(rules.canTransition("Escalated", "Completed", "manager"), false);
  assert.equal(rules.canTransition("Completed", "In Progress", "manager"), false);
  assert.equal(rules.canTransition("Scheduled", "Escalated", "admin"), false);
  assert.equal(rules.canTransition("Scheduled", "In Progress", "client"), false);
});
