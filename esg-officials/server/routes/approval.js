const express = require("express");

const router = express.Router();

const {
  protect,
  admin,
  adminOrManager,
  client,
} = require("../middlewares/auth");

const {
  getAllApprovals,
  getApprovalById,
  createApproval,
  approveRequest,
  rejectRequest,
  deleteApproval,
} = require("../controllers/approvalController");

// ==========================================
// GET ALL APPROVALS
// Admin / Manager / Client
// ==========================================
router.get("/", protect, getAllApprovals);

// ==========================================
// GET APPROVAL BY ID
// Admin / Manager / Client
// ==========================================
router.get("/:id", protect, getApprovalById);

// ==========================================
// CREATE APPROVAL REQUEST
// Admin / Manager
// ==========================================
router.post(
  "/",
  protect,
  adminOrManager,
  createApproval
);

// ==========================================
// CLIENT APPROVES
// Client only
// ==========================================
router.put(
  "/:id/approve",
  protect,
  client,
  approveRequest
);

// ==========================================
// CLIENT REJECTS
// Client only
// ==========================================
router.put(
  "/:id/reject",
  protect,
  client,
  rejectRequest
);

// ==========================================
// DELETE APPROVAL
// Admin only
// ==========================================
router.delete(
  "/:id",
  protect,
  admin,
  deleteApproval
);

module.exports = router;