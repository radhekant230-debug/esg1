const Message = require("../models/Message");
const User = require("../models/User");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// CREATE CONVERSATION ID
// ==========================================
const generateConversationId = (
  user1,
  user2,
  project = null
) => {
  const ids = [
    user1.toString(),
    user2.toString(),
  ].sort();

  return project
    ? `${ids[0]}_${ids[1]}_${project.toString()}`
    : `${ids[0]}_${ids[1]}`;
};

// ==========================================
// CHECK GENERAL MESSAGING PERMISSION
//
// Admin:
//   Can message anyone.
//
// Manager:
//   Can message Admin.
//   Can message clients belonging to their
//   assigned projects.
//
// Client:
//   Can message Admin.
//   Can message their assigned manager.
// ==========================================
const canUsersMessage = async (
  currentUser,
  otherUser
) => {
  // Admin can message anyone
  if (currentUser.role === "admin") {
    return true;
  }

  // Admin is always reachable
  if (otherUser.role === "admin") {
    return true;
  }

  // Manager → Manager is not allowed
  if (
    currentUser.role === "manager" &&
    otherUser.role === "manager"
  ) {
    return false;
  }

  // Client → Client is not allowed
  if (
    currentUser.role === "client" &&
    otherUser.role === "client"
  ) {
    return false;
  }

  // Manager → Client
  if (
    currentUser.role === "manager" &&
    otherUser.role === "client"
  ) {
    const project = await Project.findOne({
      client: otherUser._id,
      assignedManager: currentUser._id,
    });

    return !!project;
  }

  // Client → Manager
  if (
    currentUser.role === "client" &&
    otherUser.role === "manager"
  ) {
    const project = await Project.findOne({
      client: currentUser._id,
      assignedManager: otherUser._id,
    });

    return !!project;
  }

  return false;
};

// ==========================================
// CHECK PROJECT CONVERSATION PERMISSION
//
// Admin:
//   Can access any project.
//
// Manager:
//   Must be assigned to the project.
//
// Client:
//   Must own the project.
//
// Other participant:
//   Must be the project's client or manager.
//
// ==========================================
const canAccessProjectConversation = async (
  currentUser,
  otherUser,
  project
) => {
  if (!project) {
    return false;
  }

  // Admin can access any project conversation
  if (currentUser.role === "admin") {
    return (
      otherUser.role === "admin" ||
      otherUser._id.toString() ===
        project.client.toString() ||
      (
        project.assignedManager &&
        otherUser._id.toString() ===
          project.assignedManager.toString()
      )
    );
  }

  const currentUserIsClient =
    project.client.toString() ===
    currentUser._id.toString();

  const currentUserIsManager =
    project.assignedManager &&
    project.assignedManager.toString() ===
      currentUser._id.toString();

  const otherUserIsClient =
    project.client.toString() ===
    otherUser._id.toString();

  const otherUserIsManager =
    project.assignedManager &&
    project.assignedManager.toString() ===
      otherUser._id.toString();

  // Current user must belong to the project
  if (
    !currentUserIsClient &&
    !currentUserIsManager
  ) {
    return false;
  }

  // Other participant must belong to the project
  if (
    !otherUserIsClient &&
    !otherUserIsManager &&
    otherUser.role !== "admin"
  ) {
    return false;
  }

  // Client and manager can communicate
  if (
    currentUserIsClient &&
    (
      otherUserIsManager ||
      otherUser.role === "admin"
    )
  ) {
    return true;
  }

  if (
    currentUserIsManager &&
    (
      otherUserIsClient ||
      otherUser.role === "admin"
    )
  ) {
    return true;
  }

  return false;
};

