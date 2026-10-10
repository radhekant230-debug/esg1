import React, { useState } from "react";
import {
    FaClipboardCheck,
    FaCalendarAlt,
    FaUserTie,
    FaCheck,
    FaTimes,
} from "react-icons/fa";
import api from "../utils/axios";

const ApprovalCard = ({ approval, onAction }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!approval) return null;

    const formatDate = (date) => {
        if (!date) return "Not available";

        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const status = approval.status || "pending";

    const getStatusStyle = () => {
        switch (status.toLowerCase()) {
            case "approved":
                return "bg-green-100 text-green-700";

            case "rejected":
                return "bg-red-100 text-red-700";

            case "pending":
                return "bg-yellow-100 text-yellow-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    const handleAction = async (action) => {
        setLoading(true);
        setError("");

        try {
            const endpoint =
                action === "approve"
                    ? `/approvals/${approval._id}/approve`
                    : `/approvals/${approval._id}/reject`;

            const { data } = await api.put(endpoint);

            if (onAction) {
                onAction(data, action);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    `Unable to ${action} this request.`
            );
        } finally {
            setLoading(false);
        }
    };

    const isPending = status.toLowerCase() === "pending";

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg hover:shadow-xl transition duration-300 overflow-hidden">

            {/* Main Content */}
            <div className="p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">

                    <div className="flex items-start gap-3 min-w-0">

                        <div className="w-11 h-11 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center shadow-md">
                            <FaClipboardCheck />
                        </div>

                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                {approval.title ||
                                    approval.subject ||
                                    "Approval Request"}
                            </h3>

                            <p className="text-xs text-gray-500 mt-1">
                                {approval.project?.name ||
                                    approval.projectName ||
                                    "Project"}
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <span
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle()}`}
                    >
                        {status}
                    </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-3">
                    {approval.description ||
                        approval.message ||
                        "No additional information available."}
                </p>

                {/* Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                    {/* Requested By */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaUserTie className="text-gray-500 shrink-0" />

                        <div className="min-w-0">
                            <p className="text-xs text-gray-400">
                                Requested By
                            </p>

                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {approval.requestedBy?.name ||
                                    approval.createdBy?.name ||
                                    "System"}
                            </p>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaCalendarAlt className="text-gray-500 shrink-0" />

                        <div>
                            <p className="text-xs text-gray-400">
                                Requested On
                            </p>

                            <p className="text-sm font-semibold text-gray-800">
                                {formatDate(
                                    approval.createdAt ||
                                        approval.requestedAt
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Client Actions */}
                {isPending && (
                    <div className="flex flex-col sm:flex-row gap-3">

                        <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                                handleAction("approve")
                            }
                            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <FaCheck />

                            {loading
                                ? "Processing..."
                                : "Approve"}
                        </button>

                        <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                                handleAction("reject")
                            }
                            className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 font-bold py-3 rounded-lg border border-gray-300 hover:bg-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <FaTimes />

                            {loading
                                ? "Processing..."
                                : "Reject"}
                        </button>
                    </div>
                )}

                {/* Already Processed */}
                {!isPending && (
                    <div
                        className={`text-center py-3 rounded-lg text-sm font-semibold ${getStatusStyle()}`}
                    >
                        This request has been {status.toLowerCase()}.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">

                <span className="text-xs text-gray-500">
                    Approval Request
                </span>

                {approval.project?.projectId && (
                    <span className="text-xs font-semibold text-gray-700">
                        {approval.project.projectId}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ApprovalCard;