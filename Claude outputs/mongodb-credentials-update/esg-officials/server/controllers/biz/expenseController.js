const BizExpense = require("../../models/biz/BizExpense");

exports.getExpenses = async (req, res) => {
    try {
        const { from, to, category, search, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId };
        if (category) filter.category = category;
        if (from || to) {
            filter.expenseDate = {};
            if (from) filter.expenseDate.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); filter.expenseDate.$lte = d; }
        }
        if (search) filter.description = { $regex: search, $options: "i" };

        const [expenses, total] = await Promise.all([
            BizExpense.find(filter)
                .populate("createdBy", "name")
                .sort({ expenseDate: -1 })
                .skip((page - 1) * Number(limit))
                .limit(Number(limit)),
            BizExpense.countDocuments(filter),
        ]);
        res.json({ expenses, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createExpense = async (req, res) => {
    try {
        const { category, amount, description, vendor, expenseDate } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required" });

        const expense = await BizExpense.create({
            business: req.bizId,
            category: category || "other",
            amount: Number(amount),
            description,
            vendor,
            expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
            createdBy: req.user._id,
        });
        res.status(201).json({ message: "Expense recorded", expense });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const expense = await BizExpense.findOneAndUpdate(
            { _id: req.params.id, business: req.bizId },
            req.body,
            { new: true }
        );
        if (!expense) return res.status(404).json({ message: "Expense not found" });
        res.json({ message: "Expense updated", expense });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        await BizExpense.findOneAndDelete({ _id: req.params.id, business: req.bizId });
        res.json({ message: "Expense deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
