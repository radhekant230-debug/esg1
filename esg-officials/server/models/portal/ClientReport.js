const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientReportSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    reportType: {
      type: String,
      enum: [
        "Weekly Summary",
        "Monthly Marketing Report",
        "Campaign Report",
        "Sales Summary",
        "Social Media Report",
        "Local Marketing Report",
        "Business Growth Strategy",
      ],
      default: "Monthly Marketing Report",
    },
    period: {
      type: String, // e.g. "October 1 - October 31, 2026"
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    keyMetrics: {
      totalSales: { type: Number, default: 0 },
      adSpend: { type: Number, default: 0 },
      roas: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
      socialReach: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
    },
    previousPeriodComparison: {
      salesChangePct: { type: Number, default: 0 },
      spendChangePct: { type: Number, default: 0 },
      leadsChangePct: { type: Number, default: 0 },
      reachChangePct: { type: Number, default: 0 },
    },
    achievements: [String],
    areasForImprovement: [String],
    nextMonthPlan: [String],
    recommendations: [String],
    pdfUrl: {
      type: String,
      default: "",
    },
    dataSource: {
      type: String,
      default: "Verified Database Records & Agency Analytics",
    },
    authorName: {
      type: String,
      default: "ESG Officials Growth Team",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientReport", clientReportSchema);
