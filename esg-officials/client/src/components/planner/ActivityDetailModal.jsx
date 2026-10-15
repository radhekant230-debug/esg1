import React, { useContext, useEffect, useState } from "react";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import { formatISTDateTime, toISTDateInput, toISTTimeInput } from "../../utils/istDate";
import ActivityFormModal, { loadPlannerOptions } from "./ActivityFormModal";
import { Modal, Alert, StateBadge, StatusBadge, btn, inputCls, labelCls, errorMessage, Spinner } from "./plannerUi";

const JOB_STATUS = {
  pending: "bg-slate-100 text-slate-700",
  processing: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  accepted: "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-100 text-emerald-700",
  read: "bg-emerald-200 text-emerald-800",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-600",
  cancelled: "bg-gray-100 text-gray-500",
};
export const jobStatusLabel = (j) =>
  j.status === "accepted" ? "Accepted by WhatsApp (awaiting delivery receipt)" : j.status === "sent" && j.channel === "in_app" ? "Delivered in-app" : j.status;

export function JobStatusChip({ job }) {
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${JOB_STATUS[job.status] || "bg-gray-100"}`}>{jobStatusLabel(job)}</span>;
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-900 break-words">{children}</dd>
    </div>
  );
}

/**
 * Full details + every action allowed for the viewer's role.
 */
export default function ActivityDetailModal({ activityId, onClose, onChanged }) {
  const { user } = useContext(AuthContext);
  const isClient = user?.role === "client";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(""); // reschedule | cancel | assign | resolve | reject | audit
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [managers, setManagers] = useState([]);
  const [audit, setAudit] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/planner/activities/${activityId}`);
      setData(res.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load the activity."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const a = data?.activity;

  const act = async (method, path, body, success) => {
    try {
      setBusy(true);
      setError("");
      const res = await api[method](`/planner/activities/${activityId}${path}`, body);
      setNotice(res.data?.message || success);
      setPanel("");
      await load();
      onChanged && onChanged();
    } catch (err) {
      setError(errorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  const openPanel = async (name) => {
    setError("");
    setNotice("");
    if (name === panel) return setPanel("");
    setPanel(name);
    if (name === "reschedule" || name === "resolve") {
      setForm({
        scheduledDate: toISTDateInput(a.scheduledAt),
        scheduledTime: toISTTimeInput(a.scheduledAt),
        // Blank deadline = keep the same gap between scheduled time and deadline
        deadlineDate: "",
        deadlineTime: "",
        reason: "",
        resolution: "resumed",
        managerId: "",
        notes: "",
      });
    } else setForm({ reason: "", notes: "", managerId: "" });
    if ((name === "assign" || name === "resolve") && !managers.length) {
      try {
        const opts = await loadPlannerOptions();
        setManagers(opts.managers || []);
      } catch (_) {}
    }
    if (name === "audit" && !audit) {
      try {
        const res = await api.get(`/planner/activities/${activityId}/audit`);
        setAudit(res.data.logs || []);
      } catch (err) {
        setError(errorMessage(err, "Failed to load the audit trail."));
      }
    }
  };

  const f = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));
  const terminal = a && ["Completed", "Cancelled"].includes(a.status);
  const escalated = a?.status === "Escalated";
  const canApprove = a && a.status === "Pending Approval" && (isClient || user?.role === "admin");

  if (editing && a) {
    return (
      <ActivityFormModal
        activity={a}
        onClose={() => setEditing(false)}
        onSaved={(_, msg) => {
          setEditing(false);
          setNotice(msg || "Saved.");
          load();
          onChanged && onChanged();
        }}
      />
    );
  }

  const nextStatuses = !a || isClient
    ? []
    : {
        Scheduled: ["In Progress", a.requiresClientApproval ? "Pending Approval" : "Completed"],
        "In Progress": [a.requiresClientApproval ? "Pending Approval" : "Completed"],
        "Pending Approval": ["In Progress", ...(user?.role === "admin" ? ["Completed"] : [])],
      }[a.status] || [];

  return (
    <Modal
      title={a ? `${a.activityType}: ${a.scheduledDateLabel}` : "Activity"}
      subtitle={a ? `${a.activityId || ""} · ${a.title}` : ""}
      onClose={onClose}
      size="max-w-3xl"
      footer={
        a && (
          <>
            {!isClient && !terminal && !escalated && (
              <>
                <button className={btn.secondary} onClick={() => setEditing(true)}>Edit</button>
                <button className={btn.secondary} onClick={() => openPanel("reschedule")}>Reschedule</button>
                <button className={btn.secondary} onClick={() => openPanel("assign")}>Reassign</button>
                <button className={btn.secondary} onClick={() => openPanel("cancel")}>Cancel task</button>
              </>
            )}
            {!isClient && escalated && (
              <>
                {!a.escalation?.current?.acknowledgedAt && (
                  <button className={btn.secondary} disabled={busy} onClick={() => act("patch", "/escalation/acknowledge", {}, "Acknowledged.")}>
                    Acknowledge
                  </button>
                )}
                <button className={btn.primary} onClick={() => openPanel("resolve")}>Resolve escalation</button>
              </>
            )}
            {nextStatuses.map((s) => (
              <button key={s} className={s === "Completed" ? btn.primary : btn.secondary} disabled={busy} onClick={() => act("patch", "/status", { status: s }, `Marked ${s}.`)}>
                Mark {s}
              </button>
            ))}
            {canApprove && (
              <>
                <button className={btn.secondary} onClick={() => openPanel("reject")}>Request changes</button>
                <button className={btn.primary} disabled={busy} onClick={() => act("patch", "/approval", { decision: "Approved" }, "Approved.")}>
                  Approve
                </button>
              </>
            )}
          </>
        )
      }
    >
      {loading && !a ? (
        <Spinner />
      ) : !a ? (
        <Alert tone="error">{error || "Not found."}</Alert>
      ) : (
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}

          <div className="flex flex-wrap items-center gap-2">
            <StateBadge state={a.displayState} />
            <StatusBadge status={a.status} />
            {a.priority && <span className="text-[11px] font-bold text-gray-500">Priority: {a.priority}</span>}
          </div>

          <dl className="bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
            <Row label="Task">{a.title}</Row>
            <Row label="Scheduled">{a.scheduledDateLabel}, {a.scheduledTimeLabel} IST</Row>
            <Row label="Deadline">{a.deadlineLabel}</Row>
            <Row label="Client / business">{a.businessName || a.client?.companyName || a.client?.name || "—"}</Row>
            <Row label="Assigned manager">{a.assignedManager?.name || "—"}</Row>
            <Row label="Status">{a.status}{a.isOverdue && !terminal ? " (overdue)" : ""}</Row>
            {a.requiresClientApproval && (
              <Row label="Client approval">
                {a.approval?.decision || "Not requested yet"}
                {a.approval?.notes ? ` — ${a.approval.notes}` : ""}
              </Row>
            )}
            {!isClient && a.reminder && (
              <Row label="Reminder">
                {a.reminder.dueLabel || "—"} · {a.reminder.status}
                {a.reminder.late ? " (sent immediately — scheduled less than 24h ahead)" : ""}
              </Row>
            )}
            {!isClient && a.escalationDueLabel && <Row label="Escalates at">{a.escalationDueLabel} if still incomplete</Row>}
            {a.description && <Row label="Notes">{a.description}</Row>}
            {a.cancelReason && <Row label="Cancel reason">{a.cancelReason}</Row>}
          </dl>

          {/* Action panels */}
          {panel === "reschedule" && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-800">Reschedule (IST). Pending reminders move with the new date. Leave the deadline blank to keep the same gap (currently {a.deadlineLabel}).</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input aria-label="New date" type="date" className={inputCls} value={form.scheduledDate} onChange={f("scheduledDate")} />
                <input aria-label="New time" type="time" className={inputCls} value={form.scheduledTime} onChange={f("scheduledTime")} />
                <input aria-label="New deadline date" type="date" className={inputCls} value={form.deadlineDate} onChange={f("deadlineDate")} />
                <input aria-label="New deadline time" type="time" className={inputCls} value={form.deadlineTime} onChange={f("deadlineTime")} />
              </div>
              <input aria-label="Reason" className={inputCls} placeholder="Reason (optional)" value={form.reason} onChange={f("reason")} />
              <div className="flex justify-end">
                <button className={btn.primary} disabled={busy} onClick={() => act("patch", "/reschedule", form, "Rescheduled.")}>Save new date</button>
              </div>
            </div>
          )}

          {panel === "cancel" && (
            <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 space-y-3">
              <label className={labelCls} htmlFor="cancel-reason">Why is this cancelled?</label>
              <input id="cancel-reason" className={inputCls} value={form.reason} onChange={f("reason")} />
              <div className="flex justify-end">
                <button className={btn.danger} disabled={busy || !form.reason?.trim()} onClick={() => act("patch", "/cancel", { reason: form.reason }, "Cancelled.")}>
                  Cancel task
                </button>
              </div>
            </div>
          )}

          {panel === "assign" && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <label className={labelCls} htmlFor="assign-mgr">Assign to</label>
              <select id="assign-mgr" className={inputCls} value={form.managerId} onChange={f("managerId")}>
                <option value="">— Select manager —</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <div className="flex justify-end">
                <button className={btn.primary} disabled={busy || !form.managerId} onClick={() => act("patch", "/assign", { managerId: form.managerId }, "Reassigned.")}>
                  Reassign
                </button>
              </div>
            </div>
          )}

          {panel === "resolve" && (
            <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-4 space-y-3">
              <label className={labelCls} htmlFor="resolution">Resolution</label>
              <select id="resolution" className={inputCls} value={form.resolution} onChange={f("resolution")}>
                <option value="resumed">Resume work (keeps deadline; will not re-escalate for it)</option>
                <option value="rescheduled">Reschedule to a new date</option>
                <option value="reassigned">Reassign to another manager</option>
                {!a.requiresClientApproval && <option value="completed">Mark completed</option>}
                <option value="cancelled">Cancel task</option>
              </select>
              {form.resolution === "reassigned" && (
                <select aria-label="Manager" className={inputCls} value={form.managerId} onChange={f("managerId")}>
                  <option value="">— Select manager —</option>
                  {managers.map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              )}
              {form.resolution === "rescheduled" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input aria-label="New date" type="date" className={inputCls} value={form.scheduledDate} onChange={f("scheduledDate")} />
                  <input aria-label="New time" type="time" className={inputCls} value={form.scheduledTime} onChange={f("scheduledTime")} />
                  <input aria-label="New deadline date" type="date" className={inputCls} value={form.deadlineDate} onChange={f("deadlineDate")} />
                  <input aria-label="New deadline time" type="time" className={inputCls} value={form.deadlineTime} onChange={f("deadlineTime")} />
                </div>
              )}
              <input aria-label="Notes" className={inputCls} placeholder="Notes (required to cancel)" value={form.notes} onChange={f("notes")} />
              <div className="flex justify-end">
                <button
                  className={btn.primary}
                  disabled={busy}
                  onClick={() => {
                    const body = { resolution: form.resolution, notes: form.notes };
                    if (form.resolution === "reassigned") body.managerId = form.managerId;
                    if (form.resolution === "rescheduled") Object.assign(body, {
                      scheduledDate: form.scheduledDate,
                      scheduledTime: form.scheduledTime,
                      deadlineDate: form.deadlineDate,
                      deadlineTime: form.deadlineTime,
                    });
                    act("patch", "/escalation/resolve", body, "Resolved.");
                  }}
                >
                  Resolve
                </button>
              </div>
            </div>
          )}

          {panel === "reject" && (
            <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
              <label className={labelCls} htmlFor="reject-notes">What needs to change?</label>
              <textarea id="reject-notes" rows={3} className={inputCls} value={form.notes} onChange={f("notes")} />
              <div className="flex justify-end">
                <button className={btn.primary} disabled={busy || !form.notes?.trim()} onClick={() => act("patch", "/approval", { decision: "Rejected", notes: form.notes }, "Sent back.")}>
                  Send back with notes
                </button>
              </div>
            </div>
          )}

          {/* Escalation history */}
          {!isClient && a.escalation?.events?.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">Escalation history</h4>
              <ul className="space-y-2">
                {a.escalation.events.map((ev) => (
                  <li key={ev._id} className="text-xs border border-rose-100 bg-rose-50/40 rounded-lg p-2.5">
                    <strong>Escalated {formatISTDateTime(ev.escalatedAt)}</strong> — {ev.reason}
                    {ev.acknowledgedAt && <span className="block text-gray-600">Acknowledged {formatISTDateTime(ev.acknowledgedAt)}</span>}
                    {ev.resolvedAt && (
                      <span className="block text-gray-600">
                        Resolved ({ev.resolution}) {formatISTDateTime(ev.resolvedAt)}
                        {ev.resolutionNotes ? ` — ${ev.resolutionNotes}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notification delivery log */}
          {!isClient && data?.notifications && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">Reminders & notifications</h4>
              {data.notifications.length === 0 ? (
                <p className="text-xs text-gray-500">No notifications yet.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600 text-left">
                      <tr>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Channel</th>
                        <th className="px-3 py-2">To</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.notifications.map((j) => (
                        <tr key={j._id}>
                          <td className="px-3 py-2">{j.kind.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2">{j.channel === "in_app" ? "In-app" : "WhatsApp"}</td>
                          <td className="px-3 py-2">{j.recipient?.name || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatISTDateTime(j.dueAt)}</td>
                          <td className="px-3 py-2">
                            <JobStatusChip job={j} />
                            {(j.lastError || j.skipReason || j.cancelReason) && (
                              <span className="block text-[11px] text-gray-500 mt-0.5">{j.lastError || j.skipReason || j.cancelReason}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{j.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!isClient && (
            <div>
              <button className={btn.ghost} onClick={() => openPanel("audit")}>
                {panel === "audit" ? "Hide" : "Show"} audit trail
              </button>
              {panel === "audit" && audit && (
                <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto text-[11px] text-gray-700">
                  {audit.map((l) => (
                    <li key={l._id} className="border-b border-gray-100 pb-1">
                      <span className="font-mono text-gray-500">{formatISTDateTime(l.createdAt)}</span> · <strong>{l.action}</strong> · {l.actorName}
                      {l.metadata?.error ? ` · ${l.metadata.error}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
