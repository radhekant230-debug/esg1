const express = require("express");

const router = express.Router();

const {
  protect,
  admin,
  adminOrManager,
} = require("../middlewares/auth");

const {
  getAllUpdates,
  getUpdateById,
  createUpdate,
  updateUpdate,
  deleteUpdate,
} = require("../controllers/projectUpdateController");

// ==========================================
// GET ALL PROJECT UPDATES
// Admin / Manager / Client
// ==========================================
router.get("/", protect, getAllUpdates);

// ==========================================
// GET UPDATE BY ID
// Admin / Manager / Client
// ==========================================
router.get("/:id", protect, getUpdateById);

// ==========================================
// CREATE PROJECT UPDATE
// Admin / Manager
// ==========================================
router.post(
  "/",
  protect,
  adminOrManager,
  createUpdate
);

// ==========================================
// UPDATE PROJECT UPDATE
// Admin / Manager
// ==========================================
router.put(
  "/:id",
  protect,
  adminOrManager,
  updateUpdate
);

// ==========================================
// DELETE PROJECT UPDATE
// Admin only
// ==========================================
router.delete(
  "/:id",
  protect,
  admin,
  deleteUpdate
);

module.exports = router;