import React, { useState } from "react";
import ScheduleCalendar from "./ScheduleCalendar";
import QuarterPlanner from "./QuarterPlanner";

/**
 * Client portal view of the shared schedule. Uses the same calendar
 * components and API as the Manager Portal; the server restricts the data
 * to this client's own records, so both sides always show the same dates.
 */
export default function ClientScheduleTab({ clientId = "" }) {
  const [view, setView] = useState("calendar");
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Schedule & Calendar</h2>
          <p className="text-xs text-gray-500">
            Scheduled uploads, campaigns, deadlines and approvals planned by your account team. Times are Asia/Kolkata (IST).
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden">
          {[
            ["calendar", "Calendar"],
            ["quarter", "Quarterly plan"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`px-4 py-2 text-xs font-bold cursor-pointer ${view === k ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "calendar" ? (
        <ScheduleCalendar clientId={clientId} title="Your schedule" refreshKey={refresh} onDataChanged={() => setRefresh((n) => n + 1)} />
      ) : (
        <QuarterPlanner clientId={clientId} refreshKey={refresh} onDataChanged={() => setRefresh((n) => n + 1)} />
      )}
    </div>
  );
}
