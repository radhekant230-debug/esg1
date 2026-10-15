const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ACTIVITY_TYPES, STATUSES, PRIORITIES } = require("../../services/planner/rules");

const escalationEventSchema = new Schema(
  {
    escalatedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true }, // the escalation due time that triggered it
    deadline: { type: Date, default: null },
    reason: { type: String, default: "" },
    previousStatus: { type: String, default: "" },
    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    supervisors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolution: {
      type: String,
      enum: ["", "completed", "reassigned", "rescheduled", "resumed", "cancelled"],
      default: "",
    },
    resolutionNotes: { type: String, default: "" },
  },
  { _id: true }
);

const rescheduleSchema = new Schema(
  {
    fromScheduledAt: Date,
    toScheduledAt: Date,
    fromDeadline: Date,
    toDeadline: Date,
    reason: { type: String, default: "" },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scheduledActivitySchema = new Schema(
  {
    activityId: { type: String, unique: true, sparse: true, trim: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    activityType: { type: String, enum: ACTIVITY_TYPES, default: "Scheduled Upload", index: true },
    priority: { type: String, enum: PRIORITIES, default: "Medium" },

    // Single source of truth for dates (UTC instants, displayed in Asia/Kolkata)
    scheduledAt: { type: Date, required: true, index: true },
    deadline: { type: Date, required: true, index: true },
    escalationStartAt: { type: Date, default: null },

    assignedManager: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    supervisor: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Who the activity is for: a client portal account and/or a sales business.
    client: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    business: { type: Schema.Types.ObjectId, ref: "SalesBusiness", default: null, index: true },
    businessName: { type: String, default: "", trim: true },

    status: { type: String, enum: STATUSES, default: "Scheduled", index: true },
    statusBeforeEscalation: { type: String, default: "" },
    visibleToClient: { type: Boolean, default: true },

    requiresClientApproval: { type: Boolean, default: false },
    approval: {
      decision: { type: String, enum: ["", "Pending", "Approved", "Rejected"], default: "" },
      requestedAt: { type: Date, default: null },
      decidedAt: { type: Date, default: null },
      decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      notes: { type: String, default: "" },
    },

    reminder: {
      leadHours: { type: Number, default: 24 },
      dueAt: { type: Date, default: null, index: true },
      late: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["scheduled", "sent", "partially_sent", "failed", "cancelled", "not_required"],
        default: "scheduled",
      },
      lastSentAt: { type: Date, default: null },
    },

    escalation: {
      count: { type: Number, default: 0 },
      lastEscalatedAt: { type: Date, default: null },
      lastEscalatedDueAt: { type: Date, default: null },
      events: [escalationEventSchema],
    },

    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelReason: { type: String, default: "" },

    rescheduleHistory: [rescheduleSchema],

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

scheduledActivitySchema.index({ assignedManager: 1, scheduledAt: 1 });
scheduledActivitySchema.index({ client: 1, scheduledAt: 1 });
scheduledActivitySchema.index({ status: 1, deadline: 1 });

scheduledActivitySchema.pre("validate", function ensureDeadline() {
  if (!this.deadline && this.scheduledAt) this.deadline = this.scheduledAt;
});

module.exports =
  mongoose.models.ScheduledActivity || mongoose.model("ScheduledActivity", scheduledActivitySchema);
