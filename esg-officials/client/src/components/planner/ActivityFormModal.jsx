import React, { useContext, useEffect, useState } from "react";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import { toISTDateInput, toISTTimeInput, nowIST, formatISTDate, parseISTDateTime } from "../../utils/istDate";
import { Modal, Alert, btn, inputCls, labelCls, errorMessage } from "./plannerUi";

let optionsCache = null;
export async function loadPlannerOptions(force = false) {
  if (optionsCache && !force) return optionsCache;
  const res = await api.get("/planner/options");
  optionsCache = res.data;
  return optionsCache;
}

const todayKey = () => {
  const p = nowIST();
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/**
 * Create / edit a scheduled activity. All dates are entered and shown in IST.
 */
export default function ActivityFormModal({ activity = null, initialDate = "", defaultClientId = "", onClose, onSaved }) {
  const { user } = useContext(AuthContext);
  const isEdit = Boolean(activity);
  const [options, setOptions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState(() => ({
    title: activity?.title || "",
    description: activity?.description || "",
    activityType: activity?.activityType || "Scheduled Upload",
    priority: activity?.priority || "Medium",
    businessId: activity?.business?._id || "",
    clientId: activity?.client?._id || defaultClientId || "",
    assignedManager: activity?.assignedManager?._id || (user?.role === "manager" ? user._id || user.id : ""),
    scheduledDate: activity ? toISTDateInput(activity.scheduledAt) : initialDate || todayKey(),
    scheduledTime: activity ? toISTTimeInput(activity.scheduledAt) : "10:00",
    deadlineDate: activity ? toISTDateInput(activity.deadline) : "",
    deadlineTime: activity ? toISTTimeInput(activity.deadline) : "",
    escalationStartDate: activity?.escalationStartAt ? toISTDateInput(activity.escalationStartAt) : "",
    escalationStartTime: activity?.escalationStartAt ? toISTTimeInput(activity.escalationStartAt) : "",
    requiresClientApproval: Boolean(activity?.requiresClientApproval),
    visibleToClient: activity ? activity.visibleToClient !== false : true,
    reason: "",
  }));

  useEffect(() => {
    loadPlannerOptions()
      .then(setOptions)
      .catch((err) => setError(errorMessage(err, "Could not load managers, clients and businesses.")));
  }, []);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const preview = parseISTDateTime(form.scheduledDate, form.scheduledTime);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const fe = {};
    if (!form.title.trim()) fe.title = "Title is required.";
    if (!form.businessId && !form.clientId) fe.businessId = "Choose a business or a client.";
    if (!preview) fe.scheduledDate = "Choose a valid date and time.";
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description,
      activityType: form.activityType,
      priority: form.priority,
      businessId: form.businessId || null,
      clientId: form.clientId || null,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      deadlineDate: form.deadlineDate || "",
      deadlineTime: form.deadlineTime || "",
      escalationStartDate: form.escalationStartDate || "",
      escalationStartTime: form.escalationStartTime || "",
      requiresClientApproval: form.requiresClientApproval,
      visibleToClient: form.visibleToClient,
    };
    if (!isEdit || user?.role === "admin") payload.assignedManager = form.assignedManager || undefined;
    if (isEdit) payload.reason = form.reason;

    try {
      setSaving(true);
      const res = isEdit
        ? await api.put(`/planner/activities/${activity._id}`, payload)
        : await api.post("/planner/activities", payload);
      onSaved && onSaved(res.data.activity, res.data.message);
    } catch (err) {
      setError(errorMessage(err, "Failed to save the activity."));
      if (err.response?.data?.fields) setFieldErrors(err.response.data.fields);
    } finally {
      setSaving(false);
    }
  };

  const selectedBusiness = options?.businesses?.find((b) => b._id === form.businessId);
  const fieldError = (k) => fieldErrors[k] && <p className="text-[11px] text-red-600 mt-1">{fieldErrors[k]}</p>;

  return (
    <Modal
      title={isEdit ? `Edit ${activity.activityId || "activity"}` : "Schedule an activity"}
      subtitle="All dates and times are Asia/Kolkata (IST)"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="activity-form" className={btn.primary} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Schedule"}
          </button>
        </>
      }
    >
      <form id="activity-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pa-title">Task title</label>
            <input id="pa-title" className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. Diwali offer news upload" maxLength={200} />
            {fieldError("title")}
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-type">Type</label>
            <select id="pa-type" className={inputCls} value={form.activityType} onChange={set("activityType")}>
              {(options?.activityTypes || ["Scheduled Upload", "Business Activity", "Campaign", "Deadline", "Approval", "Meeting"]).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="pa-biz">Business</label>
            <select id="pa-biz" className={inputCls} value={form.businessId} onChange={set("businessId")} disabled={!options}>
              <option value="">— None —</option>
              {(options?.businesses || []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} · {b.city}
                </option>
              ))}
            </select>
            {selectedBusiness?.clientAccount && <p className="text-[11px] text-gray-500 mt-1">Linked client account will see this on their dashboard.</p>}
            {fieldError("businessId")}
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-client">Client account</label>
            <select id="pa-client" className={inputCls} value={form.clientId} onChange={set("clientId")} disabled={!options}>
              <option value="">— None / from business —</option>
              {(options?.clients || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls} htmlFor="pa-date">Scheduled date</label>
            <input id="pa-date" type="date" className={inputCls} value={form.scheduledDate} onChange={set("scheduledDate")} />
            {fieldError("scheduledDate")}
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-time">Time (IST)</label>
            <input id="pa-time" type="time" className={inputCls} value={form.scheduledTime} onChange={set("scheduledTime")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-dl">Deadline date</label>
            <input id="pa-dl" type="date" className={inputCls} value={form.deadlineDate} onChange={set("deadlineDate")} />
            {fieldError("deadlineDate")}
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-dlt">Deadline time</label>
            <input id="pa-dlt" type="time" className={inputCls} value={form.deadlineTime} onChange={set("deadlineTime")} />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 -mt-2">
          {preview ? (
            <>
              Calendar will show <strong className="text-gray-800">{form.activityType}: {formatISTDate(preview)}</strong>. Reminder goes out{" "}
              {options?.reminderLeadHours || 24}h before; escalation {options?.escalationHours || 24}h after the deadline if still incomplete. Leave the
              deadline empty to use the scheduled time.
            </>
          ) : (
            "Pick a date and time."
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="pa-mgr">Assigned manager</label>
            <select
              id="pa-mgr"
              className={inputCls}
              value={form.assignedManager}
              onChange={set("assignedManager")}
              disabled={!options || (isEdit && user?.role !== "admin")}
            >
              <option value="">{user?.role === "manager" ? "Me" : "— Select —"}</option>
              {(options?.managers || []).map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
            {isEdit && user?.role !== "admin" && <p className="text-[11px] text-gray-500 mt-1">Use "Reassign" in the task to change the manager.</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-pri">Priority</label>
            <select id="pa-pri" className={inputCls} value={form.priority} onChange={set("priority")}>
              {(options?.priorities || ["Low", "Medium", "High", "Urgent"]).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pa-esc">Escalation start (optional)</label>
            <div className="flex gap-2">
              <input id="pa-esc" type="date" className={inputCls} value={form.escalationStartDate} onChange={set("escalationStartDate")} />
              <input aria-label="Escalation start time" type="time" className={`${inputCls} max-w-[110px]`} value={form.escalationStartTime} onChange={set("escalationStartTime")} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="pa-desc">Notes / instructions</label>
          <textarea id="pa-desc" rows={3} className={inputCls} value={form.description} onChange={set("description")} maxLength={5000} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-gray-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.visibleToClient} onChange={set("visibleToClient")} className="w-4 h-4" />
            Show on the client's dashboard
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.requiresClientApproval} onChange={set("requiresClientApproval")} className="w-4 h-4" />
            Requires client approval before completion
          </label>
        </div>

        {isEdit && (
          <div>
            <label className={labelCls} htmlFor="pa-reason">Reason for change (recorded in the audit trail)</label>
            <input id="pa-reason" className={inputCls} value={form.reason} onChange={set("reason")} maxLength={500} />
          </div>
        )}
      </form>
    </Modal>
  );
}
