const Risk = require("../models/Risk");
const RiskAuditLog = require("../models/RiskAuditLog");
const RiskPolicy = require("../models/RiskPolicy");
const CalendarEvent = require("../models/CalendarEvent");
const Notification = require("../models/Notification");
const User = require("../models/User");
const ClientProfile = require("../models/portal/ClientProfile");

// Helper to compute risk score
function calculateRiskScore(severity, impactAmount = 0) {
  let base = 50;
  if (severity === "Low") base = 25;
  if (severity === "Medium") base = 50;
  if (severity === "High") base = 75;
  if (severity === "Critical") base = 95;

  if (impactAmount > 1000000) base = Math.min(100, base + 10);
  else if (impactAmount > 500000) base = Math.min(100, base + 5);

  return base;
}

// ==========================================
// 1. GET RISKS LIST (ROLE-BASED & FILTERED)
// ==========================================
exports.getRisks = async (req, res) => {
  try {
    const filter = {};

    // RBAC: Client can ONLY see risks for their account AND only when submitted or decided!
    if (req.user.role === "client") {
      filter.client = req.user._id;
      filter.status = {
        $in: ["Pending Client Approval", "Approved", "Rejected", "Resolved"],
      };
    } else if (req.user.role === "manager") {
      // Manager sees risks assigned to them or their assigned clients
      filter.$or = [
        { assignedManager: req.user._id },
        { assignedManager: null },
      ];
    }

    // Additional query filters
    if (req.query.client) {
      filter.client = req.query.client;
    }
    if (req.query.severity) {
      filter.severity = req.query.severity;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      const q = req.query.search.trim();
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { riskId: { $regex: q, $options: "i" } },
        { clientName: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }

    const risks = await Risk.find(filter)
      .populate("assignedManager", "name email phone")
      .populate("client", "name email companyName clientId")
      .sort({ createdAt: -1 });

    return res.json(risks);
  } catch (error) {
    console.error("Get Risks Error:", error);
    return res.status(500).json({ message: "Failed to load risks." });
  }
};

// ==========================================
// 2. GET SINGLE RISK BY ID
// ==========================================
exports.getRiskById = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id)
      .populate("assignedManager", "name email phone")
      .populate("client", "name email companyName clientId phone");

    if (!risk) {
      return res.status(404).json({ message: "Risk not found." });
    }

    // Client authorization check: client cannot see unsubmitted risks or another client's risk
    if (req.user.role === "client") {
      if (risk.client._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied." });
      }
      const allowedClientStatuses = [
        "Pending Client Approval",
        "Approved",
        "Rejected",
        "Resolved",
      ];
      if (!allowedClientStatuses.includes(risk.status)) {
        return res.status(403).json({
          message: "This risk is currently in internal manager review.",
        });
      }
    }

    // Fetch audit trail
    const auditLogs = await RiskAuditLog.find({ risk: risk._id }).sort({
      createdAt: -1,
    });

    return res.json({ risk, auditLogs });
  } catch (error) {
    console.error("Get Risk By ID Error:", error);
    return res.status(500).json({ message: "Failed to load risk details." });
  }
};

