const mongoose = require("mongoose");
const { Schema } = mongoose;

const salesLocationSchema = new Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring no duplicate city-state pairs
salesLocationSchema.index({ city: 1, state: 1 }, { unique: true });

module.exports = mongoose.model("SalesLocation", salesLocationSchema);