// ==========================================
// GET CONVERSATIONS
// ==========================================
exports.getConversations = async (
  req,
  res
) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id },
      ],
    })
      .populate(
        "sender",
        "name email role clientId companyName"
      )
      .populate(
        "receiver",
        "name email role clientId companyName"
      )
      .populate(
        "project",
        "projectId name client assignedManager"
      )
      .sort({ createdAt: -1 });

    const conversationMap = new Map();

    for (const message of messages) {
      if (
        !message.sender ||
        !message.receiver
      ) {
        continue;
      }

      // ==========================================
      // SECURITY CHECK
      // ==========================================

      const otherUser =
        message.sender._id.toString() ===
        req.user.id.toString()
          ? message.receiver
          : message.sender;

      let allowed = false;

      if (message.project) {
        const project =
          await Project.findById(
            message.project._id
          );

        if (project) {
          allowed =
            await canAccessProjectConversation(
              req.user,
              otherUser,
              project
            );
        }
      } else {
        allowed =
          await canUsersMessage(
            req.user,
            otherUser
          );
      }

      if (!allowed) {
        continue;
      }

      // ==========================================
      // CREATE CONVERSATION
      // ==========================================

      if (
        !conversationMap.has(
          message.conversationId
        )
      ) {
        conversationMap.set(
          message.conversationId,
          {
            conversationId:
              message.conversationId,

            otherUser,

            project:
              message.project,

            lastMessage:
              message.message,

            lastMessageAt:
              message.createdAt,

            unreadCount: 0,
          }
        );
      }

      // ==========================================
      // UNREAD COUNT
      // ==========================================

      if (
        message.receiver._id.toString() ===
          req.user.id.toString() &&
        !message.isRead
      ) {
        const conversation =
          conversationMap.get(
            message.conversationId
          );

        if (conversation) {
          conversation.unreadCount += 1;
        }
      }
    }

    return res.json(
      Array.from(
        conversationMap.values()
      )
    );
  } catch (error) {
    console.error(
      "Get Conversations Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET CONVERSATION MESSAGES
// ==========================================
exports.getMessages = async (
  req,
  res
) => {
  try {
    const {
      userId,
      projectId,
    } = req.query;

    if (!userId) {
      return res.status(400).json({
        message:
          "User ID is required",
      });
    }

    const otherUser =
      await User.findById(userId).select(
        "-password"
      );

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let project = null;

    // ==========================================
    // PROJECT CONVERSATION
    // ==========================================

    if (projectId) {
      project =
        await Project.findById(
          projectId
        );

      if (!project) {
        return res.status(404).json({
          message: "Project not found",
        });
      }

      const allowed =
        await canAccessProjectConversation(
          req.user,
          otherUser,
          project
        );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You are not authorized to access this project conversation",
        });
      }
    }

    // ==========================================
    // GENERAL CONVERSATION
    // ==========================================

    else {
      const allowed =
        await canUsersMessage(
          req.user,
          otherUser
        );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You are not authorized to access this conversation",
        });
      }
    }

    // ==========================================
    // CONVERSATION ID
    // ==========================================

    const conversationId =
      generateConversationId(
        req.user.id,
        userId,
        projectId || null
      );

    const messages =
      await Message.find({
        conversationId,
      })
        .populate(
          "sender",
          "name email role clientId companyName"
        )
        .populate(
          "receiver",
          "name email role clientId companyName"
        )
        .populate(
          "project",
          "projectId name"
        )
        .sort({
          createdAt: 1,
        });

    // ==========================================
    // MARK RECEIVED MESSAGES AS READ
    // ==========================================

    await Message.updateMany(
      {
        conversationId,
        receiver: req.user.id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.json(messages);
  } catch (error) {
    console.error(
      "Get Messages Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// SEND MESSAGE
// ==========================================
exports.sendMessage = async (
  req,
  res
) => {
  try {
    const {
      receiver,
      project,
      message,
      attachments,
    } = req.body;

    if (
      !receiver ||
      !message ||
      !message.trim()
    ) {
      return res.status(400).json({
        message:
          "Receiver and message are required",
      });
    }

    if (
      receiver.toString() ===
      req.user.id.toString()
    ) {
      return res.status(400).json({
        message:
          "You cannot send a message to yourself",
      });
    }

    const receiverUser =
      await User.findById(
        receiver
      );

    if (!receiverUser) {
      return res.status(404).json({
        message: "Receiver not found",
      });
    }

    let projectData = null;

    // ==========================================
    // PROJECT MESSAGE
    // ==========================================

    if (project) {
      projectData =
        await Project.findById(
          project
        );

      if (!projectData) {
        return res.status(404).json({
          message: "Project not found",
        });
      }

      const allowed =
        await canAccessProjectConversation(
          req.user,
          receiverUser,
          projectData
        );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You are not authorized to message this user for this project",
        });
      }
    }

    // ==========================================
    // GENERAL MESSAGE
    // ==========================================

    else {
      const allowed =
        await canUsersMessage(
          req.user,
          receiverUser
        );

      if (!allowed) {
        return res.status(403).json({
          message:
            "You are not authorized to message this user",
        });
      }
    }

    // ==========================================
    // CONVERSATION ID
    // ==========================================

    const conversationId =
      generateConversationId(
        req.user.id,
        receiver,
        project || null
      );

    // ==========================================
    // CREATE MESSAGE
    // ==========================================

    const newMessage =
      await Message.create({
        conversationId,

        sender: req.user.id,

        receiver,

        project:
          project || null,

        message:
          message.trim(),

        attachments:
          attachments || [],
      });

    // ==========================================
    // NOTIFY RECEIVER
    // ==========================================

    await Notification.create({
      recipient: receiver,

      type: "message",

      title: "New Message",

      message:
        `${req.user.name} sent you a new message.`,

      project:
        project || null,
    });

    // ==========================================
    // ACTIVITY LOG
    // ==========================================

    await ActivityLog.create({
      user: req.user.id,

      action: "SEND_MESSAGE",

      entityType: "Message",

      entityId:
        newMessage._id,

      description:
        `Sent a message to ${receiverUser.name}.`,

      metadata: {
        receiver,

        project:
          project || null,
      },
    });

    // ==========================================
    // POPULATE RESPONSE
    // ==========================================

    const populatedMessage =
      await Message.findById(
        newMessage._id
      )
        .populate(
          "sender",
          "name email role clientId companyName"
        )
        .populate(
          "receiver",
          "name email role clientId companyName"
        )
        .populate(
          "project",
          "projectId name"
        );

    return res.status(201).json({
      message:
        "Message sent successfully",

      data:
        populatedMessage,
    });
  } catch (error) {
    console.error(
      "Send Message Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// MARK MESSAGE AS READ
// ==========================================
exports.markMessageAsRead = async (
  req,
  res
) => {
  try {
    const message =
      await Message.findById(
        req.params.id
      );

    if (!message) {
      return res.status(404).json({
        message:
          "Message not found",
      });
    }

    // Only receiver can mark message as read
    if (
      message.receiver.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to modify this message",
      });
    }

    message.isRead = true;

    message.readAt =
      new Date();

    await message.save();

    return res.json({
      message:
        "Message marked as read",
    });
  } catch (error) {
    console.error(
      "Mark Message Read Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// MARK ENTIRE CONVERSATION AS READ
// ==========================================
exports.markConversationAsRead =
  async (req, res) => {
    try {
      const {
        userId,
        projectId,
      } = req.body;

      if (!userId) {
        return res.status(400).json({
          message:
            "User ID is required",
        });
      }

      const otherUser =
        await User.findById(
          userId
        );

      if (!otherUser) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      // ==========================================
      // VERIFY ACCESS
      // ==========================================

      if (projectId) {
        const project =
          await Project.findById(
            projectId
          );

        if (!project) {
          return res.status(404).json({
            message:
              "Project not found",
          });
        }

        const allowed =
          await canAccessProjectConversation(
            req.user,
            otherUser,
            project
          );

        if (!allowed) {
          return res.status(403).json({
            message:
              "You are not authorized to access this conversation",
          });
        }
      } else {
        const allowed =
          await canUsersMessage(
            req.user,
            otherUser
          );

        if (!allowed) {
          return res.status(403).json({
            message:
              "You are not authorized to access this conversation",
          });
        }
      }

      // ==========================================
      // GENERATE CONVERSATION ID
      // ==========================================

      const conversationId =
        generateConversationId(
          req.user.id,
          userId,
          projectId || null
        );

      // ==========================================
      // MARK RECEIVED MESSAGES AS READ
      // ==========================================

      await Message.updateMany(
        {
          conversationId,

          receiver:
            req.user.id,

          isRead: false,
        },
        {
          isRead: true,

          readAt:
            new Date(),
        }
      );

      return res.json({
        message:
          "Conversation marked as read",
      });
    } catch (error) {
      console.error(
        "Mark Conversation Read Error:",
        error
      );

      return res.status(500).json({
        message: "Server Error",
      });
    }
  };