const express = require("express");
const router = express.Router();
const { protectBiz, requireBizMember, requireManager, requireAdmin, bizAuth } = require("../../middlewares/bizAccess");

const businessCtrl = require("../../controllers/biz/businessController");
const dashboardCtrl = require("../../controllers/biz/dashboardController");
const productCtrl = require("../../controllers/biz/productController");
const inventoryCtrl = require("../../controllers/biz/inventoryController");
const saleCtrl = require("../../controllers/biz/saleController");
const expenseCtrl = require("../../controllers/biz/expenseController");
const customerCtrl = require("../../controllers/biz/customerController");
const supplierCtrl = require("../../controllers/biz/supplierController");
const orderCtrl = require("../../controllers/biz/orderController");
const metalRateCtrl = require("../../controllers/biz/metalRateController");

// ── Business CRUD ──────────────────────────────────────────────────
router.post("/", protectBiz, businessCtrl.createBusiness);
router.get("/", protectBiz, businessCtrl.getMyBusinesses);

router.use("/:bizId", ...bizAuth);

router.get("/:bizId", businessCtrl.getBusinessById);
router.put("/:bizId", requireAdmin, businessCtrl.updateBusiness);
router.post("/:bizId/members", requireAdmin, businessCtrl.addMember);
router.delete("/:bizId/members/:userId", requireAdmin, businessCtrl.removeMember);

// ── Dashboard ──────────────────────────────────────────────────────
router.get("/:bizId/dashboard", dashboardCtrl.getDashboard);

// ── Products ───────────────────────────────────────────────────────
router.get("/:bizId/products", productCtrl.getProducts);
router.post("/:bizId/products", requireManager, productCtrl.createProduct);
router.get("/:bizId/products/:id", productCtrl.getProductById);
router.put("/:bizId/products/:id", requireManager, productCtrl.updateProduct);
router.delete("/:bizId/products/:id", requireManager, productCtrl.archiveProduct);

// ── Categories ────────────────────────────────────────────────────
router.get("/:bizId/categories", productCtrl.getCategories);
router.post("/:bizId/categories", requireManager, productCtrl.createCategory);

// ── Inventory ─────────────────────────────────────────────────────
router.get("/:bizId/inventory", inventoryCtrl.getInventory);
router.post("/:bizId/inventory/adjust", requireManager, inventoryCtrl.adjustStock);
router.get("/:bizId/inventory/movements", inventoryCtrl.getStockMovements);

// ── Sales ─────────────────────────────────────────────────────────
router.get("/:bizId/sales", saleCtrl.getSales);
router.post("/:bizId/sales", saleCtrl.createSale);
router.get("/:bizId/sales/:id", saleCtrl.getSaleById);
router.put("/:bizId/sales/:id/cancel", requireManager, saleCtrl.cancelSale);

// ── Expenses ──────────────────────────────────────────────────────
router.get("/:bizId/expenses", expenseCtrl.getExpenses);
router.post("/:bizId/expenses", requireManager, expenseCtrl.createExpense);
router.put("/:bizId/expenses/:id", requireManager, expenseCtrl.updateExpense);
router.delete("/:bizId/expenses/:id", requireManager, expenseCtrl.deleteExpense);

// ── Customers ─────────────────────────────────────────────────────
router.get("/:bizId/customers", customerCtrl.getCustomers);
router.post("/:bizId/customers", customerCtrl.createCustomer);
router.put("/:bizId/customers/:id", customerCtrl.updateCustomer);
router.get("/:bizId/customers/:id/history", customerCtrl.getCustomerHistory);

// ── Suppliers & Purchases ─────────────────────────────────────────
router.get("/:bizId/suppliers", supplierCtrl.getSuppliers);
router.post("/:bizId/suppliers", requireManager, supplierCtrl.createSupplier);
router.put("/:bizId/suppliers/:id", requireManager, supplierCtrl.updateSupplier);
router.get("/:bizId/purchases", supplierCtrl.getPurchases);
router.post("/:bizId/purchases", requireManager, supplierCtrl.createPurchase);

// ── Orders & Tables (Café / Restaurant) ────────────────────────────
router.get("/:bizId/orders", orderCtrl.getOrders);
router.post("/:bizId/orders", orderCtrl.createOrder);
router.put("/:bizId/orders/:id/status", requireManager, orderCtrl.updateOrderStatus);
router.get("/:bizId/tables", orderCtrl.getTables);
router.post("/:bizId/tables", requireManager, orderCtrl.createTable);
router.put("/:bizId/tables/:id", requireManager, orderCtrl.updateTable);

// ── Metal Rates (Jewellery) ───────────────────────────────────────
router.get("/:bizId/metal-rates", metalRateCtrl.getMetalRates);
router.post("/:bizId/metal-rates", requireManager, metalRateCtrl.setMetalRate);

module.exports = router;
