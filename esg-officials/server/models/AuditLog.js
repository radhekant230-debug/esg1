const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Append-only audit trail for scheduling, approvals, escalations,
 * notifications, imports and financial changes.
 * (The older ActivityLog model is kept unchanged for existing features.)
 */
const auditLogSchema = new Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: [
        "ScheduledActivity",
        "NotificationJob",
        "SalesRecord",
        "SalesImportJob",
        "SalesBusiness",
        "User",
        "System",
      ],
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "SYSTEM" },
    actorRole: { type: String, default: "system" },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

// Audit entries are append-only.
auditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"], function blockMutation() {
  throw new Error("AuditLog entries are immutable");
});

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
