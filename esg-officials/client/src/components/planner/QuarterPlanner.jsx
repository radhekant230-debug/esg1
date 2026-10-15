import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import { quarterOf, nowIST, WEEKDAYS_SHORT, addDaysToKey, weekStartKey } from "../../utils/istDate";
import ActivityFormModal from "./ActivityFormModal";
import ActivityDetailModal from "./ActivityDetailModal";
import { ActivityRow } from "./ScheduleCalendar";
import { STATE_STYLES, StateLegend, Spinner, Alert, EmptyState, btn, errorMessage } from "./plannerUi";

const keyOf = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function MiniMonth({ year, month, name, byDay, todayKey, onDayClick, onItemClick }) {
  const first = keyOf(year, month, 1);
  const start = weekStartKey(first);
  return (
    <div className="border border-gray-200 rounded-xl p-2.5 bg-white">
      <p className="text-xs font-extrabold text-gray-900 mb-1.5">
        {name} {year}
      </p>
      <div className="grid grid-cols-7 text-[9px] font-bold text-gray-400 uppercase">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="text-center">{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 mt-0.5">
        {Array.from({ length: 42 }).map((_, i) => {
          const k = addDaysToKey(start, i);
          const [, km, kd] = k.split("-").map(Number);
          if (km !== month) return <div key={k} className="h-9" />;
          const list = byDay[k] || [];
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              onClick={() => (list.length === 1 ? onItemClick(list[0]) : onDayClick(k, list))}
              onKeyDown={(e) => e.key === "Enter" && onDayClick(k, list)}
              title={list.map((a) => `${a.activityType}: ${a.scheduledDateLabel} — ${a.title} (${a.status})`).join("\n") || undefined}
              className={`h-9 rounded-md flex flex-col items-center justify-center text-[10px] cursor-pointer hover:bg-gray-100 ${k === todayKey ? "ring-2 ring-gray-900" : ""} ${list.length ? "bg-gray-50 font-bold text-gray-900" : "text-gray-500"}`}
            >
              {kd}
              {list.length > 0 && (
                <span className="flex gap-0.5 mt-0.5">
                  {list.slice(0, 4).map((a) => (
                    <span key={a._id} className={`w-1.5 h-1.5 rounded-full ${(STATE_STYLES[a.displayState] || STATE_STYLES.upcoming).dot}`} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Quarterly planning calendar (manager + client). Quarter boundaries are
 * computed by the server (calendar quarters, or Indian FY if configured).
 */
export default function QuarterPlanner({ clientId = "", refreshKey = 0, onDataChanged }) {
  const { user } = useContext(AuthContext);
  const canEdit = user?.role === "admin" || user?.role === "manager";
  const now = nowIST();
  const initial = quarterOf(new Date());
  const [year, setYear] = useState(initial.year);
  const [quarter, setQuarter] = useState(initial.quarter);
  const [monthFilter, setMonthFilter] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createAt, setCreateAt] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [dayList, setDayList] = useState(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = { year, quarter };
      if (clientId) params.clientId = clientId;
      const res = await api.get("/planner/activities", { params });
      setData(res.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load the quarter."));
    } finally {
      setLoading(false);
    }
  }, [year, quarter, clientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey, tick]);

  useEffect(() => setMonthFilter("all"), [year, quarter]);

  const months = data?.range?.months || [];
  const activities = data?.activities || [];
  const visible = monthFilter === "all" ? activities : activities.filter((a) => a.dayKey.startsWith(monthFilter));

  const byDay = useMemo(() => {
    const map = {};
    activities.forEach((a) => (map[a.dayKey] = map[a.dayKey] || []).push(a));
    return map;
  }, [activities]);

  const counts = useMemo(() => {
    const c = { total: visible.length };
    visible.forEach((a) => {
      c[a.displayState] = (c[a.displayState] || 0) + 1;
      c[a.activityType] = (c[a.activityType] || 0) + 1;
    });
    return c;
  }, [visible]);

  const todayKey = keyOf(now.year, now.month, now.day);
  const changed = () => {
    setTick((t) => t + 1);
    onDataChanged && onDataChanged();
  };

  const stat = (label, value, cls) => (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-black">{value || 0}</p>
    </div>
  );

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn.ghost} onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            <FaChevronLeft />
          </button>
          <span className="text-sm font-extrabold text-gray-900 w-12 text-center">{year}</span>
          <button type="button" className={btn.ghost} onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            <FaChevronRight />
          </button>
          <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden ml-1" role="tablist" aria-label="Quarter">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                role="tab"
                aria-selected={quarter === q}
                onClick={() => setQuarter(q)}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${quarter === q ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden" aria-label="Month">
            <button type="button" onClick={() => setMonthFilter("all")} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${monthFilter === "all" ? "bg-amber-500 text-white" : "bg-white text-gray-700"}`}>
              All
            </button>
            {months.map((m) => {
              const k = `${m.year}-${String(m.month).padStart(2, "0")}`;
              return (
                <button key={k} type="button" onClick={() => setMonthFilter(k)} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${monthFilter === k ? "bg-amber-500 text-white" : "bg-white text-gray-700"}`}>
                  {m.name.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {canEdit && (
            <button type="button" className={btn.primary} onClick={() => setCreateAt(months[0] ? keyOf(months[0].year, months[0].month, 1) : todayKey)}>
              <FaPlus /> Add activity
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {loading && !data ? (
          <Spinner label="Loading quarter..." />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {stat("Total", counts.total, "border-gray-200 text-gray-900")}
              {stat("Upcoming", counts.upcoming, "border-blue-200 bg-blue-50 text-blue-900")}
              {stat("Overdue", counts.overdue, "border-red-200 bg-red-50 text-red-800")}
              {stat("Pending approval", counts["pending-approval"], "border-amber-200 bg-amber-50 text-amber-900")}
              {stat("Escalated", counts.escalated, "border-rose-300 bg-rose-50 text-rose-900")}
              {stat("Completed", counts.completed, "border-emerald-200 bg-emerald-50 text-emerald-900")}
            </div>
            <p className="text-[11px] text-gray-500">
              Uploads: {counts["Scheduled Upload"] || 0} · Campaigns: {counts.Campaign || 0} · Business activities: {counts["Business Activity"] || 0} · Deadlines: {counts.Deadline || 0} · Approvals: {counts.Approval || 0} · Meetings: {counts.Meeting || 0}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {months.map((m) => (
                <MiniMonth
                  key={`${m.year}-${m.month}`}
                  year={m.year}
                  month={m.month}
                  name={m.name}
                  byDay={byDay}
                  todayKey={todayKey}
                  onItemClick={(a) => setOpenId(a._id)}
                  onDayClick={(k, list) => {
                    if (list.length) setDayList({ key: k, list });
                    else if (canEdit) setCreateAt(k);
                  }}
                />
              ))}
            </div>
            <StateLegend />

            {dayList && (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/60">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-extrabold text-gray-800">{dayList.list[0]?.scheduledDateLabel}</p>
                  <div className="flex gap-2">
                    {canEdit && <button className={btn.ghost} onClick={() => setCreateAt(dayList.key)}><FaPlus /> Add on this day</button>}
                    <button className={btn.ghost} onClick={() => setDayList(null)}>Close</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {dayList.list.map((a) => (
                    <ActivityRow key={a._id} a={a} onClick={(x) => setOpenId(x._id)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2">Quarter agenda</h4>
              {visible.length === 0 ? (
                <EmptyState title="Nothing planned for this period">{canEdit ? "Use “Add activity” or click a day to plan uploads, campaigns and deadlines." : "Your account manager has not scheduled anything yet."}</EmptyState>
              ) : (
                <div className="space-y-4">
                  {months
                    .filter((m) => monthFilter === "all" || monthFilter === `${m.year}-${String(m.month).padStart(2, "0")}`)
                    .map((m) => {
                      const prefix = `${m.year}-${String(m.month).padStart(2, "0")}`;
                      const list = visible.filter((a) => a.dayKey.startsWith(prefix));
                      return (
                        <div key={prefix}>
                          <p className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                            {m.name} {m.year} · {list.length}
                          </p>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {list.map((a) => (
                              <ActivityRow key={a._id} a={a} onClick={(x) => setOpenId(x._id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {createAt && (
        <ActivityFormModal
          initialDate={createAt}
          defaultClientId={clientId}
          onClose={() => setCreateAt(null)}
          onSaved={() => {
            setCreateAt(null);
            setDayList(null);
            changed();
          }}
        />
      )}
      {openId && (
        <ActivityDetailModal
          activityId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setDayList(null);
            changed();
          }}
        />
      )}
    </section>
  );
}
