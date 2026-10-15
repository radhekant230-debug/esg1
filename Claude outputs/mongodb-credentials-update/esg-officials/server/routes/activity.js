const express = require("express");

const router = express.Router();

const {
  protect,
  admin,
} = require("../middlewares/auth");

const {
  getAllActivities,
  getActivityById,
  getProjectActivities,
  deleteActivity,
  clearActivities,
} = require("../controllers/activityController");

// ==========================================
// GET ALL ACTIVITY LOGS
// Admin only
// ==========================================
router.get(
  "/",
  protect,
  admin,
  getAllActivities
);

// ==========================================
// GET PROJECT ACTIVITY
// Admin / Manager / Client
// ==========================================
router.get(
  "/project/:projectId",
  protect,
  getProjectActivities
);

// ==========================================
// GET ACTIVITY BY ID
// Admin only
// ==========================================
router.get(
  "/:id",
  protect,
  admin,
  getActivityById
);

// ==========================================
// DELETE ACTIVITY
// Admin only
// ==========================================
router.delete(
  "/:id",
  protect,
  admin,
  deleteActivity
);

// ==========================================
// CLEAR ALL ACTIVITY LOGS
// Admin only
// ==========================================
router.delete(
  "/",
  protect,
  admin,
  clearActivities
);

module.exports = router;