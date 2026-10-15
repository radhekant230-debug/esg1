const express = require("express");

const router = express.Router();

const {
  protect,
  admin,
  adminOrManager,
} = require("../middlewares/auth");

const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

// ==========================================
// GET ALL PROJECTS
// Admin    → All projects
// Manager  → Assigned projects
// Client   → Own projects
// ==========================================
router.get("/", protect, getAllProjects);

// ==========================================
// GET PROJECT BY ID
// ==========================================
router.get("/:id", protect, getProjectById);

// ==========================================
// CREATE PROJECT
// Admin only
// ==========================================
router.post("/", protect, admin, createProject);

// ==========================================
// UPDATE PROJECT
// Admin + assigned Manager
// ==========================================
router.put("/:id", protect, adminOrManager, updateProject);

// ==========================================
// DELETE PROJECT
// Admin only
// ==========================================
router.delete("/:id", protect, admin, deleteProject);

module.exports = router;