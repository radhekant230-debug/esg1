const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["cafe", "restaurant", "clothing", "jewellery"],
      required: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    currency: { type: String, default: "INR" },
    taxLabel: { type: String, default: "GST" },
    defaultTaxRate: { type: Number, default: 0, min: 0, max: 100 },
    allowNegativeStock: { type: Boolean, default: false },
    logo: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
