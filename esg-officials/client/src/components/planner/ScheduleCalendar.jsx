import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import {
  MONTH_NAMES,
  WEEKDAYS_SHORT,
  nowIST,
  istDayKey,
  addDaysToKey,
  weekStartKey,
  fromISTParts,
  formatISTDate,
} from "../../utils/istDate";
import ActivityFormModal from "./ActivityFormModal";
import ActivityDetailModal from "./ActivityDetailModal";
import { STATE_STYLES, TYPE_SHORT, StateBadge, StatusBadge, StateLegend, Spinner, Alert, btn, inputCls, errorMessage } from "./plannerUi";

const keyOf = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const parseKey = (k) => k.split("-").map(Number);
const todayKey = () => {
  const p = nowIST();
  return keyOf(p.year, p.month, p.day);
};

function ActivityChip({ a, onClick, compact = false }) {
  const s = STATE_STYLES[a.displayState] || STATE_STYLES.upcoming;
  const tip = `${a.activityType}: ${a.scheduledDateLabel}, ${a.scheduledTimeLabel} IST — ${a.title} — ${a.businessName || ""} — ${a.assignedManager?.name || ""} — ${a.status}`;
  return (
    <button
      type="button"
      title={tip}
      onClick={(e) => {
        e.stopPropagation();
        onClick(a);
      }}
      className={`w-full text-left border-l-4 rounded-md px-1.5 py-1 text-[11px] leading-tight hover:brightness-95 transition cursor-pointer ${s.item}`}
    >
      {compact ? (
        <span className="block truncate">
          <strong>{a.scheduledTimeLabel.replace(":00 ", " ")}</strong> {TYPE_SHORT[a.activityType] || a.activityType}: {a.businessName || a.title}
        </span>
      ) : (
        <>
          <span className="block font-bold truncate">{a.activityType}: {a.scheduledDateLabel}</span>
          <span className="block truncate">{a.title}</span>
          <span className="block truncate opacity-80">{a.scheduledTimeLabel} · {a.businessName || "—"}</span>
        </>
      )}
    </button>
  );
}

