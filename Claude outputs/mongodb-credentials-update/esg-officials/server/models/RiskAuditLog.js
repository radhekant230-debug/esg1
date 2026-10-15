const mongoose = require("mongoose");
const { Schema } = mongoose;

const riskAuditLogSchema = new Schema(
  {
    risk: {
      type: Schema.Types.ObjectId,
      ref: "Risk",
      required: true,
      index: true,
    },
    riskId: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "RISK_CREATED",
        "RISK_REVIEWED",
        "MITIGATION_PROPOSED",
        "SUBMITTED_FOR_APPROVAL",
        "MITIGATION_PROPOSAL_SUBMITTED",
        "POSTPONED",
        "CLIENT_APPROVED",
        "CLIENT_REJECTED",
        "CLIENT_CHANGES_REQUESTED",
        "AUTO_APPROVED_24H",
        "ESCALATED",
        "RESOLVED",
        "PROPOSAL_UPDATED",
        "COMMENT_ADDED",
      ],
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    performerName: {
      type: String,
      default: "SYSTEM",
    },
    performerRole: {
      type: String,
      default: "system",
    },
    previousStatus: {
      type: String,
      default: "",
    },
    newStatus: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      default: "",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiskAuditLog", riskAuditLogSchema);
