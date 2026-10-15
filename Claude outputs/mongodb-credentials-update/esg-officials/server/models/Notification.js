const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      unique: true,
      trim: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "project",
        "task",
        "update",
        "approval",
        "message",
        "document",
        "system",
        "reminder",
        "escalation",
        "schedule",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Approval",
      default: null,
    },

    // Planner additions (all optional / additive)
    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledActivity",
      default: null,
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    link: {
      type: String,
      default: "",
      trim: true,
    },

    // Prevents duplicate notifications for the same reminder/escalation event
    dedupeKey: {
      type: String,
      default: undefined,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

// Generate unique Notification ID
notificationSchema.pre("save", async function () {
  if (!this.notificationId) {
    const year = new Date().getFullYear();

    const lastNotification = await mongoose
      .model("Notification")
      .findOne({
        notificationId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastNotification && lastNotification.notificationId) {
      const match = lastNotification.notificationId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.notificationId = `NOT-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);