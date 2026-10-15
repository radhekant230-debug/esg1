const Approval = require("../models/Approval");
const Project = require("../models/Project");
const ProjectUpdate = require("../models/ProjectUpdate");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// GET ALL APPROVALS
//
// Admin   → All approvals
// Manager → Approvals from assigned projects
// Client  → Own approvals only
// ==========================================
exports.getAllApprovals = async (req, res) => {
  try {
    const filters = {};

    // ==========================================
    // CLIENT
    // ==========================================
    if (req.user.role === "client") {
      filters.client = req.user.id;

      // If client requests a specific project,
      // verify that it belongs to them.
      if (req.query.project) {
        const project = await Project.findOne({
          _id: req.query.project,
          client: req.user.id,
        });

        if (!project) {
          return res.status(403).json({
            message:
              "You are not authorized to access approvals for this project",
          });
        }

        filters.project = req.query.project;
      }
    }

    // ==========================================
    // MANAGER
    // ==========================================
    if (req.user.role === "manager") {
      const projects = await Project.find({
        assignedManager: req.user.id,
      }).select("_id");

      const projectIds = projects.map(
        (project) => project._id
      );

      // Specific project requested
      if (req.query.project) {
        const hasAccess = projectIds.some(
          (projectId) =>
            projectId.toString() ===
            req.query.project.toString()
        );

        if (!hasAccess) {
          return res.status(403).json({
            message:
              "You are not authorized to access approvals for this project",
          });
        }

        filters.project = req.query.project;
      } else {
        filters.project = {
          $in: projectIds,
        };
      }
    }

    // ==========================================
    // ADMIN
    // ==========================================
    if (
      req.user.role === "admin" &&
      req.query.project
    ) {
      filters.project =
        req.query.project;
    }

    // ==========================================
    // STATUS FILTER
    // ==========================================
    if (req.query.status) {
      filters.status =
        req.query.status;
    }

    // ==========================================
    // GET APPROVALS
    // ==========================================
    const approvals =
      await Approval.find(filters)
        .populate(
          "project",
          "projectId name client assignedManager progress status"
        )
        .populate(
          "task",
          "taskId title status progress"
        )
        .populate(
          "update",
          "updateId title description progress status createdAt"
        )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "requestedBy",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.json(approvals);
  } catch (error) {
    console.error(
      "Get Approvals Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// GET APPROVAL BY ID
//
// Admin   → Any approval
// Manager → Assigned project only
// Client  → Own approval only
// ==========================================
exports.getApprovalById = async (
  req,
  res
) => {
  try {
    const approval =
      await Approval.findById(
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
          "update",
          "updateId title description progress status createdAt"
        )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "requestedBy",
          "name email role"
        );

    if (!approval) {
      return res.status(404).json({
        message: "Approval not found",
      });
    }

    // ==========================================
    // CLIENT AUTHORIZATION
    // ==========================================
    if (
      req.user.role === "client" &&
      (
        !approval.client ||
        approval.client._id.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view this approval",
      });
    }

    // ==========================================
    // MANAGER AUTHORIZATION
    // ==========================================
    if (req.user.role === "manager") {
      if (!approval.project) {
        return res.status(404).json({
          message:
            "Associated project not found",
        });
      }

      const project =
        await Project.findOne({
          _id: approval.project._id,
          assignedManager: req.user.id,
        });

      if (!project) {
        return res.status(403).json({
          message:
            "You are not authorized to view this approval",
        });
      }
    }

    return res.json(approval);
  } catch (error) {
    console.error(
      "Get Approval Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// CREATE APPROVAL REQUEST
//
// Admin   → Any project
// Manager → Assigned project only
// Client  → Not allowed
// ==========================================
exports.createApproval = async (
  req,
  res
) => {
  try {
    const {
      project,
      task,
      update,
    } = req.body;

    // ==========================================
    // REQUIRED FIELDS
    // ==========================================
    if (!project || !update) {
      return res.status(400).json({
        message:
          "Project and update are required",
      });
    }

    // ==========================================
    // CLIENT CANNOT CREATE
    // ==========================================
    if (req.user.role === "client") {
      return res.status(403).json({
        message:
          "Clients cannot create approval requests",
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
          "You can only request approval for projects assigned to you",
      });
    }

    // ==========================================
    // VERIFY UPDATE BELONGS TO PROJECT
    // ==========================================
    const updateData =
      await ProjectUpdate.findOne({
        _id: update,
        project,
      });

    if (!updateData) {
      return res.status(404).json({
        message:
          "Project update not found in this project",
      });
    }

    // ==========================================
    // PREVENT DUPLICATE PENDING APPROVAL
    // ==========================================
    const existingApproval =
      await Approval.findOne({
        update,
        status: "Pending",
      });

    if (existingApproval) {
      return res.status(400).json({
        message:
          "An approval request already exists for this update",
        approval:
          existingApproval,
      });
    }

    // ==========================================
    // VALIDATE TASK
    // ==========================================
    if (task) {
      const taskData =
        await Task.findOne({
          _id: task,
          project,
        });

      if (!taskData) {
        return res.status(404).json({
          message:
            "Task not found in this project",
        });
      }
    }

    // ==========================================
    // CREATE APPROVAL
    // ==========================================
    const approval =
      await Approval.create({
        project,
        task: task || null,
        update,
        client:
          projectData.client,
        requestedBy:
          req.user.id,
        status: "Pending",
      });

    // ==========================================
    // UPDATE PROJECT UPDATE STATUS
    // ==========================================
    updateData.clientApprovalRequired =
      true;

    updateData.status =
      "Waiting for Approval";

    await updateData.save();

    // ==========================================
    // UPDATE TASK STATUS
    // ==========================================
    if (task) {
      await Task.findByIdAndUpdate(
        task,
        {
          status:
            "Waiting for Approval",
        }
      );
    }

    // ==========================================
    // NOTIFY CLIENT
    // ==========================================
    await Notification.create({
      recipient:
        projectData.client,

      type: "approval",

      title:
        "Approval Required",

      message:
        `Your approval is required for "${updateData.title}".`,

      project,

      task: task || null,

      approval:
        approval._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,

      action:
        "CREATE_APPROVAL",

      entityType:
        "Approval",

      entityId:
        approval._id,

      description:
        `Requested client approval for "${updateData.title}".`,

      metadata: {
        project,
        task: task || null,
        update,
      },
    });

    // ==========================================
    // POPULATED RESPONSE
    // ==========================================
    const populatedApproval =
      await Approval.findById(
        approval._id
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
          "update",
          "updateId title description progress status createdAt"
        )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "requestedBy",
          "name email role"
        );

    return res.status(201).json({
      message:
        "Approval request created successfully",

      approval:
        populatedApproval,
    });
  } catch (error) {
    console.error(
      "Create Approval Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// APPROVE REQUEST
//
// Client only
// ==========================================
exports.approveRequest = async (
  req,
  res
) => {
  try {
    const {
      clientComment,
    } = req.body;

    const approval =
      await Approval.findById(
        req.params.id
      );

    if (!approval) {
      return res.status(404).json({
        message:
          "Approval not found",
      });
    }

    // ==========================================
    // CLIENT ONLY
    // ==========================================
    if (req.user.role !== "client") {
      return res.status(403).json({
        message:
          "Only clients can approve work",
      });
    }

    // ==========================================
    // OWN APPROVAL ONLY
    // ==========================================
    if (
      approval.client.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to approve this request",
      });
    }

    // ==========================================
    // ONLY PENDING APPROVALS
    // ==========================================
    if (
      approval.status !==
      "Pending"
    ) {
      return res.status(400).json({
        message:
          `Approval is already ${approval.status.toLowerCase()}`,
      });
    }

    // ==========================================
    // APPROVE
    // ==========================================
    approval.status =
      "Approved";

    approval.clientComment =
      clientComment
        ? clientComment.trim()
        : "";

    approval.reviewedAt =
      new Date();

    await approval.save();

    // ==========================================
    // UPDATE PROJECT UPDATE
    // ==========================================
    const update =
      await ProjectUpdate.findById(
        approval.update
      );

    if (update) {
      update.status =
        "Approved";

      update.clientApprovalRequired =
        false;

      await update.save();
    }

    // ==========================================
    // UPDATE TASK
    // ==========================================
    if (approval.task) {
      await Task.findByIdAndUpdate(
        approval.task,
        {
          status: "Approved",
        }
      );
    }

    // ==========================================
    // NOTIFY REQUESTER
    // ==========================================
    await Notification.create({
      recipient:
        approval.requestedBy,

      type: "approval",

      title:
        "Work Approved",

      message:
        `Client approved "${update ? update.title : "the requested work"}".`,

      project:
        approval.project,

      task:
        approval.task || null,

      approval:
        approval._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,

      action:
        "APPROVE_WORK",

      entityType:
        "Approval",

      entityId:
        approval._id,

      description:
        "Client approved requested work.",

      metadata: {
        project:
          approval.project,

        task:
          approval.task || null,

        update:
          approval.update,

        comment:
          clientComment || "",
      },
    });

    // ==========================================
    // POPULATED RESPONSE
    // ==========================================
    const populatedApproval =
      await Approval.findById(
        approval._id
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
          "update",
          "updateId title description progress status createdAt"
        )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "requestedBy",
          "name email role"
        );

    return res.json({
      message:
        "Work approved successfully",

      approval:
        populatedApproval,
    });
  } catch (error) {
    console.error(
      "Approve Approval Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// REJECT REQUEST
//
// Client only
// ==========================================
exports.rejectRequest = async (
  req,
  res
) => {
  try {
    const {
      clientComment,
    } = req.body;

    const approval =
      await Approval.findById(
        req.params.id
      );

    if (!approval) {
      return res.status(404).json({
        message:
          "Approval not found",
      });
    }

    // ==========================================
    // CLIENT ONLY
    // ==========================================
    if (req.user.role !== "client") {
      return res.status(403).json({
        message:
          "Only clients can reject work",
      });
    }

    // ==========================================
    // OWN APPROVAL ONLY
    // ==========================================
    if (
      approval.client.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to reject this request",
      });
    }

    // ==========================================
    // ONLY PENDING APPROVALS
    // ==========================================
    if (
      approval.status !==
      "Pending"
    ) {
      return res.status(400).json({
        message:
          `Approval is already ${approval.status.toLowerCase()}`,
      });
    }

    // ==========================================
    // COMMENT REQUIRED
    // ==========================================
    if (
      !clientComment ||
      !clientComment.trim()
    ) {
      return res.status(400).json({
        message:
          "Please provide a reason for rejecting the work",
      });
    }

    // ==========================================
    // REJECT
    // ==========================================
    approval.status =
      "Rejected";

    approval.clientComment =
      clientComment.trim();

    approval.reviewedAt =
      new Date();

    await approval.save();

    // ==========================================
    // UPDATE PROJECT UPDATE
    // ==========================================
    const update =
      await ProjectUpdate.findById(
        approval.update
      );

    if (update) {
      update.status =
        "Rejected";

      update.clientApprovalRequired =
        false;

      await update.save();
    }

    // ==========================================
    // UPDATE TASK
    // ==========================================
    if (approval.task) {
      await Task.findByIdAndUpdate(
        approval.task,
        {
          status: "Rejected",
        }
      );
    }

    // ==========================================
    // NOTIFY REQUESTER
    // ==========================================
    await Notification.create({
      recipient:
        approval.requestedBy,

      type: "approval",

      title:
        "Work Rejected",

      message:
        `Client rejected "${update ? update.title : "the requested work"}".`,

      project:
        approval.project,

      task:
        approval.task || null,

      approval:
        approval._id,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,

      action:
        "REJECT_WORK",

      entityType:
        "Approval",

      entityId:
        approval._id,

      description:
        "Client rejected requested work.",

      metadata: {
        project:
          approval.project,

        task:
          approval.task || null,

        update:
          approval.update,

        comment:
          clientComment.trim(),
      },
    });

    // ==========================================
    // POPULATED RESPONSE
    // ==========================================
    const populatedApproval =
      await Approval.findById(
        approval._id
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
          "update",
          "updateId title description progress status createdAt"
        )
        .populate(
          "client",
          "name email companyName clientId"
        )
        .populate(
          "requestedBy",
          "name email role"
        );

    return res.json({
      message:
        "Work rejected successfully",

      approval:
        populatedApproval,
    });
  } catch (error) {
    console.error(
      "Reject Approval Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE / CANCEL APPROVAL
//
// Admin only
// ==========================================
exports.deleteApproval = async (
  req,
  res
) => {
  try {
    const approval =
      await Approval.findById(
        req.params.id
      );

    if (!approval) {
      return res.status(404).json({
        message:
          "Approval not found",
      });
    }

    // ==========================================
    // ADMIN ONLY
    // ==========================================
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message:
          "Only admin can delete approval requests",
      });
    }

    await Approval.findByIdAndDelete(
      approval._id
    );

    // ==========================================
    // ACTIVITY LOG
    // ==========================================
    await ActivityLog.create({
      user: req.user.id,

      action:
        "DELETE_APPROVAL",

      entityType:
        "Approval",

      entityId:
        approval._id,

      description:
        "Deleted approval request.",

      metadata: {
        project:
          approval.project,

        task:
          approval.task || null,

        update:
          approval.update,
      },
    });

    return res.json({
      message:
        "Approval request deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Approval Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};