// ==========================================
// 3. CREATE NEW RISK
// ==========================================
exports.createRisk = async (req, res) => {
  try {
    const {
      title,
      clientId, // Mongo _id of client User
      description,
      category,
      severity,
      financialImpact,
      financialImpactAmount,
      businessImpact,
      recommendedMitigation,
      assignedManager,
      deadline,
    } = req.body;

    if (!title || !clientId || !description || !deadline) {
      return res.status(400).json({
        message: "Title, client, description, and deadline are required.",
      });
    }

    const clientUser = await User.findById(clientId);
    if (!clientUser) {
      return res.status(404).json({ message: "Selected client not found." });
    }

    let managerUser = null;
    if (assignedManager) {
      managerUser = await User.findById(assignedManager);
    } else if (req.user.role === "manager") {
      managerUser = req.user;
    }

    const sev = severity || "Medium";
    const score = calculateRiskScore(sev, Number(financialImpactAmount) || 0);

    const deadlineDate = new Date(deadline);

    const risk = await Risk.create({
      title: title.trim(),
      client: clientUser._id,
      clientName: clientUser.companyName || clientUser.name,
      clientId: clientUser.clientId || "",
      description: description.trim(),
      category: category || "Operational",
      severity: sev,
      riskScore: score,
      financialImpact: financialImpact || "",
      financialImpactAmount: Number(financialImpactAmount) || 0,
      businessImpact: businessImpact || "",
      recommendedMitigation: recommendedMitigation || "",
      assignedManager: managerUser ? managerUser._id : null,
      managerName: managerUser ? managerUser.name : "Unassigned",
      deadline: deadlineDate,
      originalDeadline: deadlineDate,
      status: "Identified",
    });

    // 1. Audit Log
    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "RISK_CREATED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      newStatus: "Identified",
      notes: `Risk "${risk.title}" identified for client ${risk.clientName}.`,
    });

    // 2. Calendar Event for initial review
    await CalendarEvent.create({
      title: `Risk Review: ${risk.title}`,
      description: `Initial risk assessment deadline for ${risk.clientName}. Severity: ${risk.severity}.`,
      eventType: "Risk Review",
      startDate: deadlineDate,
      endDate: new Date(deadlineDate.getTime() + 60 * 60 * 1000),
      risk: risk._id,
      client: clientUser._id,
      manager: managerUser ? managerUser._id : null,
      priority: risk.severity,
      createdBy: req.user._id,
    });

    // 3. Notify Manager if assigned
    if (managerUser && managerUser._id.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: managerUser._id,
        title: "New Risk Assigned",
        message: `You have been assigned to review risk "${risk.title}" for client ${risk.clientName}.`,
        type: "risk",
        relatedId: risk._id,
        link: `/risks/${risk._id}`,
      });
    }

    return res.status(201).json({
      message: `Risk "${risk.title}" created successfully.`,
      risk,
    });
  } catch (error) {
    console.error("Create Risk Error:", error);
    return res.status(500).json({ message: "Failed to create risk record." });
  }
};

// ==========================================
// 4. REVIEW RISK (MANAGER ACTIONS)
// ==========================================
exports.reviewRisk = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const prevStatus = risk.status;
    risk.status = "Under Review";
    await risk.save();

    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "RISK_REVIEWED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: prevStatus,
      newStatus: "Under Review",
      notes: `Manager ${req.user.name} initiated detailed risk review.`,
    });

    return res.json({ message: "Risk marked as Under Review.", risk });
  } catch (error) {
    console.error("Review Risk Error:", error);
    return res.status(500).json({ message: "Failed to update risk status." });
  }
};

// ==========================================
// 5. PROPOSE MITIGATION PLAN
// ==========================================
exports.proposeMitigation = async (req, res) => {
  try {
    const {
      title,
      description,
      actionSteps,
      expectedOutcome,
      estimatedCost,
      timeline,
      proposedReviewDate,
    } = req.body;

    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const prevStatus = risk.status;
    risk.status = "Mitigation Proposed";

    risk.mitigationPlan = {
      title: title || risk.mitigationPlan?.title || "Risk Mitigation Plan",
      description: description || risk.mitigationPlan?.description || "",
      actionSteps: Array.isArray(actionSteps) ? actionSteps : [],
      expectedOutcome: expectedOutcome || "",
      estimatedCost: Number(estimatedCost) || 0,
      timeline: timeline || "Immediate",
      proposedReviewDate: proposedReviewDate ? new Date(proposedReviewDate) : risk.deadline,
      version: risk.mitigationPlan?.version || 1,
      submittedBy: req.user._id,
      submitterName: req.user.name,
    };

    await risk.save();

    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "MITIGATION_PROPOSED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: prevStatus,
      newStatus: "Mitigation Proposed",
      version: risk.mitigationPlan.version,
      notes: `Mitigation plan formulated by ${req.user.name}.`,
    });

    return res.json({ message: "Mitigation plan saved successfully.", risk });
  } catch (error) {
    console.error("Propose Mitigation Error:", error);
    return res.status(500).json({ message: "Failed to save mitigation proposal." });
  }
};

