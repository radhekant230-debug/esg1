const BizCustomer = require("../../models/biz/BizCustomer");
const BizSale = require("../../models/biz/BizSale");

exports.getCustomers = async (req, res) => {
    try {
        const { search, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId, isActive: true };
        if (search) filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
        ];

        const [customers, total] = await Promise.all([
            BizCustomer.find(filter).sort({ name: 1 }).skip((page - 1) * Number(limit)).limit(Number(limit)),
            BizCustomer.countDocuments(filter),
        ]);
        res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const { name, phone, email, address, notes } = req.body;
        if (!name) return res.status(400).json({ message: "Customer name required" });
        const customer = await BizCustomer.create({ business: req.bizId, name, phone, email, address, notes });
        res.status(201).json({ message: "Customer added", customer });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const customer = await BizCustomer.findOneAndUpdate(
            { _id: req.params.id, business: req.bizId },
            req.body,
            { new: true }
        );
        if (!customer) return res.status(404).json({ message: "Customer not found" });
        res.json({ message: "Customer updated", customer });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getCustomerHistory = async (req, res) => {
    try {
        const sales = await BizSale.find({ business: req.bizId, customer: req.params.id, status: "completed" })
            .sort({ saleDate: -1 })
            .limit(50)
            .select("invoiceNo total paymentMethod saleDate items");
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
