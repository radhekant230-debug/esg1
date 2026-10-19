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
    // Client portal account (User _id) the record belongs to, set by imports
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    // ---- Time-period awareness fields ----
    recordType: {
      type: String,
      enum: ["transaction", "summary"],
      default: "summary",
      index: true,
    },
    date: {
      type: Date,
      default: null,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
      default: "monthly",
      index: true,
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    rowHash: {
      type: String,
      default: null,
      index: true,
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
    // ---- Financial fields (optional). null = not recorded / unknown ----
    // Whether totalSales is before discounts ("gross") or already net of them ("net")
    salesBasis: {
      type: String,
      enum: ["gross", "net"],
      default: "gross",
    },
    discount: {
      type: Number,
      default: null,
      min: 0,
    },
    cost: {
      type: Number,
      default: null,
      min: 0,
    },
    expenses: {
      type: Number,
      default: null,
      min: 0,
    },
    // Profit/Loss as reported in the uploaded file (may be negative). Used only
    // when profit cannot be calculated from cost and expenses.
    reportedProfit: {
      type: Number,
      default: null,
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
      // daily_rollup = monthly total derived from SalesEntry day data (restaurant
      // day-wise reports); date-range analytics read the entries instead
      enum: ["manual", "excel_upload", "daily_rollup"],
      default: "manual",
    },
    // daily_rollup only: number of days of the month that have data
    rollupDays: {
      type: Number,
      default: null,
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

// Calculate achievementRate and sync date boundaries before saving
salesRecordSchema.pre("save", function () {
  if (this.target && this.target > 0) {
    this.achievementRate = Number(((this.totalSales / this.target) * 100).toFixed(1));
  } else {
    this.achievementRate = 0;
  }

  // Ensure dates are populated
  if (this.date) {
    if (!this.startDate) this.startDate = this.date;
    if (!this.endDate) this.endDate = this.date;
  }
});

// Non-unique compound index for fast business/period filtering
salesRecordSchema.index({ business: 1, year: 1, month: 1 });
salesRecordSchema.index({ business: 1, date: 1 });
salesRecordSchema.index({ business: 1, startDate: 1, endDate: 1 });
salesRecordSchema.index({ business: 1, transactionId: 1 }, { sparse: true });

module.exports = mongoose.model("SalesRecord", salesRecordSchema);
