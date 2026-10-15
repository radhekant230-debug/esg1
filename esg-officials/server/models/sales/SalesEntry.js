const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Date-level sales data (in addition to the monthly SalesRecord summaries).
 *
 *  kind "txn"    one transaction/invoice with a stable ID from the file (transactionId)
 *  kind "day"    the total for one business on one day (rows without an ID are
 *                summed per day, so re-uploading the same day is detectable)
 *  kind "period" one summary row covering several days (e.g. a weekly total,
 *                or a custom range chosen in the upload form)
 *
 * startKey/endKey are IST calendar days ("YYYY-MM-DD"); for txn/day they are equal.
 * Financial fields use null for "not recorded" (never 0 by assumption).
 */
const salesEntrySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "SalesBusiness", required: true },
    businessName: { type: String, required: true, trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    kind: { type: String, enum: ["txn", "day", "period"], required: true },
    startKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startDate: { type: Date, required: true }, // IST midnight of startKey (for Date queries/tools)
    endDate: { type: Date, required: true },
    transactionId: { type: String, default: null, trim: true },
    lineCount: { type: Number, default: 1 }, // file rows summed into this entry (kind "day")

    totalSales: { type: Number, required: true, min: 0 },
    salesBasis: { type: String, enum: ["gross", "net"], default: "gross" },
    orders: { type: Number, default: null, min: 0 },
    target: { type: Number, default: null, min: 0 },
    discount: { type: Number, default: null, min: 0 },
    cost: { type: Number, default: null, min: 0 },
    expenses: { type: Number, default: null, min: 0 },
    reportedProfit: { type: Number, default: null },
    remarks: { type: String, default: "", trim: true },

    // Source-report metrics kept exactly as reported (rupees, 2 decimals; null =
    // column absent/blank). Used for restaurant POS reports such as the
    // Petpooja "All Restaurant Report - Day Wise". Never derived or forced to match.
    metrics: {
      grossAmount: { type: Number, default: null }, // "My Amount" (before discount)
      discount: { type: Number, default: null }, // "Total Discount"
      netSales: { type: Number, default: null }, // "Net Sales (M.A - T.D)" as reported
      deliveryCharge: { type: Number, default: null },
      containerCharge: { type: Number, default: null },
      serviceCharge: { type: Number, default: null },
      tax: { type: Number, default: null }, // "Total Tax"
      waivedOff: { type: Number, default: null },
      roundOff: { type: Number, default: null },
      totalSales: { type: Number, default: null }, // "Total Sales" as reported (incl. tax/charges)
      notPaid: { type: Number, default: null },
      bills: { type: Number, default: null }, // "Total no. of bills"
      pax: { type: Number, default: null },
      payments: {
        cash: { type: Number, default: null },
        card: { type: Number, default: null },
        duePayment: { type: Number, default: null },
        other: { type: Number, default: null },
        wallet: { type: Number, default: null },
        upi: { type: Number, default: null },
        online: { type: Number, default: null },
      },
    },
    invoiceRange: { type: String, default: "" }, // e.g. "10781-10862" — text, never a number/date
    sourceFormat: { type: String, default: "generic" }, // generic | petpooja_daywise
    reconciliation: [{ check: String, expected: Number, actual: Number, difference: Number, _id: false }],

    source: { type: String, enum: ["excel_upload", "manual"], default: "excel_upload" },
    importJob: { type: Schema.Types.ObjectId, ref: "SalesImportJob", default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploaderName: { type: String, default: "" },
  },
  { timestamps: true }
);

salesEntrySchema.pre("validate", function () {
  if (this.endKey < this.startKey) this.invalidate("endKey", "endKey must not be before startKey");
  if (this.kind !== "period" && this.startKey !== this.endKey) this.invalidate("endKey", "txn/day entries cover one day");
});

// Range queries per business
salesEntrySchema.index({ business: 1, startKey: 1, endKey: 1 });
salesEntrySchema.index({ importJob: 1 });
// Duplicate prevention (re-uploads are idempotent):
// - one transaction ID per business
salesEntrySchema.index(
  { business: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { kind: "txn" }, name: "uniq_business_transaction" }
);
// - one day total per business per day
salesEntrySchema.index(
  { business: 1, startKey: 1 },
  { unique: true, partialFilterExpression: { kind: "day" }, name: "uniq_business_day" }
);
// - one summary per business per exact period
salesEntrySchema.index(
  { business: 1, startKey: 1, endKey: 1 },
  { unique: true, partialFilterExpression: { kind: "period" }, name: "uniq_business_period" }
);

module.exports = mongoose.model("SalesEntry", salesEntrySchema);
