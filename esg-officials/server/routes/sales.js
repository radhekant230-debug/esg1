const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, admin, adminOrManager } = require("../middlewares/auth");
const salesController = require("../controllers/salesController");

// Memory storage for Excel and CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only .xlsx, .xls, and .csv spreadsheets are supported."));
    }
  },
});

// All sales routes require authentication and manager or admin privileges
router.use(protect, adminOrManager);

// 1. Dashboard & KPI analytics
router.get("/dashboard", salesController.getSalesDashboard);

// 2. Geography & Locations list
router.get("/locations", salesController.getLocations);

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

// 5. Excel Import Workflow
router.post("/upload/preview", upload.single("file"), salesController.previewSalesExcel);
router.post("/upload/commit", salesController.commitSalesExcel);
router.get("/template", salesController.downloadTemplate);
router.get("/export", salesController.exportSalesExcel);
router.get("/import-history", salesController.getImportHistory);

module.exports = router;
