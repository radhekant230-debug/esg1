const express = require("express");

const router = express.Router();

const {
    protect,
    admin,
} = require("../middlewares/auth");

const {
    getAllClients,
    getClientById,
    createClient,
    updateClient,
    resetClientPassword,
    toggleClientStatus,
    deleteClient,
    getAllManagers,
    createManager,
} = require("../controllers/clientController");

// ==========================================
// CLIENT MANAGEMENT
// ==========================================

// Get all clients
// Admin only
router.get("/", protect, admin, getAllClients);

// ==========================================
// MANAGER MANAGEMENT
// ==========================================

// Get all managers
// Admin only
router.get("/managers/all", protect, admin, getAllManagers);

// Create manager
// Admin only
router.post("/managers", protect, admin, createManager);

// ==========================================
// SINGLE CLIENT ROUTES
// ==========================================

// Get single client
// Admin / Manager / Client
router.get("/:id", protect, getClientById);

// Create client
// Admin only
router.post("/", protect, admin, createClient);

// Update client
// Admin only
router.put("/:id", protect, admin, updateClient);

// Reset client password
// Admin only
router.put(
    "/:id/reset-password",
    protect,
    admin,
    resetClientPassword
);

// Activate / deactivate client
// Admin only
router.put(
    "/:id/toggle-status",
    protect,
    admin,
    toggleClientStatus
);

// Delete client
// Admin only
router.delete("/:id", protect, admin, deleteClient);

module.exports = router;