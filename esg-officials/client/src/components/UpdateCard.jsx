import React from "react";
import {
    FaBullhorn,
    FaCalendarAlt,
    FaUser,
    FaArrowRight,
} from "react-icons/fa";

const UpdateCard = ({ update, onView }) => {
    if (!update) return null;

    const formatDate = (date) => {
        if (!date) return "Not available";

        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getTypeStyle = (type) => {
        switch (type) {
            case "Important":
                return "bg-red-100 text-red-700";

            case "Milestone":
                return "bg-green-100 text-green-700";

            case "Progress":
                return "bg-blue-100 text-blue-700";

            case "General":
                return "bg-gray-100 text-gray-600";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    const handleView = () => {
        if (onView) {
            onView(update);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg hover:shadow-xl transition duration-300 overflow-hidden">

            {/* Main Content */}
            <div className="p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">

                    <div className="flex items-start gap-3 min-w-0">

                        <div className="w-11 h-11 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center shadow-md">
                            <FaBullhorn />
                        </div>

                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                {update.title || "Project Update"}
                            </h3>

                            <p className="text-xs text-gray-500 mt-1">
                                {update.project?.name ||
                                    update.projectName ||
                                    "Project Update"}
                            </p>
                        </div>
                    </div>

                    {/* Update Type */}
                    {update.type && (
                        <span
                            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${getTypeStyle(
                                update.type
                            )}`}
                        >
                            {update.type}
                        </span>
                    )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-3">
                    {update.description ||
                        update.content ||
                        "No update description available."}
                </p>

                {/* Update Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Posted By */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaUser className="text-gray-500 shrink-0" />

                        <div className="min-w-0">
                            <p className="text-xs text-gray-400">
                                Posted By
                            </p>

                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {update.createdBy?.name ||
                                    update.postedBy?.name ||
                                    "System"}
                            </p>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaCalendarAlt className="text-gray-500 shrink-0" />

                        <div>
                            <p className="text-xs text-gray-400">
                                Date
                            </p>

                            <p className="text-sm font-semibold text-gray-800">
                                {formatDate(
                                    update.createdAt ||
                                        update.date
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">

                <div className="text-xs text-gray-500">
                    Project Update
                </div>

                <button
                    type="button"
                    onClick={handleView}
                    className="flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-gray-600 transition"
                >
                    View Update
                    <FaArrowRight className="text-xs" />
                </button>
            </div>
        </div>
    );
};

export default UpdateCard;