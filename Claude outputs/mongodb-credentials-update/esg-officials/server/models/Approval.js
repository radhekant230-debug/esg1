const mongoose = require("mongoose");

const approvalSchema = new mongoose.Schema(
  {
    approvalId: {
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

    update: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectUpdate",
      required: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    clientComment: {
      type: String,
      trim: true,
      default: "",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique Approval ID
approvalSchema.pre("save", async function () {
  if (!this.approvalId) {
    const year = new Date().getFullYear();

    const lastApproval = await mongoose
      .model("Approval")
      .findOne({
        approvalId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastApproval && lastApproval.approvalId) {
      const match = lastApproval.approvalId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.approvalId = `APR-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model("Approval", approvalSchema);