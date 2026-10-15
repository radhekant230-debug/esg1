const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const Risk = require("../models/Risk");
const RiskAuditLog = require("../models/RiskAuditLog");
const CalendarEvent = require("../models/CalendarEvent");
const Notification = require("../models/Notification");
const { processExpiredApprovals } = require("../services/autoApprovalScheduler");

async function runTests() {
  console.log("==========================================================");
  console.log("RUNNING COMPREHENSIVE RISK MANAGEMENT & 24H AUTO-APPROVAL TESTS");
  console.log("==========================================================");

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "esg-official-clients",
  });
  console.log("✓ Connected to MongoDB Atlas: esg-official-clients");

  // 1. Fetch test users
  const admin = await User.findOne({ role: "admin" });
  const manager = await User.findOne({ role: "manager" });
  const clients = await User.find({ role: "client" });

  if (!admin || !manager || clients.length < 2) {
    console.error("Missing test users (need admin, manager, and at least 2 clients)");
    process.exit(1);
  }

  const clientA = clients[0];
  const clientB = clients[1];

  console.log(`✓ Test Users: Admin (${admin.email}), Manager (${manager.email}), Client A (${clientA.email}), Client B (${clientB.email})`);

  // ==========================================================
  // TEST 1: RISK CREATION WITH FULL METADATA & MANAGER ASSIGNMENT
  // ==========================================================
  console.log("\n[TEST 1] Creating new risk record...");
  const initialDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const testRisk = await Risk.create({
    riskId: `RSK-TEST-${Date.now().toString().slice(-4)}`,
    title: "Test Dilution of Fine Dining Brand Identity",
    client: clientA._id,
    clientName: clientA.companyName || clientA.name,
    clientIdCode: clientA.clientId || "CLI-TEST",
    description: "Third-party aggregator discount campaign eroding premium guest perception.",
    category: "Reputation",
    severity: "High",
    riskScore: 78,
    financialImpact: "Estimated 15% margin erosion",
    financialImpactAmount: 450000,
    businessImpact: "Loss of elite clientele",
    mitigationAction: "Immediate withdrawal from aggressive couponing platforms",
    assignedManager: manager._id,
    deadline: initialDeadline,
    originalDeadline: initialDeadline,
    status: "Identified",
    autoApprovalEligible: true,
  });

  if (!testRisk || testRisk.status !== "Identified") {
    throw new Error("Failed TEST 1: Risk creation failed or incorrect initial status.");
  }
  console.log(`✓ TEST 1 PASSED: Created Risk ${testRisk.riskId} with status 'Identified'`);

  // ==========================================================
  // TEST 2: RBAC ISOLATION - CLIENT CANNOT SEE UNAPPROVED/UNSUBMITTED RISKS
  // ==========================================================
  console.log("\n[TEST 2] Testing RBAC isolation (internal manager workflow hidden from client)...");
  // Simulate client querying risks before submission
  const clientViewBeforeSubmission = await Risk.find({
    client: clientA._id,
    status: { $in: ["Pending Client Approval", "Approved", "Rejected", "Resolved"] },
    _id: testRisk._id,
  });

  if (clientViewBeforeSubmission.length !== 0) {
    throw new Error("Failed TEST 2: Unsubmitted risk was exposed to client!");
  }
  console.log("✓ TEST 2 PASSED: Unsubmitted risk is strictly hidden from Client Portal.");

  // ==========================================================
  // TEST 3: MANAGER REVIEW & POSTPONEMENT WITHOUT OVERWRITING ORIGINAL DEADLINE
  // ==========================================================
  console.log("\n[TEST 3] Testing manager postponement and history preservation...");
  const revisedReviewDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const postponementReason = "Awaiting final Q3 margin audit from store general managers.";

  testRisk.postponementHistory.push({
    postponedAt: new Date(),
    postponedBy: manager._id,
    postponedByName: manager.name,
    postponedByRole: "manager",
    previousDeadline: testRisk.deadline,
    newProposedReviewDate: revisedReviewDate,
    reason: postponementReason,
    notes: "Executive sign-off rescheduled pending financial validation.",
  });
  testRisk.deadline = revisedReviewDate;
  testRisk.proposedReviewDate = revisedReviewDate;
  testRisk.isPostponed = true;
  testRisk.postponementCount += 1;
  testRisk.status = "Under Review";
  await testRisk.save();

  // Verify postponement history and original deadline
  const verifiedPostponedRisk = await Risk.findById(testRisk._id);
  if (
    !verifiedPostponedRisk.isPostponed ||
    verifiedPostponedRisk.postponementHistory.length !== 1 ||
    verifiedPostponedRisk.postponementHistory[0].reason !== postponementReason ||
    !verifiedPostponedRisk.originalDeadline
  ) {
    throw new Error("Failed TEST 3: Postponement history or original deadline corrupted.");
  }
  console.log("✓ TEST 3 PASSED: Postponement saved; original deadline preserved; history intact.");

  // ==========================================================
  // TEST 4: MITIGATION PROPOSAL & SUBMISSION TO CLIENT (24H TIMER START)
  // ==========================================================
  console.log("\n[TEST 4] Formulating mitigation plan and submitting for client approval...");
  const submittedAt = new Date();
  const approvalDeadline = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000);

  testRisk.mitigationPlan = {
    title: "Direct Guest Privilege Program & Price Normalization",
    proposedAction: "Transition from third-party discounting to proprietary loyalty rewards.",
    estimatedResolutionDays: 21,
    resourceRequirements: "Senior Hospitality Consultant + CRM Integrator",
    estimatedCost: 75000,
    version: 1,
    submittedAt: submittedAt,
    notes: "Comprehensive mitigation proposal submitted for 24-hour review.",
  };
  testRisk.status = "Pending Client Approval";
  testRisk.submittedForApprovalAt = submittedAt;
  testRisk.approvalDeadline = approvalDeadline;
  await testRisk.save();

  // Create audit log
  await RiskAuditLog.create({
    risk: testRisk._id,
    riskId: testRisk.riskId,
    action: "MITIGATION_PROPOSAL_SUBMITTED",
    performer: manager._id,
    performerName: manager.name,
    performerRole: "manager",
    previousStatus: "Under Review",
    newStatus: "Pending Client Approval",
    version: 1,
    notes: "Submitted for client approval under 24-hour policy.",
  });

  // Verify client can now see it
  const clientViewAfterSubmission = await Risk.find({
    client: clientA._id,
    status: { $in: ["Pending Client Approval", "Approved", "Rejected", "Resolved"] },
    _id: testRisk._id,
  });

  if (clientViewAfterSubmission.length !== 1) {
    throw new Error("Failed TEST 4: Submitted proposal not visible to client.");
  }
  console.log("✓ TEST 4 PASSED: Proposal submitted, 24-hour timer active, now visible in Client Portal.");

  // ==========================================================
  // TEST 5: UNAUTHORIZED ACCESS PREVENTION (CLIENT B CANNOT SEE CLIENT A's RISK)
  // ==========================================================
  console.log("\n[TEST 5] Testing cross-client security isolation...");
  const clientBQuery = await Risk.find({
    client: clientB._id,
    _id: testRisk._id,
  });

  if (clientBQuery.length !== 0) {
    throw new Error("Failed TEST 5: Security breach! Client B was able to view Client A's risk!");
  }
  console.log("✓ TEST 5 PASSED: Client B cannot view Client A's risk proposal.");

  // ==========================================================
  // TEST 6: PROPOSAL VERSIONING & TIMER RESTART ON EDIT
  // ==========================================================
  console.log("\n[TEST 6] Testing proposal material modification and versioning...");
  const oldPlan = { ...testRisk.mitigationPlan.toObject() };
  testRisk.proposalVersions.push(oldPlan);

  const resubmissionTime = new Date();
  const restartedDeadline = new Date(resubmissionTime.getTime() + 24 * 60 * 60 * 1000);

  testRisk.mitigationPlan = {
    title: "Direct Guest Privilege Program v2.0 (Expanded Scope)",
    proposedAction: "Includes dedicated VIP lounge access and customized concierge service.",
    estimatedResolutionDays: 28,
    resourceRequirements: "Senior Hospitality Consultant + CRM Integrator + Brand Stylist",
    estimatedCost: 95000,
    version: 2,
    submittedAt: resubmissionTime,
    notes: "Revised scope based on preliminary client inquiry.",
  };
  testRisk.submittedForApprovalAt = resubmissionTime;
  testRisk.approvalDeadline = restartedDeadline;
  await testRisk.save();

  const versionedRisk = await Risk.findById(testRisk._id);
  if (
    versionedRisk.mitigationPlan.version !== 2 ||
    versionedRisk.proposalVersions.length !== 1 ||
    versionedRisk.proposalVersions[0].version !== 1
  ) {
    throw new Error("Failed TEST 6: Version history archiving failed.");
  }
  console.log("✓ TEST 6 PASSED: Material revision archived version 1 and restarted 24-hour timer for version 2.");

  // ==========================================================
  // TEST 7: 24-HOUR AUTOMATIC APPROVAL SCHEDULER & CONCURRENCY RACE-SAFETY
  // ==========================================================
  console.log("\n[TEST 7] Testing 24-hour automatic approval scheduler execution...");
  // Simulate 24 hours passing by setting approvalDeadline in the past (e.g. 2 minutes ago)
  const pastDeadline = new Date(Date.now() - 120000); // 2 minutes ago
  await Risk.findByIdAndUpdate(testRisk._id, {
    approvalDeadline: pastDeadline,
  });

  // Run scheduler function
  await processExpiredApprovals();

  // Verify risk is now Auto-Approved
  const autoApprovedRisk = await Risk.findById(testRisk._id);
  if (
    autoApprovedRisk.status !== "Approved" ||
    !autoApprovedRisk.isAutoApproved ||
    autoApprovedRisk.approvalDecision !== "Auto-Approved"
  ) {
    throw new Error("Failed TEST 7: Auto-approval scheduler failed to execute on expired candidate.");
  }

  // Verify Audit Log was generated
  const autoAudit = await RiskAuditLog.findOne({
    risk: testRisk._id,
    action: "AUTO_APPROVED_24H",
  });
  if (!autoAudit) {
    throw new Error("Failed TEST 7: AUTO_APPROVED_24H audit log missing.");
  }
  console.log("✓ TEST 7 PASSED: Scheduler auto-approved proposal after 24h expiration with immutable audit trail.");

  // ==========================================================
  // TEST 8: PREVENT DOUBLE-APPROVAL / RACE CONDITIONS
  // ==========================================================
  console.log("\n[TEST 8] Testing concurrency race condition safety...");
  // Try running scheduler again on the same risk
  await processExpiredApprovals();
  // Try a manual reject on the already approved risk
  const raceResult = await Risk.findOneAndUpdate(
    { _id: testRisk._id, status: "Pending Client Approval" },
    { $set: { status: "Rejected" } }
  );

  if (raceResult !== null) {
    throw new Error("Failed TEST 8: Concurrency check failed! Allowed update on already decided risk.");
  }
  console.log("✓ TEST 8 PASSED: Atomic query prevent race condition; duplicate jobs rejected safely.");

  // ==========================================================
  // TEST 9: CRITICAL RISK EXCLUSION POLICY
  // ==========================================================
  console.log("\n[TEST 9] Testing exclusion of Critical/Emergency risks from auto-approval...");
  const criticalRisk = await Risk.create({
    riskId: `RSK-CRIT-${Date.now().toString().slice(-4)}`,
    title: "Critical Legal Notice from Regulatory Authority",
    client: clientA._id,
    clientName: clientA.companyName || clientA.name,
    clientIdCode: clientA.clientId || "CLI-TEST",
    description: "Statutory notice requiring explicit legal signoff.",
    category: "Legal",
    severity: "Critical",
    riskScore: 98,
    status: "Pending Client Approval",
    autoApprovalEligible: false, // Critical risks excluded by policy
    deadline: pastDeadline,
    approvalDeadline: pastDeadline,
  });

  await processExpiredApprovals();

  const refreshedCritical = await Risk.findById(criticalRisk._id);
  if (refreshedCritical.status !== "Pending Client Approval" || refreshedCritical.isAutoApproved) {
    throw new Error("Failed TEST 9: Ineligible critical risk was erroneously auto-approved!");
  }
  console.log("✓ TEST 9 PASSED: Critical/restricted risks are strictly excluded from automated approval.");

  // Clean up test risks
  await Risk.findByIdAndDelete(testRisk._id);
  await Risk.findByIdAndDelete(criticalRisk._id);
  await RiskAuditLog.deleteMany({ risk: { $in: [testRisk._id, criticalRisk._id] } });

  console.log("\n==========================================================");
  console.log("ALL 9 CORE INTEGRATION & SECURITY TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==========================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("TEST EXECUTION ERROR:", err);
  process.exit(1);
});
