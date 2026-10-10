const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizCategorySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["product", "menu", "expense"],
      default: "product",
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizCategorySchema.index({ business: 1, name: 1 });

module.exports = mongoose.model("BizCategory", bizCategorySchema);
