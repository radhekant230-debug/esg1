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
      enum: ["completed", "partial", "failed"],
      default: "completed",
    },
    errorLogs: [
      {
        rowNumber: Number,
        businessName: String,
        state: String,
        city: String,
        month: String,
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

module.exports = mongoose.model("SalesImportJob", salesImportJobSchema);
