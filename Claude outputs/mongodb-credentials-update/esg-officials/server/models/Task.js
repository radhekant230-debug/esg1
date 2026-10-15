const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Review",
        "Waiting for Approval",
        "Approved",
        "Rejected",
        "Completed",
      ],
      default: "Pending",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique Task ID
taskSchema.pre("save", async function () {
  if (!this.taskId) {
    const year = new Date().getFullYear();

    const lastTask = await mongoose
      .model("Task")
      .findOne({
        taskId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastTask && lastTask.taskId) {
      const match = lastTask.taskId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.taskId = `TSK-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model("Task", taskSchema);