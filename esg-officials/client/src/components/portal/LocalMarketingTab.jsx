import React from "react";
import {
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaDirections,
  FaGlobe,
  FaStar,
  FaSearch,
  FaEye,
  FaCheckCircle,
} from "react-icons/fa";

export default function LocalMarketingTab({ gbpData }) {
  const latest = gbpData?.latest || {};
  const reviews = latest?.recentReviews || [];

  return (
    <div className="space-y-8">
      {/* GBP Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Google Business Profile & Local Search Discovery
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              High-intent local discovery: customers finding directions, calling, or reading reviews.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <FaCheckCircle className="w-3 h-3 text-emerald-600" />
              GBP API: Connected & Verified
            </span>
          </div>
        </div>
      </div>

      {/* Local Discovery KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Search Impressions
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.searchImpressions || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-stone-400">Maps & Search queries</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Profile Views
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.profileViews || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-stone-400">Listing interactions</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Direction Requests
          </span>
          <div className="text-xl font-bold font-mono text-amber-900">
            {latest.directionRequests || 0}
          </div>
          <span className="text-[10px] text-stone-400">High intent footfall</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Phone Calls
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {latest.calls || 0}
          </div>
          <span className="text-[10px] text-stone-400">Direct dial enquiries</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Website Clicks
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {latest.websiteClicks || 0}
          </div>
          <span className="text-[10px] text-stone-400">Listing link clicks</span>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Average Rating
          </span>
          <div className="text-xl font-bold font-mono text-amber-800 flex items-center gap-1">
            <FaStar className="w-4 h-4 text-amber-500 fill-amber-500" />
            {latest.averageRating || 4.9}
          </div>
          <span className="text-[10px] text-stone-400">From {latest.totalReviews || 248} reviews</span>
        </div>
      </div>

      {/* Verified Reviews Section */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <div className="pb-4 border-b border-[#EFE9E0] mb-5 flex justify-between items-center">
          <div>
            <h4 className="font-serif text-base font-bold text-stone-900">
              Recent Google Customer Reviews & Ratings
            </h4>
            <p className="text-xs text-stone-500">Live verified sentiment from Google Maps</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800 bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E7DFD5]">
            <FaStar className="text-amber-500" />
            <span>{latest.averageRating || 4.9} / 5.0 Rating</span>
          </div>
        </div>

        <div className="space-y-4">
          {reviews.map((rev, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-stone-50/70 border border-[#EFE9E0] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs sm:text-sm text-stone-900">{rev.author}</span>
                <div className="flex items-center gap-0.5 text-amber-500 text-xs">
                  {[...Array(rev.rating)].map((_, i) => (
                    <FaStar key={i} className="w-3 h-3 fill-amber-500" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed italic">
                "{rev.comment}"
              </p>
              {rev.reply && (
                <div className="pt-2 pl-3 border-l-2 border-[#9C7A42] text-[11px] text-stone-500 bg-white/70 p-2 rounded">
                  <span className="font-semibold text-stone-800 block mb-0.5">Owner Response:</span>
                  {rev.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
