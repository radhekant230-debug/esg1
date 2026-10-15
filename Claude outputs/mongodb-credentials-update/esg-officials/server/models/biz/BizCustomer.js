const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizCustomerSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    notes: { type: String },
    totalPurchases: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizCustomerSchema.index({ business: 1, name: 1 });
bizCustomerSchema.index({ business: 1, phone: 1 });

module.exports = mongoose.model("BizCustomer", bizCustomerSchema);
