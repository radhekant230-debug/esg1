const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizProductSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "BizCategory" },
    description: { type: String, trim: true },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number },
    trackStock: { type: Boolean, default: true },
    hasVariants: { type: Boolean, default: false },
    reorderLevel: { type: Number, default: 5, min: 0 },
    unit: { type: String, default: "pcs" },
    image: { type: String },
    // Cafe / Restaurant specific
    isAvailable: { type: Boolean, default: true },
    preparationTime: { type: Number },
    // Jewellery specific
    metalType: {
      type: String,
      enum: ["gold", "silver", "platinum", "diamond", "artificial", "other", ""],
      default: "",
    },
    purity: { type: String },
    grossWeight: { type: Number, default: 0 },
    netWeight: { type: Number, default: 0 },
    stoneWeight: { type: Number, default: 0 },
    makingCharges: { type: Number, default: 0 },
    // Clothing specific
    brand: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizProductSchema.index({ business: 1, isActive: 1 });
bizProductSchema.index({ business: 1, sku: 1 });

module.exports = mongoose.model("BizProduct", bizProductSchema);
