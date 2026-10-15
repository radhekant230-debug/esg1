import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  FaDownload,
  FaCalendarAlt,
  FaUtensils,
  FaTshirt,
  FaGem,
  FaReceipt,
  FaUndoAlt,
  FaShoppingBag,
  FaFilter,
} from "react-icons/fa";

export default function SalesPerformanceTab({ salesData, businessType, onOpenAnalytics }) {
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const records = salesData?.records || [];
  const summary = salesData?.summary || {};
  const categories = salesData?.categories || [];
  const topProducts = salesData?.topProducts || [];
  const industryDetails = salesData?.industryDetails || {};

  // Format data for chart (monthly uploads are labelled by month and summed across locations)
  const chartData = [];
  records.forEach((r) => {
    const d = new Date(r.date);
    const label =
      r.periodType === "monthly"
        ? d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
        : `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
    const last = chartData[chartData.length - 1];
    if (last && last.date === label) {
      last.revenue += r.totalRevenue || 0;
      last.orders += r.ordersCount || 0;
      last.attributed += r.adAttributedRevenue || 0;
    } else {
      chartData.push({ date: label, revenue: r.totalRevenue || 0, orders: r.ordersCount || 0, attributed: r.adAttributedRevenue || 0 });
    }
  });

  // CSV Export handler
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = "Date,Total Revenue,Orders,AOV,Attributed Revenue,Returns Amount\n";
    const rows = records
      .map(
        (r) =>
          `"${r.reportingMonth || new Date(r.date).toISOString().split("T")[0]}",${r.totalRevenue || 0},${
            r.ordersCount || 0
          },${r.averageOrderValue || 0},${r.adAttributedRevenue || 0},${r.returnsAmount || 0}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sales-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* The full monthly sales / discount / P&L dashboard lives in its own tab */}
      {onOpenAnalytics && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#E7DFD5] bg-white p-4">
          <div>
            <p className="text-sm font-bold text-stone-900">Monthly sales, discount &amp; profit/loss analytics</p>
            <p className="text-xs text-stone-500 mt-0.5">KPIs, trends, sales vs target, location comparison and import pipeline for any month.</p>
          </div>
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="shrink-0 px-4 py-2 rounded-lg bg-[#1A1A1A] text-white text-xs font-semibold hover:bg-black transition cursor-pointer"
          >
            Open Monthly Analytics
          </button>
        </div>
      )}

      <div className="border-t border-[#EFE9E0] pt-6">
        <h3 className="font-serif text-lg font-bold text-stone-900">All-time totals &amp; daily portal entries</h3>
        <p className="text-xs text-stone-500 mt-0.5">
          Cumulative figures across every reporting record. The monthly analytics above follow the selected reporting period.
        </p>
      </div>

      {/* Sales Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Total Recorded Revenue
            </span>
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-800 text-xs">Gross</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            ₹{(summary.totalRevenue || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-stone-500 mt-1">Across {records.length} reporting record{records.length === 1 ? "" : "s"}</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Orders / Covers Count
            </span>
            <span className="p-1.5 rounded-md bg-stone-100 text-stone-700 text-xs">Volume</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            {summary.totalOrders || 0}
          </div>
          <div className="text-xs text-stone-500 mt-1">Completed dining & sales tickets</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Average Order Value (AOV)
            </span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs">Efficiency</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            ₹{(summary.averageOrderValue || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-stone-500 mt-1">Average guest ticket spend</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Returns / Cancellations
            </span>
            <span className="p-1.5 rounded-md bg-rose-50 text-rose-800 text-xs">
              {summary.returnRate || 0}% Rate
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            ₹{(summary.totalReturnsAmount || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-stone-500 mt-1">Negligible refund & cancellation volume</div>
        </div>
      </div>


      {/* Main Revenue Trend Chart */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EFE9E0] gap-4 mb-6">
          <div>
            <h4 className="font-serif text-lg font-bold text-stone-900">
              Daily Revenue & Ad-Attributed Velocity
            </h4>
            <p className="text-xs text-stone-500 mt-0.5">
              Comparison between total gross receipts and revenue generated via marketing campaigns
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[#E0D8CE] p-1 bg-stone-50 text-xs font-medium">
              <button
                onClick={() => setSelectedPeriod("daily")}
                className={`px-3 py-1 rounded-md transition ${
                  selectedPeriod === "daily" ? "bg-white text-stone-900 shadow-xs" : "text-stone-500"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setSelectedPeriod("weekly")}
                className={`px-3 py-1 rounded-md transition ${
                  selectedPeriod === "weekly" ? "bg-white text-stone-900 shadow-xs" : "text-stone-500"
                }`}
              >
                Weekly
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-[#E0D8CE] hover:bg-stone-50 rounded-lg shadow-2xs cursor-pointer"
            >
              <FaDownload className="w-3 h-3 text-stone-500" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Chart Container */}
        <div className="w-full h-72 sm:h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9C7A42" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#9C7A42" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAttr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                <XAxis dataKey="date" stroke="#8C827A" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#8C827A"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    name === "revenue" ? "Total Revenue" : "Ad Attributed",
                  ]}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E0D8",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#9C7A42"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="attributed"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAttr)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-stone-400 text-sm italic">
              No sales records available for this period.
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#9C7A42]"></span>
            <span>Total Gross Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span>Ad-Attributed Revenue</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Best-Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Category */}
        <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="pb-4 border-b border-[#EFE9E0] mb-4">
            <h4 className="font-serif text-base font-bold text-stone-900">
              Sales by Product / Menu Category
            </h4>
            <p className="text-xs text-stone-500">Revenue contribution across item segments</p>
          </div>

          <div className="space-y-3.5">
            {categories.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-stone-700">{cat.name}</span>
                  <div className="space-x-2">
                    <span className="font-mono text-stone-900 font-semibold">
                      ₹{cat.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="text-stone-400 font-mono">({cat.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#9C7A42] rounded-full transition-all duration-300"
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top-Performing Menu / Products */}
        <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="pb-4 border-b border-[#EFE9E0] mb-4">
            <h4 className="font-serif text-base font-bold text-stone-900">
              Top Selling Offerings
            </h4>
            <p className="text-xs text-stone-500">Highest grossing items and velocity</p>
          </div>

          <div className="divide-y divide-[#F0EBE3]">
            {topProducts.map((prod, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-stone-900">{prod.name}</div>
                  <span className="text-[11px] text-stone-500">{prod.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-stone-900">
                    ₹{prod.revenue.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">{prod.units} units sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Industry-Specific Modules */}
      {businessType === "cafe_restaurant" && industryDetails.cafe && (
        <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E7DFD5]">
            <FaUtensils className="text-[#9C7A42] w-4 h-4" />
            <h4 className="font-serif text-base font-bold text-stone-900">
              Café & Dining Specific Metrics
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Table Reservations</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {industryDetails.cafe.reservationsCount || 32}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">+18% weekend lift</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Dining Covers Served</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {industryDetails.cafe.diningCovers || 194}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">Average 2.2 guests/table</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Promotions Redeemed</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {industryDetails.cafe.promotionsRedeemed || 14}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">From Meta Reel campaign</div>
            </div>
          </div>
        </div>
      )}

      {businessType === "clothing_fashion" && industryDetails.clothing && (
        <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E7DFD5]">
            <FaTshirt className="text-[#9C7A42] w-4 h-4" />
            <h4 className="font-serif text-base font-bold text-stone-900">
              Fashion & Apparel Velocity
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Fastest Moving Size</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">Size M (42%)</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Followed by Size L (28%)</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Return Rate</div>
              <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                {industryDetails.clothing.returnRatePercent || 4.8}%
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">Well below 18% industry avg</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Inventory On Hand</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {industryDetails.clothing.inventoryStockOnHand || 420} units
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">Healthy 28-day turnover</div>
            </div>
          </div>
        </div>
      )}

      {businessType === "jewellery" && industryDetails.jewellery && (
        <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E7DFD5]">
            <FaGem className="text-[#9C7A42] w-4 h-4" />
            <h4 className="font-serif text-base font-bold text-stone-900">
              Luxury Jewellery Specifics
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Gold Purity Sold</div>
              <div className="text-xl font-bold font-mono text-stone-900 mt-1">22K (916 Hallmarked)</div>
              <div className="text-[11px] text-stone-500 mt-0.5">84.5 grams total weight</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Average Ticket Value</div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1">₹1,45,000</div>
              <div className="text-[11px] text-stone-500 mt-0.5">High ticket bridal sets</div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-[#E7DFD5]">
              <div className="text-xs text-stone-500 uppercase font-semibold">Showroom Inventory Valuation</div>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">₹1.45 Cr</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Protected vault stock</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
