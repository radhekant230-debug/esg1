const mongoose = require("mongoose");
const { Schema } = mongoose;

const calendarEventSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    eventType: {
      type: String,
      enum: [
        "Risk Review",
        "Approval Deadline",
        "Meeting",
        "Follow-up",
        "Task Deadline",
        "Postponed Task",
      ],
      default: "Risk Review",
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    risk: {
      type: Schema.Types.ObjectId,
      ref: "Risk",
      default: null,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["Upcoming", "Completed", "Postponed", "Overdue", "Cancelled"],
      default: "Upcoming",
      index: true,
    },
    isPostponed: {
      type: Boolean,
      default: false,
    },
    originalDate: {
      type: Date,
    },
    postponementReason: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    location: {
      type: String,
      default: "Client Executive Portal / Online Meeting",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);
