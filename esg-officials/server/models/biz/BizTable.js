const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizTableSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    label: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 4 },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "inactive"],
      default: "available",
    },
    currentOrder: { type: Schema.Types.ObjectId, ref: "BizOrder", default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bizTableSchema.index({ business: 1 });

module.exports = mongoose.model("BizTable", bizTableSchema);
