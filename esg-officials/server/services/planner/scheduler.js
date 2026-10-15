/**
 * Planner background scheduler.
 *
 * Runs inside the API process (setInterval) AND can be triggered externally
 * (Render Cron Job -> `npm run planner:run`, or an HTTP cron hitting
 * POST /api/planner/cron/run with the CRON_SECRET header). A MongoDB lease
 * lock guarantees only one runner executes at a time, and NotificationJob
 * dedupe keys guarantee nothing is sent twice even if runs overlap.
 *
 * Reminders do not depend on any browser being open.
 */
const SchedulerLock = require("../../models/planner/SchedulerLock");
const { processDueJobs, runEscalationSweep, LOCK_OWNER } = require("./notifications");

const LOCK_ID = "planner";
const LEASE_MS = 5 * 60 * 1000;

let intervalId = null;
let running = false;

async function acquireLock(now) {
  try {
    return await SchedulerLock.findOneAndUpdate(
      { _id: LOCK_ID, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }, { owner: LOCK_OWNER }] },
      { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS), owner: LOCK_OWNER } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err) {
    if (err && err.code === 11000) return null; // someone else holds the lock
    throw err;
  }
}

async function releaseLock(fields) {
  await SchedulerLock.updateOne(
    { _id: LOCK_ID, owner: LOCK_OWNER },
    { $set: { lockedUntil: null, ...fields } }
  );
}

/**
 * Runs one planner tick: escalation sweep first (so escalation alerts go out
 * in the same tick), then all due reminder / escalation notification jobs.
 */
async function runPlannerTick({ now = new Date(), source = "interval", fetchImpl } = {}) {
  if (running) return { skipped: true, reason: "already running in this process" };
  running = true;
  try {
    const lock = await acquireLock(now);
    if (!lock) return { skipped: true, reason: "another runner holds the lock" };

    let result;
    try {
      const escalations = await runEscalationSweep({ now });
      const notifications = await processDueJobs({ now, fetchImpl });
      let expiredPreviews = 0;
      try {
        expiredPreviews = await require("../../controllers/salesImportController").expireStalePreviews(now);
      } catch (e) {
        console.error("[PlannerScheduler] preview cleanup failed:", e.message);
      }
      result = { ok: true, ranAt: now, source, escalations, notifications, expiredPreviews };
      await releaseLock({
        lastRunAt: now,
        lastRunSource: source,
        lastSuccessAt: now,
        lastResult: result,
        lastError: "",
      });
    } catch (err) {
      console.error("[PlannerScheduler] Tick failed:", err);
      await releaseLock({ lastRunAt: now, lastRunSource: source, lastError: err.message });
      result = { ok: false, ranAt: now, source, error: err.message };
    }
    return result;
  } finally {
    running = false;
  }
}

async function getSchedulerHealth() {
  const lock = await SchedulerLock.findById(LOCK_ID).lean();
  return {
    inProcessEnabled: Boolean(intervalId),
    intervalMs: Number(process.env.PLANNER_SCHEDULER_INTERVAL_MS) || 60000,
    lastRunAt: lock ? lock.lastRunAt : null,
    lastRunSource: lock ? lock.lastRunSource : "",
    lastSuccessAt: lock ? lock.lastSuccessAt : null,
    lastError: lock ? lock.lastError : "",
    lastResult: lock ? lock.lastResult : null,
  };
}

function startPlannerScheduler(intervalMs = Number(process.env.PLANNER_SCHEDULER_INTERVAL_MS) || 60000) {
  if (String(process.env.PLANNER_SCHEDULER_ENABLED || "true").toLowerCase() === "false") {
    console.log("[PlannerScheduler] In-process scheduler disabled (PLANNER_SCHEDULER_ENABLED=false). Use the cron endpoint/script.");
    return;
  }
  if (intervalId) return;
  console.log(`[PlannerScheduler] Starting reminder & escalation scheduler (interval: ${intervalMs}ms)`);
  runPlannerTick({ source: "startup" }).catch((e) => console.error("[PlannerScheduler]", e));
  intervalId = setInterval(() => {
    runPlannerTick({ source: "interval" }).catch((e) => console.error("[PlannerScheduler]", e));
  }, intervalMs);
  if (intervalId.unref) intervalId.unref();
}

function stopPlannerScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { runPlannerTick, startPlannerScheduler, stopPlannerScheduler, getSchedulerHealth };
