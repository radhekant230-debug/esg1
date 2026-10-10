const express = require("express");

const router = express.Router();

const {
  protect,
  adminOrManager,
} = require("../middlewares/auth");

const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");

// ==========================================
// GET ALL TASKS
// Admin / Manager / Client
// ==========================================
router.get("/", protect, getAllTasks);

// ==========================================
// GET TASK BY ID
// Admin / Manager / Client
// ==========================================
router.get("/:id", protect, getTaskById);

// ==========================================
// CREATE TASK
// Admin / Manager
// ==========================================
router.post(
  "/",
  protect,
  adminOrManager,
  createTask
);

// ==========================================
// UPDATE TASK
// Admin / Manager
// ==========================================
router.put(
  "/:id",
  protect,
  adminOrManager,
  updateTask
);

// ==========================================
// DELETE TASK
// Admin only
// ==========================================
router.delete(
  "/:id",
  protect,
  require("../middlewares/auth").admin,
  deleteTask
);

module.exports = router;