const mongoose = require("mongoose");
const { Schema } = mongoose;

const salesBusinessSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["Hotel", "Restaurant", "Service"],
      required: true,
      default: "Restaurant",
    },
    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    monthlyTarget: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate Business Code if not provided
salesBusinessSchema.pre("save", async function () {
  if (!this.code) {
    const statePrefix = (this.state || "ST").substring(0, 2).toUpperCase();
    const cityPrefix = (this.city || "CT").substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    this.code = `BIZ-${statePrefix}-${cityPrefix}-${random}`;
  }
});

module.exports = mongoose.model("SalesBusiness", salesBusinessSchema);
