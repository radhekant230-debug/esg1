const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientOrderSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportingMonth: {
      type: String, // e.g. "2026-03"
      required: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["Order", "Reservation", "Table Booking", "Custom Order", "Walk-in Purchase", "order", "reservation"],
      default: "Order",
    },
    customerName: {
      type: String,
      trim: true,
      default: "Customer",
    },
    count: {
      type: Number,
      default: 1,
      min: 1,
    },
    value: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Completed", "Confirmed", "Pending", "Cancelled", "completed", "confirmed", "pending", "cancelled"],
      default: "Completed",
    },
    channel: {
      type: String,
      enum: ["Dine-in", "Takeaway", "Online Swiggy/Zomato", "Store Walk-in", "Website", "Direct Phone", "Other", "dine_in", "dine-in", "takeaway", "online", "walk-in", "website", "direct"],
      default: "Dine-in",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      default: "Manual Entry / POS",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientOrder", clientOrderSchema);
