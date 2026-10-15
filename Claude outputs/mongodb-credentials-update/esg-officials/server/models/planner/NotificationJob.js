const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * One row per (activity, notification kind, channel, recipient, due time).
 * `dedupeKey` is unique, so creating the same reminder twice is a no-op and
 * the scheduler can never send the same notification twice.
 */
const attemptSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    outcome: { type: String, enum: ["accepted", "failed", "skipped"], required: true },
    httpStatus: { type: Number, default: null },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    retryable: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationJobSchema = new Schema(
  {
    dedupeKey: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ["upload_reminder", "escalation_manager", "escalation_supervisor"],
      required: true,
      index: true,
    },
    channel: { type: String, enum: ["in_app", "whatsapp"], required: true, index: true },
    activity: { type: Schema.Types.ObjectId, ref: "ScheduledActivity", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    escalationEventId: { type: Schema.Types.ObjectId, default: null },

    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      // accepted = provider accepted the message (not yet confirmed delivered)
      enum: ["pending", "processing", "sent", "accepted", "delivered", "read", "failed", "skipped", "cancelled"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: null, index: true },
    lockedUntil: { type: Date, default: null },
    lockOwner: { type: String, default: "" },

    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: "", index: true },
    providerStatus: { type: String, default: "" },
    providerStatusAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    skipReason: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    attemptLog: [attemptSchema],

    payload: { type: Schema.Types.Mixed, default: {} },
    notification: { type: Schema.Types.ObjectId, ref: "Notification", default: null },

    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationJobSchema.index({ status: 1, dueAt: 1 });

module.exports =
  mongoose.models.NotificationJob || mongoose.model("NotificationJob", notificationJobSchema);
