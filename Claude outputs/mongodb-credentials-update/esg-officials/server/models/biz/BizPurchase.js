const mongoose = require("mongoose");
const { Schema } = mongoose;

const purchaseItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "BizProduct" },
  productName: { type: String, required: true },
  variant: { type: Schema.Types.ObjectId, ref: "BizVariant", default: null },
  variantLabel: { type: String },
  quantity: { type: Number, required: true, min: 0.001 },
  costPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true },
});

const bizPurchaseSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    purchaseNo: { type: String },
    supplier: { type: Schema.Types.ObjectId, ref: "BizSupplier", default: null },
    supplierName: { type: String, trim: true },
    items: { type: [purchaseItemSchema], required: true },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "cash" },
    status: {
      type: String,
      enum: ["received", "pending", "cancelled"],
      default: "received",
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    purchaseDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bizPurchaseSchema.index({ business: 1, purchaseDate: -1 });

bizPurchaseSchema.pre("save", async function (next) {
  if (!this.purchaseNo) {
    const count = await mongoose.model("BizPurchase").countDocuments({ business: this.business });
    const year = new Date().getFullYear();
    this.purchaseNo = `PO-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("BizPurchase", bizPurchaseSchema);
