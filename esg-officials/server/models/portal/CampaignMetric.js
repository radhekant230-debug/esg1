const mongoose = require("mongoose");
const { Schema } = mongoose;

const campaignMetricSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaignName: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["Meta Ads", "Google Ads", "Other"],
      default: "Meta Ads",
    },
    status: {
      type: String,
      enum: ["Active", "Paused", "Completed"],
      default: "Active",
    },
    objective: {
      type: String,
      trim: true,
      default: "Lead Generation",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    budget: {
      type: Number,
      default: 0,
    },
    adSpend: {
      type: Number,
      required: true,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    reach: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    leads: {
      type: Number,
      default: 0,
    },
    conversions: {
      type: Number,
      default: 0,
    },
    attributedRevenue: {
      type: Number,
      default: 0,
    },
    // Calculated metrics
    ctr: {
      type: Number,
      default: 0,
    },
    cpc: {
      type: Number,
      default: 0,
    },
    cpl: {
      type: Number,
      default: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
    },
    roas: {
      type: Number,
      default: 0,
    },
    dataSource: {
      type: String,
      default: "Verified CSV / Manual Entry",
    },
    isLiveConnected: {
      type: Boolean,
      default: false,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Safe mathematical calculation pre-save hook
campaignMetricSchema.pre("save", function () {
  const impressions = Number(this.impressions) || 0;
  const clicks = Number(this.clicks) || 0;
  const adSpend = Number(this.adSpend) || 0;
  const leads = Number(this.leads) || 0;
  const conversions = Number(this.conversions) || 0;
  const attributedRevenue = Number(this.attributedRevenue) || 0;

  // CTR = Clicks / Impressions * 100
  this.ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;

  // CPC = Ad Spend / Clicks
  this.cpc = clicks > 0 ? Number((adSpend / clicks).toFixed(2)) : 0;

  // CPL = Ad Spend / Leads
  this.cpl = leads > 0 ? Number((adSpend / leads).toFixed(2)) : 0;

  // Conversion Rate = Conversions / Clicks * 100
  this.conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;

  // ROAS = Attributed Revenue / Ad Spend
  this.roas = adSpend > 0 ? Number((attributedRevenue / adSpend).toFixed(2)) : 0;
});

module.exports = mongoose.model("CampaignMetric", campaignMetricSchema);
