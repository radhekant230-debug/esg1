import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../../utils/axios";
import StatCard from "../../components/biz/StatCard";
import { useBiz } from "../../context/BizContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  FaShoppingBag,
  FaDollarSign,
  FaChartLine,
  FaExclamationTriangle,
  FaBox,
  FaReceipt,
  FaMoneyBillWave,
  FaArrowUp,
  FaSpinner,
} from "react-icons/fa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null ? "₹0" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const fmtSaleDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const PERIODS = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "last7days" },
  { label: "Last 30 Days", value: "last30days" },
  { label: "This Month", value: "thismonth" },
  { label: "Custom", value: "custom" },
];

const PIE_COLORS = {
  cash: "#22c55e",
  upi: "#6366f1",
  card: "#3b82f6",
  online: "#8b5cf6",
  other: "#9ca3af",
};

const getPieColor = (method) =>
  PIE_COLORS[(method ?? "").toLowerCase()] ?? PIE_COLORS.other;

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-600 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.stroke }}>
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue") || p.name?.toLowerCase().includes("cost") || p.name?.toLowerCase().includes("total")
            ? fmt(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────

const Section = ({ title, children, action }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {action && <span className="text-xs text-gray-400">{action}</span>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const EmptyState = ({ message = "No data available" }) => (
  <div className="py-10 flex flex-col items-center justify-center text-gray-300 gap-2">
    <FaBox className="text-3xl" />
    <p className="text-sm">{message}</p>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { bizId } = useParams();
  const { business, loadBusiness } = useBiz();

  const [period, setPeriod] = useState("last7days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load business context on mount
  useEffect(() => {
    if (bizId) loadBusiness(bizId);
  }, [bizId, loadBusiness]);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = { period };
      if (period === "custom") {
        if (customFrom) params.from = customFrom;
        if (customTo) params.to = customTo;
      }

      const { data: res } = await api.get(`/biz/businesses/${bizId}/dashboard`, { params });
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [bizId, period, customFrom, customTo]);

  useEffect(() => {
    if (period !== "custom") {
      fetchDashboard();
    }
  }, [period, fetchDashboard]);

  const handleCustomFetch = () => {
    fetchDashboard();
  };

  const s = data?.summary ?? {};
  const salesTrend = data?.salesTrend ?? [];
  const expenseByCategory = (data?.expenseByCategory ?? []).slice(0, 6);
  const paymentBreakdown = data?.paymentBreakdown ?? [];
  const bestSellers = (data?.bestSellers ?? []).slice(0, 6);
  const lowStock = data?.lowStock ?? [];
  const recentSales = (data?.recentSales ?? []).slice(0, 8);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
        <FaSpinner className="text-4xl animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {business?.name ?? "Dashboard"}
            </h1>
            <p className="text-sm text-gray-500 capitalize">{business?.type ?? ""}</p>
          </div>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  period === p.value
                    ? "bg-[#0f172a] text-white border-[#0f172a]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {period === "custom" && (
          <div className="max-w-screen-2xl mx-auto mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
              />
            </div>
            <button
              onClick={handleCustomFetch}
              className="flex items-center gap-1.5 bg-[#0f172a] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition"
            >
              <FaArrowUp className="rotate-90 text-xs" />
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Low Stock Warning Banner ── */}
        {(s.lowStockCount ?? 0) > 0 && lowStock.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <FaExclamationTriangle className="text-amber-500" />
              <p className="text-sm font-bold text-amber-800">
                {s.lowStockCount} item{s.lowStockCount > 1 ? "s" : ""} running low on stock
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs"
                >
                  <span className="font-semibold text-gray-800">{item.productName}</span>
                  <span className="text-gray-500 ml-1.5">
                    {item.quantity} {item.unit ?? ""} left
                  </span>
                  <span className="text-amber-600 ml-1.5">
                    (reorder at {item.reorderLevel})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Today's Sales"
            value={fmt(s.todaySales)}
            sub={`${s.todayCount ?? 0} order${(s.todayCount ?? 0) !== 1 ? "s" : ""} today`}
            icon={FaShoppingBag}
            color="green"
          />
          <StatCard
            title="Period Revenue"
            value={fmt(s.revenue)}
            sub={`${s.totalSales ?? 0} total orders`}
            icon={FaDollarSign}
            color="blue"
          />
          <StatCard
            title="Gross Profit"
            value={fmt(s.grossProfit)}
            sub="Revenue minus COGS"
            icon={FaChartLine}
            color={(s.grossProfit ?? 0) < 0 ? "red" : "indigo"}
          />
          <StatCard
            title="Net Profit"
            value={fmt(s.netProfit)}
            sub="After all expenses"
            icon={FaChartLine}
            color={(s.netProfit ?? 0) < 0 ? "red" : "teal"}
          />
          <StatCard
            title="Total Expenses"
            value={fmt(s.totalExpenses)}
            sub={`COGS: ${fmt(s.cogs)}`}
            icon={FaMoneyBillWave}
            color="amber"
          />
          <StatCard
            title="Inventory Value"
            value={fmt(s.inventoryValue)}
            sub="Current stock value"
            icon={FaBox}
            color="purple"
          />
          <StatCard
            title="Low Stock Items"
            value={s.lowStockCount ?? 0}
            sub="Below reorder level"
            icon={FaExclamationTriangle}
            color="rose"
          />
          <StatCard
            title="Total Orders"
            value={s.totalSales ?? 0}
            sub={`Open: ${s.openOrders ?? 0}`}
            icon={FaReceipt}
            color="slate"
          />
        </div>

        {/* ── Charts Row 1: Sales Trend + Expenses ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sales Trend – Area Chart (2/3 width) */}
          <Section title="Sales Trend" action={`Revenue & Cost`} >
            {salesTrend.length === 0 ? (
              <EmptyState message="No sales trend data" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="_id"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(val) => <span className="text-gray-600 capitalize">{val}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradRevenue)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="Cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#gradCost)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Expenses by Category – Horizontal Bar Chart (1/3 width) */}
          <Section title="Expenses by Category" action="Top 6">
            {expenseByCategory.length === 0 ? (
              <EmptyState message="No expense data" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  layout="vertical"
                  data={expenseByCategory}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="_id"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v) => [fmt(v), "Total"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="total" name="Total" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>

        {/* ── Charts Row 2: Payment Breakdown + Best Sellers ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Payment Breakdown – Pie Chart */}
          <Section title="Payment Breakdown">
            {paymentBreakdown.length === 0 ? (
              <EmptyState message="No payment data" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="total"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      `${name ?? "Other"} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {paymentBreakdown.map((entry, i) => (
                      <Cell key={i} fill={getPieColor(entry._id)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [fmt(v), name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(val) => (
                      <span className="text-gray-600 capitalize">{val ?? "Other"}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Best Sellers Table */}
          <Section title="Best Sellers" action="Top 6">
            {bestSellers.length === 0 ? (
              <EmptyState message="No sales data" />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Product
                      </th>
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">
                        Qty Sold
                      </th>
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bestSellers.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 text-gray-800 font-medium max-w-[160px] truncate">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-5 h-5 bg-indigo-50 text-indigo-500 text-[10px] font-bold rounded flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            {item.productName}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{item.totalQty}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-800">
                          {fmt(item.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        {/* ── Recent Sales Table ── */}
        <Section title="Recent Sales" action="Last 8 transactions">
          {recentSales.length === 0 ? (
            <EmptyState message="No recent sales" />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Invoice
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">
                      Total
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Method
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentSales.map((sale, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-indigo-600 font-semibold">
                        {sale.invoiceNo ?? "—"}
                      </td>
                      <td className="py-2.5 text-gray-700">
                        {sale.customerName ?? <span className="text-gray-400 italic">Walk-in</span>}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-gray-800">
                        {fmt(sale.total)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                          style={{
                            backgroundColor: `${getPieColor(sale.paymentMethod)}22`,
                            color: getPieColor(sale.paymentMethod),
                          }}
                        >
                          {sale.paymentMethod ?? "other"}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{fmtSaleDate(sale.saleDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
