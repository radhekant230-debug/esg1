import React from "react";
import {
  FaBullhorn,
  FaGoogle,
  FaFacebook,
  FaCheckCircle,
  FaPauseCircle,
  FaInfoCircle,
  FaPercentage,
  FaDollarSign,
  FaMousePointer,
  FaEye,
  FaFilter,
} from "react-icons/fa";

export default function AdvertisingTab({ campaignData }) {
  const campaigns = campaignData?.campaigns || [];
  const totals = campaignData?.totals || {};

  return (
    <div className="space-y-8">
      {/* Advertising Header & Platform Integrity Note */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Paid Acquisition & Performance Marketing Campaigns
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Real-time campaign telemetry across Meta Ads Manager and Google Ads Search networks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Meta Ads: Connected
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Google Ads: Connected
            </span>
          </div>
        </div>
      </div>

      {/* Aggregate Advertising Totals Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Ad Spend
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{(totals.adSpend || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-stone-400">Media expenditure</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Impressions
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(totals.impressions || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-stone-400">Total views served</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Clicks & CTR
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(totals.clicks || 0).toLocaleString("en-IN")}{" "}
            <span className="text-xs text-stone-500 font-sans font-normal">({totals.ctr || 0}%)</span>
          </div>
          <span className="text-[10px] text-stone-400">Click-through rate</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Cost Per Click (CPC)
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            ₹{totals.cpc || 0}
          </div>
          <span className="text-[10px] text-stone-400">Spend ÷ Total clicks</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Cost Per Lead (CPL)
          </span>
          <div className="text-xl font-bold font-mono text-indigo-900">
            ₹{totals.cpl || 0}
          </div>
          <span className="text-[10px] text-stone-400">{totals.leads || 0} total leads</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Blended ROAS
          </span>
          <div className="text-xl font-bold font-mono text-emerald-800">
            {totals.roas || 0}x
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">₹{(totals.attributedRevenue || 0).toLocaleString("en-IN")} return</span>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#EFE9E0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-serif text-base font-bold text-stone-900">
              Active & Completed Ad Campaigns
            </h4>
            <p className="text-xs text-stone-500">Itemized performance data per ad set</p>
          </div>
          <span className="text-xs text-stone-500 font-mono bg-stone-50 px-2.5 py-1 rounded border border-stone-200">
            Showing {campaigns.length} campaigns
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-600 font-semibold border-b border-[#E7DFD5] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Campaign Name & Objective</th>
                <th className="py-3 px-3">Platform</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Spend</th>
                <th className="py-3 px-3 text-right">Impressions</th>
                <th className="py-3 px-3 text-right">Clicks (CTR)</th>
                <th className="py-3 px-3 text-right">CPC</th>
                <th className="py-3 px-3 text-right">Leads (CPL)</th>
                <th className="py-3 px-3 text-right">Conv. Rate</th>
                <th className="py-3 px-4 text-right">Attributed Rev</th>
                <th className="py-3 px-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9E0] font-sans">
              {campaigns.map((c) => {
                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : "0.00";
                const cpc = c.clicks > 0 ? (c.adSpend / c.clicks).toFixed(2) : "0.00";
                const cpl = c.leads > 0 ? (c.adSpend / c.leads).toFixed(2) : "0.00";
                const convRate = c.clicks > 0 ? ((c.conversions / c.clicks) * 100).toFixed(2) : "0.00";
                const roas = c.adSpend > 0 ? (c.attributedRevenue / c.adSpend).toFixed(2) : "0.00";

                return (
                  <tr key={c._id} className="hover:bg-stone-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900">{c.campaignName}</div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                        <span>Obj: {c.objective}</span>
                        <span>•</span>
                        <span className="italic">{c.dataSource}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                        {c.platform === "Meta Ads" ? (
                          <FaFacebook className="text-blue-600 w-3 h-3" />
                        ) : (
                          <FaGoogle className="text-amber-600 w-3 h-3" />
                        )}
                        {c.platform}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-stone-900">
                      ₹{(c.adSpend || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-stone-600">
                      {(c.impressions || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-stone-700">
                      {(c.clicks || 0).toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] text-stone-400">({ctr}%)</span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-stone-600">
                      ₹{cpc}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-indigo-900">
                      {c.leads || 0} <span className="text-[10px] text-stone-400">(₹{cpl})</span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-stone-600">
                      {convRate}%
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-800">
                      ₹{(c.attributedRevenue || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-900">
                      {roas}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#FAF7F2] border-t border-[#E7DFD5] text-[11px] text-stone-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Calculation logic: CTR = Clicks/Impr × 100 • CPC = Spend/Clicks • CPL = Spend/Leads • ROAS = Attributed Revenue/Spend
          </span>
          <span className="font-mono">Last API Sync: October 10, 2026</span>
        </div>
      </div>
    </div>
  );
}
