const mongoose = require("mongoose");
const { Schema } = mongoose;

const salesRecordSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "SalesBusiness",
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Hotel", "Restaurant", "Service"],
      default: "Restaurant",
    },
    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      index: true,
    },
    monthName: {
      type: String,
      required: true,
      trim: true,
      index: true, // e.g. "September 2026"
    },
    totalSales: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    orders: {
      type: Number,
      default: 0,
      min: 0,
    },
    target: {
      type: Number,
      default: 0,
      min: 0,
    },
    achievementRate: {
      type: Number,
      default: 0, // calculated as (totalSales / target) * 100
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploaderName: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["manual", "excel_upload"],
      default: "manual",
    },
    importJob: {
      type: Schema.Types.ObjectId,
      ref: "SalesImportJob",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate achievementRate before saving
salesRecordSchema.pre("save", function () {
  if (this.target && this.target > 0) {
    this.achievementRate = Number(((this.totalSales / this.target) * 100).toFixed(1));
  } else {
    this.achievementRate = 0;
  }
});

// Compound unique index to prevent duplicate records for the same business in the same month & year
salesRecordSchema.index({ business: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("SalesRecord", salesRecordSchema);
