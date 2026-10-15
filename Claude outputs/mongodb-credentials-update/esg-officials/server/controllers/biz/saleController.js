const BizSale = require("../../models/biz/BizSale");
const BizProduct = require("../../models/biz/BizProduct");
const BizStock = require("../../models/biz/BizStock");
const BizCustomer = require("../../models/biz/BizCustomer");
const { applyStockDelta } = require("./inventoryController");

// POST /api/biz/businesses/:bizId/sales
exports.createSale = async (req, res) => {
    try {
        const {
            items, customerId, customerName, customerPhone,
            paymentMethod, amountPaid, notes, saleDate,
        } = req.body;

        if (!items?.length) return res.status(400).json({ message: "At least one item required" });

        // Resolve products and compute totals
        const resolvedItems = [];
        let subtotal = 0, totalDiscount = 0, totalTax = 0, totalCost = 0;

        for (const item of items) {
            const product = await BizProduct.findOne({ _id: item.productId, business: req.bizId, isActive: true });
            if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });

            const unitPrice = Number(item.unitPrice ?? product.sellingPrice);
            const quantity = Number(item.quantity);
            const discount = Number(item.discount ?? 0);
            const taxRate = Number(item.taxRate ?? product.taxRate ?? req.business.defaultTaxRate ?? 0);
            const lineBase = unitPrice * quantity - discount;
            const lineTax = +(lineBase * taxRate / 100).toFixed(2);
            const lineTotal = +(lineBase + lineTax).toFixed(2);
            const costPrice = Number(item.costPrice ?? product.costPrice ?? 0);

            // Check stock
            if (product.trackStock) {
                const stock = await BizStock.findOne({ business: req.bizId, product: product._id, variant: item.variantId || null });
                const qty = stock?.quantity ?? 0;
                if (!req.business.allowNegativeStock && qty < quantity) {
                    return res.status(400).json({ message: `Insufficient stock for ${product.name} (available: ${qty})` });
                }
            }

            resolvedItems.push({
                product: product._id,
                productName: product.name,
                variant: item.variantId || null,
                variantLabel: item.variantLabel || "",
                quantity,
                unitPrice,
                costPrice,
                discount,
                taxRate,
                lineTotal,
                lineTax,
            });

            subtotal += unitPrice * quantity;
            totalDiscount += discount;
            totalTax += lineTax;
            totalCost += costPrice * quantity;
        }

        const total = +(subtotal - totalDiscount + totalTax).toFixed(2);
        const paid = Number(amountPaid ?? total);
        const status = paid >= total ? "completed" : "partial";

        const sale = await BizSale.create({
            business: req.bizId,
            customer: customerId || null,
            customerName: customerName || "Walk-in",
            customerPhone,
            items: resolvedItems,
            subtotal: +subtotal.toFixed(2),
            totalDiscount: +totalDiscount.toFixed(2),
            totalTax: +totalTax.toFixed(2),
            totalCost: +totalCost.toFixed(2),
            total,
            paymentMethod: paymentMethod || "cash",
            amountPaid: paid,
            balanceDue: +(total - paid).toFixed(2),
            status,
            notes,
            createdBy: req.user._id,
            saleDate: saleDate ? new Date(saleDate) : new Date(),
        });

        // Deduct stock
        for (const item of resolvedItems) {
            const product = await BizProduct.findById(item.product);
            if (product?.trackStock) {
                await applyStockDelta(req.bizId, item.product, item.variant, -item.quantity, "sale", sale._id, "BizSale", null, req.user._id);
            }
        }

        // Update customer totals
        if (customerId) {
            await BizCustomer.findByIdAndUpdate(customerId, {
                $inc: { totalPurchases: 1, totalSpent: total },
            });
        }

        const populated = await BizSale.findById(sale._id);
        res.status(201).json({ message: "Sale recorded", sale: populated });
    } catch (err) {
        console.error("createSale:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/biz/businesses/:bizId/sales
exports.getSales = async (req, res) => {
    try {
        const { from, to, status, paymentMethod, search, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId };
        if (status) filter.status = status;
        if (paymentMethod) filter.paymentMethod = paymentMethod;
        if (from || to) {
            filter.saleDate = {};
            if (from) filter.saleDate.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); filter.saleDate.$lte = d; }
        }
        if (search) filter.$or = [
            { invoiceNo: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
        ];

        const [sales, total] = await Promise.all([
            BizSale.find(filter).sort({ saleDate: -1 }).skip((page - 1) * Number(limit)).limit(Number(limit)),
            BizSale.countDocuments(filter),
        ]);
        res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("getSales:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId/sales/:id
exports.getSaleById = async (req, res) => {
    try {
        const sale = await BizSale.findOne({ _id: req.params.id, business: req.bizId });
        if (!sale) return res.status(404).json({ message: "Sale not found" });
        res.json(sale);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// PUT /api/biz/businesses/:bizId/sales/:id/cancel
exports.cancelSale = async (req, res) => {
    try {
        const sale = await BizSale.findOne({ _id: req.params.id, business: req.bizId });
        if (!sale) return res.status(404).json({ message: "Sale not found" });
        if (sale.status === "cancelled") return res.status(400).json({ message: "Already cancelled" });

        sale.status = "cancelled";
        await sale.save();

        // Reverse stock deductions
        for (const item of sale.items) {
            const product = await BizProduct.findById(item.product);
            if (product?.trackStock) {
                await applyStockDelta(req.bizId, item.product, item.variant, item.quantity, "return_in", sale._id, "BizSale", "Sale cancelled", req.user._id);
            }
        }

        if (sale.customer) {
            await BizCustomer.findByIdAndUpdate(sale.customer, {
                $inc: { totalPurchases: -1, totalSpent: -sale.total },
            });
        }

        res.json({ message: "Sale cancelled" });
    } catch (err) {
        console.error("cancelSale:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};
