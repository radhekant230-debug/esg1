const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ==========================================
// AUTHENTICATION
// ==========================================
const protect = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Not authorized, user not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been disabled",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

// ==========================================
// ADMIN ONLY
// ==========================================
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized, admin only",
  });
};

// ==========================================
// MANAGER ONLY
// ==========================================
const manager = (req, res, next) => {
  if (req.user && req.user.role === "manager") {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized, manager only",
  });
};

// ==========================================
// CLIENT ONLY
// ==========================================
const client = (req, res, next) => {
  if (req.user && req.user.role === "client") {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized, client only",
  });
};

// ==========================================
// ADMIN OR MANAGER
// ==========================================
const adminOrManager = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "manager")
  ) {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized, admin or manager only",
  });
};

// ==========================================
// ADMIN OR CLIENT
// ==========================================
const adminOrClient = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "client")
  ) {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized",
  });
};

module.exports = {
  protect,
  admin,
  manager,
  client,
  adminOrManager,
  adminOrClient,
};