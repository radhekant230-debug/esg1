const mongoose = require("mongoose");
const { Schema } = mongoose;

const googleBusinessMetricSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportingMonth: {
      type: String, // "2026-10"
      required: true,
    },
    profileViews: {
      type: Number,
      default: 0,
    },
    searchImpressions: {
      type: Number,
      default: 0,
    },
    websiteClicks: {
      type: Number,
      default: 0,
    },
    calls: {
      type: Number,
      default: 0,
    },
    directionRequests: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 4.8,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    recentReviews: [
      {
        author: { type: String, required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, default: "" },
        date: { type: Date, default: Date.now },
        reply: { type: String, default: "" },
      },
    ],
    connectionStatus: {
      type: String,
      enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed"],
      default: "Connected",
    },
    dataSource: {
      type: String,
      default: "Google Business Profile Sync",
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

module.exports = mongoose.model("GoogleBusinessMetric", googleBusinessMetricSchema);
