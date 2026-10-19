const mongoose = require("mongoose");
const { Schema } = mongoose;

const salesImportJobSchema = new Schema(
  {
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
    filename: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    updatedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      // pending = previewed, awaiting confirmation; processing = commit in progress
      enum: ["pending", "processing", "completed", "partial", "failed", "rejected", "expired", "cancelled"],
      default: "completed",
    },
    // ---- Preview / safe-import fields (additive) ----
    fileHash: { type: String, default: "", index: true },
    sheetName: { type: String, default: "" },
    headerRow: { type: Number, default: 1 },
    columnMapping: { type: Schema.Types.Mixed, default: {} },
    unmappedColumns: [{ type: String }],
    // skip = "Add new only" (existing periods kept), update = "Replace" existing periods
    duplicateMode: { type: String, enum: ["skip", "update"], default: "skip" },
    // Upload-form context
    targetBusiness: { type: Schema.Types.ObjectId, ref: "SalesBusiness", default: null },
    // Client portal chosen in the upload form; commit refuses rows of businesses not linked to it
    targetClient: { type: Schema.Types.ObjectId, ref: "User", default: null },
    defaultPeriod: {
      month: { type: Number, default: null },
      year: { type: Number, default: null },
    },
    reportingPeriod: { type: String, default: "auto" }, // 1_day, 1_week, 2_weeks, 1_month, custom, etc.
    reportingPeriodLabel: { type: String, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    detectedDateRange: {
      start: { type: Date, default: null },
      end: { type: Date, default: null },
      days: { type: Number, default: 0 },
      label: { type: String, default: "" },
    },
    recordType: { type: String, enum: ["transaction", "summary", "mixed"], default: "summary" },
    // What the file covers (filled at preview, used for history & client sync)
    periods: [{ type: String }],
    businesses: [{ type: Schema.Types.ObjectId, ref: "SalesBusiness" }],
    affectedClients: [{ type: Schema.Types.ObjectId, ref: "User" }],
    sheets: [{ sheetName: String, headerRow: Number, rows: Number, _id: false }],
    ignoredSheets: [{ sheetName: String, reason: String, _id: false }],
    // Original uploaded file, stored in MongoDB GridFS (bucket "salesImportFiles")
    originalFile: {
      fileId: { type: Schema.Types.ObjectId, default: null },
      filename: { type: String, default: "" },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: "" },
      sha256: { type: String, default: "" },
    },
    // Restaurant day-wise reports (stored as SalesEntry)
    reportFormat: { type: String, default: null }, // e.g. "restaurant_daywise"
    reportMeta: { type: Schema.Types.Mixed, default: null }, // report name, period, per-restaurant totals & reconciliation
    reportPeriod: {
      start: { type: String, default: null }, // "YYYY-MM-DD"
      end: { type: String, default: null },
    },
    entryCounts: { type: Schema.Types.Mixed, default: null },
    // Previous imports of the same business/periods that this one replaced
    replacedImports: [{ type: Schema.Types.ObjectId, ref: "SalesImportJob" }],
    validRows: { type: [Schema.Types.Mixed], default: [] },
    invalidRows: { type: [Schema.Types.Mixed], default: [] },
    validCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    committedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    errorLogs: [
      {
        rowNumber: Number,
        businessName: String,
        state: String,
        city: String,
        month: String,
        reason: String,
        sheet: String,
      },
    ],
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

module.exports = mongoose.model("SalesImportJob", salesImportJobSchema);
