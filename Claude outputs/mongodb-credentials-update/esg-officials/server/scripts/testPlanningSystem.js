/**
 * End-to-end tests for the planner, reminders, WhatsApp, escalation, import and
 * analytics features and DB connection management (scenarios 1-19). Runs the real Express app
 * against a THROW-AWAY test database and a local mock of the WhatsApp Cloud API.
 *
 * Usage (never point this at production):
 *   MONGO_URI_TEST="mongodb+srv://.../?retryWrites=true" npm run test:integration
 * or, with no MongoDB available:  npm i -D mongodb-memory-server && npm run test:integration
 *
 * The database name always ends in "_test" and is dropped before and after the run.
 */
require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const assert = require("assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const TEST_DB = process.env.MONGO_TEST_DB || "esg_planner_test";
if (!/_test$/.test(TEST_DB)) {
  console.error("Refusing to run: MONGO_TEST_DB must end with _test");
  process.exit(1);
}

// ---- Environment for the run (set BEFORE loading the app) ------------------
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
process.env.APP_BASE_URL = "https://portal.example.test";
process.env.PLANNER_SCHEDULER_ENABLED = "false";
process.env.REMINDER_LEAD_HOURS = "24";
process.env.ESCALATION_HOURS = "24";
process.env.CRON_SECRET = "integration-cron-secret-0123456789";
process.env.WHATSAPP_APP_SECRET = "mock-app-secret";
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "mock-verify-token";

const ist = require("../utils/istDate");

const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✘ ${name}\n      ${err && err.stack ? err.stack.split("\n").slice(0, 4).join("\n      ") : err}`);
  }
}

// ---- Mock WhatsApp Cloud API -----------------------------------------------
const waCalls = [];
function startMockWhatsApp() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const payload = body ? JSON.parse(body) : {};
        waCalls.push({ url: req.url, payload, auth: req.headers.authorization });
        res.setHeader("Content-Type", "application/json");
        if (payload.to === "919999900002") {
          // Manager B: provider rejects the template
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: { message: "(#132001) Template name does not exist in the translation", code: 132001 } }));
        }
        res.statusCode = 200;
        return res.end(JSON.stringify({ messages: [{ id: `wamid.MOCK${waCalls.length}` }] }));
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function setWhatsAppEnv(port, on = true) {
  if (on) {
    process.env.WHATSAPP_ACCESS_TOKEN = "mock-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "100200300";
    process.env.WHATSAPP_REMINDER_TEMPLATE = "upload_reminder";
    process.env.WHATSAPP_ESCALATION_TEMPLATE = "task_escalation";
    process.env.WHATSAPP_API_BASE_URL = `http://127.0.0.1:${port}`;
  } else {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  }
}

