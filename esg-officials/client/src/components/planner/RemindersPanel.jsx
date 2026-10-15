import React, { useCallback, useContext, useEffect, useState } from "react";
import { FaWhatsapp, FaSyncAlt } from "react-icons/fa";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import { formatISTDateTime } from "../../utils/istDate";
import ActivityDetailModal, { JobStatusChip } from "./ActivityDetailModal";
import { Card, Alert, Spinner, EmptyState, btn, inputCls, labelCls, errorMessage } from "./plannerUi";

/** Integration status banner: tells the truth about WhatsApp and the scheduler. */
export function IntegrationStatus({ status, onRunNow, running }) {
  if (!status) return null;
  const wa = status.whatsapp;
  const sch = status.scheduler;
  return (
    <div className="space-y-2">
      {!wa.configured ? (
        <Alert tone="warn" title="WhatsApp notifications are not configured">
          Missing on the server: {wa.missing.join(", ")}. Reminders and escalations are still delivered as in-app notifications. See the deployment
          guide for the required WhatsApp Cloud API variables and approved templates.
        </Alert>
      ) : (
        <Alert tone="success" title="WhatsApp Cloud API configured">
          Template “{wa.templates.reminder}”{wa.templates.escalation ? ` and “${wa.templates.escalation}”` : ""} ({wa.language}).{" "}
          {wa.webhookConfigured
            ? "Delivery receipts are received through the webhook."
            : "Webhook not configured — messages show as “accepted” until a delivery receipt arrives."}
        </Alert>
      )}
      {wa.configured && wa.warnings?.length > 0 && (
        <Alert tone="info">
          <ul className="list-disc pl-4">
            {wa.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      <Alert tone={sch.healthy ? "info" : "warn"} title={sch.healthy ? "Reminder scheduler is running" : "Reminder scheduler has not run recently"}>
        Last run: {sch.lastRunAt ? `${formatISTDateTime(sch.lastRunAt)} (${sch.lastRunSource})` : "never"}
        {sch.lastError ? ` · Last error: ${sch.lastError}` : ""}. Reminders go out {status.rules.reminderLeadHours}h before the scheduled time;
        escalations {status.rules.escalationHours}h after the deadline.
        {!sch.healthy && " If the server sleeps (e.g. Render free plan), configure the cron trigger described in the deployment guide."}
        {onRunNow && (
          <button type="button" className={`${btn.ghost} ml-2`} onClick={onRunNow} disabled={running}>
            <FaSyncAlt className={running ? "animate-spin" : ""} /> Run now
          </button>
        )}
      </Alert>
    </div>
  );
}

function NotificationSettingsCard() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ whatsappNumber: "", whatsapp: false, uploadReminders: true, escalations: true });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [canOtp, setCanOtp] = useState(false);

  const load = async () => {
    const res = await api.get("/planner/settings/notifications");
    setSettings(res.data.settings);
    setCanOtp(Boolean(res.data.whatsapp?.canSendOtp));
    setForm({
      whatsappNumber: res.data.settings.whatsappNumber || "",
      whatsapp: res.data.settings.notificationPreferences.whatsapp,
      uploadReminders: res.data.settings.notificationPreferences.uploadReminders,
      escalations: res.data.settings.notificationPreferences.escalations,
    });
  };

  useEffect(() => {
    load().catch((err) => setMsg({ tone: "error", text: errorMessage(err, "Failed to load settings.") }));
  }, []);

  const run = async (fn) => {
    try {
      setBusy(true);
      setMsg(null);
      const text = await fn();
      setMsg({ tone: "success", text });
      await load();
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err, "Request failed.") });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const res = await api.put("/planner/settings/notifications", {
        whatsappNumber: form.whatsappNumber,
        notificationPreferences: { whatsapp: form.whatsapp, uploadReminders: form.uploadReminders, escalations: form.escalations },
      });
      return res.data.message;
    });

  if (!settings) return <Card title="My notification preferences"><Spinner /></Card>;

  return (
    <Card title="My notification preferences" subtitle="In-app notifications are always on. WhatsApp needs a verified number.">
      <div className="space-y-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div>
          <label className={labelCls} htmlFor="wa-number">WhatsApp number (with country code)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="wa-number" className={inputCls} placeholder="+91 98765 43210" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
            <span className={`shrink-0 self-start sm:self-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${settings.whatsappVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {settings.whatsappVerified ? `Verified (${settings.whatsappVerificationMethod})` : settings.whatsappNumber ? "Not verified" : "No number"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-xs text-gray-700">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.checked })} /> <FaWhatsapp className="text-emerald-600" /> Send me WhatsApp notifications</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.uploadReminders} onChange={(e) => setForm({ ...form, uploadReminders: e.target.checked })} /> Upload reminders (1 day before)</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.escalations} onChange={(e) => setForm({ ...form, escalations: e.target.checked })} /> Escalation alerts</label>
        </div>
        <div className="flex justify-end">
          <button type="button" className={btn.primary} disabled={busy} onClick={save}>Save preferences</button>
        </div>

        {settings.whatsappNumber && !settings.whatsappVerified && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-800">Verify {settings.whatsappNumberMasked}</p>
            {canOtp ? (
              <>
                <button type="button" className={btn.secondary} disabled={busy} onClick={() => run(async () => (await api.post("/planner/settings/whatsapp/send-code")).data.message)}>
                  Send code on WhatsApp
                </button>
                <div className="flex gap-2">
                  <input aria-label="Verification code" className={inputCls} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" />
                  <button type="button" className={btn.primary} disabled={busy || code.length !== 6} onClick={() => run(async () => (await api.post("/planner/settings/whatsapp/verify", { code })).data.message)}>
                    Verify
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-600">WhatsApp code verification is not configured on the server. Ask an administrator to confirm your number.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function AdminNotificationSetup() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const load = () =>
    api
      .get("/planner/admin/notification-setup")
      .then((r) => setUsers(r.data.users))
      .catch((e) => setError(errorMessage(e, "Failed to load.")));
  useEffect(() => {
    load();
  }, []);
  const managers = (users || []).filter((u) => u.role === "manager");
  const supervisors = users || [];
  const call = async (fn) => {
    try {
      setError("");
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e, "Update failed."));
    }
  };
  return (
    <Card title="Manager WhatsApp numbers & supervisors (admin)" subtitle="Verify numbers you have confirmed with the manager, and choose who receives each manager's escalations.">
      {error && <Alert tone="error" className="mb-2">{error}</Alert>}
      {!users ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Opted in</th>
                <th className="px-3 py-2">Supervisor (escalations)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {managers.map((m) => (
                <tr key={m._id}>
                  <td className="px-3 py-2 font-semibold">{m.name}<span className="block text-gray-500 font-normal">{m.email}</span></td>
                  <td className="px-3 py-2">
                    {m.whatsappNumberMasked || "—"}{" "}
                    {m.whatsappNumber && (
                      <button
                        type="button"
                        className={btn.ghost}
                        onClick={() => call(() => api.put(`/planner/admin/users/${m._id}/whatsapp-verification`, { verified: !m.whatsappVerified }))}
                      >
                        {m.whatsappVerified ? "✓ Verified — revoke" : "Mark verified"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">{m.notificationPreferences?.whatsapp ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Supervisor for ${m.name}`}
                      className={`${inputCls} !py-1 text-xs`}
                      value={m.supervisor?._id || ""}
                      onChange={(e) => call(() => api.put(`/planner/admin/users/${m._id}/supervisor`, { supervisorId: e.target.value || null }))}
                    >
                      <option value="">All admins (default)</option>
                      {supervisors
                        .filter((s) => s._id !== m._id)
                        .map((s) => (
                          <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Reminders & notifications: delivery log with the real provider status,
 * preferences, verification and the integration health banner.
 */
export default function RemindersPanel({ refreshKey = 0 }) {
  const { user } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter) params.status = filter;
      const [j, s] = await Promise.all([api.get("/planner/reminders", { params }), api.get("/planner/integrations/status")]);
      setJobs(j.data.jobs || []);
      setStatus(s.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load reminders."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const runNow =
    user?.role === "admin"
      ? async () => {
          try {
            setRunning(true);
            await api.post("/planner/admin/run-scheduler");
            await load();
          } catch (err) {
            setError(errorMessage(err, "Run failed."));
          } finally {
            setRunning(false);
          }
        }
      : null;

  return (
    <div className="space-y-4">
      <IntegrationStatus status={status} onRunNow={runNow} running={running} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card
            title="Reminder & notification log"
            subtitle="Every reminder and escalation message with its real delivery status. “Accepted” means WhatsApp accepted it; “delivered/read” comes from WhatsApp's delivery receipt."
            actions={
              <select aria-label="Status filter" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="sent,accepted,delivered,read">Sent / accepted / delivered</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="cancelled">Cancelled</option>
              </select>
            }
          >
            {error && <Alert tone="error" className="mb-2">{error}</Alert>}
            {loading && !jobs.length ? (
              <Spinner />
            ) : jobs.length === 0 ? (
              <EmptyState title="No reminders yet">Reminders are created automatically when you schedule an activity.</EmptyState>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-600 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Due (IST)</th>
                      <th className="px-3 py-2">Task</th>
                      <th className="px-3 py-2">Kind</th>
                      <th className="px-3 py-2">Channel</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((j) => (
                      <tr key={j._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => j.activity?._id && setOpenId(j.activity._id)}>
                        <td className="px-3 py-2 whitespace-nowrap">{j.dueLabel}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold">{j.activity?.title || "—"}</span>
                          <span className="block text-gray-500">{j.activity?.businessName}</span>
                        </td>
                        <td className="px-3 py-2">{j.kind.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2">{j.channel === "in_app" ? "In-app" : "WhatsApp"}</td>
                        <td className="px-3 py-2">
                          <JobStatusChip job={j} />
                          {(j.lastError || j.skipReason || j.cancelReason) && (
                            <span className="block text-[11px] text-gray-500 mt-0.5 max-w-xs">{j.lastError || j.skipReason || j.cancelReason}</span>
                          )}
                          {j.providerMessageId && <span className="block text-[10px] font-mono text-gray-400 truncate max-w-[180px]">{j.providerMessageId}</span>}
                          {j.attempts > 1 && <span className="block text-[10px] text-gray-500">Attempts: {j.attempts}{j.nextAttemptAt && j.status === "pending" ? ` · retry ${formatISTDateTime(j.nextAttemptAt)}` : ""}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <NotificationSettingsCard />
        </div>
      </div>
      {user?.role === "admin" && <AdminNotificationSetup />}
      {openId && <ActivityDetailModal activityId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