// ==========================================
// 6. SUBMIT MITIGATION FOR CLIENT APPROVAL (STARTS 24H TIMER)
// ==========================================
exports.submitForClientApproval = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    if (!risk.mitigationPlan || !risk.mitigationPlan.title) {
      return res.status(400).json({
        message: "Please prepare and save a mitigation plan before submitting to client.",
      });
    }

    const prevStatus = risk.status;
    const now = new Date();

    // Check policy settings
    let policy = await RiskPolicy.findOne();
    if (!policy) {
      policy = await RiskPolicy.create({});
    }

    // Determine auto-approval eligibility
    let isEligible = policy.autoApprovalEnabled;
    let excludedReason = "";

    if (policy.excludeCriticalSeverity && risk.severity === "Critical") {
      isEligible = false;
      excludedReason = "Critical severity requires mandatory manual executive approval.";
    }

    // If resubmitting with changed version, archive previous version
    if (risk.submittedForApprovalAt && risk.mitigationPlan.version) {
      risk.proposalVersions.push({
        version: risk.mitigationPlan.version,
        title: risk.mitigationPlan.title,
        description: risk.mitigationPlan.description,
        actionSteps: risk.mitigationPlan.actionSteps,
        expectedOutcome: risk.mitigationPlan.expectedOutcome,
        estimatedCost: risk.mitigationPlan.estimatedCost,
        timeline: risk.mitigationPlan.timeline,
        submittedAt: risk.submittedForApprovalAt,
        submittedBy: risk.mitigationPlan.submittedBy,
        approvalDeadline: risk.approvalDeadline,
        decision: "Superseded by v" + (risk.mitigationPlan.version + 1),
        decisionNotes: "Resubmitted with revised mitigation scope.",
        decisionAt: now,
      });

      // Increment version
      risk.mitigationPlan.version = (risk.mitigationPlan.version || 1) + 1;
    }

    const deadlineHours = policy.autoApprovalHours || 24;
    const approvalDeadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

    risk.status = "Pending Client Approval";
    risk.autoApprovalEligible = isEligible;
    risk.autoApprovalExcludedReason = excludedReason;
    risk.submittedForApprovalAt = now;
    risk.approvalDeadline = approvalDeadline;
    risk.approvalDecision = "Pending";
    risk.isAutoApproved = false;
    risk.mitigationPlan.submittedAt = now;
    risk.mitigationPlan.submittedBy = req.user._id;
    risk.mitigationPlan.submitterName = req.user.name;

    await risk.save();

    // 1. Audit Log
    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "SUBMITTED_FOR_APPROVAL",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: prevStatus,
      newStatus: "Pending Client Approval",
      version: risk.mitigationPlan.version,
      notes: `Mitigation plan submitted to client ${risk.clientName}. 24-hour review window active until ${approvalDeadline.toISOString()}.`,
      metadata: {
        approvalDeadline,
        autoApprovalEligible: isEligible,
        version: risk.mitigationPlan.version,
      },
    });

    // 2. Notify Client
    await Notification.create({
      user: risk.client,
      title: "Action Required: Review Risk Mitigation Plan",
      message: `A proposed mitigation plan for "${risk.title}" has been submitted for your review. Please review and decide within ${deadlineHours} hours.`,
      type: "approval",
      relatedId: risk._id,
      link: `/client/dashboard?tab=risks&riskId=${risk._id}`,
    });

    // 3. Calendar Event for Approval Deadline
    await CalendarEvent.create({
      title: `Client Approval Deadline: ${risk.title}`,
      description: `24-Hour client approval deadline for ${risk.title} (Client: ${risk.clientName}). Auto-approval triggers if no response received.`,
      eventType: "Approval Deadline",
      startDate: approvalDeadline,
      endDate: new Date(approvalDeadline.getTime() + 30 * 60 * 1000),
      risk: risk._id,
      client: risk.client,
      manager: risk.assignedManager,
      priority: risk.severity,
      status: "Upcoming",
      createdBy: req.user._id,
    });

    return res.json({
      message: `Mitigation plan submitted to client successfully. Approval deadline: ${approvalDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      risk,
    });
  } catch (error) {
    console.error("Submit For Approval Error:", error);
    return res.status(500).json({ message: "Failed to submit proposal to client." });
  }
};

// ==========================================
// 7. POSTPONE / RESCHEDULE RISK
// ==========================================
exports.postponeRisk = async (req, res) => {
  try {
    const { reason, newReviewDate, notes } = req.body;

    if (!reason || !newReviewDate) {
      return res.status(400).json({
        message: "Reason for postponement and new proposed review date are required.",
      });
    }

    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const previousDeadline = risk.deadline;
    const newDeadlineDate = new Date(newReviewDate);

    // Archive into postponement history (Preserves original deadline and previous dates)
    risk.postponementHistory.push({
      postponedAt: new Date(),
      previousDeadline: previousDeadline,
      newReviewDate: newDeadlineDate,
      reason: reason.trim(),
      notes: notes ? notes.trim() : "",
      postponedBy: req.user._id,
      postponerName: req.user.name,
    });

    risk.deadline = newDeadlineDate;
    await risk.save();

    // 1. Audit Log
    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "POSTPONED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      notes: `Risk postponed to ${newDeadlineDate.toLocaleDateString()}. Reason: ${reason.trim()}`,
      metadata: {
        previousDeadline,
        newReviewDate: newDeadlineDate,
        reason: reason.trim(),
      },
    });

    // 2. Update Calendar Events
    await CalendarEvent.updateMany(
      { risk: risk._id, status: "Upcoming", eventType: "Risk Review" },
      {
        $set: {
          startDate: newDeadlineDate,
          endDate: new Date(newDeadlineDate.getTime() + 60 * 60 * 1000),
          isPostponed: true,
          originalDate: previousDeadline,
          postponementReason: reason.trim(),
          status: "Postponed",
        },
      }
    );

    // 3. Notify Client
    await Notification.create({
      user: risk.client,
      title: "Risk Review Postponed",
      message: `The review for risk "${risk.title}" has been postponed to ${newDeadlineDate.toLocaleDateString()}. Reason: ${reason.trim()}`,
      type: "risk",
      relatedId: risk._id,
      link: `/client/dashboard?tab=risks`,
    });

    return res.json({
      message: `Risk review postponed to ${newDeadlineDate.toLocaleDateString()} successfully.`,
      risk,
    });
  } catch (error) {
    console.error("Postpone Risk Error:", error);
    return res.status(500).json({ message: "Failed to postpone risk." });
  }
};

// ==========================================
// 8. ESCALATE RISK
// ==========================================
exports.escalateRisk = async (req, res) => {
  try {
    const { reason, targetTeam } = req.body;
    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const prevStatus = risk.status;
    risk.status = "Escalated";
    risk.escalationDetails = {
      escalatedAt: new Date(),
      reason: reason || "Escalated due to high operational sensitivity.",
      escalatedBy: req.user._id,
      escalatedByName: req.user.name,
      targetTeam: targetTeam || "Executive Leadership",
    };

    await risk.save();

    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "ESCALATED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: prevStatus,
      newStatus: "Escalated",
      notes: `Escalated to ${risk.escalationDetails.targetTeam}. Reason: ${risk.escalationDetails.reason}`,
    });

    // Notify Admins
    const admins = await User.find({ role: "admin" });
    for (const a of admins) {
      await Notification.create({
        user: a._id,
        title: "Risk Escalation Alert",
        message: `Risk "${risk.title}" for client ${risk.clientName} has been escalated by ${req.user.name}.`,
        type: "risk",
        relatedId: risk._id,
        link: `/risks/${risk._id}`,
      });
    }

    return res.json({ message: "Risk escalated successfully.", risk });
  } catch (error) {
    console.error("Escalate Risk Error:", error);
    return res.status(500).json({ message: "Failed to escalate risk." });
  }
};

// ==========================================
// 9. RESOLVE RISK
// ==========================================
exports.resolveRisk = async (req, res) => {
  try {
    const { notes } = req.body;
    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const prevStatus = risk.status;
    risk.status = "Resolved";
    risk.resolutionDetails = {
      resolvedAt: new Date(),
      notes: notes || "Mitigation completed and risk successfully resolved.",
      resolvedBy: req.user._id,
      resolvedByName: req.user.name,
    };

    await risk.save();

    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "RESOLVED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: prevStatus,
      newStatus: "Resolved",
      notes: risk.resolutionDetails.notes,
    });

    // Mark calendar events completed
    await CalendarEvent.updateMany(
      { risk: risk._id },
      { $set: { status: "Completed" } }
    );

    // Notify Client
    await Notification.create({
      user: risk.client,
      title: "Risk Marked Resolved",
      message: `Risk "${risk.title}" has been successfully resolved.`,
      type: "risk",
      relatedId: risk._id,
      link: `/client/dashboard?tab=risks`,
    });

    return res.json({ message: "Risk marked as resolved.", risk });
  } catch (error) {
    console.error("Resolve Risk Error:", error);
    return res.status(500).json({ message: "Failed to resolve risk." });
  }
};

// ==========================================
// 10. CLIENT DECIDE ON MITIGATION PLAN (APPROVE / REJECT / REQUEST CHANGES)
// ==========================================
exports.clientDecideMitigation = async (req, res) => {
  try {
    const { action, reason, notes } = req.body;
    const now = new Date();

    if (!["approve", "reject", "request_changes"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be approve, reject, or request_changes." });
    }

    if (action === "reject" && (!reason || !reason.trim())) {
      return res.status(400).json({ message: "Rejection reason is required." });
    }

    if (action === "request_changes" && (!notes || !notes.trim())) {
      return res.status(400).json({ message: "Revision notes are required when requesting changes." });
    }

    // Concurrency-safe atomic check: ensure proposal is still Pending Client Approval
    const query = {
      _id: req.params.id,
      status: "Pending Client Approval",
    };

    // If client, ensure ownership
    if (req.user.role === "client") {
      query.client = req.user._id;
    }

    let updateFields = {};
    let auditAction = "";
    let statusText = "";
    let messageText = "";

    if (action === "approve") {
      updateFields = {
        status: "Approved",
        approvalDecision: "Approved",
        isAutoApproved: false,
        decisionAt: now,
        decidedBy: req.user._id,
        decidedByName: req.user.name,
        decisionNotes: notes ? notes.trim() : "Approved by client.",
      };
      auditAction = "CLIENT_APPROVED";
      statusText = "Approved";
      messageText = "Mitigation plan approved successfully.";
    } else if (action === "reject") {
      updateFields = {
        status: "Rejected",
        approvalDecision: "Rejected",
        isAutoApproved: false,
        decisionAt: now,
        decidedBy: req.user._id,
        decidedByName: req.user.name,
        decisionNotes: reason.trim(),
      };
      auditAction = "CLIENT_REJECTED";
      statusText = "Rejected";
      messageText = "Mitigation plan rejected.";
    } else if (action === "request_changes") {
      updateFields = {
        status: "Under Review",
        approvalDecision: "Changes Requested",
        decisionAt: now,
        decidedBy: req.user._id,
        decidedByName: req.user.name,
        decisionNotes: notes.trim(),
      };
      auditAction = "CLIENT_CHANGES_REQUESTED";
      statusText = "Under Review";
      messageText = "Changes requested. Returned to manager for revision.";
    }

    const updatedRisk = await Risk.findOneAndUpdate(query, { $set: updateFields }, { new: true });

    if (!updatedRisk) {
      return res.status(409).json({
        message: "This proposal has already been decided or auto-approved by the system.",
      });
    }

    // 1. Audit Log
    await RiskAuditLog.create({
      risk: updatedRisk._id,
      riskId: updatedRisk.riskId,
      action: auditAction,
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      previousStatus: "Pending Client Approval",
      newStatus: statusText,
      version: updatedRisk.mitigationPlan?.version || 1,
      notes: updateFields.decisionNotes,
      metadata: { action, decidedAt: now },
    });

    // 2. Notify Assigned Manager
    if (updatedRisk.assignedManager) {
      await Notification.create({
        user: updatedRisk.assignedManager,
        title: `Client ${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Requested Changes on"} Mitigation Plan`,
        message: `Client ${req.user.name} has ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "requested modifications on"} the mitigation proposal for "${updatedRisk.title}".`,
        type: "approval",
        relatedId: updatedRisk._id,
        link: `/risks/${updatedRisk._id}`,
      });
    }

    // 3. Update Calendar Events
    await CalendarEvent.updateMany(
      { risk: updatedRisk._id, eventType: "Approval Deadline" },
      { $set: { status: "Completed" } }
    );

    return res.json({ message: messageText, risk: updatedRisk });
  } catch (error) {
    console.error("Client Decide Mitigation Error:", error);
    return res.status(500).json({ message: "Failed to process approval decision." });
  }
};

