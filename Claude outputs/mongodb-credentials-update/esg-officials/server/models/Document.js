const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      unique: true,
      trim: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
      type: String,
      trim: true,
      default: "",
    },

    fileType: {
      type: String,
      trim: true,
      default: "",
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique Document ID
documentSchema.pre("save", async function () {
  if (!this.documentId) {
    const year = new Date().getFullYear();

    const lastDocument = await mongoose
      .model("Document")
      .findOne({
        documentId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastDocument && lastDocument.documentId) {
      const match = lastDocument.documentId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.documentId = `DOC-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model("Document", documentSchema);