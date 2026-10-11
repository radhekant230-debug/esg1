const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { protect, adminOrManager } = require("../middlewares/auth");
const portalController = require("../controllers/portalController");
const User = require("../models/User");

// All portal routes require authentication
router.use(protect);

// Pre-resolve and validate target client for this request (enforcing manager & client data isolation)
const resolvePortalClient = async (req, res, next) => {
  try {
    if (req.user.role === "client") {
      // Client is strictly isolated to their own account
      req.targetClientId = req.user._id;
      return next();
    }

    // Admin or Manager
    const targetId = req.query.clientId;
    if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
      if (req.user.role === "manager") {
        // Manager can ONLY view clients assigned to them
        const assignedClient = await User.findOne({
          _id: targetId,
          role: "client",
          assignedManager: req.user._id,
        });
        if (!assignedClient) {
          return res.status(403).json({
            message: "Access denied: You are not authorized to view or manage this client's portal data.",
          });
        }
      }
      req.targetClientId = targetId;
      return next();
    }

    // If no clientId specified in query:
    if (req.user.role === "manager") {
      // Pick first client assigned to this manager
      const firstAssigned = await User.findOne({
        role: "client",
        assignedManager: req.user._id,
      }).sort({ createdAt: 1 });
      req.targetClientId = firstAssigned ? firstAssigned._id : null;
      return next();
    }

    if (req.user.role === "admin") {
      const firstClient = await User.findOne({ role: "client" }).sort({ createdAt: 1 });
      req.targetClientId = firstClient ? firstClient._id : null;
      return next();
    }

    req.targetClientId = null;
    next();
  } catch (err) {
    next(err);
  }
};

router.use(resolvePortalClient);

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
