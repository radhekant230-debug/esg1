const User = require("../models/User");
const OTP = require("../models/OTP");
const bcrypt = require("bcryptjs");
const { sendOTPEmail } = require("../utils/email");
const jwt = require("jsonwebtoken");

// ==========================================
// GENERATE JWT TOKEN
// ==========================================
const generateToken = (id, role) => {
  return jwt.sign(
    {
      id,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ==========================================
// REGISTER CLIENT
// ==========================================
exports.registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    companyName,
    phone,
  } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const userExists = await User.findOne({
      email: normalizedEmail,
    });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    // Public registration can ONLY create clients.
    // Admin and Manager accounts are created by Admin.
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "client",
      companyName: companyName
        ? companyName.trim()
        : undefined,
      phone: phone
        ? phone.trim()
        : undefined,
      isVerified: false,
      isActive: true,
    });

    // Generate 6-digit OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const hashedOtp = await bcrypt.hash(otp, 10);

    // Remove old verification OTPs
    await OTP.deleteMany({
      email: normalizedEmail,
      action: "account_verification",
    });

    // Store new OTP
    await OTP.create({
      email: normalizedEmail,
      otp: hashedOtp,
      action: "account_verification",
    });

    // Send OTP email
    await sendOTPEmail(
      normalizedEmail,
      otp,
      "account_verification"
    );

    return res.status(201).json({
      message:
        "Client registered successfully. Please verify your email with the OTP sent.",
      email: newUser.email,
      clientId: newUser.clientId,
    });
  } catch (error) {
    console.error(
      "Registration Error:",
      error
    );

    return res.status(500).json({
      message: "Error registering client",
    });
  }
};

// ==========================================
// LOGIN
// ==========================================
exports.loginUser = async (req, res) => {
  const {
    email,
    clientId,
    loginId,
    username,
    password,
    portal,
  } = req.body;

  try {
    const rawId = (email || clientId || loginId || username || "").toString().trim();

    if (!rawId || !password) {
      return res.status(400).json({
        message: "Email/Client ID and password are required",
      });
    }

    let loginQuery;

    if (rawId.includes("@")) {
      loginQuery = {
        email: rawId.toLowerCase(),
      };
    } else {
      loginQuery = {
        $or: [
          { clientId: rawId },
          { email: rawId.toLowerCase() },
        ],
      };
    }

    const user = await User.findOne(loginQuery);

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Portal-specific role enforcement
    if (portal) {
      const requestedPortal = String(portal).toLowerCase().trim();
      if (requestedPortal === "admin" && user.role !== "admin") {
        return res.status(403).json({
          message: "Access denied: This login is reserved for ESG Administrators only.",
        });
      }
      if (requestedPortal === "manager" && user.role !== "manager" && user.role !== "admin") {
        return res.status(403).json({
          message: "Access denied: This login is reserved for Account Managers only.",
        });
      }
      if (requestedPortal === "client" && user.role !== "client") {
        return res.status(403).json({
          message: "Access denied: This login is reserved for Clients only.",
        });
      }
    }

    // Check whether account is active
    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been disabled. Please contact the administrator.",
      });
    }

    // Compare password with support for bcrypt hash & safe auto-migration of legacy plaintext passwords
    let isMatch = false;
    const isBcrypt = typeof user.password === "string" && 
      (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) && 
      user.password.length === 60;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && typeof password === "string" && password.trim() !== password) {
        isMatch = await bcrypt.compare(password.trim(), user.password);
      }
    } else {
      // Legacy plaintext password check
      if (user.password === password || (typeof password === "string" && user.password === password.trim())) {
        isMatch = true;
        try {
          // Immediately upgrade legacy plaintext password to secure bcrypt hash
          user.password = await bcrypt.hash(password.trim(), 10);
          await user.save();
          console.log(`[auth] Automatically migrated plaintext password to bcrypt for: ${user.email}`);
        } catch (hashErr) {
          console.error("[auth] Failed to auto-hash legacy password:", hashErr.message);
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // ==========================================
    // CLIENT EMAIL VERIFICATION
    // ==========================================
    if (
      user.role === "client" &&
      !user.isVerified
    ) {
      const otp = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      const hashedOtp = await bcrypt.hash(otp, 10);

      // Remove previous OTP
      await OTP.deleteMany({
        email: user.email,
        action: "account_verification",
      });

      // Create new OTP
      await OTP.create({
        email: user.email,
        otp: hashedOtp,
        action: "account_verification",
      });

      // Send OTP
      await sendOTPEmail(
        user.email,
        otp,
        "account_verification"
      );

      return res.status(400).json({
        message:
          "Account not verified. Please verify your email with the OTP sent.",
        requiresVerification: true,
        email: user.email,
      });
    }

    // ==========================================
    // UPDATE LAST LOGIN
    // ==========================================
    user.lastLogin = new Date();

    await user.save();

    // ==========================================
    // LOGIN RESPONSE
    // ==========================================
    return res.json({
      message: "Login successful",

      _id: user._id,

      name: user.name,

      email: user.email,

      role: user.role,

      clientId:
        user.clientId || null,

      companyName:
        user.companyName || null,

      assignedManager:
        user.assignedManager || null,

      token: generateToken(
        user._id,
        user.role
      ),
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    if (error.name === "MongoServerSelectionError" || error.name === "MongoNetworkError") {
      return res.status(503).json({
        message: "Database service temporarily unavailable. Please verify MongoDB network access rules.",
      });
    }

    return res.status(500).json({
      message: "Internal server error during authentication",
    });
  }
};

// ==========================================
// VERIFY OTP
// ==========================================
exports.verifyOtp = async (req, res) => {
  const {
    email,
    otp,
  } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({
        message:
          "Email and OTP are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const normalizedOtp = String(
      otp
    ).trim();

    // ==========================================
    // FIND VALID OTP
    // ==========================================
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      action: "account_verification",
    });

    // New OTPs are bcrypt-hashed. The plain comparison is temporary support
    // for an OTP issued before this security update; all OTPs expire in five minutes.
    const otpMatches = otpRecord && (
      otpRecord.otp.startsWith("$2")
        ? await bcrypt.compare(normalizedOtp, otpRecord.otp)
        : otpRecord.otp === normalizedOtp
    );

    if (!otpMatches) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // ==========================================
    // VERIFY CLIENT ONLY
    // ==========================================
    const user =
      await User.findOneAndUpdate(
        {
          email: normalizedEmail,
          role: "client",
        },
        {
          isVerified: true,
          lastLogin: new Date(),
        },
        {
          new: true,
        }
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Client account not found",
      });
    }

    // ==========================================
    // DELETE USED OTP
    // ==========================================
    await OTP.deleteMany({
      email: normalizedEmail,
      action: "account_verification",
    });

    // ==========================================
    // RETURN LOGIN TOKEN
    // ==========================================
    return res.json({
      message:
        "Email verified successfully",

      _id: user._id,

      name: user.name,

      email: user.email,

      role: user.role,

      clientId:
        user.clientId || null,

      companyName:
        user.companyName || null,

      assignedManager:
        user.assignedManager || null,

      token: generateToken(
        user._id,
        user.role
      ),
    });
  } catch (error) {
    console.error(
      "OTP Verification Error:",
      error
    );

    return res.status(500).json({
      message:
        "Error verifying OTP",
    });
  }
};