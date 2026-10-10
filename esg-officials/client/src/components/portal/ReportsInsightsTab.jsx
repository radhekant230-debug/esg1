import React, { useState } from "react";
import {
  FaFilePdf,
  FaDownload,
  FaCheckCircle,
  FaExclamationCircle,
  FaCompass,
  FaCalendarAlt,
  FaLightbulb,
} from "react-icons/fa";

export default function ReportsInsightsTab({ reportsData }) {
  const reports = reportsData?.reports || [];
  const [selectedReport, setSelectedReport] = useState(reports[0] || null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Executive Reports & Strategic Growth Intelligence
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Data-backed marketing reviews, strategic recommendations, and verified monthly milestones.
            </p>
          </div>
          <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-[#E0D8CE] text-stone-700">
            {reports.length} Reports Published
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports Archive List */}
        <div className="space-y-3">
          <h4 className="font-serif text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">
            Archived Reports
          </h4>

          {reports.map((r) => {
            const isSelected = selectedReport?._id === r._id;
            return (
              <div
                key={r._id}
                onClick={() => setSelectedReport(r)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-white border-[#9C7A42] shadow-md ring-1 ring-[#9C7A42]/30"
                    : "bg-[#FAF7F2] border-[#E7DFD5] hover:bg-white hover:border-[#C7BAA8]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-400 mb-1 font-mono">
                    <span>{r.period}</span>
                    <span className="text-[#9C7A42] font-semibold">{r.reportType}</span>
                  </div>
                  <h5 className="font-serif font-bold text-stone-900 text-xs sm:text-sm">
                    {r.title}
                  </h5>
                </div>

                <div className="pt-3 border-t border-[#EFE9E0] mt-3 flex items-center justify-between text-xs text-stone-500">
                  <span className="flex items-center gap-1 text-red-700 font-medium">
                    <FaFilePdf className="w-3.5 h-3.5" /> PDF Attached
                  </span>
                  <span className="text-[11px] font-mono">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Report Inspection View */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#EFE9E0] gap-4">
                <div>
                  <span className="text-xs font-mono font-bold text-[#9C7A42] uppercase tracking-wider">
                    {selectedReport.reportType} • {selectedReport.period}
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 mt-1">
                    {selectedReport.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Compiled by {selectedReport.authorName} • {selectedReport.dataSource}
                  </p>
                </div>

                {selectedReport.pdfUrl && (
                  <a
                    href={selectedReport.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
                  >
                    <FaDownload className="w-3 h-3 text-[#9C7A42]" />
                    Download PDF
                  </a>
                )}
              </div>

              {/* Executive Summary */}
              <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5">
                <h4 className="font-serif font-bold text-stone-900 text-sm mb-2">
                  Executive Briefing
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {selectedReport.summary}
                </p>
              </div>

              {/* Key Verified Metrics */}
              {selectedReport.keyMetrics && (
                <div>
                  <h4 className="font-serif font-bold text-stone-900 text-sm mb-3">
                    Validated Performance Metrics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Total Sales Revenue</span>
                      <span className="text-base font-bold font-mono text-stone-900 mt-0.5 block">
                        ₹{(selectedReport.keyMetrics.totalSales || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Advertising Spend</span>
                      <span className="text-base font-bold font-mono text-stone-900 mt-0.5 block">
                        ₹{(selectedReport.keyMetrics.adSpend || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Return on Ad Spend</span>
                      <span className="text-base font-bold font-mono text-emerald-800 mt-0.5 block">
                        {selectedReport.keyMetrics.roas || 0}x
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Generated Leads</span>
                      <span className="text-base font-bold font-mono text-indigo-900 mt-0.5 block">
                        {selectedReport.keyMetrics.leads || 0}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Social Reach</span>
                      <span className="text-base font-bold font-mono text-rose-900 mt-0.5 block">
                        {(selectedReport.keyMetrics.socialReach || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <span className="text-stone-500 block">Engagement Rate</span>
                      <span className="text-base font-bold font-mono text-pink-800 mt-0.5 block">
                        {selectedReport.keyMetrics.engagementRate || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Achievements & Improvement Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs mb-2">
                    <FaCheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Key Achievements & Milestones</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                    {selectedReport.achievements?.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs mb-2">
                    <FaExclamationCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Areas Requiring Optimization</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                    {selectedReport.areasForImprovement?.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Strategic Roadmap */}
              {selectedReport.nextMonthPlan && (
                <div className="p-5 rounded-xl border border-[#E7DFD5] bg-[#FAF7F2]">
                  <div className="flex items-center gap-1.5 text-stone-900 font-bold text-xs mb-2">
                    <FaCompass className="w-3.5 h-3.5 text-[#9C7A42]" />
                    <span>Next Cycle Strategic Action Plan</span>
                  </div>
                  <ul className="space-y-2 text-xs text-stone-700">
                    {selectedReport.nextMonthPlan.map((plan, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-[#9C7A42] font-bold">0{i + 1}.</span>
                        <span>{plan}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#E7DFD5] rounded-xl p-12 text-center text-stone-400 italic">
              Select a report from the archive to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
