const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientLeadSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ["Meta Ads", "Google Ads", "Website Enquiry", "Instagram DM", "Walk-in", "Referral", "Other"],
      default: "Meta Ads",
    },
    campaign: {
      type: String,
      trim: true,
      default: "",
    },
    enquiryDate: {
      type: Date,
      default: Date.now,
    },
    reportingMonth: {
      type: String,
      trim: true,
      index: true,
    },
    enquiryCount: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Converted", "Lost"],
      default: "New",
      index: true,
    },
    isQualified: {
      type: Boolean,
      default: false,
    },
    isConverted: {
      type: Boolean,
      default: false,
    },
    estimatedValue: {
      type: Number,
      default: 0,
    },
    notes: [
      {
        text: { type: String, required: true },
        author: { type: String, default: "Agency Manager" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientLead", clientLeadSchema);
