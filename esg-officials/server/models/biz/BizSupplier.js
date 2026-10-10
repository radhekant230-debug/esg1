const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizSupplierSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    category: { type: String, trim: true },
    notes: { type: String },
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizSupplierSchema.index({ business: 1, name: 1 });

module.exports = mongoose.model("BizSupplier", bizSupplierSchema);
