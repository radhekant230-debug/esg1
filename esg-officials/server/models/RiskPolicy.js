const mongoose = require("mongoose");
const { Schema } = mongoose;

const riskPolicySchema = new Schema(
  {
    policyName: {
      type: String,
      default: "Standard 24-Hour Mitigation Approval Policy",
    },
    autoApprovalEnabled: {
      type: Boolean,
      default: true,
    },
    autoApprovalHours: {
      type: Number,
      default: 24,
      min: 1,
      max: 168,
    },
    excludeCriticalSeverity: {
      type: Boolean,
      default: true,
    },
    excludeEmergencyRisks: {
      type: Boolean,
      default: true,
    },
    noticeText: {
      type: String,
      default:
        "Please review this proposed risk mitigation plan within 24 hours. If no decision is received within 24 hours of submission, the plan will be automatically approved according to the applicable approval policy.",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiskPolicy", riskPolicySchema);
