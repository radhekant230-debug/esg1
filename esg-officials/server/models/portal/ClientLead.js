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
    // Actual visit/spend figures for this customer from a POS customer-list
    // import (lifetime totals as reported by the export; null = not reported).
    // Never derived from estimatedValue.
    customerStats: {
      visits: { type: Number, default: null },
      totalSpent: { type: Number, default: null },
      avgSpend: { type: Number, default: null },
      lastVisitAt: { type: Date, default: null },
      source: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
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

clientLeadSchema.index({ client: 1, phone: 1 });
clientLeadSchema.index({ client: 1, enquiryDate: -1 });

module.exports = mongoose.model("ClientLead", clientLeadSchema);
