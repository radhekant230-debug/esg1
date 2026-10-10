const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    entityType: {
      type: String,
      enum: [
        "User",
        "Project",
        "Task",
        "ProjectUpdate",
        "Approval",
        "Message",
        "Document",
        "Notification",
      ],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);