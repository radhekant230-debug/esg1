const mongoose = require("mongoose");
const { Schema } = mongoose;

const EXPENSE_CATEGORIES = [
  "rent", "salary", "electricity", "supplies", "transport",
  "marketing", "maintenance", "purchase", "other",
];

const bizExpenseSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "other" },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    vendor: { type: String, trim: true },
    receipt: { type: String },
    expenseDate: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bizExpenseSchema.index({ business: 1, expenseDate: -1 });

module.exports = mongoose.model("BizExpense", bizExpenseSchema);
