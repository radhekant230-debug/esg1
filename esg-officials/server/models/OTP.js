const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    otp: {
      type: String,
      required: true,
    },

    action: {
      type: String,
      enum: [
        "account_verification",
        "password_reset",
      ],
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model("OTP", otpSchema);