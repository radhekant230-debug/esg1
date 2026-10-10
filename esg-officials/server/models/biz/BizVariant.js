const mongoose = require("mongoose");
const { Schema } = mongoose;

// Represents a size/colour/weight variant of a product
const bizVariantSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    product: { type: Schema.Types.ObjectId, ref: "BizProduct", required: true },
    label: { type: String, required: true, trim: true },
    attributes: { type: Map, of: String },
    sku: { type: String },
    barcode: { type: String },
    costPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizVariantSchema.index({ business: 1, product: 1 });

module.exports = mongoose.model("BizVariant", bizVariantSchema);
