const BizProduct = require("../../models/biz/BizProduct");
const BizStock = require("../../models/biz/BizStock");
const BizCategory = require("../../models/biz/BizCategory");

// GET /api/biz/businesses/:bizId/products
exports.getProducts = async (req, res) => {
    try {
        const { search, category, isActive = "true", page = 1, limit = 50 } = req.query;
        const filter = { business: req.bizId };
        if (isActive !== "all") filter.isActive = isActive === "true";
        if (category) filter.category = category;
        if (search) filter.name = { $regex: search, $options: "i" };

        const [products, total] = await Promise.all([
            BizProduct.find(filter)
                .populate("category", "name")
                .sort({ name: 1 })
                .skip((page - 1) * Number(limit))
                .limit(Number(limit)),
            BizProduct.countDocuments(filter),
        ]);

        // Attach current stock to each product
        const productIds = products.map((p) => p._id);
        const stocks = await BizStock.find({ business: req.bizId, product: { $in: productIds }, variant: null });
        const stockMap = Object.fromEntries(stocks.map((s) => [s.product.toString(), s.quantity]));

        const result = products.map((p) => ({
            ...p.toObject(),
            currentStock: stockMap[p._id.toString()] ?? 0,
        }));

        res.json({ products: result, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("getProducts:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId/products/:id
exports.getProductById = async (req, res) => {
    try {
        const product = await BizProduct.findOne({ _id: req.params.id, business: req.bizId })
            .populate("category", "name");
        if (!product) return res.status(404).json({ message: "Product not found" });
        const stock = await BizStock.findOne({ business: req.bizId, product: product._id, variant: null });
        res.json({ ...product.toObject(), currentStock: stock?.quantity ?? 0 });
    } catch (err) {
        console.error("getProductById:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/biz/businesses/:bizId/products
exports.createProduct = async (req, res) => {
    try {
        const product = await BizProduct.create({ ...req.body, business: req.bizId });
        if (product.trackStock) {
            const openingQty = Number(req.body.openingStock) || 0;
            await BizStock.create({ business: req.bizId, product: product._id, variant: null, quantity: openingQty });
        }
        res.status(201).json({ message: "Product created", product });
    } catch (err) {
        console.error("createProduct:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/biz/businesses/:bizId/products/:id
exports.updateProduct = async (req, res) => {
    try {
        const product = await BizProduct.findOneAndUpdate(
            { _id: req.params.id, business: req.bizId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product updated", product });
    } catch (err) {
        console.error("updateProduct:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /api/biz/businesses/:bizId/products/:id  (archive only)
exports.archiveProduct = async (req, res) => {
    try {
        await BizProduct.findOneAndUpdate({ _id: req.params.id, business: req.bizId }, { isActive: false });
        res.json({ message: "Product archived" });
    } catch (err) {
        console.error("archiveProduct:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId/categories
exports.getCategories = async (req, res) => {
    try {
        const categories = await BizCategory.find({ business: req.bizId, isActive: true }).sort({ sortOrder: 1, name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/biz/businesses/:bizId/categories
exports.createCategory = async (req, res) => {
    try {
        const cat = await BizCategory.create({ ...req.body, business: req.bizId });
        res.status(201).json(cat);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
