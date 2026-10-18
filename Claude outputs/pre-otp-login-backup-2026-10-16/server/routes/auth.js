const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  verifyOtp,
} = require("../controllers/authController");

// Public client registration
router.post("/register", registerUser);

// Login for Admin / Manager / Client
router.post("/login", loginUser);

// Email OTP verification
router.post("/verify-otp", verifyOtp);

module.exports = router;