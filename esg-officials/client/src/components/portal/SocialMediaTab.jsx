import React from "react";
import {
  FaInstagram,
  FaFacebook,
  FaHeart,
  FaComment,
  FaShare,
  FaBookmark,
  FaExternalLinkAlt,
  FaUserPlus,
  FaChartLine,
  FaPlayCircle,
  FaImages,
} from "react-icons/fa";

export default function SocialMediaTab({ socialData }) {
  const latest = socialData?.latest || {};
  const topPosts = latest?.topPosts || [];

  return (
    <div className="space-y-8">
      {/* Social Media Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Organic & Amplified Social Media Performance
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              Audience acquisition, viral video reach, and community engagement analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
              <FaInstagram className="w-3.5 h-3.5 text-rose-600" />
              Instagram: Connected (@cafemysa.official)
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
              <FaFacebook className="w-3.5 h-3.5 text-blue-600" />
              Meta Page: Connected
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Followers
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.followers || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-1">
            +{(latest.followerGrowth || 0).toLocaleString("en-IN")} this month
          </div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Unique Reach
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.reach || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Unique accounts</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Impressions
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.impressions || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Total feed exposures</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Engagement Rate
          </span>
          <div className="text-xl font-bold font-mono text-pink-800">
            {latest.engagementRate || 0}%
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Interactions ÷ Reach</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Profile Visits
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.profileVisits || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Brand exploration</div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-4 rounded-xl shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Bio Link Clicks
          </span>
          <div className="text-xl font-bold font-mono text-stone-900">
            {(latest.linkClicks || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">Menu & table reserve</div>
        </div>
      </div>

      {/* Content Format Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-600 block">Reels & Short Video</span>
            <span className="text-sm text-stone-500">62% of total reach</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-700 rounded-lg">
            <FaPlayCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-600 block">Carousels & Guides</span>
            <span className="text-sm text-stone-500">26% highest save rate</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg">
            <FaImages className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E7DFD5] p-5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-stone-600 block">Posting Frequency</span>
            <span className="text-sm text-stone-500">3-4 High quality posts / week</span>
          </div>
          <div className="p-3 bg-stone-100 text-stone-800 rounded-lg">
            <FaChartLine className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Top-Performing Posts Visual Cards */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <div className="pb-4 border-b border-[#EFE9E0] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-serif text-base font-bold text-stone-900">
              Top Performing Creatives & Content
            </h4>
            <p className="text-xs text-stone-500">Visual preview of highest engaging posts published this cycle</p>
          </div>
          <span className="text-xs font-mono text-stone-500 bg-stone-50 px-2 py-1 rounded border border-stone-200">
            Source: {latest.dataSource || "Instagram Graph API"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topPosts.map((post, idx) => (
            <div
              key={idx}
              className="border border-[#E7DFD5] rounded-xl overflow-hidden bg-white shadow-2xs hover:shadow-md transition flex flex-col sm:flex-row"
            >
              <div className="sm:w-48 h-48 sm:h-auto bg-stone-100 shrink-0 relative overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white backdrop-blur-xs">
                  {post.format}
                </span>
              </div>

              <div className="p-4 flex flex-col justify-between grow">
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                    <span>{new Date(post.postDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="text-rose-700 font-semibold font-mono">{post.reach.toLocaleString()} Reach</span>
                  </div>
                  <h5 className="font-semibold text-stone-900 text-xs sm:text-sm mb-1">{post.title}</h5>
                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {post.caption}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#F0EBE3] mt-3 flex items-center justify-between text-xs font-mono text-stone-700">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-rose-700">
                      <FaHeart className="w-3 h-3" /> {post.likes}
                    </span>
                    <span className="flex items-center gap-1 text-stone-600">
                      <FaComment className="w-3 h-3" /> {post.comments}
                    </span>
                    <span className="flex items-center gap-1 text-stone-600">
                      <FaShare className="w-3 h-3" /> {post.shares}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
