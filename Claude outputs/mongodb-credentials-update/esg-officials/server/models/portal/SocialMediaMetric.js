const mongoose = require("mongoose");
const { Schema } = mongoose;

const socialMediaMetricSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["Instagram", "Facebook", "LinkedIn", "YouTube", "Other"],
      default: "Instagram",
    },
    reportingMonth: {
      type: String, // e.g. "2026-10"
      required: true,
    },
    followers: {
      type: Number,
      default: 0,
    },
    followerGrowth: {
      type: Number,
      default: 0,
    },
    reach: {
      type: Number,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },
    engagementRate: {
      type: Number,
      default: 0, // %
    },
    profileVisits: {
      type: Number,
      default: 0,
    },
    linkClicks: {
      type: Number,
      default: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
    },
    topPosts: [
      {
        title: { type: String, default: "" },
        caption: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        postDate: { type: Date, default: Date.now },
        format: { type: String, default: "Reel" }, // Reel, Carousel, Photo, Story
        reach: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        postUrl: { type: String, default: "" },
      },
    ],
    dataSource: {
      type: String,
      default: "Monthly Report Import",
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

// Auto-calculate engagement rate if missing
socialMediaMetricSchema.pre("save", function () {
  const interactions = (this.likes || 0) + (this.comments || 0) + (this.shares || 0) + (this.saves || 0);
  const reach = this.reach || this.impressions || 0;
  if (reach > 0 && !this.engagementRate) {
    this.engagementRate = Number(((interactions / reach) * 100).toFixed(2));
  }
});

module.exports = mongoose.model("SocialMediaMetric", socialMediaMetricSchema);
