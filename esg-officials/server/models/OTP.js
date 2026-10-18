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
    },

    // MongoDB removes the document after this time (TTL index below).
    // Expiry is also checked in every verification query.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + require("../utils/otpConfig").otpConfig().ttlMs),
    },
  },
  {
    timestamps: false,
  }
);

otpSchema.index({ email: 1, action: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// The old fixed 5-minute TTL index on createdAt is removed by
// `npm run migrate:otp` (until then codes simply disappear after 5 minutes).

module.exports = mongoose.model("OTP", otpSchema);