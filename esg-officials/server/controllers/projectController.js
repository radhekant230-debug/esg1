const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// GET ALL PROJECTS
//
// Admin   → all projects
// Manager → only projects assigned to them
// Client  → only their own projects
// ==========================================
exports.getAllProjects = async (req, res) => {
  try {
    const filters = {};

    // Manager → assigned projects only
    if (req.user.role === "manager") {
      filters.assignedManager = req.user.id;
    }

    // Client → own projects only
    if (req.user.role === "client") {
      filters.client = req.user.id;
    }

    // Optional status filter
    if (req.query.status) {
      filters.status = req.query.status;
    }

    // Optional priority filter
    if (req.query.priority) {
      filters.priority = req.query.priority;
    }

    // Optional search
    if (req.query.search) {
      filters.name = {
        $regex: req.query.search,
        $options: "i",
      };
    }

    const projects = await Project.find(filters)
      .populate(
        "client",
        "name email companyName clientId"
      )
      .populate(
        "assignedManager",
        "name email phone"
      )
      .populate(
        "createdBy",
        "name email"
      )
      .sort({ createdAt: -1 });

    return res.json(projects);
  } catch (error) {
    console.error(
      "Get Projects Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET PROJECT BY ID
//
// Admin   → any project
// Manager → assigned project only
// Client  → own project only
// ==========================================
exports.getProjectById = async (req, res) => {
  try {
    const project =
      await Project.findById(req.params.id)
        .populate(
          "client",
          "name email companyName phone clientId"
        )
        .populate(
          "assignedManager",
          "name email phone"
        )
        .populate(
          "createdBy",
          "name email"
        );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Client → own projects only
    if (
      req.user.role === "client" &&
      (
        !project.client ||
        project.client._id.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to access this project",
      });
    }

    // Manager → assigned projects only
    if (
      req.user.role === "manager" &&
      (
        !project.assignedManager ||
        project.assignedManager._id.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to access this project",
      });
    }

    return res.json(project);
  } catch (error) {
    console.error(
      "Get Project Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// CREATE PROJECT
// Admin only
// ==========================================
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      client,
      assignedManager,
      startDate,
      deadline,
      status,
      priority,
      progress,
    } = req.body;

    if (
      !name ||
      !description ||
      !client ||
      !startDate ||
      !deadline
    ) {
      return res.status(400).json({
        message:
          "Name, description, client, start date and deadline are required",
      });
    }

    // ==========================================
    // VALIDATE CLIENT
    // ==========================================
    const clientUser =
      await User.findOne({
        _id: client,
        role: "client",
        isActive: true,
      });

    if (!clientUser) {
      return res.status(404).json({
        message:
          "Client not found or inactive",
      });
    }

    // ==========================================
    // VALIDATE MANAGER
    // ==========================================
    if (assignedManager) {
      const managerUser =
        await User.findOne({
          _id: assignedManager,
          role: "manager",
          isActive: true,
        });

      if (!managerUser) {
        return res.status(404).json({
          message:
            "Manager not found or inactive",
        });
      }
    }

    // ==========================================
    // VALIDATE DATES
    // ==========================================
    const start = new Date(startDate);
    const end = new Date(deadline);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res.status(400).json({
        message:
          "Invalid start date or deadline",
      });
    }

    if (end < start) {
      return res.status(400).json({
        message:
          "Deadline cannot be before start date",
      });
    }

    // ==========================================
    // VALIDATE PROGRESS
    // ==========================================
    const projectProgress =
      progress !== undefined
        ? Number(progress)
        : 0;

    if (
      !Number.isFinite(projectProgress) ||
      projectProgress < 0 ||
      projectProgress > 100
    ) {
      return res.status(400).json({
        message:
          "Progress must be between 0 and 100",
      });
    }

    // ==========================================
    // CREATE PROJECT
    // ==========================================
    const project =
      await Project.create({
        name: name.trim(),
        description: description.trim(),
        client,
        assignedManager:
          assignedManager || null,
        startDate: start,
        deadline: end,
        status:
          status || "Not Started",
        priority:
          priority || "Medium",
        progress: projectProgress,
        createdBy: req.user.id,
      });

    // ==========================================
    // POPULATE PROJECT
    // ==========================================
    const populatedProject =
      await Project.findById(
        project._id
      )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "assignedManager",
          "name email phone"
        )
        .populate(
          "createdBy",
          "name email"
        );

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient: client,
      type: "project",
      title: "New Project Assigned",
      message:
        `A new project "${name}" has been created for you.`,
      project: project._id,
    });

    // ==========================================
    // NOTIFY MANAGER
    // ==========================================
    if (assignedManager) {
      await Notification.create({
        recipient: assignedManager,
        type: "project",
        title: "New Project Assigned",
        message:
          `You have been assigned to project "${name}".`,
        project: project._id,
      });
    }

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: project._id,
      description:
        `Created project "${name}" for ${
          clientUser.companyName ||
          clientUser.name
        }.`,
      metadata: {
        client,
        assignedManager:
          assignedManager || null,
      },
    });

    return res.status(201).json({
      message:
        "Project created successfully",
      project: populatedProject,
    });
  } catch (error) {
    console.error(
      "Create Project Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// UPDATE PROJECT
//
// Admin:
//   Can edit project details.
//
// Manager:
//   Can ONLY update project progress.
//   Only for projects assigned to them.
//
// Client:
//   Cannot modify projects.
//
// Project progress is normally calculated
// from tasks, but managers can update it
// directly if the UI requires it.
// ==========================================
exports.updateProject = async (req, res) => {
  try {
    const project =
      await Project.findById(
        req.params.id
      );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // ==========================================
    // CLIENT
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot modify projects",
      });
    }

    // ==========================================
    // MANAGER
    // ==========================================
    if (req.user.role === "manager") {
      // Manager must be assigned to project
      if (
        !project.assignedManager ||
        project.assignedManager.toString() !==
          req.user.id.toString()
      ) {
        return res.status(403).json({
          message:
            "You are not authorized to modify this project",
        });
      }

      // Manager can ONLY update progress
      const submittedFields =
        Object.keys(req.body);

      if (
        submittedFields.length !== 1 ||
        submittedFields[0] !==
          "progress"
      ) {
        return res.status(403).json({
          message:
            "Managers can only update project progress",
        });
      }

      const progress =
        Number(req.body.progress);

      if (
        !Number.isFinite(progress) ||
        progress < 0 ||
        progress > 100
      ) {
        return res.status(400).json({
          message:
            "Progress must be a number between 0 and 100",
        });
      }

      project.progress = progress;

      // Automatically update project status
      if (progress === 100) {
        project.status = "Completed";
      } else if (progress > 0) {
        project.status = "In Progress";
      } else {
        project.status = "Not Started";
      }
    }

    // ==========================================
    // ADMIN
    // ==========================================
    if (req.user.role === "admin") {
      const allowedFields = [
        "name",
        "description",
        "assignedManager",
        "startDate",
        "deadline",
        "status",
        "priority",
        "progress",
      ];

      for (
        const field of allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          project[field] =
            req.body[field];
        }
      }

      // ==========================================
      // VALIDATE MANAGER
      // ==========================================
      if (
        req.body.assignedManager !==
          undefined &&
        req.body.assignedManager !==
          null &&
        req.body.assignedManager !== ""
      ) {
        const manager =
          await User.findOne({
            _id:
              req.body.assignedManager,
            role: "manager",
            isActive: true,
          });

        if (!manager) {
          return res.status(404).json({
            message:
              "Assigned manager not found or inactive",
          });
        }
      }

      // Allow admin to remove manager
      if (
        req.body.assignedManager ===
          null ||
        req.body.assignedManager ===
          ""
      ) {
        project.assignedManager =
          null;
      }

      // ==========================================
      // VALIDATE PROGRESS
      // ==========================================
      if (
        req.body.progress !==
        undefined
      ) {
        const progress =
          Number(req.body.progress);

        if (
          !Number.isFinite(
            progress
          ) ||
          progress < 0 ||
          progress > 100
        ) {
          return res.status(400).json({
            message:
              "Progress must be a number between 0 and 100",
          });
        }

        project.progress =
          progress;
      }

      // ==========================================
      // VALIDATE DATES
      // ==========================================
      if (
        req.body.startDate !==
          undefined ||
        req.body.deadline !==
          undefined
      ) {
        const start =
          new Date(
            project.startDate
          );

        const deadline =
          new Date(
            project.deadline
          );

        if (
          Number.isNaN(
            start.getTime()
          ) ||
          Number.isNaN(
            deadline.getTime()
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid project dates",
          });
        }

        if (deadline < start) {
          return res.status(400).json({
            message:
              "Deadline cannot be before start date",
          });
        }
      }

      if (
        project.name
      ) {
        project.name =
          project.name.trim();
      }

      if (
        project.description
      ) {
        project.description =
          project.description.trim();
      }
    }

    await project.save();

    // ==========================================
    // UPDATED PROJECT
    // ==========================================
    const updatedProject =
      await Project.findById(
        project._id
      )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "assignedManager",
          "name email phone"
        )
        .populate(
          "createdBy",
          "name email"
        );

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient: project.client,
      type: "project",
      title: "Project Updated",
      message:
        `Your project "${project.name}" has been updated.`,
      project: project._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action: "UPDATE_PROJECT",
      entityType: "Project",
      entityId: project._id,
      description:
        `Updated project "${project.name}".`,
      metadata: {
        ...req.body,
      },
    });

    return res.json({
      message:
        "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error(
      "Update Project Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// DELETE PROJECT
// Admin only
// ==========================================
exports.deleteProject = async (
  req,
  res
) => {
  try {
    const project =
      await Project.findById(
        req.params.id
      );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message:
          "Only admin can delete projects",
      });
    }

    // ==========================================
    // DELETE PROJECT
    // ==========================================
    await Project.findByIdAndDelete(
      project._id
    );

    // ==========================================
    // DELETE ASSOCIATED TASKS
    // ==========================================
    await Task.deleteMany({
      project: project._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action: "DELETE_PROJECT",
      entityType: "Project",
      entityId: project._id,
      description:
        `Deleted project "${project.name}".`,
      metadata: {
        client: project.client,
        assignedManager:
          project.assignedManager,
      },
    });

    return res.json({
      message:
        "Project deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Project Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};