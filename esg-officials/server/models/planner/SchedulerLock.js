const mongoose = require("mongoose");

/** Lease lock + last-run telemetry for background jobs. */
const schedulerLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date, default: null },
    owner: { type: String, default: "" },
    lastRunAt: { type: Date, default: null },
    lastRunSource: { type: String, default: "" },
    lastSuccessAt: { type: Date, default: null },
    lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
    lastError: { type: String, default: "" },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.models.SchedulerLock || mongoose.model("SchedulerLock", schedulerLockSchema);
