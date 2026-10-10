const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientVaultDocumentSchema = new Schema(
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
    category: {
      type: String,
      enum: [
        "Marketing Strategy",
        "Brand Guidelines",
        "Logos & Brand Assets",
        "Creative Files",
        "Campaign Reports",
        "Invoices & Receipts",
        "Contracts & Proposals",
        "Client Deliverables",
      ],
      default: "Marketing Strategy",
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      default: "PDF",
    },
    fileSize: {
      type: String,
      default: "2.4 MB",
    },
    description: {
      type: String,
      default: "",
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    uploaderName: {
      type: String,
      default: "ESG Officials Team",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientVaultDocument", clientVaultDocumentSchema);
