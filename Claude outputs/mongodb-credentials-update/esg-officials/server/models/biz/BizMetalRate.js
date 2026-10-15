const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizMetalRateSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    metalType: {
      type: String,
      enum: ["gold", "silver", "platinum", "other"],
      required: true,
    },
    purity: { type: String, trim: true },
    ratePerGram: { type: Number, required: true, min: 0 },
    ratePerTola: { type: Number, default: 0 },
    effectiveDate: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bizMetalRateSchema.index({ business: 1, metalType: 1, effectiveDate: -1 });

module.exports = mongoose.model("BizMetalRate", bizMetalRateSchema);
