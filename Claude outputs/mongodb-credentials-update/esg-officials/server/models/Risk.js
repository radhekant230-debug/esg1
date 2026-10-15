const mongoose = require("mongoose");
const { Schema } = mongoose;

const postponementHistorySchema = new Schema({
  postponedAt: { type: Date, default: Date.now },
  previousDeadline: { type: Date },
  newReviewDate: { type: Date },
  newProposedReviewDate: { type: Date },
  reason: { type: String, required: true, trim: true },
  notes: { type: String, trim: true, default: "" },
  postponedBy: { type: Schema.Types.ObjectId, ref: "User" },
  postponedByName: { type: String, default: "" },
  postponerName: { type: String, default: "" },
  postponedByRole: { type: String, default: "manager" },
});

const proposalVersionSchema = new Schema({
  version: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  actionSteps: [{ type: String }],
  expectedOutcome: { type: String, default: "" },
  estimatedCost: { type: Number, default: 0 },
  timeline: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvalDeadline: { type: Date },
  decision: { type: String, default: "Superseded" },
  decisionNotes: { type: String, default: "" },
  decisionAt: { type: Date },
});

const riskSchema = new Schema(
  {
    riskId: {
      type: String,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: String,
      trim: true,
      default: "",
    },
    business: {
      type: Schema.Types.ObjectId,
      ref: "SalesBusiness",
      default: null,
    },
    businessName: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Operational",
        "Financial",
        "Compliance",
        "Strategic",
        "Reputational",
        "Reputation",
        "Technology",
        "ESG/Environmental",
        "Market",
        "Legal",
      ],
      default: "Operational",
      index: true,
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      required: true,
      default: "Medium",
      index: true,
    },
    riskScore: {
      type: Number,
      default: 50,
      min: 1,
      max: 100,
    },
    financialImpact: {
      type: String,
      default: "",
      trim: true,
    },
    financialImpactAmount: {
      type: Number,
      default: 0,
    },
    businessImpact: {
      type: String,
      default: "",
      trim: true,
    },
    recommendedMitigation: {
      type: String,
      default: "",
      trim: true,
    },
    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    managerName: {
      type: String,
      default: "",
      trim: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    originalDeadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: [
        "Identified",
        "Under Review",
        "Mitigation Proposed",
        "Pending Client Approval",
        "Approved",
        "Rejected",
        "Resolved",
        "Escalated",
      ],
      default: "Identified",
      index: true,
    },

    // Manager Proposed Mitigation Plan
    mitigationPlan: {
      title: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      actionSteps: [{ type: String, trim: true }],
      expectedOutcome: { type: String, trim: true, default: "" },
      estimatedCost: { type: Number, default: 0 },
      timeline: { type: String, trim: true, default: "" },
      proposedReviewDate: { type: Date },
      version: { type: Number, default: 1 },
      submittedAt: { type: Date },
      submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
      submitterName: { type: String, default: "" },
    },
    proposalVersions: [proposalVersionSchema],
    postponementHistory: [postponementHistorySchema],
    isPostponed: {
      type: Boolean,
      default: false,
    },
    postponementCount: {
      type: Number,
      default: 0,
    },
    proposedReviewDate: {
      type: Date,
    },

    // 24-Hour Automatic Approval Policy Tracking
    autoApprovalEligible: {
      type: Boolean,
      default: true,
      index: true,
    },
    autoApprovalExcludedReason: {
      type: String,
      default: "",
    },
    submittedForApprovalAt: {
      type: Date,
      index: true,
    },
    approvalDeadline: {
      type: Date,
      index: true,
    },
    approvalDecision: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Changes Requested", "Auto-Approved"],
      default: "Pending",
    },
    decisionAt: {
      type: Date,
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    decidedByName: {
      type: String,
      default: "",
    },
    decisionNotes: {
      type: String,
      default: "",
    },
    isAutoApproved: {
      type: Boolean,
      default: false,
    },

    // Escalation & Resolution
    escalationDetails: {
      escalatedAt: { type: Date },
      reason: { type: String, default: "" },
      escalatedBy: { type: Schema.Types.ObjectId, ref: "User" },
      escalatedByName: { type: String, default: "" },
      targetTeam: { type: String, default: "Executive Leadership" },
    },
    resolutionDetails: {
      resolvedAt: { type: Date },
      notes: { type: String, default: "" },
      resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      resolvedByName: { type: String, default: "" },
    },

    // Attachments & Discussion Comments
    supportingDocuments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        userName: { type: String, required: true },
        role: { type: String, required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate unique Risk ID
riskSchema.pre("save", async function () {
  if (!this.riskId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("Risk").countDocuments();
    this.riskId = `RSK-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  if (!this.originalDeadline && this.deadline) {
    this.originalDeadline = this.deadline;
  }
});

module.exports = mongoose.model("Risk", riskSchema);