// ---- HTTP helper ------------------------------------------------------------
let baseUrl;
const tokens = {};
async function api(who, method, path, body, { raw = false, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (who) opts.headers.Authorization = `Bearer ${tokens[who]}`;
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  if (raw) return res;
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

function csvForm(text, filename = "sales.csv") {
  const fd = new FormData();
  fd.append("file", new Blob([text], { type: "text/csv" }), filename);
  return fd;
}

// ---- Main -------------------------------------------------------------------
(async () => {
  let memoryServer = null;
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    try {
      const { MongoMemoryReplSet } = require("mongodb-memory-server");
      memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      uri = memoryServer.getUri();
      console.log("Using in-memory MongoDB replica set");
    } catch (e) {
      console.error("Set MONGO_URI_TEST to a NON-production MongoDB, or install mongodb-memory-server (npm i -D mongodb-memory-server).");
      process.exit(1);
    }
  }
  if (process.env.MONGO_URI && uri === process.env.MONGO_URI && !process.env.ALLOW_SAME_CLUSTER) {
    console.error("Refusing to run: MONGO_URI_TEST equals MONGO_URI. Use a separate cluster (or set ALLOW_SAME_CLUSTER=1 — the test DB name still ends in _test).");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: TEST_DB });
  await mongoose.connection.dropDatabase();

  const mockWa = await startMockWhatsApp();
  setWhatsAppEnv(mockWa.address().port, true);

  const app = require("../app");
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const User = require("../models/User");
  const SalesBusiness = require("../models/sales/SalesBusiness");
  const ScheduledActivity = require("../models/planner/ScheduledActivity");
  const NotificationJob = require("../models/planner/NotificationJob");
  const Notification = require("../models/Notification");
  const AuditLog = require("../models/AuditLog");
  const { runPlannerTick } = require("../services/planner/scheduler");
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

  // ---- Fixtures --------------------------------------------------------------
  const pw = "x".repeat(60);
  const admin = await User.create({ name: "Admin", email: "admin@t.test", password: pw, role: "admin" });
  const supervisor = await User.create({ name: "Supervisor Sue", email: "sup@t.test", password: pw, role: "manager", assignedCity: "Ranchi", assignedState: "Jharkhand" });
  const managerA = await User.create({
    name: "Manager A", email: "a@t.test", password: pw, role: "manager",
    assignedState: "Jharkhand", assignedCity: "Ranchi", assignedCities: ["Ranchi", "Dhanbad"], supervisor: supervisor._id,
    whatsappNumber: "+919999900001", whatsappVerified: true, whatsappVerificationMethod: "admin",
    notificationPreferences: { inApp: true, whatsapp: true, uploadReminders: true, escalations: true },
  });
  const managerB = await User.create({
    name: "Manager B", email: "b@t.test", password: pw, role: "manager",
    assignedState: "Bihar", assignedCity: "Patna",
    whatsappNumber: "+919999900002", whatsappVerified: true, whatsappVerificationMethod: "admin",
    notificationPreferences: { inApp: true, whatsapp: true, uploadReminders: true, escalations: true },
  });
  const clientA = await User.create({ name: "Client A", email: "ca@t.test", password: pw, role: "client", companyName: "Green Horizon Pvt Ltd", assignedManager: managerA._id });
  const clientB = await User.create({ name: "Client B", email: "cb@t.test", password: pw, role: "client", companyName: "Patna Foods", assignedManager: managerB._id });
  const bizA = await SalesBusiness.create({ name: "Hotel Green Horizon", code: "BIZ-JH-RAN-0001", category: "Hotel", state: "Jharkhand", city: "Ranchi", monthlyTarget: 350000, clientAccount: clientA._id });
  const bizA2 = await SalesBusiness.create({ name: "Maya Multicuisine Restaurant", code: "BIZ-JH-RAN-0002", category: "Restaurant", state: "Jharkhand", city: "Ranchi", monthlyTarget: 0 });
  const bizA3 = await SalesBusiness.create({ name: "Spice Route", code: "BIZ-JH-RAN-0003", category: "Restaurant", state: "Jharkhand", city: "Ranchi", monthlyTarget: 70000 });
  const clientD = await User.create({ name: "Client Dhanbad", email: "cd@t.test", password: pw, role: "client", companyName: "Coal Capital Hospitality", assignedManager: managerA._id });
  const bizD = await SalesBusiness.create({ name: "Coal Capital Grand", code: "BIZ-JH-DHN-0001", category: "Hotel", state: "Jharkhand", city: "Dhanbad", monthlyTarget: 0, clientAccount: clientD._id });
  const bizB = await SalesBusiness.create({ name: "Patna Grand", code: "BIZ-BR-PAT-0001", category: "Hotel", state: "Bihar", city: "Patna", monthlyTarget: 100000, clientAccount: clientB._id });

  const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
  Object.assign(tokens, { admin: sign(admin), managerA: sign(managerA), managerB: sign(managerB), clientA: sign(clientA), clientB: sign(clientB), clientD: sign(clientD) });

  // The acceptance example uses 26 October 2026; if that date has passed, use a date 12 days ahead.
  let schedDate = "2026-10-26";
  if (ist.parseISTDateTime(schedDate, "10:00").getTime() - Date.now() < 36 * 3600 * 1000) {
    const p = ist.toISTParts(new Date(Date.now() + 12 * 86400000));
    schedDate = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    console.log(`(26 Oct 2026 is no longer in the future — using ${schedDate})`);
  }
  const schedAt = ist.parseISTDateTime(schedDate, "10:00");
  const H = 3600 * 1000;

  let uploadId;
  let bUploadId;

  console.log("\nScenarios");

  await scenario("1. Schedule an upload and the calendar shows the exact date (IST)", async () => {
    const r = await api("managerA", "POST", "/planner/activities", {
      title: "Diwali news upload",
      activityType: "Scheduled Upload",
      businessId: bizA._id,
      scheduledDate: schedDate,
      scheduledTime: "10:00",
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    uploadId = r.data.activity._id;
    assert.equal(r.data.activity.scheduledDateLabel, ist.formatISTDate(schedAt));
    assert.equal(r.data.activity.scheduledTimeLabel, "10:00 AM");
    assert.equal(String(r.data.activity.client._id), String(clientA._id), "client auto-linked from business");
    const p = ist.toISTParts(schedAt);
    const list = await api("managerA", "GET", `/planner/activities?year=${p.year}&month=${p.month}`);
    const item = list.data.activities.find((a) => a._id === uploadId);
    assert.ok(item, "activity is in the month view");
    assert.equal(item.dayKey, schedDate);
    if (schedDate === "2026-10-26") assert.equal(item.scheduledDateLabel, "26 October 2026");
  });

  await scenario("2. Reminder is scheduled for the day before (25 October 2026) and sent once", async () => {
    const r = await api("managerA", "GET", `/planner/activities/${uploadId}`);
    const expectedDue = new Date(schedAt.getTime() - 24 * H);
    assert.equal(new Date(r.data.activity.reminder.dueAt).toISOString(), expectedDue.toISOString());
    if (schedDate === "2026-10-26") assert.match(r.data.activity.reminder.dueLabel, /^25 October 2026, 10:00 AM IST$/);
    const jobs = await NotificationJob.find({ activity: uploadId, kind: "upload_reminder" });
    assert.deepEqual(jobs.map((j) => j.channel).sort(), ["in_app", "whatsapp"]);

    await runPlannerTick({ now: new Date(expectedDue.getTime() - 60 * 1000), source: "test" });
    assert.equal(await Notification.countDocuments({ activity: uploadId, type: "reminder" }), 0, "not sent early");

    await runPlannerTick({ now: expectedDue, source: "test" });
    await runPlannerTick({ now: new Date(expectedDue.getTime() + 5 * 60 * 1000), source: "test" });
    const notes = await Notification.find({ activity: uploadId, type: "reminder" });
    assert.equal(notes.length, 1, "exactly one in-app reminder (no duplicates)");
    assert.equal(String(notes[0].recipient), String(managerA._id));
    assert.match(notes[0].message, /Hotel Green Horizon/);
    assert.match(notes[0].link, new RegExp(`activity=${uploadId}`));
  });

  await scenario("3. WhatsApp reports the provider's actual status (accepted -> delivered, and failures)", async () => {
    const waJob = await NotificationJob.findOne({ activity: uploadId, kind: "upload_reminder", channel: "whatsapp" });
    assert.equal(waJob.status, "accepted", `got ${waJob.status} ${waJob.lastError || waJob.skipReason}`);
    assert.match(waJob.providerMessageId, /^wamid\.MOCK/);
    const call = waCalls.find((c) => c.payload.to === "919999900001");
    assert.equal(call.payload.template.name, "upload_reminder");
    const named = Object.fromEntries(call.payload.template.components[0].parameters.map((p) => [p.parameter_name, p.text]));
    assert.equal(named.business_name, "Hotel Green Horizon");
    assert.equal(named.scheduled_date, ist.formatISTDate(schedAt));
    assert.equal(named.scheduled_time, "10:00 AM IST");
    assert.match(named.task_link, /^https:\/\/portal\.example\.test\/manager\/dashboard\?tab=uploads&activity=/);

    // Delivery receipt via signed webhook
    const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: waJob.providerMessageId, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)) }] } }] }] });
    const sig = `sha256=${crypto.createHmac("sha256", "mock-app-secret").update(body).digest("hex")}`;
    const bad = await api(null, "POST", "/webhooks/whatsapp", body, { headers: { "X-Hub-Signature-256": "sha256=00" } });
    assert.equal(bad.status, 401, "unsigned webhook rejected");
    const ok = await api(null, "POST", "/webhooks/whatsapp", body, { headers: { "X-Hub-Signature-256": sig } });
    assert.equal(ok.status, 200);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await NotificationJob.findById(waJob._id)).status, "delivered");

    // Provider failure for manager B is recorded as failed — never as sent
    const rb = await api("managerB", "POST", "/planner/activities", {
      title: "Patna menu upload", businessId: bizB._id, scheduledDate: schedDate, scheduledTime: "11:00",
    });
    assert.equal(rb.status, 201, JSON.stringify(rb.data));
    bUploadId = rb.data.activity._id;
    await runPlannerTick({ now: new Date(ist.parseISTDateTime(schedDate, "11:00").getTime() - 24 * H), source: "test" });
    const bJob = await NotificationJob.findOne({ activity: bUploadId, channel: "whatsapp" });
    assert.equal(bJob.status, "failed");
    assert.match(bJob.lastError, /132001/);
    assert.equal(bJob.providerMessageId, "");
    const bInApp = await NotificationJob.findOne({ activity: bUploadId, channel: "in_app" });
    assert.equal(bInApp.status, "sent", "in-app still delivered");

    // Not configured -> skipped with a clear reason, in-app keeps working
    setWhatsAppEnv(0, false);
    const rc = await api("managerA", "POST", "/planner/activities", {
      title: "Unconfigured WA check", businessId: bizA2._id, scheduledDate: schedDate, scheduledTime: "15:00",
    });
    await runPlannerTick({ now: new Date(ist.parseISTDateTime(schedDate, "15:00").getTime() - 24 * H), source: "test" });
    const cJob = await NotificationJob.findOne({ activity: rc.data.activity._id, channel: "whatsapp" });
    assert.equal(cJob.status, "skipped");
    assert.match(cJob.skipReason, /not configured/i);
    const st = await api("managerA", "GET", "/planner/integrations/status");
    assert.equal(st.data.whatsapp.configured, false);
    setWhatsAppEnv(mockWa.address().port, true);
  });

  await scenario("4. Incomplete task escalates 24h after the deadline (manager + supervisor notified once)", async () => {
    const deadline = schedAt; // deadline defaults to the scheduled time
    await runPlannerTick({ now: new Date(deadline.getTime() + 24 * H - 60 * 1000), source: "test" });
    assert.notEqual((await ScheduledActivity.findById(uploadId)).status, "Escalated", "not before 24h");

    await runPlannerTick({ now: new Date(deadline.getTime() + 24 * H), source: "test" });
    const a = await ScheduledActivity.findById(uploadId);
    assert.equal(a.status, "Escalated");
    assert.equal(a.escalation.count, 1);
    assert.ok(a.escalation.lastEscalatedAt);
    const notified = await Notification.find({ activity: uploadId, type: "escalation" });
    const recipients = notified.map((n) => String(n.recipient)).sort();
    assert.deepEqual(recipients, [String(managerA._id), String(supervisor._id)].sort());

    await runPlannerTick({ now: new Date(deadline.getTime() + 30 * H), source: "test" });
    assert.equal((await ScheduledActivity.findById(uploadId)).escalation.count, 1, "no repeated escalation");
    assert.equal(await Notification.countDocuments({ activity: uploadId, type: "escalation" }), 2, "no duplicate notifications");
    assert.ok(await AuditLog.findOne({ entityId: a._id, action: "ESCALATED" }), "audit trail");

    const ack = await api("managerA", "PATCH", `/planner/activities/${uploadId}/escalation/acknowledge`, { notes: "On it" });
    assert.equal(ack.status, 200, JSON.stringify(ack.data));
    const res = await api("managerA", "PATCH", `/planner/activities/${uploadId}/escalation/resolve`, { resolution: "completed", notes: "Uploaded" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.activity.status, "Completed");
  });

  await scenario("5. Completed and cancelled tasks are never escalated", async () => {
    const mk = async (title, time) =>
      (await api("managerA", "POST", "/planner/activities", { title, businessId: bizA3._id, scheduledDate: schedDate, scheduledTime: time })).data.activity._id;
    const doneId = await mk("Will complete", "12:00");
    const cancelId = await mk("Will cancel", "13:00");
    assert.equal((await api("managerA", "PATCH", `/planner/activities/${doneId}/status`, { status: "Completed" })).status, 200);
    const c = await api("managerA", "PATCH", `/planner/activities/${cancelId}/cancel`, { reason: "Client paused campaign" });
    assert.equal(c.status, 200);
    assert.equal(await NotificationJob.countDocuments({ activity: cancelId, status: "pending" }), 0, "pending reminders cancelled");
    await runPlannerTick({ now: new Date(schedAt.getTime() + 10 * 24 * H), source: "test" });
    assert.equal((await ScheduledActivity.findById(doneId)).status, "Completed");
    assert.equal((await ScheduledActivity.findById(cancelId)).status, "Cancelled");
    assert.equal(await Notification.countDocuments({ activity: { $in: [doneId, cancelId] }, type: "escalation" }), 0);
  });

  const validCsv =
    "Month,Business Name,Location,Total Sales,Sales Basis,Orders,Target,Discount,Cost,Expenses,Remarks\n" +
    "October 2026,Hotel Green Horizon,Ranchi,100000,Gross,50,120000,10000,50000,20000,\n" +
    "October 2026,Maya Multicuisine Restaurant,Ranchi,45000,Net,20,,5000,30000,20000,\n" +
    "October 2026,Spice Route,Ranchi,80000,Gross,30,,,,,Costs not tracked\n" +
    "September 2026,Hotel Green Horizon,Ranchi,90000,Gross,45,120000,,,,\n";

  await scenario("6. Import a valid CSV and the monthly dashboard totals match", async () => {
    const prev = await api("managerA", "POST", "/sales/upload/preview", csvForm(validCsv));
    assert.equal(prev.status, 200, JSON.stringify(prev.data));
    assert.equal(prev.data.validCount, 4);
    assert.equal(prev.data.invalidCount, 0);
    const commit = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, duplicateMode: "skip" });
    assert.equal(commit.status, 200, JSON.stringify(commit.data));
    assert.equal(commit.data.summary.successCount, 4);
    const again = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId });
    assert.equal(again.status, 409, "the same preview cannot be imported twice");

    const an = await api("managerA", "GET", "/sales/analytics/monthly?year=2026&month=10&months=3");
    assert.equal(an.status, 200, JSON.stringify(an.data));
    assert.equal(an.data.selected.recordedSales.value, 225000);
    assert.equal(an.data.selected.orders, 100);
    assert.equal(an.data.imports.importedRecords, 3);
    // Re-importing the same rows is reported as existing and skipped (no duplicates)
    const prev2 = await api("managerA", "POST", "/sales/upload/preview", csvForm(validCsv));
    assert.equal(prev2.data.existingCount, 4);
    assert.ok(prev2.data.previouslyImported, "same file detected");
    const c2 = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev2.data.importJobId, duplicateMode: "skip" });
    assert.equal(c2.data.summary.skippedCount, 4);
    assert.equal(c2.data.summary.successCount, 0);
  });

  await scenario("7. Invalid CSV gives row-level errors and needs explicit confirmation", async () => {
    const bad =
      "Monthly report,,,\n" +
      "Month,Business Name,Location,Total Sales\n" +
      ",Hotel Green Horizon,Ranchi,1000\n" +
      "November 2026,Unknown Cafe,Ranchi,1000\n" +
      "November 2026,Patna Grand,Patna,5000\n" +
      "November 2026,Spice Route,Ranchi,abc\n" +
      "November 2026,Hotel Green Horizon,Ranchi,2000\n";
    const prev = await api("managerA", "POST", "/sales/upload/preview", csvForm(bad, "bad.csv"));
    assert.equal(prev.status, 200, JSON.stringify(prev.data));
    assert.equal(prev.data.columnInfo.headerRow, 2);
    assert.equal(prev.data.invalidCount, 4);
    assert.equal(prev.data.validCount, 1);
    const errs = Object.fromEntries(prev.data.invalidRows.map((r) => [r.rowNumber, r.errors.join(" ")]));
    assert.match(errs[3], /Month is missing/);
    assert.match(errs[4], /not registered/);
    assert.match(errs[5], /not authorized/);
    assert.match(errs[6], /Total Sales is not a number/);
    const blocked = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.data.requiresAcknowledgement, true);
    const csvRes = await api("managerA", "GET", `/sales/upload/${prev.data.importJobId}/invalid-rows`, undefined, { raw: true });
    const text = await csvRes.text();
    assert.match(text, /Row Number/);
    assert.match(text, /Unknown Cafe/);
    const ok = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, acknowledgeInvalid: true });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.summary.successCount, 1);
    assert.equal(ok.data.summary.rejectedCount, 4);
    const missingCols = await api("managerA", "POST", "/sales/upload/preview", csvForm("Month,Outlet,Amt\nOctober 2026,X,1\n", "m.csv"));
    assert.equal(missingCols.status, 422);
    assert.equal(missingCols.data.needsMapping, true);
  });

  await scenario("8. Sales, discount, profit and loss match known test data", async () => {
    const an = await api("managerA", "GET", "/sales/analytics/monthly?year=2026&month=10&months=2");
    const s = an.data.selected;
    assert.deepEqual([s.gross.value, s.gross.status], [230000, "complete"]);
    assert.deepEqual([s.discount.value, s.discount.status], [15000, "partial"]);
    assert.equal(s.net.value, 135000);
    assert.equal(s.cost.value, 80000);
    assert.equal(s.grossProfit.value, 55000);
    assert.equal(s.expenses.value, 40000);
    assert.equal(s.netProfit.value, 15000);
    assert.equal(s.profitMargin.value, 11.11);
    // Target: Green Horizon record target 120000 + Spice Route business target 70000 (Maya has none)
    assert.equal(s.target.value, 190000);
    assert.equal(s.target.achievement, 94.74);
    assert.equal(s.growth.recordedSales, 150); // Sep 90000 -> Oct 225000
    const maya = an.data.businessBreakdown.find((b) => b.name === "Maya Multicuisine Restaurant");
    assert.equal(maya.netProfit.value, -5000, "loss shown as negative");
    const spice = an.data.businessBreakdown.find((b) => b.name === "Spice Route");
    assert.equal(spice.grossProfit.value, null, "missing cost -> Data unavailable, not 0");
    const exp = await api("managerA", "GET", "/sales/analytics/monthly/export?year=2026&month=10&format=csv", undefined, { raw: true });
    const text = await exp.text();
    assert.equal(exp.status, 200);
    assert.match(text, /Data unavailable/);
  });

  await scenario("9. Manager and client see the same dates; each sees only permitted records", async () => {
    const m = await api("managerA", "GET", `/planner/activities/${uploadId}`);
    const c = await api("clientA", "GET", `/planner/activities/${uploadId}`);
    assert.equal(c.status, 200);
    assert.equal(c.data.activity.scheduledAt, m.data.activity.scheduledAt);
    assert.equal(c.data.activity.scheduledDateLabel, m.data.activity.scheduledDateLabel);
    assert.equal(c.data.activity.status, m.data.activity.status);
    assert.equal(c.data.activity.reminder, undefined, "internal reminder data hidden from clients");
    assert.equal((await api("clientB", "GET", `/planner/activities/${uploadId}`)).status, 404);
    const listB = await api("clientB", "GET", "/planner/activities");
    assert.ok(listB.data.activities.every((a) => a._id !== uploadId));
    assert.ok(listB.data.activities.some((a) => a._id === bUploadId));
    assert.equal((await api("managerB", "PATCH", `/planner/activities/${uploadId}/cancel`, { reason: "x" })).status, 403);
    assert.equal((await api("clientA", "POST", "/planner/activities", { title: "x", businessId: bizA._id, scheduledDate: schedDate })).status, 403);
    const forbidden = await api("managerB", "POST", "/planner/activities", { title: "x", businessId: bizA._id, scheduledDate: schedDate });
    assert.equal(forbidden.status, 403);
    const anB = await api("managerB", "GET", "/sales/analytics/monthly?year=2026&month=10");
    assert.ok(anB.data.businessBreakdown.every((b) => b.name === "Patna Grand"));
    const q = await api("clientA", "GET", `/planner/activities?year=${ist.toISTParts(schedAt).year}&quarter=${ist.quarterOf(schedAt).quarter}`);
    assert.ok(q.data.activities.some((a) => a._id === uploadId), "quarter view for client");
    assert.equal((await api("clientA", "GET", "/sales/analytics/monthly")).status, 403, "clients cannot read manager analytics");
  });

  await scenario("10. Existing features still respond", async () => {
    const checks = [
      ["managerA", "/sales/dashboard?year=2026&month=10"],
      ["managerA", "/sales/businesses"],
      ["managerA", "/sales/records"],
      ["managerA", "/sales/import-history"],
      ["managerA", "/notifications"],
      ["managerA", "/portal/clients-selector"],
      ["managerA", "/risks/calendar/events"],
      ["clientA", "/portal/profile"],
      ["admin", "/clients/managers/all"],
      ["admin", "/admin/overview"],
    ];
    for (const [who, path] of checks) {
      const r = await api(who, "GET", path);
      assert.equal(r.status, 200, `${path} -> ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    }
    const tpl = await api("managerA", "GET", "/sales/template?format=csv", undefined, { raw: true });
    assert.match(await tpl.text(), /Month,Business Name,Location,State,Total Sales,Sales Basis,Orders,Target,Discount,Cost,Expenses,Remarks/);
    const cron = await api(null, "POST", "/planner/cron/run", {}, { headers: { "X-Cron-Secret": "wrong-secret-wrong-secret-123" } });
    assert.equal(cron.status, 401);
  });


  // ---------------------------------------------------------------------------
  // Manager upload -> Client Portal synchronisation
  // ---------------------------------------------------------------------------
  const xlsxLib = require("xlsx");
  const xlsxForm = (aoa, filename = "sales.xlsx") => {
    const wb = xlsxLib.utils.book_new();
    xlsxLib.utils.book_append_sheet(wb, xlsxLib.utils.aoa_to_sheet(aoa), "Sales");
    const buf = xlsxLib.write(wb, { type: "buffer", bookType: "xlsx" });
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
    return fd;
  };
  const withFields = (fd, fields) => {
    Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
    return fd;
  };
  const clientSales = async (who) => (await api(who, "GET", "/portal/sales")).data;
  const clientStamp = async (who) => (await api(who, "GET", "/portal/sync-status")).data;

  await scenario("11. Valid CSV upload for Ranchi -> saved -> Ranchi client portal shows it (no client action)", async () => {
    const before = await clientStamp("clientA");
    const fd = withFields(csvForm("Total Sales,Orders,Discount,Cost,Expenses\n310000,140,15000,160000,60000\n", "ranchi_nov.csv"), {
      targetBusinessId: bizA._id, reportingMonth: 11, reportingYear: 2026,
    });
    const prev = await api("managerA", "POST", "/sales/upload/preview", fd);
    assert.equal(prev.status, 200, JSON.stringify(prev.data));
    assert.equal(prev.data.validCount, 1);
    assert.equal(prev.data.portalTargets[0].clientName, "Green Horizon Pvt Ltd", "preview names the client portal that will receive the data");
    const commit = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, duplicateMode: "add" });
    assert.equal(commit.status, 200, JSON.stringify(commit.data));
    assert.equal(commit.data.summary.clientPortalsUpdated, 1);
    const SalesRecord = require("../models/sales/SalesRecord");
    const rec = await SalesRecord.findOne({ business: bizA._id, year: 2026, month: 11 });
    assert.ok(rec, "record saved in the database");
    assert.equal(rec.totalSales, 310000);
    const after = await clientStamp("clientA");
    assert.notEqual(after.version, before.version, "client sync version changed -> dashboard auto-refreshes");
    const sales = await clientSales("clientA");
    const nov = sales.monthly.find((m) => m.monthName === "November 2026");
    assert.ok(nov, "client portal monthly summary includes November 2026");
    assert.equal(nov.totalSales, 310000);
    assert.equal(nov.netSales, 295000);
    assert.equal(nov.netProfit, 75000);
    assert.ok(sales.records.some((r) => r.source === "manager_import" && r.reportingMonth === "November 2026"));
    const note = await Notification.findOne({ recipient: clientA._id, type: "update" });
    assert.ok(note && /November 2026/.test(note.message), "client notified");
    const file = await api("managerA", "GET", `/sales/upload/${prev.data.importJobId}/file`, undefined, { raw: true });
    assert.equal(file.status, 200, "original file kept in import history");
    assert.match(await file.text(), /310000/);
    const hist = await api("managerA", "GET", "/sales/import-history");
    const h = hist.data.find((j) => j._id === prev.data.importJobId);
    assert.deepEqual(h.periods, ["November 2026"]);
    assert.equal(h.importedCount, 1);
    assert.equal(h.hasOriginalFile, true);
  });

  await scenario("12. Excel upload for Dhanbad -> Dhanbad client sees it; Ranchi client does not (and vice versa)", async () => {
    const prev = await api(
      "managerA",
      "POST",
      "/sales/upload/preview",
      xlsxForm([["Month", "Business Name", "Location", "Total Sales", "Orders"], ["November 2026", "Coal Capital Grand", "Dhanbad", 99000, 40]], "dhanbad_nov.xlsx")
    );
    assert.equal(prev.status, 200, JSON.stringify(prev.data));
    const commit = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, duplicateMode: "add" });
    assert.equal(commit.status, 200, JSON.stringify(commit.data));
    const d = await clientSales("clientD");
    assert.equal(d.monthly.find((m) => m.monthName === "November 2026").totalSales, 99000);
    assert.ok(d.records.every((r) => r.source !== "manager_import" || r.city === "Dhanbad"), "Dhanbad portal has only Dhanbad data");
    const a = await clientSales("clientA");
    assert.ok(a.records.every((r) => r.city !== "Dhanbad"), "Ranchi portal never shows Dhanbad data");
    assert.equal(a.monthly.find((m) => m.monthName === "November 2026").totalSales, 310000);
    const b = await clientSales("clientB");
    assert.ok(!b.records.some((r) => r.source === "manager_import" && ["Ranchi", "Dhanbad"].includes(r.city)));
    // A Ranchi-targeted upload cannot write Dhanbad rows
    const bad = await api("managerA", "POST", "/sales/upload/preview", withFields(
      csvForm("Month,Business Name,Location,Total Sales\nDecember 2026,Coal Capital Grand,Dhanbad,5000\n"),
      { targetBusinessId: bizA._id }
    ));
    assert.equal(bad.data.validCount, 0);
    assert.match(bad.data.invalidRows[0].errors[0], /upload target is "Hotel Green Horizon, Ranchi"/);
    // A manager cannot target a business outside their assignment
    const foreign = await api("managerA", "POST", "/sales/upload/preview", withFields(csvForm("Total Sales\n1\n"), { targetBusinessId: bizB._id, reportingMonth: 11, reportingYear: 2026 }));
    assert.equal(foreign.status, 403);
  });

  await scenario("13. Corrected re-upload replaces the period without duplicating; history kept", async () => {
    const SalesRecord = require("../models/sales/SalesRecord");
    const fd = withFields(csvForm("Total Sales,Orders\n325000,150\n", "ranchi_nov_corrected.csv"), { targetBusinessId: bizA._id, reportingMonth: 11, reportingYear: 2026 });
    const prev = await api("managerA", "POST", "/sales/upload/preview", fd);
    assert.equal(prev.data.existingCount, 1);
    assert.equal(prev.data.replacesImports.length, 1, "preview shows which earlier import would be replaced");
    const keep = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, duplicateMode: "add" });
    assert.equal(keep.data.summary.skippedCount, 1, "'Add new only' keeps the existing month");
    assert.equal((await SalesRecord.findOne({ business: bizA._id, year: 2026, month: 11 })).totalSales, 310000);

    const prev2 = await api("managerA", "POST", "/sales/upload/preview", withFields(csvForm("Total Sales,Orders\n325000,150\n", "ranchi_nov_corrected.csv"), { targetBusinessId: bizA._id, reportingMonth: 11, reportingYear: 2026 }));
    const rep = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev2.data.importJobId, duplicateMode: "replace" });
    assert.equal(rep.status, 200, JSON.stringify(rep.data));
    assert.equal(rep.data.summary.updatedCount, 1);
    assert.equal(await SalesRecord.countDocuments({ business: bizA._id, year: 2026, month: 11 }), 1, "no duplicate record");
    assert.equal((await SalesRecord.findOne({ business: bizA._id, year: 2026, month: 11 })).totalSales, 325000);
    const sales = await clientSales("clientA");
    assert.equal(sales.monthly.find((m) => m.monthName === "November 2026").totalSales, 325000, "client portal shows the corrected value");
    assert.equal(sales.records.filter((r) => r.reportingMonth === "November 2026" && r.source === "manager_import").length, 1);
    const audits = await AuditLog.find({ action: "SALES_RECORD_UPDATED_BY_IMPORT" }).lean();
    assert.ok(audits.some((a) => a.before.totalSales === 310000 && a.after.totalSales === 325000), "previous values preserved in the audit trail");
    // Unrelated client data untouched
    assert.equal((await clientSales("clientD")).monthly.find((m) => m.monthName === "November 2026").totalSales, 99000);
  });

  await scenario("14. Invalid files and missing columns are reported, nothing saved", async () => {
    const SalesRecord = require("../models/sales/SalesRecord");
    const countBefore = await SalesRecord.countDocuments({});
    const fakeXlsx = new FormData();
    fakeXlsx.append("file", new Blob(["not really excel"]), "fake.xlsx");
    const r1 = await api("managerA", "POST", "/sales/upload/preview", fakeXlsx);
    assert.equal(r1.status, 400);
    const exe = new FormData();
    exe.append("file", new Blob(["MZ"]), "virus.exe");
    const r2 = await api("managerA", "POST", "/sales/upload/preview", exe);
    assert.equal(r2.status, 400);
    const r3 = await api("managerA", "POST", "/sales/upload/preview", csvForm("Outlet,Amount Collected\nX,1\n"));
    assert.equal(r3.status, 422);
    assert.equal(r3.data.needsMapping, true);
    const r4 = await api("managerA", "POST", "/sales/upload/preview", withFields(csvForm("Outlet,Amount Collected\nHotel Green Horizon,1\n"), {
      mapping: JSON.stringify({ businessName: "Outlet", totalSales: "Amount Collected" }), reportingMonth: 12, reportingYear: 2026,
    }));
    assert.equal(r4.status, 200, JSON.stringify(r4.data));
    assert.equal(r4.data.validCount, 1, "manual mapping makes the file importable");
    assert.equal(await SalesRecord.countDocuments({}), countBefore, "previews never write records");
  });

  await scenario("15. Client portal permissions: client cannot read another client's sync status or data", async () => {
    const r = await api("clientA", "GET", `/portal/sales?clientId=${clientD._id}`);
    assert.ok(r.data.records.every((x) => x.city !== "Dhanbad"), "clientId query is ignored for clients");
    const m = await api("managerB", "GET", `/portal/sync-status?clientId=${clientA._id}`);
    assert.equal(m.status, 403, "managers only reach their assigned clients");
  });

  await scenario("16. Client Portal monthly analytics = Manager analytics, same period, own businesses only", async () => {
    const up = async (csv, month, year, name) => {
      const prev = await api("managerA", "POST", "/sales/upload/preview", withFields(csvForm(csv, name), { targetBusinessId: bizA._id, reportingMonth: month, reportingYear: year }));
      assert.equal(prev.status, 200, JSON.stringify(prev.data));
      const c = await api("managerA", "POST", "/sales/upload/commit", { importJobId: prev.data.importJobId, duplicateMode: "replace" });
      assert.equal(c.status, 200, JSON.stringify(c.data));
    };
    await up("Total Sales,Orders\n160000,80\n", 9, 2025, "ranchi_sep25.csv");
    await up("Total Sales,Orders,Discount,Cost,Expenses,Target\n200000,90,20000,90000,50000,250000\n", 10, 2025, "ranchi_oct25.csv");

    const q = "year=2025&month=10&months=6";
    const c = await api("clientA", "GET", `/portal/analytics/monthly?${q}`);
    assert.equal(c.status, 200, JSON.stringify(c.data));
    const s = c.data.selected;
    assert.equal(c.data.scope.businesses, 1);
    assert.deepEqual(c.data.scope.available.map((b) => b.name), ["Hotel Green Horizon"], "client sees only its linked business");
    assert.equal(s.recordedSales.value, 200000);
    assert.equal(s.orders, 90);
    assert.equal(s.discount.value, 20000);
    assert.equal(s.net.value, 180000);
    assert.equal(s.cost.value, 90000);
    assert.equal(s.grossProfit.value, 90000);
    assert.equal(s.expenses.value, 50000);
    assert.equal(s.netProfit.value, 40000);
    assert.equal(s.profitMargin.value, 22.22);
    assert.equal(s.target.achievement, 80);
    assert.equal(s.growth.recordedSales, 25, "MoM = (200000 - 160000) / 160000");
    const sep = c.data.trend.find((t) => t.label === "Sep 2025");
    assert.equal(sep.recordedSales.value, 160000);
    assert.equal(sep.cost.value, null, "missing cost is unavailable, not 0");
    assert.equal(sep.cost.status, "unavailable");
    assert.equal(sep.netProfit.value, null);
    assert.equal(c.data.imports.importedRecords, 1);
    assert.ok(c.data.profitabilityRows.some((r) => r.monthName === "October 2025" && r.business === "Hotel Green Horizon"));
    assert.ok(c.data.imports.importHistory.length >= 1);
    assert.ok(c.data.imports.importHistory.every((j) => !/dhanbad/i.test(j.filename || "")), "no other client's imports");

    // Same numbers as the Manager Portal for the same business and period
    const m = await api("managerA", "GET", `/sales/analytics/monthly?${q}&businessId=${bizA._id}`);
    assert.equal(m.status, 200);
    for (const k of ["recordedSales", "discount", "net", "cost", "grossProfit", "expenses", "netProfit", "profitMargin"]) {
      assert.equal(m.data.selected[k].value, s[k].value, `manager/client parity: ${k}`);
    }

    // Isolation: other client, foreign businessId, unassigned manager
    const d = await api("clientD", "GET", `/portal/analytics/monthly?${q}`);
    assert.equal(d.data.selected.recordCount, 0, "Dhanbad client does not see Ranchi's October");
    assert.ok(d.data.scope.available.every((b) => b.city === "Dhanbad"));
    const sneaky = await api("clientD", "GET", `/portal/analytics/monthly?${q}&businessId=${bizA._id}&clientId=${clientA._id}`);
    assert.equal(sneaky.data.scope.businesses, 0, "a foreign businessId/clientId cannot widen a client's scope");
    assert.equal(sneaky.data.selected.recordCount, 0);
    const mb = await api("managerB", "GET", `/portal/analytics/monthly?clientId=${clientA._id}`);
    assert.equal(mb.status, 403);
    const exp = await api("clientA", "GET", `/portal/analytics/monthly/export?${q}&format=csv`, undefined, { raw: true });
    assert.equal(exp.status, 200);
    const text = await exp.text();
    assert.match(text, /Hotel Green Horizon/);
    assert.doesNotMatch(text, /Coal Capital|Patna|Maya Multicuisine|Spice Route/);
  });

  // ---------------------------------------------------------------------------
  // Database connection management: health, outage/recovery, credential rotation
  // ---------------------------------------------------------------------------
  const dbm = require("../config/db");
  const raw = async (path) => {
    const r = await fetch(`${baseUrl}${path}`);
    return { status: r.status, text: await r.text() };
  };
  const leaks = (text, ...secrets) =>
    /mongodb(\+srv)?:\/\//i.test(text) || secrets.filter(Boolean).some((sec) => text.includes(sec));
  const portalApisWork = async () => {
    assert.equal((await api("admin", "GET", "/admin/overview")).status, 200, "Admin Portal API");
    assert.equal((await api("managerA", "GET", "/sales/businesses")).status, 200, "Manager Portal API");
    assert.equal((await api("clientA", "GET", "/portal/analytics/monthly?year=2025&month=10")).status, 200, "Client Portal API");
    const own = await api("clientA", "GET", `/portal/analytics/monthly?year=2025&month=10&clientId=${clientD._id}`);
    assert.ok(own.data.scope.available.every((b) => b.city !== "Dhanbad"), "client isolation still enforced");
  };

  await scenario("17. Health endpoints: live + ready, no secrets in the response", async () => {
    const live = await raw("/health/live");
    assert.equal(live.status, 200);
    const ready = await raw("/health");
    assert.equal(ready.status, 200, ready.text);
    const body = JSON.parse(ready.text);
    assert.equal(body.ready, true);
    assert.equal(body.checks.database.status, "connected");
    assert.equal(typeof body.checks.database.latencyMs, "number");
    assert.equal(body.checks.config.MONGO_URI, true);
    assert.ok(!leaks(ready.text, uri, process.env.JWT_SECRET), "health response must not contain the URI or secrets");
  });

  await scenario("18. Temporary database outage -> fast 503s -> automatic recovery; portal APIs work again", async () => {
    await mongoose.disconnect();
    const down = await raw("/health");
    assert.equal(down.status, 503);
    assert.ok(!leaks(down.text, uri), "degraded health response leaks nothing");
    const t0 = Date.now();
    const blocked = await api("clientA", "GET", "/portal/profile");
    assert.equal(blocked.status, 503, "database-backed APIs answer 503 while the DB is down");
    assert.equal(blocked.data.code, "DATABASE_UNAVAILABLE");
    assert.ok(Date.now() - t0 < 2000, "no hanging requests during an outage");
    await dbm.connectDB({ uri, retries: 2, baseDelayMs: 200, options: { dbName: TEST_DB } });
    assert.equal((await raw("/health")).status, 200, "ready again after reconnect");
    await portalApisWork();
  });

  await scenario("19. Credential rotation on the TEST database: second user -> switch -> verify -> revoke old user", async () => {
    const adminDb = mongoose.connection.db.admin();
    const pwA = require("crypto").randomBytes(18).toString("hex");
    const pwB = require("crypto").randomBytes(18).toString("hex");
    const roles = [{ role: "readWrite", db: TEST_DB }];
    try {
      await mongoose.connection.db.command({ createUser: "esg_rot_a", pwd: pwA, roles });
      await mongoose.connection.db.command({ createUser: "esg_rot_b", pwd: pwB, roles });
    } catch (e) {
      console.log(`      (skipped: this test database does not allow createUser — ${dbm.classifyError(e).code})`);
      return;
    }
    const withCreds = (user, pw) => {
      const u = new URL(uri);
      u.username = user;
      u.password = pw;
      u.searchParams.set("authSource", TEST_DB);
      return u.toString();
    };
    const uriA = withCreds("esg_rot_a", pwA);
    const uriB = withCreds("esg_rot_b", pwB);
    try {
      // running on the "old" user
      await mongoose.disconnect();
      await dbm.connectDB({ uri: uriA, retries: 0, options: { dbName: TEST_DB } });
      const usersBefore = await User.countDocuments({});
      // "restart" with the new secret (Render: save MONGO_URI -> redeploy)
      await mongoose.disconnect();
      await dbm.connectDB({ uri: uriB, retries: 0, options: { dbName: TEST_DB } });
      assert.equal(await User.countDocuments({}), usersBefore, "same data visible with the new user");
      assert.equal((await raw("/health")).status, 200);
      await portalApisWork();
      // revoke the old user only after verification
      await mongoose.connection.db.command({ dropUser: "esg_rot_a" });
      // the old secret no longer works, and the error is classified without leaking it
      const probe = mongoose.createConnection();
      let code = null;
      try {
        await probe.openUri(uriA, { dbName: TEST_DB, serverSelectionTimeoutMS: 5000 });
      } catch (e) {
        code = dbm.classifyError(e).code;
        assert.ok(!dbm.redact(e.message, uriA).includes(pwA), "redacted error has no password");
      } finally {
        await probe.close().catch(() => {});
      }
      assert.equal(code, "AUTH_FAILED", "old credentials are rejected after revocation");
      // a full connectDB with bad credentials fails fast (no retry loop)
      await mongoose.disconnect();
      const t1 = Date.now();
      await assert.rejects(dbm.connectDB({ uri: uriA, retries: 5, baseDelayMs: 2000, options: { dbName: TEST_DB } }), (e) => e.code === "AUTH_FAILED" && !e.message.includes(pwA));
      assert.ok(Date.now() - t1 < 10000, "authentication failures are not retried");
    } finally {
      await mongoose.disconnect().catch(() => {});
      await dbm.connectDB({ uri, retries: 2, options: { dbName: TEST_DB } });
      await mongoose.connection.db.command({ dropUser: "esg_rot_a" }).catch(() => {});
      await mongoose.connection.db.command({ dropUser: "esg_rot_b" }).catch(() => {});
    }
  });

  // ---- Teardown ----------------------------------------------------------------
  server.close();
  mockWa.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (err) => {
  console.error("Integration run crashed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
