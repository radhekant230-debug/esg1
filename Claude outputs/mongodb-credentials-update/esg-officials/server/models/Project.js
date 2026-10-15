const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    startDate: {
      type: Date,
      required: true,
    },

    deadline: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Not Started",
        "Planning",
        "In Progress",
        "Waiting for Client",
        "On Hold",
        "Completed",
        "Cancelled",
      ],
      default: "Not Started",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
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

// Generate Project ID automatically
projectSchema.pre("save", async function () {
  if (!this.projectId) {
    const year = new Date().getFullYear();

    const lastProject = await mongoose
      .model("Project")
      .findOne({
        projectId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastProject && lastProject.projectId) {
      const match = lastProject.projectId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.projectId = `PRJ-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model("Project", projectSchema);