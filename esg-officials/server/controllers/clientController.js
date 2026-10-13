const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const ClientProfile = require("../models/portal/ClientProfile");

// Helper to normalize business type
const normalizeBusinessType = (type) => {
  if (!type) return "other";
  const lower = String(type).toLowerCase().trim();
  if (lower.includes("cafe") || lower.includes("café")) return "cafe";
  if (lower.includes("restaurant")) return "restaurant";
  if (lower.includes("clothing") || lower.includes("fashion")) return "clothing";
  if (lower.includes("jewel")) return "jewellery";
  if (lower.includes("retail")) return "retail_service";
  return "other";
};

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

    const clientIds = clients.map((c) => c._id);
    const profiles = await ClientProfile.find({ client: { $in: clientIds } });
    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.client.toString(), p));

    const enrichedClients = clients.map((client) => {
      const p = profileMap.get(client._id.toString());
      return {
        ...client.toObject(),
        profile: p || null,
        businessType: p?.businessType || "other",
        servicesPurchased: p?.servicesPurchased || [],
        serviceStartDate: p?.serviceStartDate || null,
        reportingPeriod: p?.reportingPeriod || "Monthly",
        retainerAmount: p?.retainerAmount || p?.servicePackage?.monthlyFee || 0,
        website: p?.website || "",
        address: p?.address || "",
        logo: p?.logo || "",
      };
    });

    return res.json(enrichedClients);
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

    const profile = await ClientProfile.findOne({ client: client._id });

    return res.json({
      ...client.toObject(),
      profile: profile || null,
      businessType: profile?.businessType || "other",
      servicesPurchased: profile?.servicesPurchased || [],
      serviceStartDate: profile?.serviceStartDate || null,
      reportingPeriod: profile?.reportingPeriod || "Monthly",
      retainerAmount: profile?.retainerAmount || profile?.servicePackage?.monthlyFee || 0,
      website: profile?.website || "",
      address: profile?.address || "",
      logo: profile?.logo || "",
    });
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
      businessType,
      address,
      website,
      logo,
      assignedManager,
      servicesPurchased,
      startDate,
      reportingPeriod,
      retainerAmount,
      isActive,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Client contact person's name is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Email address is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        message: "Business name is required.",
      });
    }

    // Password validation or auto-generation
    let finalPassword = password ? String(password).trim() : "";
    if (finalPassword && finalPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }
    if (!finalPassword) {
      finalPassword = `Esg@${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Check duplicate email
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "A user with this email address already exists.",
      });
    }

    // Validate manager
    let managerDoc = null;
    if (assignedManager) {
      managerDoc = await User.findOne({
        _id: assignedManager,
        role: "manager",
        isActive: true,
      });

      if (!managerDoc) {
        return res.status(404).json({
          message: "Assigned manager not found or inactive.",
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      finalPassword,
      10
    );

    // Create client user (clientId is auto-generated by pre-save hook)
    const client = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "client",
      companyName: companyName.trim(),
      phone: phone ? phone.trim() : "",
      assignedManager: assignedManager || null,
      isVerified: true,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    // Create client profile with all metadata
    const normType = normalizeBusinessType(businessType);
    let finalServices = Array.isArray(servicesPurchased) && servicesPurchased.length > 0
      ? servicesPurchased
      : ["Brand Strategy", "Content", "Social Media", "Reporting"];

    const clientProfile = await ClientProfile.create({
      client: client._id,
      businessName: companyName.trim(),
      businessType: normType,
      contactPersonName: name.trim(),
      logo: logo ? logo.trim() : "",
      phone: phone ? phone.trim() : "",
      website: website ? website.trim() : "",
      address: address ? address.trim() : "",
      servicesPurchased: finalServices,
      serviceStartDate: startDate ? new Date(startDate) : new Date(),
      reportingPeriod: reportingPeriod ? reportingPeriod.trim() : "Monthly",
      retainerAmount: Number(retainerAmount) || 0,
      accountManagerDetails: {
        name: managerDoc?.name || "Rahul Sharma",
        email: managerDoc?.email || "rahul.manager@esgofficial.com",
        phone: managerDoc?.phone || "+91 98765 43210",
        role: "Senior Growth Strategist",
      },
      servicePackage: {
        name: `${companyName.trim()} Retainer`,
        monthlyFee: Number(retainerAmount) || 0,
        billingCycle: reportingPeriod ? reportingPeriod.trim() : "Monthly",
        servicesIncluded: finalServices,
      },
    });

    // Notify assigned manager
    if (assignedManager) {
      await Notification.create({
        recipient: assignedManager,
        type: "system",
        title: "New Client Assigned",
        message: `${name} (${companyName}) has been assigned to you as a client.`,
      });
    }

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "CREATE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description: `Created client "${name}" (${companyName}).`,
      metadata: {
        clientId: client.clientId,
        email: client.email,
        companyName: client.companyName,
        assignedManager: assignedManager || null,
        businessType: normType,
        servicesPurchased: finalServices,
      },
    });

    // Safely attempt to send credentials email if Resend is configured
    let emailSent = false;
    try {
      const { sendClientCredentialsEmail } = require("../utils/email");
      await sendClientCredentialsEmail(
        client.email,
        client.name,
        client.clientId,
        finalPassword
      );
      emailSent = true;
    } catch (emailErr) {
      console.warn("Client credentials email skipped or failed:", emailErr.message);
    }

    // Return populated client with full profile
    const clientResponse = await User.findById(client._id)
      .select("-password")
      .populate(
        "assignedManager",
        "name email phone"
      );

    return res.status(201).json({
      message: "Client created successfully",
      client: {
        ...clientResponse.toObject(),
        profile: clientProfile,
        businessType: clientProfile.businessType,
        servicesPurchased: clientProfile.servicesPurchased,
        serviceStartDate: clientProfile.serviceStartDate,
        reportingPeriod: clientProfile.reportingPeriod,
        retainerAmount: clientProfile.retainerAmount,
        website: clientProfile.website,
        address: clientProfile.address,
        logo: clientProfile.logo,
        temporaryPassword: finalPassword,
        emailSent,
      },
    });
  } catch (error) {
    console.error("Create Client Error:", error);

    return res.status(500).json({
      message: error.message || "Server Error",
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
      businessType,
      address,
      website,
      logo,
      servicesPurchased,
      startDate,
      reportingPeriod,
      retainerAmount,
    } = req.body;

    // EMAIL
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail !== client.email) {
        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: client._id },
        });

        if (existingUser) {
          return res.status(400).json({
            message: "Email is already being used",
          });
        }

        client.email = normalizedEmail;
      }
    }

    // MANAGER ASSIGNMENT
    let managerDoc = null;
    if (assignedManager !== undefined) {
      if (assignedManager === null || assignedManager === "") {
        client.assignedManager = null;
      } else {
        managerDoc = await User.findOne({
          _id: assignedManager,
          role: "manager",
          isActive: true,
        });

        if (!managerDoc) {
          return res.status(404).json({
            message: "Assigned manager not found or inactive",
          });
        }

        client.assignedManager = assignedManager;
      }
    }

    // OTHER USER FIELDS
    if (name !== undefined) client.name = name.trim();
    if (companyName !== undefined) client.companyName = companyName.trim();
    if (phone !== undefined) client.phone = phone.trim();
    if (isActive !== undefined) client.isActive = Boolean(isActive);

    await client.save();

    // UPDATE CLIENT PROFILE
    const profileUpdates = {};
    if (companyName !== undefined) profileUpdates.businessName = companyName.trim();
    if (name !== undefined) profileUpdates.contactPersonName = name.trim();
    if (phone !== undefined) profileUpdates.phone = phone.trim();
    if (website !== undefined) profileUpdates.website = website.trim();
    if (address !== undefined) profileUpdates.address = address.trim();
    if (logo !== undefined) profileUpdates.logo = logo.trim();
    if (businessType !== undefined) profileUpdates.businessType = normalizeBusinessType(businessType);
    if (servicesPurchased !== undefined && Array.isArray(servicesPurchased)) {
      profileUpdates.servicesPurchased = servicesPurchased;
    }
    if (startDate !== undefined) profileUpdates.serviceStartDate = new Date(startDate);
    if (reportingPeriod !== undefined) profileUpdates.reportingPeriod = reportingPeriod.trim();
    if (retainerAmount !== undefined) {
      profileUpdates.retainerAmount = Number(retainerAmount) || 0;
      profileUpdates["servicePackage.monthlyFee"] = Number(retainerAmount) || 0;
    }
    if (managerDoc) {
      profileUpdates.accountManagerDetails = {
        name: managerDoc.name,
        email: managerDoc.email,
        phone: managerDoc.phone || "+91 98765 43210",
        role: "Senior Growth Strategist",
      };
    }

    const updatedProfile = await ClientProfile.findOneAndUpdate(
      { client: client._id },
      { $set: profileUpdates },
      { new: true, upsert: true }
    );

    // Get updated client
    const updatedClient = await User.findById(client._id)
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
      message: "Your client profile has been updated by the administrator.",
    });

    // Activity log
    await ActivityLog.create({
      user: req.user.id,
      action: "UPDATE_CLIENT",
      entityType: "User",
      entityId: client._id,
      description: `Updated client "${client.name}".`,
      metadata: req.body,
    });

    return res.json({
      message: "Client updated successfully",
      client: {
        ...updatedClient.toObject(),
        profile: updatedProfile,
        businessType: updatedProfile.businessType,
        servicesPurchased: updatedProfile.servicesPurchased,
        serviceStartDate: updatedProfile.serviceStartDate,
        reportingPeriod: updatedProfile.reportingPeriod,
        retainerAmount: updatedProfile.retainerAmount,
        website: updatedProfile.website,
        address: updatedProfile.address,
        logo: updatedProfile.logo,
      },
    });
  } catch (error) {
    console.error("Update Client Error:", error);

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

    await ClientProfile.deleteMany({
      client: client._id,
    });

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

// ==========================================
// RESET MANAGER PASSWORD
// Admin only
// ==========================================
exports.resetManagerPassword = async (
  req,
  res
) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const manager = await User.findOne({
      _id: req.params.id,
      role: "manager",
    });

    if (!manager) {
      return res.status(404).json({
        message: "Manager not found",
      });
    }

    manager.password = await bcrypt.hash(password, 10);
    await manager.save();

    await ActivityLog.create({
      user: req.user.id,
      action: "RESET_MANAGER_PASSWORD",
      entityType: "User",
      entityId: manager._id,
      description: `Reset password for manager "${manager.name}".`,
    });

    return res.json({
      message: `Password reset successfully for manager "${manager.name}"`,
    });
  } catch (error) {
    console.error("Reset Manager Password Error:", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};