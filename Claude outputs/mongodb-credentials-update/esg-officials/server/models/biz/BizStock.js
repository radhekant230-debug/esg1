const mongoose = require("mongoose");
const { Schema } = mongoose;

// Current stock level snapshot — updated on every movement
const bizStockSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: Schema.Types.ObjectId, ref: "BizProduct", required: true },
    variant: { type: Schema.Types.ObjectId, ref: "BizVariant", default: null },
    quantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bizStockSchema.index({ business: 1, product: 1, variant: 1 }, { unique: true });

module.exports = mongoose.model("BizStock", bizStockSchema);
