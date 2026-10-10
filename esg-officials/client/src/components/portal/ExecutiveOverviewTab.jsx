import React from "react";
import {
  FaArrowUp,
  FaArrowDown,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationCircle,
  FaClock,
  FaBullhorn,
  FaDollarSign,
  FaUserFriends,
  FaShoppingBag,
  FaGlobe,
  FaShareAlt,
  FaHeart,
  FaPercentage,
  FaReceipt,
} from "react-icons/fa";

export default function ExecutiveOverviewTab({ data, businessType, onNavigateTab }) {
  const metrics = data?.metrics || {};

  const cardList = [
    {
      key: "totalSalesRevenue",
      title: "Total Sales Revenue",
      data: metrics.totalSalesRevenue,
      icon: FaDollarSign,
      color: "text-amber-800",
      bgColor: "bg-amber-50/70",
      borderColor: "border-amber-200/60",
      subtext: "Gross sales across all channels",
      tab: "sales",
    },
    {
      key: "advertisingSpend",
      title: "Advertising Spend",
      data: metrics.advertisingSpend,
      icon: FaBullhorn,
      color: "text-stone-800",
      bgColor: "bg-stone-50/70",
      borderColor: "border-stone-200/60",
      subtext: "Meta Ads & Google Ads media spend",
      tab: "advertising",
    },
    {
      key: "adAttributedRevenue",
      title: "Ad-Attributed Revenue",
      data: metrics.adAttributedRevenue,
      icon: FaReceipt,
      color: "text-emerald-800",
      bgColor: "bg-emerald-50/60",
      borderColor: "border-emerald-200/60",
      subtext: "Tracked directly from paid campaigns",
      tab: "advertising",
    },
    {
      key: "roas",
      title: "Return on Ad Spend (ROAS)",
      data: metrics.roas,
      icon: FaPercentage,
      color: "text-amber-900",
      bgColor: "bg-amber-50/60",
      borderColor: "border-amber-200/60",
      subtext: "Attributed Revenue ÷ Ad Spend",
      tab: "advertising",
    },
    {
      key: "leadsAndEnquiries",
      title: "Leads & Enquiries",
      data: metrics.leadsAndEnquiries,
      icon: FaUserFriends,
      color: "text-indigo-900",
      bgColor: "bg-indigo-50/50",
      borderColor: "border-indigo-200/50",
      subtext: "Validated customer inquiries",
      tab: "leads",
    },
    {
      key: "costPerLead",
      title: "Cost Per Lead (CPL)",
      data: metrics.costPerLead,
      icon: FaInfoCircle,
      color: "text-blue-900",
      bgColor: "bg-blue-50/50",
      borderColor: "border-blue-200/50",
      subtext: "Ad Spend ÷ Qualified Leads",
      tab: "leads",
    },
    {
      key: "ordersOrReservations",
      title: businessType === "cafe_restaurant" ? "Orders & Reservations" : "Customer Orders",
      data: metrics.ordersOrReservations,
      icon: FaShoppingBag,
      color: "text-amber-800",
      bgColor: "bg-amber-50/50",
      borderColor: "border-amber-200/50",
      subtext: businessType === "cafe_restaurant" ? "Dine-in covers & table bookings" : "Completed purchase transactions",
      tab: "sales",
    },
    {
      key: "socialReach",
      title: "Social Media Reach",
      data: metrics.socialReach,
      icon: FaShareAlt,
      color: "text-rose-900",
      bgColor: "bg-rose-50/50",
      borderColor: "border-rose-200/50",
      subtext: "Unique accounts reached on Instagram & Meta",
      tab: "social",
    },
    {
      key: "engagementRate",
      title: "Engagement Rate",
      data: metrics.engagementRate,
      icon: FaHeart,
      color: "text-pink-900",
      bgColor: "bg-pink-50/50",
      borderColor: "border-pink-200/50",
      subtext: "Interactions ÷ Total Impressions",
      tab: "social",
    },
    {
      key: "websiteVisits",
      title: "Website & Search Clicks",
      data: metrics.websiteVisits,
      icon: FaGlobe,
      color: "text-cyan-900",
      bgColor: "bg-cyan-50/50",
      borderColor: "border-cyan-200/50",
      subtext: "Visits from search, ads, and local profile",
      tab: "google_business",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Financial Attribution Notice & Clarity Banner */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#9C7A42]"></span>
              <h3 className="font-serif text-lg font-semibold text-[#1A1A1A]">
                Executive Reporting Summary • October 2026 Cycle
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-600">
              Clear financial attribution separating gross revenue, paid campaign returns, and verified agency investment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="bg-white border border-[#E0D8CE] px-3 py-1.5 rounded-md text-stone-700 shadow-2xs">
              Agency Retainer: <strong className="text-stone-900 font-sans">{metrics.agencyServiceFee?.formatted || "₹45,000/mo"}</strong>
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-md">
              Data Status: Verified Records
            </span>
          </div>
        </div>
      </div>

      {/* 10 Executive Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cardList.map((card) => {
          const item = card.data || {};
          const Icon = card.icon;
          const hasData = item.hasData !== false && item.value !== undefined && item.value !== null && item.value !== 0;

          return (
            <div
              key={card.key}
              onClick={() => onNavigateTab && onNavigateTab(card.tab)}
              className={`p-5 rounded-xl border ${card.borderColor} ${card.bgColor} transition-all duration-200 hover:shadow-md hover:border-[#C4B296] cursor-pointer flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
                    {card.title}
                  </span>
                  <div className={`p-2 rounded-lg bg-white/80 border border-stone-200/50 ${card.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="my-2">
                  {hasData ? (
                    <div className="text-2xl font-bold text-stone-900 font-mono tracking-tight">
                      {item.formatted || item.value}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-stone-400 italic flex items-center gap-1.5 py-1">
                      <FaClock className="w-3 h-3 text-stone-400" />
                      {item.status || "Awaiting report"}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200/40 text-xs">
                {hasData && item.changePct !== null && item.changePct !== undefined ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {item.changePct >= 0 ? (
                      <span className="text-emerald-700 flex items-center font-semibold">
                        <FaArrowUp className="w-2.5 h-2.5 mr-0.5" />+{item.changePct}%
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center font-semibold">
                        <FaArrowDown className="w-2.5 h-2.5 mr-0.5" />{item.changePct}%
                      </span>
                    )}
                    <span className="text-stone-500 text-[11px]">vs prior cycle</span>
                  </div>
                ) : (
                  <span className="text-stone-500 text-[11px] leading-tight block">
                    {card.subtext}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Attribution Breakdown Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#EFE9E0] mb-5">
            <div>
              <h4 className="font-serif text-lg font-bold text-stone-900">
                Marketing Return & Revenue Attribution Breakdown
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Strict separation of gross business revenue, marketing attribution, and agency costs
              </p>
            </div>
            <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2.5 py-1 rounded">
              Verified Reconciliation
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs sm:text-sm font-medium text-stone-700 mb-1.5">
                <span>Total Gross Sales Revenue</span>
                <span className="font-mono font-bold text-stone-900">{metrics.totalSalesRevenue?.formatted || "₹0"}</span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1A1A1A] rounded-full" style={{ width: "100%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm font-medium text-stone-700 mb-1.5">
                <span>Paid Ads Attributed Revenue (Direct Tracked)</span>
                <span className="font-mono font-bold text-emerald-800">{metrics.adAttributedRevenue?.formatted || "₹0"}</span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: "52%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm font-medium text-stone-700 mb-1.5">
                <span>Advertising Media Spend (Meta & Google)</span>
                <span className="font-mono font-bold text-amber-800">{metrics.advertisingSpend?.formatted || "₹0"}</span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#9C7A42] rounded-full" style={{ width: "16%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs sm:text-sm font-medium text-stone-700 mb-1.5">
                <span>ESG Officials Agency Management Retainer</span>
                <span className="font-mono font-bold text-stone-700">{metrics.agencyServiceFee?.formatted || "₹45,000"}</span>
              </div>
              <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-stone-400 rounded-full" style={{ width: "9%" }}></div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#EFE9E0] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-500 gap-2">
            <span className="italic">
              * Attribution rule: Revenue is categorized as ad-attributed only when matched to campaign UTM parameters or verified reservation codes.
            </span>
            <button
              onClick={() => onNavigateTab && onNavigateTab("advertising")}
              className="text-[#9C7A42] font-semibold hover:underline self-start sm:self-auto cursor-pointer"
            >
              View Campaign Details &rarr;
            </button>
          </div>
        </div>

        {/* Quick Summary / Status Card */}
        <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FaCheckCircle className="text-emerald-700 w-4 h-4" />
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Strategy & Growth Pulse
              </h4>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              All core marketing channels are operating under optimized ROAS targets. Weekend demand generation is delivering maximum table/order conversion with lowered customer acquisition cost.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E7DFD5]">
                <span className="text-stone-600">Active Retainer Package</span>
                <span className="font-semibold text-stone-900">Performance Growth</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E7DFD5]">
                <span className="text-stone-600">Content Approval Queue</span>
                <span className="font-semibold text-amber-800">1 Item Pending</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E7DFD5]">
                <span className="text-stone-600">Next Strategy Sync</span>
                <span className="font-semibold text-stone-900">Thursday, 3:00 PM</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E7DFD5]">
            <button
              onClick={() => onNavigateTab && onNavigateTab("content_calendar")}
              className="w-full bg-[#1A1A1A] hover:bg-stone-800 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-center block"
            >
              Review Pending Creatives
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
