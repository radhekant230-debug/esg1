const mongoose = require("mongoose");
const { Schema } = mongoose;

const saleItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "BizProduct" },
  productName: { type: String, required: true },
  variant: { type: Schema.Types.ObjectId, ref: "BizVariant", default: null },
  variantLabel: { type: String },
  quantity: { type: Number, required: true, min: 0.001 },
  unitPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true },
  lineTax: { type: Number, default: 0 },
});

const bizSaleSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    invoiceNo: { type: String },
    customer: { type: Schema.Types.ObjectId, ref: "BizCustomer", default: null },
    customerName: { type: String, trim: true },
    customerPhone: { type: String },
    items: { type: [saleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    totalCost: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "online", "partial", "other"],
      default: "cash",
    },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["completed", "cancelled", "refunded", "partial"],
      default: "completed",
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    saleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bizSaleSchema.index({ business: 1, saleDate: -1 });
bizSaleSchema.index({ business: 1, status: 1 });
bizSaleSchema.index({ business: 1, invoiceNo: 1 });

bizSaleSchema.pre("save", async function (next) {
  if (!this.invoiceNo) {
    const count = await mongoose.model("BizSale").countDocuments({ business: this.business });
    const year = new Date().getFullYear();
    this.invoiceNo = `INV-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("BizSale", bizSaleSchema);
