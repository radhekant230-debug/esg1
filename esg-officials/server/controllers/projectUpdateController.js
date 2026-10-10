const ProjectUpdate = require("../models/ProjectUpdate");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const Approval = require("../models/Approval");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// GET ALL PROJECT UPDATES
//
// Admin   → all updates
// Manager → updates from assigned projects
// Client  → updates from own projects
// ==========================================
exports.getAllUpdates = async (req, res) => {
  try {
    let projectIds = null;

    // Manager → assigned projects only
    if (req.user.role === "manager") {
      const projects = await Project.find({
        assignedManager: req.user.id,
      }).select("_id");

      projectIds = projects.map(
        (project) => project._id
      );
    }

    // Client → own projects only
    if (req.user.role === "client") {
      const projects = await Project.find({
        client: req.user.id,
      }).select("_id");

      projectIds = projects.map(
        (project) => project._id
      );
    }

    const filters = {};

    if (projectIds !== null) {
      filters.project = {
        $in: projectIds,
      };
    }

    // Optional project filter
    if (req.query.project) {
      if (projectIds !== null) {
        const hasAccess = projectIds.some(
          (id) =>
            id.toString() ===
            req.query.project.toString()
        );

        if (!hasAccess) {
          return res.status(403).json({
            message:
              "You are not authorized to access this project",
          });
        }
      }

      filters.project =
        req.query.project;
    }

    // Optional status filter
    if (req.query.status) {
      filters.status =
        req.query.status;
    }

    const updates =
      await ProjectUpdate.find(filters)
        .populate(
          "project",
          "projectId name client assignedManager progress status"
        )
        .populate(
          "task",
          "taskId title status progress"
        )
        .populate(
          "createdBy",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.json(updates);
  } catch (error) {
    console.error(
      "Get Updates Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET UPDATE BY ID
//
// Admin   → any update
// Manager → assigned project only
// Client  → own project only
// ==========================================
exports.getUpdateById = async (
  req,
  res
) => {
  try {
    const update =
      await ProjectUpdate.findById(
        req.params.id
      )
        .populate(
          "project",
          "projectId name client assignedManager progress status"
        )
        .populate(
          "task",
          "taskId title status progress"
        )
        .populate(
          "createdBy",
          "name email role"
        );

    if (!update) {
      return res.status(404).json({
        message:
          "Project update not found",
      });
    }

    if (!update.project) {
      return res.status(404).json({
        message:
          "Associated project not found",
      });
    }

    const project =
      await Project.findById(
        update.project._id
      );

    if (!project) {
      return res.status(404).json({
        message:
          "Associated project not found",
      });
    }

    // Client → own project only
    if (
      req.user.role === "client" &&
      project.client.toString() !==
        req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to access this update",
      });
    }

    // Manager → assigned project only
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
          "You are not authorized to access this update",
      });
    }

    return res.json(update);
  } catch (error) {
    console.error(
      "Get Update Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// CREATE PROJECT UPDATE
//
// Admin   → any project
// Manager → assigned projects only
// Client  → cannot create
// ==========================================
exports.createUpdate = async (
  req,
  res
) => {
  try {
    const {
      project,
      task,
      title,
      description,
      progress,
      status,
      attachments,
      clientApprovalRequired,
    } = req.body;

    if (
      !project ||
      !title ||
      !description
    ) {
      return res.status(400).json({
        message:
          "Project, title and description are required",
      });
    }

    // ==========================================
    // CLIENT CANNOT CREATE
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot create project updates",
      });
    }

    // ==========================================
    // FIND PROJECT
    // ==========================================
    const projectData =
      await Project.findById(
        project
      );

    if (!projectData) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // ==========================================
    // MANAGER → ASSIGNED PROJECT ONLY
    // ==========================================
    if (
      req.user.role === "manager" &&
      (
        !projectData.assignedManager ||
        projectData.assignedManager.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You can only create updates for projects assigned to you",
      });
    }

    // ==========================================
    // VALIDATE TASK
    // ==========================================
    let taskData = null;

    if (task) {
      taskData =
        await Task.findOne({
          _id: task,
          project: project,
        });

      if (!taskData) {
        return res.status(404).json({
          message:
            "Task not found in this project",
        });
      }
    }

    // ==========================================
    // VALIDATE PROGRESS
    // ==========================================
    let updateProgress =
      projectData.progress;

    if (progress !== undefined) {
      updateProgress =
        Number(progress);

      if (
        !Number.isFinite(
          updateProgress
        ) ||
        updateProgress < 0 ||
        updateProgress > 100
      ) {
        return res.status(400).json({
          message:
            "Progress must be between 0 and 100",
        });
      }
    }

    // ==========================================
    // CREATE UPDATE
    // ==========================================
    const requiresApproval =
      clientApprovalRequired === true;

    const update =
      await ProjectUpdate.create({
        project,
        task: task || null,
        title: title.trim(),
        description:
          description.trim(),
        progress: updateProgress,
        status:
          status || "Update",
        createdBy: req.user.id,
        attachments:
          Array.isArray(attachments)
            ? attachments
            : [],
        clientApprovalRequired:
          requiresApproval,
      });

    // ==========================================
    // UPDATE PROJECT PROGRESS
    // ==========================================
    if (progress !== undefined) {
      projectData.progress =
        updateProgress;

      if (updateProgress === 100) {
        projectData.status =
          "Completed";
      } else if (updateProgress > 0) {
        projectData.status =
          "In Progress";
      } else {
        projectData.status =
          "Not Started";
      }

      await projectData.save();
    }

    // ==========================================
    // CREATE APPROVAL
    // ==========================================
    let approval = null;

    if (requiresApproval) {
      approval =
        await Approval.create({
          project,
          task: task || null,
          update: update._id,
          client: projectData.client,
          requestedBy: req.user.id,
          status: "Pending",
        });
    }

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient:
        projectData.client,

      type: requiresApproval
        ? "approval"
        : "update",

      title: requiresApproval
        ? "Approval Required"
        : "New Project Update",

      message: requiresApproval
        ? `Approval is required for "${title.trim()}".`
        : `A new update has been posted for "${projectData.name}".`,

      project: projectData._id,

      approval: approval
        ? approval._id
        : null,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action:
        "CREATE_PROJECT_UPDATE",
      entityType:
        "ProjectUpdate",
      entityId: update._id,
      description:
        `Created project update "${title.trim()}".`,
      metadata: {
        project,
        task: task || null,
        progress:
          updateProgress,
        clientApprovalRequired:
          requiresApproval,
      },
    });

    // ==========================================
    // POPULATED RESPONSE
    // ==========================================
    const populatedUpdate =
      await ProjectUpdate.findById(
        update._id
      )
        .populate(
          "project",
          "projectId name client assignedManager progress status"
        )
        .populate(
          "task",
          "taskId title status progress"
        )
        .populate(
          "createdBy",
          "name email role"
        );

    return res.status(201).json({
      message: requiresApproval
        ? "Project update created and approval requested"
        : "Project update created successfully",

      update:
        populatedUpdate,

      approval,
    });
  } catch (error) {
    console.error(
      "Create Update Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// UPDATE PROJECT UPDATE
//
// Admin   → any update
// Manager → updates from assigned projects
// Client  → cannot modify
// ==========================================
exports.updateUpdate = async (
  req,
  res
) => {
  try {
    const update =
      await ProjectUpdate.findById(
        req.params.id
      );

    if (!update) {
      return res.status(404).json({
        message:
          "Project update not found",
      });
    }

    const project =
      await Project.findById(
        update.project
      );

    if (!project) {
      return res.status(404).json({
        message:
          "Associated project not found",
      });
    }

    // ==========================================
    // CLIENT CANNOT EDIT
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot modify project updates",
      });
    }

    // ==========================================
    // MANAGER → ASSIGNED PROJECT ONLY
    // ==========================================
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
          "You are not authorized to modify this update",
      });
    }

    // ==========================================
    // ALLOWED FIELDS
    // ==========================================
    const allowedFields = [
      "title",
      "description",
      "progress",
      "status",
      "attachments",
    ];

    for (
      const field of allowedFields
    ) {
      if (
        req.body[field] !==
        undefined
      ) {
        update[field] =
          req.body[field];
      }
    }

    // ==========================================
    // VALIDATE TITLE
    // ==========================================
    if (
      req.body.title !==
        undefined &&
      !req.body.title.trim()
    ) {
      return res.status(400).json({
        message:
          "Title cannot be empty",
      });
    }

    if (
      req.body.title !==
        undefined
    ) {
      update.title =
        req.body.title.trim();
    }

    // ==========================================
    // VALIDATE DESCRIPTION
    // ==========================================
    if (
      req.body.description !==
        undefined &&
      !req.body.description.trim()
    ) {
      return res.status(400).json({
        message:
          "Description cannot be empty",
      });
    }

    if (
      req.body.description !==
        undefined
    ) {
      update.description =
        req.body.description.trim();
    }

    // ==========================================
    // VALIDATE PROGRESS
    // ==========================================
    if (
      req.body.progress !==
      undefined
    ) {
      const numericProgress =
        Number(
          req.body.progress
        );

      if (
        !Number.isFinite(
          numericProgress
        ) ||
        numericProgress < 0 ||
        numericProgress > 100
      ) {
        return res.status(400).json({
          message:
            "Progress must be between 0 and 100",
        });
      }

      update.progress =
        numericProgress;

      // Keep project progress synchronized
      project.progress =
        numericProgress;

      if (
        numericProgress === 100
      ) {
        project.status =
          "Completed";
      } else if (
        numericProgress > 0
      ) {
        project.status =
          "In Progress";
      } else {
        project.status =
          "Not Started";
      }

      await project.save();
    }

    // ==========================================
    // SAVE UPDATE
    // ==========================================
    await update.save();

    // ==========================================
    // POPULATED UPDATE
    // ==========================================
    const updatedUpdate =
      await ProjectUpdate.findById(
        update._id
      )
        .populate(
          "project",
          "projectId name client assignedManager progress status"
        )
        .populate(
          "task",
          "taskId title status progress"
        )
        .populate(
          "createdBy",
          "name email role"
        );

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient: project.client,
      type: "update",
      title:
        "Project Update Modified",
      message:
        `An update for "${project.name}" has been modified.`,
      project: project._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action:
        "UPDATE_PROJECT_UPDATE",
      entityType:
        "ProjectUpdate",
      entityId: update._id,
      description:
        `Updated project update "${update.title}".`,
      metadata: {
        ...req.body,
      },
    });

    return res.json({
      message:
        "Project update modified successfully",
      update:
        updatedUpdate,
    });
  } catch (error) {
    console.error(
      "Update Project Update Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// DELETE PROJECT UPDATE
//
// Admin only
// ==========================================
exports.deleteUpdate = async (
  req,
  res
) => {
  try {
    const update =
      await ProjectUpdate.findById(
        req.params.id
      );

    if (!update) {
      return res.status(404).json({
        message:
          "Project update not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message:
          "Only admin can delete project updates",
      });
    }

    // ==========================================
    // DELETE UPDATE
    // ==========================================
    await ProjectUpdate.findByIdAndDelete(
      update._id
    );

    // ==========================================
    // REMOVE PENDING APPROVAL
    // ==========================================
    await Approval.deleteMany({
      update: update._id,
      status: "Pending",
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action:
        "DELETE_PROJECT_UPDATE",
      entityType:
        "ProjectUpdate",
      entityId: update._id,
      description:
        `Deleted project update "${update.title}".`,
    });

    return res.json({
      message:
        "Project update deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Project Update Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};