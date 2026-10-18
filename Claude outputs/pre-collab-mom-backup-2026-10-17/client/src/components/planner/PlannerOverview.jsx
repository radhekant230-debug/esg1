import React, { useCallback, useEffect, useState } from "react";
import { FaCalendarDay, FaExclamationTriangle, FaBell, FaClipboardCheck, FaFire, FaArrowRight, FaCloudUploadAlt, FaWhatsapp } from "react-icons/fa";
import api from "../../utils/axios";
import { nowIST, MONTH_NAMES } from "../../utils/istDate";
import ActivityDetailModal, { JobStatusChip } from "./ActivityDetailModal";
import { IntegrationStatus } from "./RemindersPanel";
import { Card, StateBadge, Spinner, Alert, EmptyState, btn, errorMessage } from "./plannerUi";
import { metricDisplay, growthText } from "../sales/metricFormat";
import ExcelUploadModal from "../sales/ExcelUploadModal";

function Kpi({ icon: Icon, label, value, tone, onClick }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <button type="button" onClick={onClick} className="text-left bg-white p-4 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition flex items-center justify-between gap-3 cursor-pointer">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{value}</p>
      </div>
      <span className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg ${tones[tone]}`}>
        <Icon />
      </span>
    </button>
  );
}

function MiniList({ items, onOpen, empty, showDeadline = true }) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-gray-100">
      {items.slice(0, 8).map((a) => (
        <li key={a._id}>
          <button type="button" className="w-full text-left py-2.5 flex items-start justify-between gap-3 hover:bg-gray-50 rounded-lg px-1 cursor-pointer" onClick={() => onOpen(a._id)}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
              <p className="text-[11px] text-gray-500 truncate">
                {a.activityType}: {a.scheduledDateLabel} · {a.businessName || "—"} · {a.assignedManager?.name || "—"}
              </p>
              {showDeadline && <p className="text-[11px] text-gray-500">Deadline {a.deadlineLabel}</p>}
            </div>
            <StateBadge state={a.displayState} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Planner overview: deadlines, overdue work, reminders due today and the
 * current month's performance — the first thing a manager sees.
 */
export default function PlannerOverview({ onNavigate, refreshKey = 0, onDataChanged }) {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const now = nowIST();

  const load = useCallback(async () => {
    const [s, a, st] = await Promise.allSettled([
      api.get("/planner/summary"),
      api.get("/sales/analytics/monthly", { params: { year: now.year, month: now.month, months: 2 } }),
      api.get("/planner/integrations/status"),
    ]);
    if (s.status === "fulfilled") {
      setSummary(s.value.data);
      setError("");
    } else setError(errorMessage(s.reason, "Failed to load the overview."));
    if (a.status === "fulfilled") setAnalytics(a.value.data);
    else setAnalyticsError(errorMessage(a.reason, "Monthly metrics unavailable."));
    if (st.status === "fulfilled") setStatus(st.value.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey, tick]);

  if (!summary && !error) return <Spinner label="Loading overview..." />;
  if (!summary) return <Alert tone="error">{error}</Alert>;

  const sel = analytics?.selected;
  const perf = [
    { label: "Total sales", m: sel?.recordedSales, sub: sel ? `MoM ${growthText(sel.growth?.recordedSales)}` : "" },
    { label: "Net sales (after discounts)", m: sel?.net },
    { label: "Discounts given", m: sel?.discount },
    { label: "Net profit / loss", m: sel?.netProfit },
    {
      label: "Target achievement",
      m: sel ? { value: sel.target.achievement, status: sel.target.status, covered: sel.target.covered, total: sel.target.total } : null,
      pct: true,
      sub: sel?.target?.value ? `Target ₹${Number(sel.target.value).toLocaleString("en-IN")}` : "Target not configured",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-black text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-xs font-semibold tracking-wider uppercase">Sales planning overview</p>
          <h2 className="text-xl sm:text-2xl font-extrabold mt-1">Today is {summary.todayLabel}</h2>
          <p className="text-gray-300 text-sm mt-1">
            {summary.scheduledToday.length} scheduled today · {summary.remindersDueToday.length} reminders due today · times in Asia/Kolkata
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="overview-header-whatsapp-btn"
            onClick={() => onNavigate("whatsapp")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition cursor-pointer shrink-0"
            title="Manage saved client WhatsApp contacts & send quick messages"
          >
            <FaWhatsapp className="text-base" />
            Client WhatsApp
          </button>
          <button
            type="button"
            id="overview-header-import-sales-btn"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gray-900 hover:bg-gray-800 text-white shadow-md hover:shadow-lg transition cursor-pointer shrink-0"
            title="Upload sales data for any date range (CSV, Excel)"
          >
            <FaCloudUploadAlt className="text-base" />
            Import Sales CSV / Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={FaCalendarDay} label="Deadlines (7 days)" value={summary.upcomingDeadlines.length} tone="blue" onClick={() => onNavigate("uploads")} />
        <Kpi icon={FaExclamationTriangle} label="Overdue" value={summary.overdue.length} tone="red" onClick={() => onNavigate("uploads")} />
        <Kpi icon={FaBell} label="Reminders today" value={summary.remindersDueToday.length} tone="gray" onClick={() => onNavigate("reminders")} />
        <Kpi icon={FaClipboardCheck} label="Pending approvals" value={summary.pendingApprovals.length} tone="amber" onClick={() => onNavigate("approvals")} />
        <Kpi icon={FaFire} label="Escalated" value={summary.escalated.length} tone="rose" onClick={() => onNavigate("escalations")} />
      </div>

      {summary.escalated.length > 0 && (
        <Alert tone="error" title={`${summary.escalated.length} escalated task(s) need action`}>
          <button type="button" className="underline font-semibold" onClick={() => onNavigate("escalations")}>Review escalations</button>
        </Alert>
      )}

      <Card
        title={`Monthly performance — ${MONTH_NAMES[now.month - 1]} ${now.year}`}
        subtitle="From imported and manually entered sales records. Missing discounts/costs are shown as unavailable, not zero."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="overview-perf-import-sales-btn"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition cursor-pointer whitespace-nowrap"
              title="Upload sales data for any date range (CSV, Excel)"
            >
              <FaCloudUploadAlt className="text-sm" />
              Import Sales CSV / Excel
            </button>
            <button className={btn.ghost} onClick={() => onNavigate("analytics")}>
              Open analytics <FaArrowRight />
            </button>
          </div>
        }
      >
        {analyticsError && !sel ? (
          <Alert tone="warn">{analyticsError}</Alert>
        ) : !sel ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {perf.map((p) => {
              const d = metricDisplay(p.m, { pct: p.pct, compact: true });
              return (
                <div key={p.label} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{p.label}</p>
                  <p className={`text-lg font-black mt-1 ${d.muted ? "text-gray-400 text-sm" : d.negative ? "text-red-600" : "text-gray-900"}`}>{d.text}</p>
                  {(d.note || p.sub) && <p className="text-[10px] text-gray-500 mt-0.5">{d.note || p.sub}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Upcoming deadlines (next 7 days)" actions={<button className={btn.ghost} onClick={() => onNavigate("calendar")}>Calendar <FaArrowRight /></button>}>
          <MiniList items={summary.upcomingDeadlines} onOpen={setOpenId} empty="No deadlines in the next 7 days." />
        </Card>
        <Card title="Overdue tasks" subtitle="Past their deadline and not completed">
          <MiniList items={summary.overdue} onOpen={setOpenId} empty="Nothing overdue." />
        </Card>
        <Card title="Reminders due today" actions={<button className={btn.ghost} onClick={() => onNavigate("reminders")}>All reminders <FaArrowRight /></button>}>
          {summary.remindersDueToday.length === 0 ? (
            <EmptyState title="No reminders due today." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.remindersDueToday.map((j) => (
                <li key={j._id} className="py-2 flex items-start justify-between gap-2">
                  <button type="button" className="text-left min-w-0" onClick={() => j.activity && setOpenId(j.activity._id)}>
                    <p className="text-sm font-semibold truncate">{j.activity?.title}</p>
                    <p className="text-[11px] text-gray-500">{j.activity?.businessName} · {j.channel === "in_app" ? "In-app" : "WhatsApp"} · due {j.dueLabel}</p>
                  </button>
                  <JobStatusChip job={j} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Scheduled today">
          <MiniList items={summary.scheduledToday} onOpen={setOpenId} empty="Nothing scheduled today." showDeadline={false} />
        </Card>
      </div>

      <IntegrationStatus status={status} />

      {openId && (
        <ActivityDetailModal
          activityId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setTick((n) => n + 1);
            onDataChanged && onDataChanged();
          }}
        />
      )}

      <ExcelUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setIsUploadOpen(false);
          load();
          onDataChanged && onDataChanged();
        }}
      />
    </div>
  );
}