/** Full row used in week and day views: every required field visible. */
function ActivityRow({ a, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(a)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-400 hover:shadow-sm transition cursor-pointer"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-gray-900">
          {a.activityType}: {a.scheduledDateLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <StateBadge state={a.displayState} />
          {a.status.toLowerCase() !== (STATE_STYLES[a.displayState]?.label || "").toLowerCase() && <StatusBadge status={a.status} />}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 mt-1">{a.title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-gray-600">
        <span><strong>Time:</strong> {a.scheduledTimeLabel} IST</span>
        <span><strong>Deadline:</strong> {a.deadlineLabel}</span>
        <span><strong>Client/business:</strong> {a.businessName || "—"}</span>
        <span><strong>Manager:</strong> {a.assignedManager?.name || "—"}</span>
      </div>
    </button>
  );
}

/**
 * Shared calendar for the Manager Portal and the Client Portal.
 * Data always comes from /api/planner/activities, which applies role scoping,
 * so both portals show the same dates for the same record.
 */
export default function ScheduleCalendar({ clientId = "", refreshKey = 0, onDataChanged, initialView = "month", title = "Calendar" }) {
  const { user } = useContext(AuthContext);
  const canEdit = user?.role === "admin" || user?.role === "manager";
  // Phones get the stacked week list by default; the month grid scrolls sideways there.
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 && initialView === "month" ? "week" : initialView
  );
  const [cursor, setCursor] = useState(todayKey()); // IST day key in focus
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [createAt, setCreateAt] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  const [cy, cm] = parseKey(cursor);

  const range = useMemo(() => {
    if (view === "month") {
      const first = keyOf(cy, cm, 1);
      const start = weekStartKey(first);
      return { start, end: addDaysToKey(start, 41) };
    }
    if (view === "week") {
      const start = weekStartKey(cursor);
      return { start, end: addDaysToKey(start, 6) };
    }
    return { start: cursor, end: cursor };
  }, [view, cursor, cy, cm]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = { start: range.start, end: range.end };
      if (clientId) params.clientId = clientId;
      if (typeFilter) params.type = typeFilter;
      if (stateFilter) params.state = stateFilter;
      const res = await api.get("/planner/activities", { params });
      setItems(res.data.activities || []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load the calendar."));
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, clientId, typeFilter, stateFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey, localRefresh]);

  const byDay = useMemo(() => {
    const map = {};
    items.forEach((a) => {
      (map[a.dayKey] = map[a.dayKey] || []).push(a);
    });
    Object.values(map).forEach((list) => list.sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt)));
    return map;
  }, [items]);

  const move = (dir) => {
    if (view === "month") {
      const idx = cy * 12 + (cm - 1) + dir;
      setCursor(keyOf(Math.floor(idx / 12), (idx % 12) + 1, 1));
    } else setCursor(addDaysToKey(cursor, dir * (view === "week" ? 7 : 1)));
  };

  const heading =
    view === "month"
      ? `${MONTH_NAMES[cm - 1]} ${cy}`
      : view === "week"
        ? `${formatISTDate(fromISTParts(...parseKey(range.start), 12))} – ${formatISTDate(fromISTParts(...parseKey(range.end), 12))}`
        : formatISTDate(fromISTParts(cy, cm, parseKey(cursor)[2], 12));

  const changed = () => {
    setLocalRefresh((n) => n + 1);
    onDataChanged && onDataChanged();
  };

  const today = todayKey();

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-xs">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button type="button" className={btn.ghost} onClick={() => move(-1)} aria-label="Previous">
            <FaChevronLeft />
          </button>
          <button type="button" className={btn.secondary} onClick={() => setCursor(today)}>
            Today
          </button>
          <button type="button" className={btn.ghost} onClick={() => move(1)} aria-label="Next">
            <FaChevronRight />
          </button>
          <div className="ml-1">
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900">{heading}</h3>
            <p className="text-[11px] text-gray-500">{title} · Asia/Kolkata (IST)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden" role="tablist" aria-label="Calendar view">
            {["month", "week", "day"].map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-bold capitalize cursor-pointer ${view === v ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <select aria-label="Filter by type" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {Object.keys(TYPE_SHORT).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select aria-label="Filter by status" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATE_STYLES).map(([k, s]) => (
              <option key={k} value={k}>{s.label}</option>
            ))}
          </select>
          {canEdit && (
            <button type="button" className={btn.primary} onClick={() => setCreateAt(view === "month" ? today : cursor)}>
              <FaPlus /> Schedule
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {error && <Alert tone="error" className="mb-3">{error}</Alert>}
        {loading && !items.length ? (
          <Spinner label="Loading calendar..." />
        ) : view === "month" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {WEEKDAYS_SHORT.map((d) => (
                  <div key={d} className="px-2 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-t border-l border-gray-200">
                {Array.from({ length: 42 }).map((_, i) => {
                  const k = addDaysToKey(range.start, i);
                  const [, km, kd] = parseKey(k);
                  const list = byDay[k] || [];
                  const inMonth = km === cm;
                  return (
                    <div
                      key={k}
                      onClick={() => canEdit && setCreateAt(k)}
                      title={canEdit ? "Click an empty area to schedule on this day" : undefined}
                      className={`min-h-[104px] border-r border-b border-gray-200 p-1.5 space-y-1 ${inMonth ? "bg-white" : "bg-gray-50/70"} ${canEdit ? "cursor-pointer hover:bg-amber-50/40" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          aria-label={`Open day view for ${k}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCursor(k);
                            setView("day");
                          }}
                          className={`text-[11px] font-bold w-6 h-6 inline-flex items-center justify-center rounded-full hover:ring-2 hover:ring-gray-300 cursor-pointer ${
                            k === today ? "bg-gray-900 text-white" : inMonth ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {kd}
                        </button>
                        {list.length > 3 && (
                          <button
                            type="button"
                            className="text-[10px] font-bold text-gray-500 hover:text-gray-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCursor(k);
                              setView("day");
                            }}
                          >
                            +{list.length - 3} more
                          </button>
                        )}
                      </div>
                      {list.slice(0, 3).map((a) => (
                        <ActivityChip key={a._id} a={a} compact onClick={(x) => setOpenId(x._id)} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : view === "week" ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const k = addDaysToKey(range.start, i);
              const [, , kd] = parseKey(k);
              const list = byDay[k] || [];
              return (
                <div key={k} className={`rounded-xl border p-2 md:min-h-[140px] ${k === today ? "border-gray-900" : "border-gray-200"} bg-gray-50/50`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-700">
                      {WEEKDAYS_SHORT[i]} {kd}
                    </span>
                    {canEdit && (
                      <button type="button" className="text-gray-400 hover:text-gray-900 text-xs" onClick={() => setCreateAt(k)} aria-label={`Schedule on ${k}`}>
                        <FaPlus />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {list.length === 0 && <p className="text-[11px] text-gray-400">—</p>}
                    {list.map((a) => (
                      <ActivityChip key={a._id} a={a} onClick={(x) => setOpenId(x._id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {(byDay[cursor] || []).length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Nothing scheduled for this day.</p>
            ) : (
              byDay[cursor].map((a) => <ActivityRow key={a._id} a={a} onClick={(x) => setOpenId(x._id)} />)
            )}
          </div>
        )}
        <StateLegend className="mt-3" />
      </div>

      {createAt && (
        <ActivityFormModal
          initialDate={createAt}
          defaultClientId={clientId}
          onClose={() => setCreateAt(null)}
          onSaved={() => {
            setCreateAt(null);
            changed();
          }}
        />
      )}
      {openId && <ActivityDetailModal activityId={openId} onClose={() => setOpenId(null)} onChanged={changed} />}
    </section>
  );
}

export { ActivityRow, istDayKey };
