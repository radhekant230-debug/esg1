const ActivityLog = require("../models/ActivityLog");
const Project = require("../models/Project");

// ==========================================
// GET ALL ACTIVITY LOGS
// Admin only
// ==========================================
exports.getAllActivities = async (req, res) => {
  try {
    const filters = {};

    if (req.query.user) {
      filters.user = req.query.user;
    }

    if (req.query.entityType) {
      filters.entityType = req.query.entityType;
    }

    if (req.query.action) {
      filters.action = req.query.action;
    }

    const activities = await ActivityLog.find(filters)
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Get Activities Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// GET ACTIVITY BY ID
// Admin only
// ==========================================
exports.getActivityById = async (req, res) => {
  try {
    const activity = await ActivityLog.findById(req.params.id)
      .populate("user", "name email role");

    if (!activity) {
      return res.status(404).json({
        message: "Activity log not found",
      });
    }

    res.json(activity);
  } catch (error) {
    console.error("Get Activity Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// GET PROJECT ACTIVITY
// Admin / Manager / Client
// ==========================================
exports.getProjectActivities = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Manager → only projects assigned to them
    if (
      req.user.role === "manager" &&
      (
        !project.assignedManager ||
        project.assignedManager.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view this project's activities",
      });
    }

    // Client → only their own projects
    if (
      req.user.role === "client" &&
      project.client.toString() !==
        req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view this project's activities",
      });
    }

    const activities = await ActivityLog.find({
      "metadata.project": projectId,
    })
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Get Project Activities Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE ACTIVITY
// Admin only
// ==========================================
exports.deleteActivity = async (req, res) => {
  try {
    const activity = await ActivityLog.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        message: "Activity log not found",
      });
    }

    await ActivityLog.findByIdAndDelete(activity._id);

    res.json({
      message: "Activity log deleted successfully",
    });
  } catch (error) {
    console.error("Delete Activity Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE ALL ACTIVITY LOGS
// Admin only
// ==========================================
exports.clearActivities = async (req, res) => {
  try {
    await ActivityLog.deleteMany({});

    res.json({
      message: "All activity logs cleared successfully",
    });
  } catch (error) {
    console.error("Clear Activities Error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};