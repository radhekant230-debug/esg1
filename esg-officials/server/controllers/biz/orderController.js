const BizOrder = require("../../models/biz/BizOrder");
const BizTable = require("../../models/biz/BizTable");
const BizProduct = require("../../models/biz/BizProduct");

exports.getOrders = async (req, res) => {
    try {
        const { status, orderType, from, to, page = 1, limit = 30 } = req.query;
        const filter = { business: req.bizId };
        if (status) filter.status = status;
        if (orderType) filter.orderType = orderType;
        if (from || to) {
            filter.orderDate = {};
            if (from) filter.orderDate.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); filter.orderDate.$lte = d; }
        }
        const [orders, total] = await Promise.all([
            BizOrder.find(filter).sort({ orderDate: -1 }).skip((page - 1) * Number(limit)).limit(Number(limit)),
            BizOrder.countDocuments(filter),
        ]);
        res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { items, tableId, orderType, customerName, customerPhone, deliveryAddress, notes } = req.body;
        if (!items?.length) return res.status(400).json({ message: "At least one item required" });

        let subtotal = 0;
        const resolvedItems = [];
        for (const item of items) {
            const product = await BizProduct.findOne({ _id: item.productId, business: req.bizId, isActive: true });
            if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });
            const qty = Number(item.quantity);
            const price = Number(item.unitPrice ?? product.sellingPrice);
            subtotal += qty * price;
            resolvedItems.push({ product: product._id, productName: product.name, quantity: qty, unitPrice: price, notes: item.notes });
        }

        const tax = +((subtotal * (req.business.defaultTaxRate || 0)) / 100).toFixed(2);
        const total = +(subtotal + tax).toFixed(2);

        const order = await BizOrder.create({
            business: req.bizId,
            table: tableId || null,
            tableLabel: tableId ? (await BizTable.findById(tableId))?.label : "",
            orderType: orderType || "dine-in",
            customerName,
            customerPhone,
            deliveryAddress,
            items: resolvedItems,
            subtotal,
            tax,
            total,
            notes,
            createdBy: req.user._id,
        });

        if (tableId) {
            await BizTable.findByIdAndUpdate(tableId, { status: "occupied", currentOrder: order._id });
        }

        res.status(201).json({ message: "Order created", order });
    } catch (err) {
        console.error("createOrder:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ["pending", "preparing", "ready", "served", "completed", "cancelled"];
        if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });

        const order = await BizOrder.findOne({ _id: req.params.id, business: req.bizId });
        if (!order) return res.status(404).json({ message: "Order not found" });

        order.status = status;
        if (status === "completed") order.isPaid = true;
        await order.save();

        if (order.table && ["completed", "cancelled"].includes(status)) {
            await BizTable.findByIdAndUpdate(order.table, { status: "available", currentOrder: null });
        }

        res.json({ message: "Status updated", order });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/biz/businesses/:bizId/tables
exports.getTables = async (req, res) => {
    try {
        const tables = await BizTable.find({ business: req.bizId }).populate("currentOrder", "orderNo status total").sort({ sortOrder: 1, label: 1 });
        res.json(tables);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createTable = async (req, res) => {
    try {
        const { label, capacity, sortOrder } = req.body;
        if (!label) return res.status(400).json({ message: "Table label required" });
        const table = await BizTable.create({ business: req.bizId, label, capacity: capacity || 4, sortOrder: sortOrder || 0 });
        res.status(201).json({ message: "Table created", table });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.updateTable = async (req, res) => {
    try {
        const table = await BizTable.findOneAndUpdate(
            { _id: req.params.id, business: req.bizId },
            req.body,
            { new: true }
        );
        if (!table) return res.status(404).json({ message: "Table not found" });
        res.json({ message: "Table updated", table });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
