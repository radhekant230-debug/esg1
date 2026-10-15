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
    defaultPeriod: {
      month: { type: Number, default: null },
      year: { type: Number, default: null },
    },
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
