const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// ==========================================
// GET ALL CLIENTS
// Admin only
// ==========================================
exports.getAllClients = async (req, res) => {
  try {
    const clients = await User.find({
      role: "client",
    })
      .select("-password")
      .populate(
        "assignedManager",
        "name email phone"
      )
      .sort({ createdAt: -1 });

    return res.json(clients);
  } catch (error) {
    console.error("Get Clients Error:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET CLIENT BY ID
// Admin / Assigned Manager / Own Client
// ==========================================
exports.getClientById = async (req, res) => {
  try {
    const client = await User.findOne({
      _id: req.params.id,
      role: "client",
    })
      .select("-password")
      .populate(
        "assignedManager",
        "name email phone"
      );

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Client → only their own profile
    if (
      req.user.role === "client" &&
      client._id.toString() !==
        req.user.id.toString()
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view this client",
      });
    }

    // Manager → only assigned clients
    if (
      req.user.role === "manager" &&
      (
        !client.assignedManager ||
        client.assignedManager._id.toString() !==
          req.user.id.toString()
      )
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view this client",
      });
    }

    return res.json(client);
  } catch (error) {
    console.error("Get Client Error:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// CREATE CLIENT
// Admin only
// ==========================================
exports.createClient = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      companyName,
      phone,
      assignedManager,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    // Check duplicate email
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          "A user with this email already exists",
      });
    }

    // Validate manager
    if (assignedManager) {
      const manager = await User.findOne({
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
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Admin-created clients are already verified
    const client = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "client",
      companyName: companyName
        ? companyName.trim()
        : "",
      phone: phone
        ? phone.trim()
        : "",
      assignedManager:
        assignedManager || null,
      isVerified: true,
      isActive: true,
    });

    // Notify assigned manager
    if (assignedManager) {
      await Notification.create({
        recipient: assignedManager,
        type: "system",
        title: "New Client Assigned",
        message:
          `${name} has been assigned to you as a client.`,
      });
    }

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "CREATE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description:
        `Created client "${name}".`,
      metadata: {
        clientId: client.clientId,
        email: client.email,
        companyName: client.companyName,
        assignedManager:
          assignedManager || null,
      },
    });

    // Return populated client
    const clientResponse =
      await User.findById(client._id)
        .select("-password")
        .populate(
          "assignedManager",
          "name email phone"
        );

    return res.status(201).json({
      message:
        "Client created successfully",
      client: clientResponse,
    });
  } catch (error) {
    console.error(
      "Create Client Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// UPDATE CLIENT
// Admin only
// ==========================================
exports.updateClient = async (req, res) => {
  try {
    const client = await User.findOne({
      _id: req.params.id,
      role: "client",
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    const {
      name,
      email,
      companyName,
      phone,
      assignedManager,
      isActive,
    } = req.body;

    // ==========================================
    // EMAIL
    // ==========================================
    if (email !== undefined) {
      const normalizedEmail = email
        .trim()
        .toLowerCase();

      if (
        normalizedEmail !== client.email
      ) {
        const existingUser =
          await User.findOne({
            email: normalizedEmail,
            _id: {
              $ne: client._id,
            },
          });

        if (existingUser) {
          return res.status(400).json({
            message:
              "Email is already being used",
          });
        }

        client.email = normalizedEmail;
      }
    }

    // ==========================================
    // MANAGER ASSIGNMENT
    // ==========================================
    if (
      assignedManager !== undefined
    ) {
      if (
        assignedManager === null ||
        assignedManager === ""
      ) {
        client.assignedManager = null;
      } else {
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

        client.assignedManager =
          assignedManager;
      }
    }

    // ==========================================
    // OTHER FIELDS
    // ==========================================
    if (name !== undefined) {
      client.name = name.trim();
    }

    if (companyName !== undefined) {
      client.companyName =
        companyName.trim();
    }

    if (phone !== undefined) {
      client.phone = phone.trim();
    }

    if (isActive !== undefined) {
      client.isActive = Boolean(isActive);
    }

    await client.save();

    // Get updated client
    const updatedClient =
      await User.findById(client._id)
        .select("-password")
        .populate(
          "assignedManager",
          "name email phone"
        );

    // Notify client
    await Notification.create({
      recipient: client._id,
      type: "system",
      title: "Profile Updated",
      message:
        "Your client profile has been updated by the administrator.",
    });

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "UPDATE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description:
        `Updated client "${client.name}".`,
      metadata: req.body,
    });

    return res.json({
      message:
        "Client updated successfully",
      client: updatedClient,
    });
  } catch (error) {
    console.error(
      "Update Client Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// RESET CLIENT PASSWORD
// Admin only
// ==========================================
exports.resetClientPassword = async (
  req,
  res
) => {
  try {
    const { password } = req.body;

    if (
      !password ||
      password.length < 6
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    const client = await User.findOne({
      _id: req.params.id,
      role: "client",
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    client.password =
      await bcrypt.hash(password, 10);

    await client.save();

    await Notification.create({
      recipient: client._id,
      type: "system",
      title: "Password Updated",
      message:
        "Your account password has been reset by the administrator.",
    });

    await ActivityLog.create({
      user: req.user.id,
      action:
        "RESET_CLIENT_PASSWORD",
      entityType: "User",
      entityId: client._id,
      description:
        `Reset password for client "${client.name}".`,
    });

    return res.json({
      message:
        "Client password reset successfully",
    });
  } catch (error) {
    console.error(
      "Reset Client Password Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// ACTIVATE / DEACTIVATE CLIENT
// Admin only
// ==========================================
exports.toggleClientStatus = async (
  req,
  res
) => {
  try {
    const client = await User.findOne({
      _id: req.params.id,
      role: "client",
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    client.isActive =
      !client.isActive;

    await client.save();

    await ActivityLog.create({
      user: req.user.id,
      action: client.isActive
        ? "ACTIVATE_CLIENT"
        : "DEACTIVATE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description:
        `${client.isActive ? "Activated" : "Deactivated"} client "${client.name}".`,
    });

    return res.json({
      message: client.isActive
        ? "Client activated successfully"
        : "Client deactivated successfully",
      isActive: client.isActive,
    });
  } catch (error) {
    console.error(
      "Toggle Client Status Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// DELETE CLIENT
// Admin only
// ==========================================
exports.deleteClient = async (
  req,
  res
) => {
  try {
    const client = await User.findOne({
      _id: req.params.id,
      role: "client",
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Save information before deletion
    const deletedClientData = {
      email: client.email,
      companyName:
        client.companyName,
      clientId: client.clientId,
    };

    await User.findByIdAndDelete(
      client._id
    );

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "DELETE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description:
        `Deleted client "${client.name}".`,
      metadata: deletedClientData,
    });

    return res.json({
      message:
        "Client deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Client Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// GET ALL MANAGERS
// Admin only
// ==========================================
exports.getAllManagers = async (
  req,
  res
) => {
  try {
    const managers = await User.find({
      role: "manager",
    })
      .select("-password")
      .sort({ name: 1 });

    return res.json(managers);
  } catch (error) {
    console.error(
      "Get Managers Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==========================================
// CREATE MANAGER
// Admin only
// ==========================================
exports.createManager = async (
  req,
  res
) => {
  try {
    const {
      name,
      email,
      password,
      phone,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Check duplicate email
    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        message:
          "A user with this email already exists",
      });
    }

    // Hash password
    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    const manager =
      await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone
          ? phone.trim()
          : "",
        role: "manager",
        isVerified: true,
        isActive: true,
      });

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "CREATE_MANAGER",
      entityType: "User",
      entityId: manager._id,
      description:
        `Created manager "${manager.name}".`,
    });

    // Remove password from response
    const managerResponse =
      await User.findById(
        manager._id
      ).select("-password");

    return res.status(201).json({
      message:
        "Manager created successfully",
      manager: managerResponse,
    });
  } catch (error) {
    console.error(
      "Create Manager Error:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};