const User = require("../models/User");
const Risk = require("../models/Risk");
const RiskAuditLog = require("../models/RiskAuditLog");
const RiskPolicy = require("../models/RiskPolicy");
const CalendarEvent = require("../models/CalendarEvent");

/**
 * Bootstraps sample risk management records, mitigation proposals,
 * postponement histories, and calendar events for clients.
 */
async function ensureRiskData() {
  try {
    // 1. Ensure Risk Policy
    let policy = await RiskPolicy.findOne();
    if (!policy) {
      policy = await RiskPolicy.create({
        policyName: "Standard 24-Hour Mitigation Approval Policy",
        autoApprovalEnabled: true,
        autoApprovalHours: 24,
        excludeCriticalSeverity: true,
        excludeEmergencyRisks: true,
        noticeText:
          "Please review this proposed risk mitigation plan within 24 hours. If no decision is received within 24 hours of submission, the plan will be automatically approved according to the applicable approval policy.",
      });
      console.log("[riskBootstrap] Default Risk Policy established.");
    }

    // Check if risks already exist
    const riskCount = await Risk.countDocuments();
    if (riskCount >= 4) {
      console.log(`[riskBootstrap] ${riskCount} risk records already present.`);
      return;
    }

    // Find clients and managers
    const clients = await User.find({ role: "client" });
    if (!clients || clients.length === 0) {
      console.log("[riskBootstrap] No client accounts found for seeding risks.");
      return;
    }

    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });
    const managerId = manager ? manager._id : null;
    const managerName = manager ? manager.name : "Rahul Sharma";

    const client1 = clients[0]; // Radhe Kant Raj or Aman Kapoor
    const client2 = clients.length > 1 ? clients[1] : client1;
    const client3 = clients.length > 2 ? clients[2] : client1;

    const now = new Date();

    // Risk 1: Pending Client Approval (Active 24-Hour Countdown)
    const risk1SubmittedAt = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
    const risk1Deadline = new Date(risk1SubmittedAt.getTime() + 24 * 60 * 60 * 1000); // 20 hours remaining

    const r1 = await Risk.create({
      title: "Supply Chain Vendor Inconsistency & Buffer Depletion",
      client: client1._id,
      clientName: client1.companyName || client1.name,
      clientId: client1.clientId || "CLI-2026-0001",
      description:
        "Key regional distributor experiencing logistical delays impacting critical packaging and raw material buffers for peak weekend dining sales.",
      category: "Operational",
      severity: "High",
      riskScore: 78,
      financialImpact: "Estimated revenue loss of ₹1,80,000 during upcoming weekend rush.",
      financialImpactAmount: 180000,
      businessImpact: "Menu fulfillment disruption and customer wait-time inflation.",
      recommendedMitigation:
        "Activate secondary contracted FMCG supplier in Ranchi with guaranteed 4-hour SLA.",
      assignedManager: managerId,
      managerName: managerName,
      deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      originalDeadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      status: "Pending Client Approval",
      autoApprovalEligible: true,
      submittedForApprovalAt: risk1SubmittedAt,
      approvalDeadline: risk1Deadline,
      approvalDecision: "Pending",
      mitigationPlan: {
        title: "Immediate Vendor Redundancy & Buffer Rebalancing",
        description:
          "Formally contract backup logistics provider and secure a 14-day stock reserve at preferred volume discount.",
        actionSteps: [
          "Execute emergency procurement order with certified backup supplier",
          "Establish automated low-stock webhook notifications at 25% threshold",
          "Lock in wholesale rates through a 90-day volume commitment",
        ],
        expectedOutcome: "Zero menu item stockouts; inventory buffers restored to 120%.",
        estimatedCost: 35000,
        timeline: "48 Hours",
        proposedReviewDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        version: 1,
        submittedAt: risk1SubmittedAt,
        submittedBy: managerId,
        submitterName: managerName,
      },
    });

    await RiskAuditLog.create({
      risk: r1._id,
      riskId: r1.riskId,
      action: "SUBMITTED_FOR_APPROVAL",
      performedBy: managerId,
      performerName: managerName,
      performerRole: "manager",
      previousStatus: "Mitigation Proposed",
      newStatus: "Pending Client Approval",
      version: 1,
      notes: "Proposal submitted to client with active 24-hour review window.",
      metadata: { approvalDeadline: risk1Deadline },
    });

    await CalendarEvent.create({
      title: `Client Approval Deadline: ${r1.title}`,
      description: `24-Hour countdown deadline for ${r1.clientName}.`,
      eventType: "Approval Deadline",
      startDate: risk1Deadline,
      endDate: new Date(risk1Deadline.getTime() + 30 * 60 * 1000),
      risk: r1._id,
      client: client1._id,
      manager: managerId,
      priority: "High",
      status: "Upcoming",
    });

    // Risk 2: Postponed Risk with Postponement History
    const originalDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const newDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const r2 = await Risk.create({
      title: "Commercial Lease Renewal & Municipal Compliance Audit",
      client: client2._id,
      clientName: client2.companyName || client2.name,
      clientId: client2.clientId || "CLI-2026-0002",
      description:
        "Commercial lease renewal clause renegotiation pending local municipal zoning verification and fire safety certificate renewal.",
      category: "Compliance",
      severity: "Medium",
      riskScore: 54,
      financialImpact: "Potential regulatory delay penalty of ₹45,000.",
      financialImpactAmount: 45000,
      businessImpact: "Requires zoning clarification from municipal authority.",
      recommendedMitigation:
        "Retain municipal liaison and file fast-track verification application.",
      assignedManager: managerId,
      managerName: managerName,
      deadline: newDate,
      originalDeadline: originalDate,
      status: "Under Review",
      postponementHistory: [
        {
          postponedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          previousDeadline: originalDate,
          newReviewDate: newDate,
          reason: "Awaiting municipal surveyor site visit scheduled for Thursday.",
          notes: "Surveyor confirmed appointment via official letter.",
          postponedBy: managerId,
          postponerName: managerName,
        },
      ],
      mitigationPlan: {
        title: "Fast-Track Municipal Compliance Dossier",
        description:
          "Compile updated structural safety audit and submit to city council.",
        actionSteps: [
          "Complete electrical and fire safety audit with certified technician",
          "File renewal deed with landlord legal council",
        ],
        expectedOutcome: "Full compliance certification issued within 10 business days.",
        estimatedCost: 15000,
        timeline: "7 Days",
        proposedReviewDate: newDate,
        version: 1,
      },
    });

    await RiskAuditLog.create({
      risk: r2._id,
      riskId: r2.riskId,
      action: "POSTPONED",
      performedBy: managerId,
      performerName: managerName,
      performerRole: "manager",
      previousStatus: "Identified",
      newStatus: "Under Review",
      notes: "Postponed due to scheduled municipal surveyor site visit.",
      metadata: { originalDate, newDate },
    });

    await CalendarEvent.create({
      title: `Risk Review (Postponed): ${r2.title}`,
      description: `Revised review date for ${r2.clientName}. Original: ${originalDate.toLocaleDateString()}`,
      eventType: "Risk Review",
      startDate: newDate,
      endDate: new Date(newDate.getTime() + 60 * 60 * 1000),
      risk: r2._id,
      client: client2._id,
      manager: managerId,
      priority: "Medium",
      status: "Postponed",
      isPostponed: true,
      originalDate: originalDate,
      postponementReason: "Awaiting municipal surveyor site visit scheduled for Thursday.",
    });

    // Risk 3: Auto-Approved Proposal (24h Expiration Completed)
    const autoApprovedDate = new Date(now.getTime() - 26 * 60 * 60 * 1000);
    const r3 = await Risk.create({
      title: "Point-of-Sale Hardware Redundancy & Data Backup",
      client: client1._id,
      clientName: client1.companyName || client1.name,
      clientId: client1.clientId || "CLI-2026-0001",
      description:
        "Primary POS billing terminal experienced intermittent memory fault during evening sales shift.",
      category: "Technology",
      severity: "Low",
      riskScore: 28,
      financialImpact: "Risk of delayed order checkouts during rush hours.",
      financialImpactAmount: 20000,
      businessImpact: "Requires secondary offline billing tablet configuration.",
      recommendedMitigation:
        "Deploy synced cloud-backup tablet billing station with thermal Bluetooth printer.",
      assignedManager: managerId,
      managerName: managerName,
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      originalDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: "Approved",
      autoApprovalEligible: true,
      submittedForApprovalAt: new Date(now.getTime() - 50 * 60 * 60 * 1000),
      approvalDeadline: autoApprovedDate,
      approvalDecision: "Auto-Approved",
      isAutoApproved: true,
      decisionAt: autoApprovedDate,
      decisionNotes: "Auto-approved after 24 hours according to applicable approval policy.",
      mitigationPlan: {
        title: "Backup Offline POS Deployment",
        description: "Configure secondary iPad with offline local cache billing.",
        actionSteps: [
          "Install offline POS license on secondary executive tablet",
          "Run sync test with cloud database",
        ],
        expectedOutcome: "100% billing continuity even during internet downtime.",
        estimatedCost: 12000,
        timeline: "Completed",
        version: 1,
      },
    });

    await RiskAuditLog.create({
      risk: r3._id,
      riskId: r3.riskId,
      action: "AUTO_APPROVED_24H",
      performerName: "SYSTEM_SCHEDULER",
      performerRole: "system",
      previousStatus: "Pending Client Approval",
      newStatus: "Approved",
      version: 1,
      notes: "Auto-approved after 24 hours according to applicable approval policy.",
    });

    // Risk 4: Critical Severity (Excluded from 24h Auto-Approval by Policy)
    const r4 = await Risk.create({
      title: "Core Data Privacy & Client Information Security Review",
      client: client3._id,
      clientName: client3.companyName || client3.name,
      clientId: client3.clientId || "CLI-2026-0003",
      description:
        "Mandatory annual data protection and client payment credential handling security audit.",
      category: "Compliance",
      severity: "Critical",
      riskScore: 92,
      financialImpact: "Statutory non-compliance penalty risk.",
      financialImpactAmount: 500000,
      businessImpact: "Requires formal signoff from client chief legal counsel.",
      recommendedMitigation:
        "Enforce zero-trust JWT token lifecycle and multi-factor admin verification.",
      assignedManager: managerId,
      managerName: managerName,
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      originalDeadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: "Pending Client Approval",
      autoApprovalEligible: false,
      autoApprovalExcludedReason:
        "Critical severity requires mandatory manual executive approval.",
      submittedForApprovalAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      approvalDeadline: null,
      approvalDecision: "Pending",
      mitigationPlan: {
        title: "Enterprise Data Privacy & Security Hardening",
        description:
          "Conduct full vulnerability assessment, enforce TLS 1.3, and implement encrypted client data stores.",
        actionSteps: [
          "Third-party penetration testing and compliance audit",
          "Update privacy policy and client data authorization agreements",
        ],
        expectedOutcome: "Zero high-risk findings; compliance certificate awarded.",
        estimatedCost: 75000,
        timeline: "14 Days",
        version: 1,
      },
    });

    await CalendarEvent.create({
      title: `Meeting: Executive Security Briefing (${r4.title})`,
      description: `Critical compliance review with ${r4.clientName}.`,
      eventType: "Meeting",
      startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      risk: r4._id,
      client: client3._id,
      manager: managerId,
      priority: "Critical",
      status: "Upcoming",
    });

    console.log("[riskBootstrap] Successfully seeded 4 realistic risk workflows.");
  } catch (error) {
    console.error("[riskBootstrap] Error bootstrapping risk data:", error);
  }
}

module.exports = { ensureRiskData };
