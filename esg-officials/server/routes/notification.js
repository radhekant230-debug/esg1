const express = require("express");

const router = express.Router();

const { protect } = require("../middlewares/auth");

const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
} = require("../controllers/notificationController");

// ==========================================
// GET MY NOTIFICATIONS
// ==========================================
router.get(
  "/",
  protect,
  getMyNotifications
);

// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================
router.get(
  "/unread-count",
  protect,
  getUnreadCount
);

// ==========================================
// MARK ALL AS READ
// ==========================================
router.put(
  "/read-all",
  protect,
  markAllAsRead
);

// ==========================================
// DELETE ALL READ NOTIFICATIONS
// ==========================================
router.delete(
  "/read",
  protect,
  deleteReadNotifications
);

// ==========================================
// MARK ONE AS READ
// ==========================================
router.put(
  "/:id/read",
  protect,
  markAsRead
);

// ==========================================
// DELETE ONE NOTIFICATION
// ==========================================
router.delete(
  "/:id",
  protect,
  deleteNotification
);

module.exports = router;