const express = require("express");

const router = express.Router();

const {
    protect,
    admin,
    adminOrManager,
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
    updateManagerLocation,
    updateManager,
    toggleManagerStatus,
    resetManagerPassword,
    getWhatsAppContacts,
    updateClientWhatsApp,
} = require("../controllers/clientController");

// ==========================================
// CLIENT WHATSAPP CONTACTS (MANAGER & ADMIN)
// ==========================================
router.get("/whatsapp/contacts", protect, adminOrManager, getWhatsAppContacts);
router.put("/:id/whatsapp", protect, adminOrManager, updateClientWhatsApp);
router.patch("/:id/whatsapp", protect, adminOrManager, updateClientWhatsApp);

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

// Update manager location
// Admin only
router.put("/managers/:id/location", protect, admin, updateManagerLocation);

// Toggle manager account status
// Admin only
router.put("/managers/:id/status", protect, admin, toggleManagerStatus);
router.patch("/managers/:id/status", protect, admin, toggleManagerStatus);

// Update manager profile / details
// Admin only
router.put("/managers/:id", protect, admin, updateManager);

// Reset manager password
// Admin only
router.put("/managers/:id/reset-password", protect, admin, resetManagerPassword);

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