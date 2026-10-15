const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// GET ALL TASKS
//
// Admin   → all tasks
// Manager → ONLY tasks assigned to them
// Client  → ONLY tasks belonging to their projects
// ==========================================
exports.getAllTasks = async (req, res) => {
  try {
    const filters = {};

    // ==========================================
    // MANAGER
    // ==========================================
    if (req.user.role === "manager") {
      filters.assignedManager = req.user.id;
    }

    // ==========================================
    // CLIENT
    // ==========================================
    if (req.user.role === "client") {
      const clientProjects = await Project.find({
        client: req.user.id,
      }).select("_id");

      const projectIds = clientProjects.map(
        (project) => project._id
      );

      filters.project = {
        $in: projectIds,
      };
    }

    // ==========================================
    // PROJECT FILTER
    //
    // IMPORTANT:
    // Never allow this filter to override
    // manager/client authorization.
    // ==========================================
    if (req.query.project) {
      const requestedProject =
        req.query.project;

      // Manager → requested project must
      // belong to manager
      if (req.user.role === "manager") {
        const project =
          await Project.findOne({
            _id: requestedProject,
            assignedManager: req.user.id,
          });

        if (!project) {
          return res.status(403).json({
            message:
              "You are not authorized to access tasks from this project",
          });
        }

        filters.project =
          requestedProject;
      }

      // Client → requested project must
      // belong to client
      else if (req.user.role === "client") {
        const project =
          await Project.findOne({
            _id: requestedProject,
            client: req.user.id,
          });

        if (!project) {
          return res.status(403).json({
            message:
              "You are not authorized to access tasks from this project",
          });
        }

        filters.project =
          requestedProject;
      }

      // Admin → can filter any project
      else {
        filters.project =
          requestedProject;
      }
    }

    // ==========================================
    // STATUS FILTER
    // ==========================================
    if (req.query.status) {
      filters.status =
        req.query.status;
    }

    // ==========================================
    // PRIORITY FILTER
    // ==========================================
    if (req.query.priority) {
      filters.priority =
        req.query.priority;
    }

    // ==========================================
    // SEARCH
    // ==========================================
    if (req.query.search) {
      filters.title = {
        $regex: req.query.search,
        $options: "i",
      };
    }

    // ==========================================
    // GET TASKS
    // ==========================================
    const tasks =
      await Task.find(filters)
        .populate(
          "project",
          "projectId name client assignedManager"
        )
        .populate(
          "assignedManager",
          "name email phone"
        )
        .populate(
          "createdBy",
          "name email"
        )
        .sort({
          createdAt: -1,
        });

    return res.json(tasks);
  } catch (error) {
    console.error(
      "Get Tasks Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET TASK BY ID
//
// Admin   → any task
// Manager → ONLY assigned task
// Client  → task from own project
// ==========================================
exports.getTaskById = async (
  req,
  res
) => {
  try {
    const task =
      await Task.findById(
        req.params.id
      )
        .populate(
          "project",
          "projectId name client assignedManager"
        )
        .populate(
          "assignedManager",
          "name email phone"
        )
        .populate(
          "createdBy",
          "name email"
        );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (!task.project) {
      return res.status(404).json({
        message:
          "Associated project not found",
      });
    }

    const project =
      await Project.findById(
        task.project._id
      );

    if (!project) {
      return res.status(404).json({
        message:
          "Associated project not found",
      });
    }

    // ==========================================
    // CLIENT
    // ==========================================
    if (
      req.user.role === "client" &&
      project.client.toString() !==
        req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to access this task",
      });
    }

    // ==========================================
    // MANAGER
    // ==========================================
    if (
      req.user.role === "manager" &&
      (
        !task.assignedManager ||
        task.assignedManager._id.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to access this task",
      });
    }

    return res.json(task);
  } catch (error) {
    console.error(
      "Get Task Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// CREATE TASK
//
// Admin   → can create any task
// Manager → can create task only in their
//           assigned project
// Client  → cannot create
// ==========================================
exports.createTask = async (
  req,
  res
) => {
  try {
    const {
      title,
      description,
      project,
      assignedManager,
      status,
      priority,
      dueDate,
      progress,
    } = req.body;

    // ==========================================
    // REQUIRED FIELDS
    // ==========================================
    if (
      !title ||
      !description ||
      !project ||
      !assignedManager
    ) {
      return res.status(400).json({
        message:
          "Title, description, project and assigned manager are required",
      });
    }

    // ==========================================
    // CLIENT CANNOT CREATE
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot create tasks",
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
          "You can only create tasks for projects assigned to you",
      });
    }

    // ==========================================
    // VALIDATE MANAGER
    // ==========================================
    const manager =
      await User.findOne({
        _id: assignedManager,
        role: "manager",
        isActive: true,
      });

    if (!manager) {
      return res.status(404).json({
        message:
          "Assigned manager not found or inactive",
      });
    }

    // ==========================================
    // TASK MANAGER MUST MATCH PROJECT MANAGER
    // ==========================================
    if (
      !projectData.assignedManager ||
      projectData.assignedManager.toString() !==
        assignedManager.toString()
    ) {
      return res.status(400).json({
        message:
          "Assigned manager must be the manager assigned to this project",
      });
    }

    // ==========================================
    // VALIDATE PROGRESS
    // ==========================================
    const numericProgress =
      progress !== undefined
        ? Number(progress)
        : 0;

    if (
      !Number.isFinite(
        numericProgress
      ) ||
      numericProgress < 0 ||
      numericProgress > 100
    ) {
      return res.status(400).json({
        message:
          "Progress must be a number between 0 and 100",
      });
    }

    // ==========================================
    // VALIDATE DUE DATE
    // ==========================================
    let parsedDueDate = null;

    if (dueDate) {
      parsedDueDate =
        new Date(dueDate);

      if (
        Number.isNaN(
          parsedDueDate.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid due date",
        });
      }

      if (
        projectData.deadline &&
        parsedDueDate >
          new Date(
            projectData.deadline
          )
      ) {
        return res.status(400).json({
          message:
            "Task due date cannot be after project deadline",
        });
      }
    }

    // ==========================================
    // CREATE TASK
    // ==========================================
    const task =
      await Task.create({
        title: title.trim(),
        description:
          description.trim(),
        project,
        assignedManager,
        status:
          status || "Pending",
        priority:
          priority || "Medium",
        dueDate:
          parsedDueDate,
        progress:
          numericProgress,
        createdBy:
          req.user.id,
      });

    // ==========================================
    // POPULATE TASK
    // ==========================================
    const populatedTask =
      await Task.findById(
        task._id
      )
        .populate(
          "project",
          "projectId name client assignedManager"
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
    // NOTIFY MANAGER
    // ==========================================
    await Notification.create({
      recipient:
        assignedManager,
      type: "task",
      title:
        "New Task Assigned",
      message:
        `You have been assigned a new task: "${title.trim()}".`,
      project,
      task: task._id,
    });

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient:
        projectData.client,
      type: "task",
      title:
        "New Task Added",
      message:
        `A new task "${title.trim()}" has been added to your project.`,
      project,
      task: task._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action: "CREATE_TASK",
      entityType: "Task",
      entityId: task._id,
      description:
        `Created task "${title.trim()}".`,
      metadata: {
        project,
        assignedManager,
      },
    });

    return res.status(201).json({
      message:
        "Task created successfully",
      task: populatedTask,
    });
  } catch (error) {
    console.error(
      "Create Task Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// UPDATE TASK
//
// Admin:
//   Can edit all task fields.
//
// Manager:
//   Can edit ONLY progress.
//
// Client:
//   Cannot modify.
//
// IMPORTANT:
// Manager can ONLY update tasks assigned
// directly to that manager.
// ==========================================
exports.updateTask = async (
  req,
  res
) => {
  try {
    const task =
      await Task.findById(
        req.params.id
      );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // ==========================================
    // CLIENT
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot modify tasks",
      });
    }

    // ==========================================
    // MANAGER
    // ==========================================
    if (req.user.role === "manager") {
      // Must be assigned directly to manager
      if (
        !task.assignedManager ||
        task.assignedManager.toString() !==
          req.user.id.toString()
      ) {
        return res.status(403).json({
          message:
            "You can only update tasks assigned to you",
        });
      }

      // Manager MUST provide progress
      if (
        req.body.progress ===
        undefined
      ) {
        return res.status(400).json({
          message:
            "Managers can only update task progress",
        });
      }

      // No other fields allowed
      const submittedFields =
        Object.keys(req.body);

      const invalidFields =
        submittedFields.filter(
          (field) =>
            field !== "progress"
        );

      if (
        invalidFields.length > 0
      ) {
        return res.status(403).json({
          message:
            "Managers can only update task progress",
        });
      }

      // Validate progress
      const progress =
        Number(
          req.body.progress
        );

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

      task.progress =
        progress;

      // Automatically update status
      if (progress === 100) {
        task.status =
          "Completed";
      } else if (progress > 0) {
        task.status =
          "In Progress";
      } else {
        task.status =
          "Pending";
      }
    }

    // ==========================================
    // ADMIN
    // ==========================================
    if (req.user.role === "admin") {
      const allowedFields = [
        "title",
        "description",
        "status",
        "priority",
        "dueDate",
        "progress",
      ];

      for (
        const field of allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          task[field] =
            req.body[field];
        }
      }

      // Validate title
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
        task.title =
          req.body.title.trim();
      }

      // Validate description
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
        task.description =
          req.body.description.trim();
      }

      // Validate progress
      if (
        req.body.progress !==
        undefined
      ) {
        const progress =
          Number(
            req.body.progress
          );

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

        task.progress =
          progress;
      }

      // Validate due date
      if (
        req.body.dueDate !==
          undefined &&
        req.body.dueDate !==
          null &&
        req.body.dueDate !== ""
      ) {
        const dueDate =
          new Date(
            req.body.dueDate
          );

        if (
          Number.isNaN(
            dueDate.getTime()
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid due date",
          });
        }

        const project =
          await Project.findById(
            task.project
          );

        if (
          project &&
          project.deadline &&
          dueDate >
            new Date(
              project.deadline
            )
        ) {
          return res.status(400).json({
            message:
              "Task due date cannot be after project deadline",
          });
        }

        task.dueDate =
          dueDate;
      }

      if (
        req.body.dueDate ===
          null ||
        req.body.dueDate ===
          ""
      ) {
        task.dueDate =
          null;
      }
    }

    // ==========================================
    // SAVE TASK
    // ==========================================
    await task.save();

    // ==========================================
    // UPDATE PROJECT PROGRESS
    //
    // Project progress is calculated as
    // average progress of its tasks.
    // ==========================================
    const project =
      await Project.findById(
        task.project
      );

    if (project) {
      const projectTasks =
        await Task.find({
          project:
            project._id,
        }).select(
          "progress"
        );

      if (
        projectTasks.length > 0
      ) {
        const totalProgress =
          projectTasks.reduce(
            (sum, currentTask) =>
              sum +
              Number(
                currentTask.progress ||
                  0
              ),
            0
          );

        const averageProgress =
          Math.round(
            totalProgress /
              projectTasks.length
          );

        project.progress =
          averageProgress;

        const allCompleted =
          projectTasks.every(
            (currentTask) =>
              Number(
                currentTask.progress ||
                  0
              ) === 100
          );

        if (allCompleted) {
          project.progress =
            100;
          project.status =
            "Completed";
        } else if (
          averageProgress > 0
        ) {
          project.status =
            "In Progress";
        } else {
          project.status =
            "Not Started";
        }

        await project.save();
      }
    }

    // ==========================================
    // UPDATED TASK
    // ==========================================
    const updatedTask =
      await Task.findById(
        task._id
      )
        .populate(
          "project",
          "projectId name client assignedManager"
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
    if (project) {
      await Notification.create({
        recipient:
          project.client,
        type: "task",
        title:
          "Task Updated",
        message:
          `Task "${task.title}" has been updated.`,
        project:
          project._id,
        task:
          task._id,
      });
    }

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,
      action: "UPDATE_TASK",
      entityType: "Task",
      entityId: task._id,
      description:
        `Updated task "${task.title}".`,
      metadata: {
        ...req.body,
      },
    });

    return res.json({
      message:
        "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error(
      "Update Task Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// DELETE TASK
//
// Admin only
// ==========================================
exports.deleteTask = async (
  req,
  res
) => {
  try {
    const task =
      await Task.findById(
        req.params.id
      );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message:
          "Only admin can delete tasks",
      });
    }

    await Task.findByIdAndDelete(
      task._id
    );

    await ActivityLog.create({
      user: req.user.id,
      action: "DELETE_TASK",
      entityType: "Task",
      entityId: task._id,
      description:
        `Deleted task "${task.title}".`,
    });

    return res.json({
      message:
        "Task deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Task Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};