/**
 * One-shot runner for reminders + escalations.
 * Use as a Render Cron Job (e.g. every 10 minutes):  npm run planner:run
 * Safe to run alongside the in-process scheduler: a MongoDB lease lock and
 * per-notification dedupe keys prevent double processing / double sending.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { runPlannerTick } = require("../services/planner/scheduler");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  const result = await runPlannerTick({ source: "cron-script" });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(result && result.ok === false ? 1 : 0);
})().catch(async (err) => {
  console.error("[runPlannerJobs] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
