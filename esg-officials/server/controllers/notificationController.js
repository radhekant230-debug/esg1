const Notification = require("../models/Notification");

// ==========================================
// GET MY NOTIFICATIONS
// ==========================================
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
    })
      .populate("project", "projectId name")
      .populate("task", "taskId title")
      .populate("approval", "approvalId status")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    console.error("Get Notifications Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.json({
      count,
    });
  } catch (error) {
    console.error("Get Unread Count Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// MARK ONE NOTIFICATION AS READ
// ==========================================
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark All Notifications Read Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE ONE NOTIFICATION
// ==========================================
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    await Notification.findByIdAndDelete(notification._id);

    res.json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE ALL READ NOTIFICATIONS
// ==========================================
exports.deleteReadNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({
      recipient: req.user.id,
      isRead: true,
    });

    res.json({
      message: "Read notifications deleted successfully",
    });
  } catch (error) {
    console.error("Delete Read Notifications Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};