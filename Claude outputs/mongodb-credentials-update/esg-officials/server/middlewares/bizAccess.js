const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Business = require("../models/biz/Business");
const BizMember = require("../models/biz/BizMember");

const ROLE_RANK = { owner: 5, admin: 4, manager: 3, cashier: 2, staff: 1 };

// 1. Verify JWT and attach req.user (reuses existing auth logic)
const protectBiz = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not authorized — no token" });
    }
    try {
        const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        if (!user?.isActive) return res.status(401).json({ message: "Account inactive" });
        req.user = user;
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};

// 2. Resolve :bizId and verify membership — attaches req.business and req.bizRole
const requireBizMember = async (req, res, next) => {
    const { bizId } = req.params;
    if (!mongoose.isValidObjectId(bizId)) {
        return res.status(400).json({ message: "Invalid business ID" });
    }

    const business = await Business.findById(bizId);
    if (!business?.isActive) {
        return res.status(404).json({ message: "Business not found" });
    }

    // System-level admins can access any business
    if (req.user.role === "admin") {
        req.business = business;
        req.bizId = business._id;
        req.bizRole = "admin";
        return next();
    }

    const member = await BizMember.findOne({
        business: bizId,
        user: req.user._id,
        isActive: true,
    });
    if (!member) {
        return res.status(403).json({ message: "You are not a member of this business" });
    }

    req.business = business;
    req.bizId = business._id;
    req.bizRole = member.role;
    next();
};

// 3. Role guards — use after requireBizMember
const requireMinRole = (minRole) => (req, res, next) => {
    if ((ROLE_RANK[req.bizRole] || 0) >= (ROLE_RANK[minRole] || 99)) return next();
    res.status(403).json({ message: `${minRole} or higher role required` });
};

const requireManager = requireMinRole("manager");
const requireAdmin = requireMinRole("admin");
const requireOwner = requireMinRole("owner");

// Convenience: run protect + requireBizMember together
const bizAuth = [protectBiz, requireBizMember];

module.exports = {
    protectBiz,
    requireBizMember,
    requireMinRole,
    requireManager,
    requireAdmin,
    requireOwner,
    bizAuth,
};
