const mongoose = require("mongoose");
const { Schema } = mongoose;

const contentCalendarItemSchema = new Schema(
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
    platform: {
      type: String,
      enum: ["Instagram", "Facebook", "LinkedIn", "YouTube", "Google Business", "Multi-Platform"],
      default: "Instagram",
    },
    format: {
      type: String,
      enum: ["Reel", "Carousel", "Static Graphic", "High-Res Photo", "Story", "Ad Creative"],
      default: "Reel",
    },
    caption: {
      type: String,
      default: "",
    },
    creativeUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: "",
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Draft",
        "Pending Approval",
        "Changes Requested",
        "Approved",
        "Scheduled",
        "Published",
        "Cancelled",
      ],
      default: "Pending Approval",
      index: true,
    },
    clientFeedback: {
      type: String,
      default: "",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    history: [
      {
        action: { type: String, required: true },
        byName: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        comment: { type: String, default: "" },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ContentCalendarItem", contentCalendarItemSchema);
