const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "BizProduct" },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  notes: { type: String },
  status: {
    type: String,
    enum: ["pending", "preparing", "ready", "served"],
    default: "pending",
  },
});

const bizOrderSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    orderNo: { type: String },
    table: { type: Schema.Types.ObjectId, ref: "BizTable", default: null },
    tableLabel: { type: String },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      default: "dine-in",
    },
    customer: { type: Schema.Types.ObjectId, ref: "BizCustomer", default: null },
    customerName: { type: String },
    customerPhone: { type: String },
    deliveryAddress: { type: String },
    items: { type: [orderItemSchema], required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "completed", "cancelled"],
      default: "pending",
    },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "cash" },
    isPaid: { type: Boolean, default: false },
    notes: { type: String },
    completedSale: { type: Schema.Types.ObjectId, ref: "BizSale", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bizOrderSchema.index({ business: 1, orderDate: -1 });
bizOrderSchema.index({ business: 1, status: 1 });

bizOrderSchema.pre("save", async function (next) {
  if (!this.orderNo) {
    const count = await mongoose.model("BizOrder").countDocuments({ business: this.business });
    this.orderNo = `ORD-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("BizOrder", bizOrderSchema);
