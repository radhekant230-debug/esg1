import React, { useCallback, useEffect, useState } from "react";
import api from "../../utils/axios";
import { formatISTDateTime } from "../../utils/istDate";
import ActivityDetailModal from "./ActivityDetailModal";
import { Card, StatusBadge, Spinner, EmptyState, Alert, btn, errorMessage } from "./plannerUi";

export default function EscalationsPanel({ refreshKey = 0, onDataChanged, openActivityId = "", escalationHours = 24 }) {
  const [history, setHistory] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(openActivityId || null);
  const [busyId, setBusyId] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (openActivityId) setOpenId(openActivityId);
  }, [openActivityId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/planner/escalations", { params: history ? { history: "true" } : {} });
      setItems(res.data.activities || []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load escalations."));
    } finally {
      setLoading(false);
    }
  }, [history]);

  useEffect(() => {
    load();
  }, [load, refreshKey, tick]);

  const changed = () => {
    setTick((n) => n + 1);
    onDataChanged && onDataChanged();
  };

  const acknowledge = async (id) => {
    try {
      setBusyId(id);
      await api.patch(`/planner/activities/${id}/escalation/acknowledge`, {});
      changed();
    } catch (err) {
      setError(errorMessage(err, "Failed to acknowledge."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <Card
      title="Escalated tasks"
      subtitle={`Tasks still incomplete ${escalationHours}h after their deadline are escalated automatically to the manager and supervisor — once per deadline.`}
      actions={
        <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden">
          <button type="button" onClick={() => setHistory(false)} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${!history ? "bg-gray-900 text-white" : "bg-white"}`}>
            Open
          </button>
          <button type="button" onClick={() => setHistory(true)} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${history ? "bg-gray-900 text-white" : "bg-white"}`}>
            History
          </button>
        </div>
      }
    >
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {loading && !items.length ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title={history ? "No escalations recorded." : "No open escalations."} />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const ev = a.escalation?.current;
            return (
              <li key={a._id} className={`border rounded-xl p-3 ${a.status === "Escalated" ? "border-rose-300 bg-rose-50/50" : "border-gray-200"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <button type="button" className="text-left min-w-0" onClick={() => setOpenId(a._id)}>
                    <p className="text-sm font-bold text-gray-900">{a.title}</p>
                    <p className="text-[11px] text-gray-600">
                      {a.activityType}: {a.scheduledDateLabel} · {a.businessName || "—"} · Manager: {a.assignedManager?.name || "—"}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Deadline {a.deadlineLabel} · Escalated {ev ? formatISTDateTime(ev.escalatedAt) : "—"}
                      {ev?.supervisors?.length ? ` · Supervisor: ${ev.supervisors.map((s) => s.name || "").filter(Boolean).join(", ") || "notified"}` : ""}
                    </p>
                    {ev?.acknowledgedAt && (
                      <p className="text-[11px] text-emerald-700">
                        Acknowledged {formatISTDateTime(ev.acknowledgedAt)}
                        {ev.acknowledgedBy?.name ? ` by ${ev.acknowledgedBy.name}` : ""}
                      </p>
                    )}
                    {ev?.resolvedAt && (
                      <p className="text-[11px] text-gray-600">
                        Resolved ({ev.resolution}) {formatISTDateTime(ev.resolvedAt)}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={a.status} />
                    {a.status === "Escalated" && !ev?.acknowledgedAt && (
                      <button type="button" className={btn.secondary} disabled={busyId === a._id} onClick={() => acknowledge(a._id)}>
                        Acknowledge
                      </button>
                    )}
                    {a.status === "Escalated" && (
                      <button type="button" className={btn.primary} onClick={() => setOpenId(a._id)}>
                        Resolve / reassign
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {openId && <ActivityDetailModal activityId={openId} onClose={() => setOpenId(null)} onChanged={changed} />}
    </Card>
  );
}
