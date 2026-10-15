import { formatINR } from "../planner/plannerUi";

/**
 * Formats an analytics metric { value, covered, total, status } from
 * /api/sales/analytics/monthly. Missing data is shown as "Data unavailable",
 * never as ₹0.
 */
export function metricDisplay(m, { pct = false, compact = false, count = false } = {}) {
  if (!m || m.status === "no_records") return { text: "No records", muted: true, note: "" };
  if (m.value === null || m.value === undefined) return { text: "Data unavailable", muted: true, note: "Not recorded for this period" };
  const text = pct ? `${m.value > 0 && m.growth ? "+" : ""}${m.value}%` : count ? Number(m.value).toLocaleString("en-IN") : formatINR(m.value, { compact });
  const note = m.status === "partial" ? `Partial: ${m.covered} of ${m.total} records` : "";
  return { text, muted: false, note, negative: m.value < 0 };
}

export const growthText = (g) => (g === null || g === undefined ? "n/a" : `${g > 0 ? "+" : ""}${g}%`);
