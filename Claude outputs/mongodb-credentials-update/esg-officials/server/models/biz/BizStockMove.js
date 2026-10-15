const mongoose = require("mongoose");
const { Schema } = mongoose;

// Immutable stock movement ledger
const bizStockMoveSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: Schema.Types.ObjectId, ref: "BizProduct", required: true },
    productName: { type: String },
    variant: { type: Schema.Types.ObjectId, ref: "BizVariant", default: null },
    type: {
      type: String,
      enum: ["purchase", "sale", "adjustment", "return_in", "return_out", "opening"],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousQty: { type: Number, default: 0 },
    newQty: { type: Number, default: 0 },
    reference: { type: Schema.Types.ObjectId },
    referenceModel: { type: String },
    reason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bizStockMoveSchema.index({ business: 1, product: 1, createdAt: -1 });

module.exports = mongoose.model("BizStockMove", bizStockMoveSchema);
