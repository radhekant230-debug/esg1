import React from "react";

/**
 * Shared look & feel for the planner (manager + client views use the same
 * colours so a status always looks the same everywhere).
 */
export const STATE_STYLES = {
  upcoming: {
    label: "Upcoming",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    item: "border-l-blue-500 bg-blue-50/70 text-blue-950",
  },
  "pending-approval": {
    label: "Pending approval",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    item: "border-l-amber-500 bg-amber-50/80 text-amber-950",
  },
  overdue: {
    label: "Overdue",
    chip: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    item: "border-l-red-500 bg-red-50/80 text-red-950",
  },
  escalated: {
    label: "Escalated",
    chip: "bg-rose-600 text-white border-rose-700",
    dot: "bg-rose-700",
    item: "border-l-rose-700 bg-rose-100 text-rose-950",
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    item: "border-l-emerald-500 bg-emerald-50/70 text-emerald-950",
  },
  cancelled: {
    label: "Cancelled",
    chip: "bg-gray-100 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
    item: "border-l-gray-400 bg-gray-50 text-gray-500 line-through",
  },
};

export const TYPE_SHORT = {
  "Scheduled Upload": "Upload",
  "Business Activity": "Activity",
  Campaign: "Campaign",
  Deadline: "Deadline",
  Approval: "Approval",
  Meeting: "Meeting",
};

export function StateBadge({ state, className = "" }) {
  const s = STATE_STYLES[state] || STATE_STYLES.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${s.chip} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${state === "escalated" ? "bg-white" : s.dot}`} />
      {s.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Scheduled: "bg-slate-100 text-slate-700",
    "In Progress": "bg-blue-100 text-blue-700",
    "Pending Approval": "bg-amber-100 text-amber-800",
    Completed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-gray-200 text-gray-600",
    Escalated: "bg-rose-600 text-white",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export function StateLegend({ className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-600 ${className}`}>
      {Object.entries(STATE_STYLES).map(([key, s]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${s.dot}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export const formatINR = (n, { compact = false } = {}) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (compact && Math.abs(v) >= 100000) {
    if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
    return `₹${(v / 100000).toFixed(2)} L`;
  }
  return `${v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const errorMessage = (err, fallback = "Something went wrong.") =>
  err?.response?.data?.message || err?.message || fallback;

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="py-12 text-center text-gray-500 text-sm">
      <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-3" />
      <p className="font-semibold">{label}</p>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="py-10 px-4 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50/60">
      <p className="font-bold text-gray-700 text-sm">{title}</p>
      {children && <div className="text-xs text-gray-500 mt-1">{children}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "", bodyClassName = "p-4 sm:p-5" }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-200 shadow-xs ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
          <div className="min-w-0">
            {title && <h3 className="text-sm sm:text-base font-extrabold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Alert({ tone = "info", title, children, className = "" }) {
  const tones = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warn: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border rounded-xl p-3.5 text-xs sm:text-sm ${tones[tone]} ${className}`}>
      {title && <p className="font-bold mb-0.5">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-50 transition cursor-pointer",
  secondary:
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer",
  danger:
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition cursor-pointer",
  ghost:
    "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-600 text-xs font-semibold hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer",
};

export const inputCls =
  "w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 disabled:bg-gray-100";

export const labelCls = "block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1";

/** Triggers a browser download for an axios blob response. */
export function downloadBlob(response, fallbackName) {
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = match ? match[1] : fallbackName;
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers?.["content-type"] }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export function Modal({ title, subtitle, onClose, children, footer, size = "max-w-2xl" }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white w-full ${size} rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[94vh]`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-[#18181B] text-white rounded-t-2xl">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 text-lg leading-none cursor-pointer" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