// ==========================================
// 11. ADD COMMENT TO RISK
// ==========================================
exports.addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty." });
    }

    const risk = await Risk.findById(req.params.id);
    if (!risk) return res.status(404).json({ message: "Risk not found." });

    const newComment = {
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    risk.comments.push(newComment);
    await risk.save();

    await RiskAuditLog.create({
      risk: risk._id,
      riskId: risk.riskId,
      action: "COMMENT_ADDED",
      performedBy: req.user._id,
      performerName: req.user.name,
      performerRole: req.user.role,
      notes: `Comment posted by ${req.user.name}.`,
    });

    return res.json({ message: "Comment added.", comments: risk.comments });
  } catch (error) {
    console.error("Add Comment Error:", error);
    return res.status(500).json({ message: "Failed to add comment." });
  }
};

// ==========================================
// 12. GET AUDIT LOGS FOR A RISK
// ==========================================
exports.getRiskAuditLogs = async (req, res) => {
  try {
    const logs = await RiskAuditLog.find({ risk: req.params.id }).sort({ createdAt: -1 });
    return res.json(logs);
  } catch (error) {
    console.error("Get Audit Logs Error:", error);
    return res.status(500).json({ message: "Failed to fetch audit logs." });
  }
};

// ==========================================
// 13. GET & UPDATE RISK POLICY (ADMIN ONLY)
// ==========================================
exports.getRiskPolicy = async (req, res) => {
  try {
    let policy = await RiskPolicy.findOne();
    if (!policy) {
      policy = await RiskPolicy.create({});
    }
    return res.json(policy);
  } catch (error) {
    console.error("Get Policy Error:", error);
    return res.status(500).json({ message: "Failed to load policy." });
  }
};

