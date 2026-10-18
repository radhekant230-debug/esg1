const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  verifyOtp,
  requestLoginOtp,
  verifyLoginOtp,
} = require("../controllers/authController");
const { rateLimit, bodyId } = require("../utils/rateLimit");

const MIN15 = 15 * 60 * 1000;
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

// per client IP, and per IP + identifier (slows guessing on one account)
const perIp = (name, max) => rateLimit({ name: `${name}:ip`, windowMs: MIN15, max, message: TOO_MANY });
const perIdentity = (name, max) =>
  rateLimit({ name: `${name}:id`, windowMs: MIN15, max, key: (req) => `${req.ip}|${bodyId(req)}`, message: TOO_MANY });

// Public client registration
router.post("/register", perIp("register", 20), registerUser);

// Login for Admin / Manager / Client (password)
router.post("/login", perIp("login", 100), perIdentity("login", 10), loginUser);

// Email OTP verification (new client accounts)
router.post("/verify-otp", perIp("verify", 30), perIdentity("verify", 10), verifyOtp);

// Passwordless sign-in: email a 6-digit code, then exchange it for the normal login token
router.post("/login-otp/request", perIp("otp-request", 10), perIdentity("otp-request", 5), requestLoginOtp);
router.post("/login-otp/verify", perIp("otp-verify", 30), perIdentity("otp-verify", 10), verifyLoginOtp);

module.exports = router;
