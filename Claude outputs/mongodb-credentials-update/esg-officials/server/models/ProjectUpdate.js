const mongoose = require("mongoose");

const projectUpdateSchema = new mongoose.Schema(
  {
    updateId: {
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

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "Update",
        "Waiting for Approval",
        "Approved",
        "Rejected",
      ],
      default: "Update",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attachments: [
      {
        name: {
          type: String,
          trim: true,
        },

        url: {
          type: String,
          trim: true,
        },

        publicId: {
          type: String,
          trim: true,
        },
      },
    ],

    clientApprovalRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique Update ID
projectUpdateSchema.pre("save", async function () {
  if (!this.updateId) {
    const year = new Date().getFullYear();

    const lastUpdate = await mongoose
      .model("ProjectUpdate")
      .findOne({
        updateId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastUpdate && lastUpdate.updateId) {
      const match = lastUpdate.updateId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.updateId = `UPD-${year}-${String(number).padStart(4, "0")}`;
  }

});

module.exports = mongoose.model(
  "ProjectUpdate",
  projectUpdateSchema
);