exports.updateRiskPolicy = async (req, res) => {
  try {
    let policy = await RiskPolicy.findOne();
    if (!policy) policy = new RiskPolicy();

    const {
      autoApprovalEnabled,
      autoApprovalHours,
      excludeCriticalSeverity,
      excludeEmergencyRisks,
      noticeText,
    } = req.body;

    if (autoApprovalEnabled !== undefined) policy.autoApprovalEnabled = Boolean(autoApprovalEnabled);
    if (autoApprovalHours !== undefined) policy.autoApprovalHours = Math.max(1, Number(autoApprovalHours));
    if (excludeCriticalSeverity !== undefined) policy.excludeCriticalSeverity = Boolean(excludeCriticalSeverity);
    if (excludeEmergencyRisks !== undefined) policy.excludeEmergencyRisks = Boolean(excludeEmergencyRisks);
    if (noticeText) policy.noticeText = noticeText.trim();
    policy.updatedBy = req.user._id;

    await policy.save();

    return res.json({ message: "Risk approval policy updated successfully.", policy });
  } catch (error) {
    console.error("Update Policy Error:", error);
    return res.status(500).json({ message: "Failed to update risk policy." });
  }
};

// ==========================================
// 14. GET UNIFIED APPROVALS CENTER DATA
// ==========================================
exports.getApprovalsCenter = async (req, res) => {
  try {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const filter = {};
    if (req.user.role === "client") {
      filter.client = req.user._id;
    } else if (req.user.role === "manager") {
      filter.$or = [{ assignedManager: req.user._id }, { assignedManager: null }];
    }

    const allRisks = await Risk.find(filter)
      .populate("assignedManager", "name email")
      .populate("client", "name companyName clientId")
      .sort({ updatedAt: -1 });

    const pendingClientApprovals = allRisks.filter((r) => r.status === "Pending Client Approval");
    const pendingManagerReviews = allRisks.filter((r) => ["Identified", "Under Review"].includes(r.status));
    const approvedProposals = allRisks.filter((r) => r.status === "Approved");
    const rejectedProposals = allRisks.filter((r) => r.status === "Rejected");
    const autoApprovedProposals = allRisks.filter((r) => r.isAutoApproved === true);
    const expiringApprovals = pendingClientApprovals.filter(
      (r) => r.approvalDeadline && r.approvalDeadline > now && r.approvalDeadline <= fourHoursLater
    );
    const overdueApprovals = allRisks.filter(
      (r) =>
        (r.status === "Pending Client Approval" && r.approvalDeadline && r.approvalDeadline < now) ||
        (["Identified", "Under Review"].includes(r.status) && r.deadline && r.deadline < now)
    );

    return res.json({
      summary: {
        totalPending: pendingClientApprovals.length + pendingManagerReviews.length,
        pendingClientCount: pendingClientApprovals.length,
        pendingManagerCount: pendingManagerReviews.length,
        approvedCount: approvedProposals.length,
        rejectedCount: rejectedProposals.length,
        autoApprovedCount: autoApprovedProposals.length,
        expiringSoonCount: expiringApprovals.length,
        overdueCount: overdueApprovals.length,
      },
      lists: {
        pendingClientApprovals,
        pendingManagerReviews,
        approvedProposals,
        rejectedProposals,
        autoApprovedProposals,
        expiringApprovals,
        overdueApprovals,
      },
    });
  } catch (error) {
    console.error("Get Approvals Center Error:", error);
    return res.status(500).json({ message: "Failed to load Approvals Center." });
  }
};

