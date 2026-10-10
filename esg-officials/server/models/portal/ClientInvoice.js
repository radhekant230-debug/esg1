const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientInvoiceSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    servicePackage: {
      type: String,
      required: true,
      trim: true,
      default: "Brand Growth & Performance Marketing",
    },
    servicesIncluded: {
      type: [String],
      default: [
        "Digital Advertising (Meta & Google)",
        "Social Media Production & Management",
        "Lead Management & Tracking",
        "Strategic Growth Consulting",
      ],
    },
    billingPeriod: {
      type: String,
      required: true, // e.g. "01 Oct 2026 - 31 Oct 2026"
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 18, // 18% GST standard in India
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"],
      default: "Sent",
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paidDate: {
      type: Date,
    },
    pdfUrl: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

clientInvoiceSchema.pre("save", function () {
  if (this.subtotal > 0 && !this.taxAmount) {
    this.taxAmount = Math.round((this.subtotal * (this.taxRate || 18)) / 100);
    this.totalAmount = this.subtotal + this.taxAmount;
  }
});

module.exports = mongoose.model("ClientInvoice", clientInvoiceSchema);
