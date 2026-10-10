const express = require("express");
const router = express.Router();
const { protect, adminOrManager } = require("../middlewares/auth");
const portalController = require("../controllers/portalController");

// All portal routes require authentication
router.use(protect);

// 1. Profile & Client Setup
router.get("/profile", portalController.getProfile);
router.put("/profile", portalController.updateProfile);
router.get("/clients-selector", adminOrManager, portalController.getAllClientsForSelector);

// 2. Executive Overview
router.get("/overview", portalController.getExecutiveOverview);

// 3. Sales & Business Performance
router.get("/sales", portalController.getSalesPerformance);
router.post("/sales", adminOrManager, portalController.addSalesRecord);

// 4. Advertising & Campaigns
router.get("/campaigns", portalController.getCampaigns);
router.post("/campaigns", adminOrManager, portalController.addCampaign);

// 5. Social Media Performance
router.get("/social", portalController.getSocialMedia);
router.post("/social", adminOrManager, portalController.addSocialMedia);

// 6. Google Business Profile & Local Marketing
router.get("/google-business", portalController.getGoogleBusiness);
router.post("/google-business", adminOrManager, portalController.addGoogleBusiness);

// 7. Leads & Enquiries
router.get("/leads", portalController.getLeads);
router.post("/leads", adminOrManager, portalController.addLead);
router.put("/leads/:id", portalController.updateLead);

// 8. Content Calendar & Approvals
router.get("/content-calendar", portalController.getContentCalendar);
router.post("/content-calendar", adminOrManager, portalController.addContentCalendarItem);
router.put("/content-calendar/:id/review", portalController.reviewContentCalendarItem);

// 9. Agency Workspace (Work in Progress)
router.get("/workspace", portalController.getAgencyWorkspace);

// 10. Reports & Insights
router.get("/reports", portalController.getReports);
router.post("/reports", adminOrManager, portalController.addReport);

// 11. Resource Vault & Documents
router.get("/vault", portalController.getVaultDocuments);
router.post("/vault", adminOrManager, portalController.addVaultDocument);

// 12. Commercials & Invoices
router.get("/invoices", portalController.getInvoices);
router.post("/invoices", adminOrManager, portalController.addInvoice);

module.exports = router;
