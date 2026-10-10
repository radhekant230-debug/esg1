import React, { useState } from "react";
import api from "../../utils/axios";
import {
  FaCheck,
  FaTimes,
  FaCalendarAlt,
  FaCommentAlt,
  FaHistory,
  FaInstagram,
  FaFacebook,
  FaPlayCircle,
  FaImages,
} from "react-icons/fa";

export default function ContentApprovalsTab({ contentData, onRefresh }) {
  const items = contentData?.items || [];
  const counts = contentData?.counts || {};
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState("Approved"); // "Approved" or "Changes Requested"
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      setIsSubmitting(true);
      await api.put(`/portal/content-calendar/${selectedItem._id}/review`, {
        status: actionType,
        comment: feedbackComment.trim(),
      });
      setSelectedItem(null);
      setFeedbackComment("");
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error submitting review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Pending Approval":
        return "bg-amber-100 text-amber-900 border-amber-200 animate-pulse";
      case "Changes Requested":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Published":
        return "bg-stone-100 text-stone-800 border-stone-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Content Calendar & Creative Approvals
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Review and approve upcoming social media posts, reels, and ad creatives before publication.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
              {counts.pendingApproval || 0} Pending Your Approval
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              {counts.approved || 0} Approved
            </span>
          </div>
        </div>
      </div>

      {/* Content Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item._id}
            className="bg-white border border-[#E7DFD5] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              {/* Creative Thumbnail with Format Badge */}
              <div className="h-56 bg-stone-100 relative overflow-hidden group">
                <img
                  src={item.creativeUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-black/75 text-white backdrop-blur-xs flex items-center gap-1">
                    {item.format === "Reel" ? <FaPlayCircle /> : <FaImages />}
                    {item.format}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/90 text-stone-900 backdrop-blur-xs">
                    {item.platform}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold border backdrop-blur-xs ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-2 font-mono">
                  <FaCalendarAlt className="w-3 h-3 text-[#9C7A42]" />
                  <span>
                    Planned:{" "}
                    {new Date(item.scheduledDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                <h4 className="font-serif font-bold text-stone-900 text-sm mb-2 leading-snug">
                  {item.title}
                </h4>

                <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mb-4 italic bg-stone-50/70 p-2.5 rounded-lg border border-[#EFE9E0]">
                  "{item.caption}"
                </p>

                {item.clientFeedback && (
                  <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800 mb-4">
                    <span className="font-bold block text-[11px] mb-0.5">Your Feedback:</span>
                    {item.clientFeedback}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-[#FAF7F2] border-t border-[#E7DFD5]">
              {item.status === "Pending Approval" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setActionType("Approved");
                    }}
                    className="grow bg-[#1A1A1A] hover:bg-stone-800 text-white text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FaCheck className="w-3 h-3 text-emerald-400" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setActionType("Changes Requested");
                    }}
                    className="grow bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold py-2 px-3 rounded-lg border border-[#D5CEC4] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FaTimes className="w-3 h-3 text-rose-600" /> Request Changes
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
                  <span>Status: {item.status}</span>
                  {item.approvedAt && (
                    <span className="text-emerald-700 font-sans font-medium text-[11px]">
                      Approved on {new Date(item.approvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Approval / Feedback Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-[#E7DFD5]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-serif text-base font-bold text-stone-900">
                  {actionType === "Approved" ? "Approve Creative" : "Request Changes & Feedback"}
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Creative: {selectedItem.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {actionType === "Approved"
                    ? "Approval Notes or Publishing Directives (Optional)"
                    : "Describe Requested Creative or Caption Revisions"}
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder={
                    actionType === "Approved"
                      ? "Looks wonderful, ready for scheduled posting!"
                      : "Please adjust the second frame color palette and mention our weekend lunch hours..."
                  }
                  required={actionType === "Changes Requested"}
                  rows={4}
                  className="w-full text-xs p-3 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer transition ${
                    actionType === "Approved"
                      ? "bg-emerald-800 hover:bg-emerald-900"
                      : "bg-rose-800 hover:bg-rose-900"
                  }`}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : actionType === "Approved"
                    ? "Confirm Creative Approval"
                    : "Send Revision Notes to Agency"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
