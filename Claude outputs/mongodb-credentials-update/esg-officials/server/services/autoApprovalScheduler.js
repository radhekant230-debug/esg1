const Risk = require("../models/Risk");
const RiskAuditLog = require("../models/RiskAuditLog");
const Notification = require("../models/Notification");
const CalendarEvent = require("../models/CalendarEvent");

let intervalId = null;
let isProcessing = false;

/**
 * Checks and automatically approves eligible mitigation proposals that have passed their 24-hour deadline.
 * Uses atomic findOneAndUpdate to prevent race conditions with manual decisions.
 */
async function processExpiredApprovals() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();

    // Query candidates that are pending approval and past deadline
    const expiredCandidates = await Risk.find({
      status: "Pending Client Approval",
      autoApprovalEligible: true,
      approvalDeadline: { $lte: now },
    });

    for (const candidate of expiredCandidates) {
      try {
        // Concurrency-safe atomic update
        const updatedRisk = await Risk.findOneAndUpdate(
          {
            _id: candidate._id,
            status: "Pending Client Approval",
            autoApprovalEligible: true,
            approvalDeadline: { $lte: now },
          },
          {
            $set: {
              status: "Approved",
              approvalDecision: "Auto-Approved",
              isAutoApproved: true,
              decisionAt: now,
              decisionNotes:
                "Auto-approved after 24 hours according to applicable approval policy.",
            },
          },
          { returnDocument: "after" }
        );

        if (!updatedRisk) {
          // Candidate was either already manually approved/rejected or modified concurrently
          continue;
        }

        console.log(
          `[AutoApprovalScheduler] Successfully auto-approved Risk ${updatedRisk.riskId} ("${updatedRisk.title}")`
        );

        // 1. Audit Log
        await RiskAuditLog.create({
          risk: updatedRisk._id,
          riskId: updatedRisk.riskId,
          action: "AUTO_APPROVED_24H",
          performerName: "SYSTEM_SCHEDULER",
          performerRole: "system",
          previousStatus: "Pending Client Approval",
          newStatus: "Approved",
          version: updatedRisk.mitigationPlan?.version || 1,
          notes:
            "Risk mitigation proposal was automatically approved after expiration of the 24-hour review window.",
          metadata: {
            submittedAt: updatedRisk.submittedForApprovalAt,
            deadline: updatedRisk.approvalDeadline,
            executedAt: now,
          },
        });

        // 2. Client Notification
        if (updatedRisk.client) {
          await Notification.create({
            recipient: updatedRisk.client,
            title: "Mitigation Plan Auto-Approved",
            message: `The proposed risk mitigation plan for "${updatedRisk.title}" has been automatically approved according to the 24-hour approval policy.`,
            type: "approval",
            relatedId: updatedRisk._id,
            link: "/client/dashboard?tab=risks",
          });
        }

        // 3. Manager Notification
        if (updatedRisk.assignedManager) {
          await Notification.create({
            recipient: updatedRisk.assignedManager,
            title: "Mitigation Plan Auto-Approved (24h)",
            message: `Mitigation proposal for "${updatedRisk.title}" (Client: ${updatedRisk.clientName}) was automatically approved after 24 hours.`,
            type: "approval",
            relatedId: updatedRisk._id,
            link: `/risks/${updatedRisk._id}`,
          });
        }

        // 4. Update linked Calendar Events
        await CalendarEvent.updateMany(
          { risk: updatedRisk._id, eventType: "Approval Deadline" },
          { $set: { status: "Completed" } }
        );
      } catch (itemErr) {
        console.error(
          `[AutoApprovalScheduler] Error processing risk ${candidate._id}:`,
          itemErr
        );
      }
    }
  } catch (err) {
    console.error("[AutoApprovalScheduler] Scheduler error:", err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts the background auto-approval scheduler.
 * Runs check every 20 seconds.
 */
function startAutoApprovalScheduler(intervalMs = 20000) {
  if (intervalId) return;
  console.log(
    `[AutoApprovalScheduler] Initializing 24-hour auto-approval background service (interval: ${intervalMs}ms)`
  );
  // Run once immediately on start
  processExpiredApprovals();
  intervalId = setInterval(processExpiredApprovals, intervalMs);
}

function stopAutoApprovalScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[AutoApprovalScheduler] Service stopped.");
  }
}

module.exports = {
  startAutoApprovalScheduler,
  stopAutoApprovalScheduler,
  processExpiredApprovals,
};
