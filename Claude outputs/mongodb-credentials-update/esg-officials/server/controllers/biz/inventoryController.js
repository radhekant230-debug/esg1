const BizStock = require("../../models/biz/BizStock");
const BizStockMove = require("../../models/biz/BizStockMove");
const BizProduct = require("../../models/biz/BizProduct");

// Helper — update stock and record movement atomically (no TX required for single doc)
async function applyStockDelta(bizId, productId, variantId, delta, type, ref, refModel, reason, userId) {
    const query = { business: bizId, product: productId, variant: variantId || null };
    let stock = await BizStock.findOne(query);
    if (!stock) {
        stock = await BizStock.create({ ...query, quantity: 0 });
    }
    const prev = stock.quantity;
    stock.quantity = Math.max(0, prev + delta); // never go negative unless explicitly allowed
    await stock.save();

    const product = await BizProduct.findById(productId).select("name");
    await BizStockMove.create({
        business: bizId,
        product: productId,
        productName: product?.name || "",
        variant: variantId || null,
        type,
        quantity: delta,
        previousQty: prev,
        newQty: stock.quantity,
        reference: ref,
        referenceModel: refModel,
        reason,
        createdBy: userId,
    });
    return stock.quantity;
}

// GET /api/biz/businesses/:bizId/inventory
exports.getInventory = async (req, res) => {
    try {
        const { search, lowstock, page = 1, limit = 50 } = req.query;
        const productFilter = { business: req.bizId, isActive: true, trackStock: true };
        if (search) productFilter.name = { $regex: search, $options: "i" };

        const products = await BizProduct.find(productFilter)
            .populate("category", "name")
            .sort({ name: 1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit));

        const productIds = products.map((p) => p._id);
        const stocks = await BizStock.find({ business: req.bizId, product: { $in: productIds } });
        const stockMap = {};
        stocks.forEach((s) => {
            const key = `${s.product}-${s.variant || "null"}`;
            stockMap[key] = s.quantity;
        });

        let inventory = products.map((p) => ({
            ...p.toObject(),
            currentStock: stockMap[`${p._id}-null`] ?? 0,
        }));

        if (lowstock === "true") {
            inventory = inventory.filter((p) => p.currentStock <= p.reorderLevel);
        }

        const total = await BizProduct.countDocuments(productFilter);
        res.json({ inventory, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("getInventory:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/biz/businesses/:bizId/inventory/adjust
exports.adjustStock = async (req, res) => {
    try {
        const { productId, variantId, quantity, reason, type = "adjustment" } = req.body;
        if (!productId || quantity === undefined) {
            return res.status(400).json({ message: "productId and quantity required" });
        }
        const allowed = ["adjustment", "opening", "return_in", "return_out"];
        if (!allowed.includes(type)) return res.status(400).json({ message: "Invalid adjustment type" });

        const newQty = await applyStockDelta(
            req.bizId, productId, variantId, Number(quantity), type, null, null, reason, req.user._id
        );
        res.json({ message: "Stock adjusted", newQuantity: newQty });
    } catch (err) {
        console.error("adjustStock:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId/inventory/movements
exports.getStockMovements = async (req, res) => {
    try {
        const { productId, type, page = 1, limit = 50 } = req.query;
        const filter = { business: req.bizId };
        if (productId) filter.product = productId;
        if (type) filter.type = type;

        const [moves, total] = await Promise.all([
            BizStockMove.find(filter)
                .populate("createdBy", "name")
                .sort({ createdAt: -1 })
                .skip((page - 1) * Number(limit))
                .limit(Number(limit)),
            BizStockMove.countDocuments(filter),
        ]);
        res.json({ movements: moves, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("getStockMovements:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { ...exports, applyStockDelta };
