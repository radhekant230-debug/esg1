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
        "login", // passwordless email sign-in
      ],
      required: true,
    },

    // wrong guesses so far (login codes are burned after 5)
    attempts: {
      type: Number,
      default: 0,
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

otpSchema.index({ email: 1, action: 1 });

module.exports = mongoose.model("OTP", otpSchema);