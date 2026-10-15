const BizSupplier = require("../../models/biz/BizSupplier");
const BizPurchase = require("../../models/biz/BizPurchase");
const BizProduct = require("../../models/biz/BizProduct");
const { applyStockDelta } = require("./inventoryController");

exports.getSuppliers = async (req, res) => {
    try {
        const { search, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId, isActive: true };
        if (search) filter.name = { $regex: search, $options: "i" };
        const [suppliers, total] = await Promise.all([
            BizSupplier.find(filter).sort({ name: 1 }).skip((page - 1) * Number(limit)).limit(Number(limit)),
            BizSupplier.countDocuments(filter),
        ]);
        res.json({ suppliers, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const { name, phone, email, address, category, notes } = req.body;
        if (!name) return res.status(400).json({ message: "Supplier name required" });
        const supplier = await BizSupplier.create({ business: req.bizId, name, phone, email, address, category, notes });
        res.status(201).json({ message: "Supplier added", supplier });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const supplier = await BizSupplier.findOneAndUpdate(
            { _id: req.params.id, business: req.bizId },
            req.body,
            { new: true }
        );
        if (!supplier) return res.status(404).json({ message: "Supplier not found" });
        res.json({ message: "Supplier updated", supplier });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPurchases = async (req, res) => {
    try {
        const { from, to, status, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId };
        if (status) filter.status = status;
        if (from || to) {
            filter.purchaseDate = {};
            if (from) filter.purchaseDate.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); filter.purchaseDate.$lte = d; }
        }
        const [purchases, total] = await Promise.all([
            BizPurchase.find(filter).populate("supplier", "name").sort({ purchaseDate: -1 }).skip((page - 1) * Number(limit)).limit(Number(limit)),
            BizPurchase.countDocuments(filter),
        ]);
        res.json({ purchases, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createPurchase = async (req, res) => {
    try {
        const { items, supplierId, supplierName, paymentMethod, amountPaid, notes, purchaseDate } = req.body;
        if (!items?.length) return res.status(400).json({ message: "At least one item required" });

        const resolvedItems = [];
        let total = 0;

        for (const item of items) {
            const product = await BizProduct.findOne({ _id: item.productId, business: req.bizId });
            if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
            const lineTotal = Number(item.quantity) * Number(item.costPrice);
            resolvedItems.push({
                product: product._id,
                productName: product.name,
                variant: item.variantId || null,
                variantLabel: item.variantLabel || "",
                quantity: Number(item.quantity),
                costPrice: Number(item.costPrice),
                lineTotal,
            });
            total += lineTotal;
        }

        const purchase = await BizPurchase.create({
            business: req.bizId,
            supplier: supplierId || null,
            supplierName: supplierName || "Unknown Supplier",
            items: resolvedItems,
            total: +total.toFixed(2),
            amountPaid: Number(amountPaid ?? total),
            paymentMethod: paymentMethod || "cash",
            status: "received",
            notes,
            createdBy: req.user._id,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        });

        // Add stock
        for (const item of resolvedItems) {
            const product = await BizProduct.findById(item.product);
            if (product?.trackStock) {
                await applyStockDelta(req.bizId, item.product, item.variant, item.quantity, "purchase", purchase._id, "BizPurchase", null, req.user._id);
            }
        }

        // Update supplier totals
        if (supplierId) {
            await BizSupplier.findByIdAndUpdate(supplierId, {
                $inc: { totalPurchases: total, totalPaid: Number(amountPaid ?? total) },
            });
        }

        res.status(201).json({ message: "Purchase recorded", purchase });
    } catch (err) {
        console.error("createPurchase:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
