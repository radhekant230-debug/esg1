import React from "react";
import {
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaShieldAlt,
  FaCreditCard,
  FaReceipt,
} from "react-icons/fa";

export default function CommercialsInvoicesTab({ invoicesData }) {
  const invoices = invoicesData?.invoices || [];
  const summary = invoicesData?.summary || {};
  const currentPackage = summary?.package || {};

  const getStatusBadge = (status) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Sent":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Overdue":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Commercials, Service Retainers & Invoices
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Official statement of agency service packages, monthly fee commitments, and verified payment vouchers.
            </p>
          </div>
          <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-[#E0D8CE] text-stone-700">
            GST Invoice Compliant
          </span>
        </div>
      </div>

      {/* Package & Billing Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl border border-[#E7DFD5] bg-white shadow-2xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Current Service Retainer
          </span>
          <div className="text-lg font-bold font-serif text-stone-900">
            {currentPackage.name || "Brand Growth & Performance"}
          </div>
          <div className="text-xs text-[#9C7A42] font-semibold mt-1">
            ₹{(currentPackage.monthlyFee || 45000).toLocaleString("en-IN")} / {currentPackage.billingCycle || "Monthly"}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block mb-1">
            Total Paid Receipts
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-900">
            ₹{(summary.totalPaid || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">Verified settled invoices</div>
        </div>

        <div className="p-5 rounded-xl border border-stone-200 bg-white shadow-2xs">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Pending / Outstanding
          </span>
          <div className="text-2xl font-bold font-mono text-stone-900">
            ₹{(summary.totalPending || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-stone-500 mt-1">Upcoming billing obligations</div>
        </div>
      </div>

      {/* Retainer Scope Overview */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <h4 className="font-serif text-base font-bold text-stone-900 mb-3">
          Services Included in Active Retainer
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-stone-700">
          {(currentPackage.servicesIncluded || [
            "Meta & Google Ads Campaign Management & Optimization",
            "Full Creative Content Production (Reels, Static, Carousels)",
            "Google Business Profile Optimization & Local Discovery SEO",
            "Strategic Weekly Growth Analytics & Executive Reporting",
          ]).map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E7DFD5]">
              <FaCheckCircle className="text-emerald-700 w-3.5 h-3.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#EFE9E0] flex justify-between items-center">
          <div>
            <h4 className="font-serif text-base font-bold text-stone-900">
              Tax Invoices & Billing History
            </h4>
            <p className="text-xs text-stone-500">Official commercial statements issued by ESG Officials</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-600 font-semibold border-b border-[#E7DFD5] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-3">Service Package & Scope</th>
                <th className="py-3 px-3">Billing Cycle</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">GST (18%)</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9E0]">
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-stone-50/70 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                    {inv.invoiceNumber}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-stone-900">{inv.servicePackage}</div>
                    <div className="text-[11px] text-stone-500">Issued on {new Date(inv.invoiceDate).toLocaleDateString()}</div>
                  </td>

                  <td className="py-3.5 px-3 font-mono text-stone-600">
                    {inv.billingPeriod}
                  </td>

                  <td className="py-3.5 px-3 font-mono text-stone-600">
                    {new Date(inv.dueDate).toLocaleDateString()}
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono text-stone-700">
                    ₹{(inv.subtotal || 0).toLocaleString("en-IN")}
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono text-stone-500">
                    ₹{(inv.taxAmount || 0).toLocaleString("en-IN")}
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono font-bold text-stone-900">
                    ₹{(inv.totalAmount || 0).toLocaleString("en-IN")}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-800 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200"
                      >
                        <FaDownload className="w-2.5 h-2.5 text-[#9C7A42]" /> PDF
                      </a>
                    ) : (
                      <span className="text-stone-400 text-[11px]">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
