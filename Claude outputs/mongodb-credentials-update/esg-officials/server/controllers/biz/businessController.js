const Business = require("../../models/biz/Business");
const BizMember = require("../../models/biz/BizMember");

// POST /api/biz/businesses
exports.createBusiness = async (req, res) => {
    try {
        const { name, type, address, phone, email, currency, taxLabel, defaultTaxRate } = req.body;
        if (!name || !type) return res.status(400).json({ message: "Name and type are required" });

        const business = await Business.create({
            name: name.trim(),
            type,
            owner: req.user._id,
            address,
            phone,
            email,
            currency: currency || "INR",
            taxLabel: taxLabel || "GST",
            defaultTaxRate: defaultTaxRate || 0,
        });

        await BizMember.create({ business: business._id, user: req.user._id, role: "owner" });

        res.status(201).json({ message: "Business created", business });
    } catch (err) {
        console.error("createBusiness:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses
exports.getMyBusinesses = async (req, res) => {
    try {
        let businesses;
        if (req.user.role === "admin") {
            businesses = await Business.find({ isActive: true }).sort({ createdAt: -1 });
        } else {
            const memberships = await BizMember.find({ user: req.user._id, isActive: true }).select("business role");
            const ids = memberships.map((m) => m.business);
            businesses = await Business.find({ _id: { $in: ids }, isActive: true }).sort({ name: 1 });
            // Attach role to each
            businesses = businesses.map((b) => {
                const m = memberships.find((x) => x.business.toString() === b._id.toString());
                return { ...b.toObject(), myRole: m?.role || "staff" };
            });
        }
        res.json(businesses);
    } catch (err) {
        console.error("getMyBusinesses:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId
exports.getBusinessById = async (req, res) => {
    try {
        const members = await BizMember.find({ business: req.bizId, isActive: true })
            .populate("user", "name email role")
            .sort({ role: 1 });
        res.json({ business: req.business, members, myRole: req.bizRole });
    } catch (err) {
        console.error("getBusinessById:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// PUT /api/biz/businesses/:bizId
exports.updateBusiness = async (req, res) => {
    try {
        const allowed = ["name", "address", "phone", "email", "currency", "taxLabel", "defaultTaxRate", "allowNegativeStock", "logo"];
        allowed.forEach((k) => {
            if (req.body[k] !== undefined) req.business[k] = req.body[k];
        });
        await req.business.save();
        res.json({ message: "Business updated", business: req.business });
    } catch (err) {
        console.error("updateBusiness:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/biz/businesses/:bizId/members
exports.addMember = async (req, res) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !role) return res.status(400).json({ message: "userId and role required" });

        const existing = await BizMember.findOne({ business: req.bizId, user: userId });
        if (existing) {
            existing.role = role;
            existing.isActive = true;
            await existing.save();
            return res.json({ message: "Member role updated" });
        }
        const member = await BizMember.create({ business: req.bizId, user: userId, role });
        res.status(201).json({ message: "Member added", member });
    } catch (err) {
        console.error("addMember:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /api/biz/businesses/:bizId/members/:userId
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        if (userId === req.business.owner.toString()) {
            return res.status(400).json({ message: "Cannot remove the business owner" });
        }
        await BizMember.findOneAndUpdate({ business: req.bizId, user: userId }, { isActive: false });
        res.json({ message: "Member removed" });
    } catch (err) {
        console.error("removeMember:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};
