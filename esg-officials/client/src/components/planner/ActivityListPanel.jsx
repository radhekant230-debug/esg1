import React, { useCallback, useEffect, useState } from "react";
import { FaPlus, FaSearch } from "react-icons/fa";
import api from "../../utils/axios";
import ActivityFormModal from "./ActivityFormModal";
import ActivityDetailModal from "./ActivityDetailModal";
import { Card, StateBadge, StatusBadge, Spinner, EmptyState, Alert, btn, inputCls, errorMessage, STATE_STYLES } from "./plannerUi";

/**
 * Tabular list of scheduled activities (used for "Scheduled Uploads" and
 * "Pending Approvals"). Each row is its own record with its own deadline,
 * status and escalation history.
 */
export default function ActivityListPanel({
  title,
  subtitle,
  presetType = "",
  presetStatus = "",
  allowCreate = true,
  refreshKey = 0,
  onDataChanged,
  openActivityId = "",
  emptyText = "Nothing here yet.",
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(openActivityId || null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (openActivityId) setOpenId(openActivityId);
  }, [openActivityId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (presetType) params.type = presetType;
      if (presetStatus) params.status = presetStatus;
      if (state) params.state = state;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/planner/activities", { params });
      setItems(res.data.activities || []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load activities."));
    } finally {
      setLoading(false);
    }
  }, [presetType, presetStatus, state, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, refreshKey, tick, search]);

  const changed = () => {
    setTick((n) => n + 1);
    onDataChanged && onDataChanged();
  };

  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input aria-label="Search" className={`${inputCls} !pl-8 !py-1.5 text-xs w-44`} placeholder="Search title / business" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!presetStatus && (
            <select aria-label="Status filter" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">All</option>
              {Object.entries(STATE_STYLES).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          )}
          {allowCreate && (
            <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
              <FaPlus /> New
            </button>
          )}
        </>
      }
    >
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {loading && !items.length ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 text-left uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Scheduled (IST)</th>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">Client / business</th>
                  <th className="px-3 py-2.5">Manager</th>
                  <th className="px-3 py-2.5">Deadline</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((a) => (
                  <tr key={a._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpenId(a._id)}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-bold text-gray-900">{a.scheduledDateLabel}</span>
                      <span className="block text-gray-500">{a.scheduledTimeLabel}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-gray-900">{a.title}</span>
                      <span className="block text-gray-500">{a.activityType} · {a.activityId}</span>
                    </td>
                    <td className="px-3 py-2.5">{a.businessName || "—"}</td>
                    <td className="px-3 py-2.5">{a.assignedManager?.name || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{a.deadlineLabel}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1 items-start">
                        <StateBadge state={a.displayState} />
                        <StatusBadge status={a.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map((a) => (
              <button key={a._id} type="button" onClick={() => setOpenId(a._id)} className="w-full text-left border border-gray-200 rounded-xl p-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold">{a.activityType}: {a.scheduledDateLabel}</span>
                  <StateBadge state={a.displayState} />
                </div>
                <p className="text-sm font-semibold mt-1">{a.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {a.scheduledTimeLabel} · {a.businessName || "—"} · {a.assignedManager?.name || "—"}
                </p>
                <p className="text-[11px] text-gray-500">Deadline: {a.deadlineLabel} · {a.status}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {creating && (
        <ActivityFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            changed();
          }}
        />
      )}
      {openId && <ActivityDetailModal activityId={openId} onClose={() => setOpenId(null)} onChanged={changed} />}
    </Card>
  );
}
