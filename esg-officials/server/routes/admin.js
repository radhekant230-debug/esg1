const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middlewares/auth");
const adminController = require("../controllers/adminController");
const clientController = require("../controllers/clientController");

// All Admin routes require authentication AND admin role
router.use(protect, admin);

// 1. Executive All-Client Overview
router.get("/overview", adminController.getOverview);

// 2. Client Management
router.get("/clients", clientController.getAllClients);
router.get("/clients/:id", adminController.getClientDetail);
router.post("/clients", clientController.createClient);
router.put("/clients/:id", clientController.updateClient);
router.put("/clients/:id/reset-password", clientController.resetClientPassword);
router.patch("/clients/:id/status", clientController.toggleClientStatus);
router.delete("/clients/:id", clientController.deleteClient);

// 3. Sales & Revenue
router.post("/clients/:id/sales", adminController.addClientSales);
router.put("/sales/:recordId", adminController.updateClientSales);
router.delete("/sales/:recordId", adminController.deleteClientSales);

// 4. Advertising & Campaigns
router.post("/clients/:id/campaigns", adminController.addClientCampaign);
router.put("/campaigns/:campaignId", adminController.updateClientCampaign);
router.delete("/campaigns/:campaignId", adminController.deleteClientCampaign);

// 5. Leads & Enquiries
router.post("/clients/:id/leads", adminController.addClientLead);
router.put("/leads/:leadId", adminController.updateClientLead);
router.delete("/leads/:leadId", adminController.deleteClientLead);

// 6. Orders & Reservations
router.post("/clients/:id/orders", adminController.addClientOrder);
router.put("/orders/:orderId", adminController.updateClientOrder);
router.delete("/orders/:orderId", adminController.deleteClientOrder);

// 7. Invoices & Expenses
router.post("/clients/:id/invoices", adminController.addClientInvoice);
router.put("/invoices/:invoiceId", adminController.updateClientInvoice);

module.exports = router;
