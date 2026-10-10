const mongoose = require("mongoose");
const BizSale = require("../../models/biz/BizSale");
const BizExpense = require("../../models/biz/BizExpense");
const BizStock = require("../../models/biz/BizStock");
const BizProduct = require("../../models/biz/BizProduct");
const BizOrder = require("../../models/biz/BizOrder");

// Compute date range from period string
function getDateRange(period, from, to) {
    const now = new Date();
    let start, end;
    end = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (period) {
        case "today":
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            break;
        case "yesterday":
            start = new Date(now);
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setHours(23, 59, 59, 999);
            break;
        case "last7days":
            start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            break;
        case "thismonth":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case "custom":
            start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
            end = to ? new Date(to) : end;
            end.setHours(23, 59, 59, 999);
            break;
        case "last30days":
        default:
            start = new Date(now);
            start.setDate(start.getDate() - 29);
            start.setHours(0, 0, 0, 0);
    }
    return { start, end };
}

// GET /api/biz/businesses/:bizId/dashboard
exports.getDashboard = async (req, res) => {
    try {
        const bizId = req.bizId;
        const { period = "last30days", from, to } = req.query;
        const { start, end } = getDateRange(period, from, to);
        const match = {
            business: new mongoose.Types.ObjectId(bizId),
            status: { $in: ["completed"] },
            saleDate: { $gte: start, $lte: end },
        };

        // -- Sales summary --
        const [saleSummary] = await BizSale.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalCost: { $sum: "$totalCost" },
                    totalDiscount: { $sum: "$totalDiscount" },
                    totalTax: { $sum: "$totalTax" },
                    count: { $sum: 1 },
                },
            },
        ]);

        // -- Today's sales always shown regardless of period --
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const [todaySummary] = await BizSale.aggregate([
            { $match: { business: new mongoose.Types.ObjectId(bizId), status: "completed", saleDate: { $gte: todayStart, $lte: todayEnd } } },
            { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
        ]);

        // -- Expenses --
        const [expenseSummary] = await BizExpense.aggregate([
            { $match: { business: new mongoose.Types.ObjectId(bizId), expenseDate: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]);

        // -- Sales trend (daily breakdown) --
        const salesTrend = await BizSale.aggregate([
            { $match: { ...match, status: "completed" } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
                    revenue: { $sum: "$total" },
                    cost: { $sum: "$totalCost" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // -- Expenses by category --
        const expenseByCategory = await BizExpense.aggregate([
            { $match: { business: new mongoose.Types.ObjectId(bizId), expenseDate: { $gte: start, $lte: end } } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
        ]);

        // -- Payment method breakdown --
        const paymentBreakdown = await BizSale.aggregate([
            { $match: { ...match, status: "completed" } },
            { $group: { _id: "$paymentMethod", total: { $sum: "$total" }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
        ]);

        // -- Best-selling products --
        const bestSellers = await BizSale.aggregate([
            { $match: { ...match, status: "completed" } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    productName: { $first: "$items.productName" },
                    totalQty: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: "$items.lineTotal" },
                },
            },
            { $sort: { totalQty: -1 } },
            { $limit: 8 },
        ]);

        // -- Low stock products --
        const lowStock = await BizStock.aggregate([
            { $match: { business: new mongoose.Types.ObjectId(bizId) } },
            {
                $lookup: {
                    from: "bizproducts",
                    localField: "product",
                    foreignField: "_id",
                    as: "prod",
                },
            },
            { $unwind: "$prod" },
            { $match: { "prod.isActive": true, "prod.trackStock": true, $expr: { $lte: ["$quantity", "$prod.reorderLevel"] } } },
            {
                $project: {
                    product: "$prod._id",
                    productName: "$prod.name",
                    quantity: 1,
                    reorderLevel: "$prod.reorderLevel",
                    unit: "$prod.unit",
                },
            },
            { $sort: { quantity: 1 } },
            { $limit: 10 },
        ]);

        // -- Inventory value --
        const [inventoryValue] = await BizStock.aggregate([
            { $match: { business: new mongoose.Types.ObjectId(bizId), quantity: { $gt: 0 } } },
            {
                $lookup: {
                    from: "bizproducts",
                    localField: "product",
                    foreignField: "_id",
                    as: "prod",
                },
            },
            { $unwind: "$prod" },
            { $match: { "prod.isActive": true } },
            { $group: { _id: null, value: { $sum: { $multiply: ["$quantity", "$prod.costPrice"] } } } },
        ]);

        // -- Recent transactions (last 10) --
        const recentSales = await BizSale.find({ business: bizId, status: "completed" })
            .sort({ saleDate: -1 })
            .limit(10)
            .select("invoiceNo customerName total paymentMethod saleDate items");

        // -- Open orders (cafe/restaurant) --
        const openOrders = await BizOrder.countDocuments({
            business: bizId,
            status: { $nin: ["completed", "cancelled"] },
        });

        const revenue = saleSummary?.totalRevenue || 0;
        const cogs = saleSummary?.totalCost || 0;
        const grossProfit = revenue - cogs;
        const totalExpenses = expenseSummary?.total || 0;
        const netProfit = grossProfit - totalExpenses;

        res.json({
            period: { label: period, start, end },
            summary: {
                todaySales: todaySummary?.total || 0,
                todayCount: todaySummary?.count || 0,
                revenue,
                totalSales: saleSummary?.count || 0,
                totalDiscount: saleSummary?.totalDiscount || 0,
                totalTax: saleSummary?.totalTax || 0,
                cogs,
                grossProfit,
                totalExpenses,
                netProfit,
                inventoryValue: inventoryValue?.value || 0,
                lowStockCount: lowStock.length,
                openOrders,
            },
            salesTrend,
            expenseByCategory,
            paymentBreakdown,
            bestSellers,
            lowStock,
            recentSales,
        });
    } catch (err) {
        console.error("getDashboard:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};