// ==========================================
// 15. CALENDAR & SCHEDULING DATA
// ==========================================
exports.getCalendarEvents = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "client") {
      filter.client = req.user._id;
    } else if (req.user.role === "manager") {
      filter.$or = [{ manager: req.user._id }, { manager: null }];
    }

    if (req.query.month && req.query.year) {
      const year = parseInt(req.query.year, 10);
      const month = parseInt(req.query.month, 10) - 1;
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      filter.startDate = { $gte: start, $lte: end };
    }

    const events = await CalendarEvent.find(filter)
      .populate("risk", "title riskId severity status mitigationPlan")
      .populate("client", "name companyName")
      .populate("manager", "name email")
      .sort({ startDate: 1 });

    return res.json(events);
  } catch (error) {
    console.error("Get Calendar Events Error:", error);
    return res.status(500).json({ message: "Failed to load calendar events." });
  }
};

exports.createCalendarEvent = async (req, res) => {
  try {
    const { title, description, eventType, startDate, endDate, priority, client, manager, location } = req.body;
    if (!title || !startDate) {
      return res.status(400).json({ message: "Title and start date are required." });
    }

    const event = await CalendarEvent.create({
      title: title.trim(),
      description: description || "",
      eventType: eventType || "Meeting",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(new Date(startDate).getTime() + 60 * 60 * 1000),
      priority: priority || "Medium",
      client: client || null,
      manager: manager || req.user._id,
      location: location || "Client Executive Portal / Online Meeting",
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: "Calendar event created.", event });
  } catch (error) {
    console.error("Create Calendar Event Error:", error);
    return res.status(500).json({ message: "Failed to create calendar event." });
  }
};
