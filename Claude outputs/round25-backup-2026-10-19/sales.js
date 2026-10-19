const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, admin, adminOrManager } = require("../middlewares/auth");
const salesController = require("../controllers/salesController");
const salesImport = require("../controllers/salesImportController");
const salesAnalytics = require("../controllers/salesAnalyticsController");

// Memory storage for Excel and CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      cb(null, true);
    } else {
      const err = new Error("Invalid file type. Only .xlsx, .xls, and .csv spreadsheets are supported.");
      err.status = 400;
      cb(err);
    }
  },
});

// All sales routes require authentication and manager or admin privileges
router.use(protect, adminOrManager);

// 1. Dashboard & KPI analytics
router.get("/dashboard", salesController.getSalesDashboard);

// 2. Geography & Locations list
router.get("/locations", salesController.getLocations);
router.post("/locations", admin, salesController.createLocation);

// 3. Business Management
router.get("/businesses", salesController.getBusinesses);
router.get("/businesses/:id", salesController.getBusinessDetail);
router.post("/businesses", admin, salesController.createBusiness);
router.put("/businesses/:id", admin, salesController.updateBusiness);
router.delete("/businesses/:id", admin, salesController.deleteBusiness);

// 4. Sales Records
router.get("/records", salesController.getSalesRecords);
router.post("/records", salesController.createSalesRecord);
router.put("/records/:id", salesController.updateSalesRecord);
router.delete("/records/:id", admin, salesController.deleteSalesRecord);

// 5. Excel/CSV Import Workflow (preview -> confirm, transactional)
router.get("/import-targets", salesImport.getImportTargets);
router.post("/import-targets/link", salesImport.linkImportTarget);
router.post("/upload/preview", upload.single("file"), salesImport.previewSalesExcel);
router.post("/upload/commit", salesImport.commitSalesExcel);
router.get("/upload/:id/invalid-rows", salesImport.downloadInvalidRows);
router.delete("/upload/:id", salesImport.cancelPreview);
router.get("/upload/:id/file", salesImport.downloadOriginalFile);
router.get("/template", salesImport.downloadTemplate);
router.get("/export", salesController.exportSalesExcel);
router.get("/import-history", salesImport.getImportHistory);

// 6. Monthly Sales, Discount, Profit & Loss analytics
router.get("/analytics/monthly", salesAnalytics.getMonthlyAnalytics);
router.get("/analytics/monthly/export", salesAnalytics.exportMonthlyAnalytics);
// Date-range analytics over monthly summaries, daily records and day-wise reports
router.get("/analytics/range", salesAnalytics.getRangeAnalytics);
router.get("/analytics/range/export", salesAnalytics.exportRangeAnalytics);

module.exports = router;
