import React from "react";
import {
    FaTasks,
    FaCalendarAlt,
    FaUserTie,
    FaArrowRight,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const TaskCard = ({ task }) => {
    const navigate = useNavigate();

    if (!task) return null;

    const getStatusStyle = (status) => {
        switch (status) {
            case "Completed":
                return "bg-green-100 text-green-700";

            case "Approved":
                return "bg-green-100 text-green-700";

            case "In Progress":
                return "bg-blue-100 text-blue-700";

            case "Review":
                return "bg-purple-100 text-purple-700";

            case "Waiting for Approval":
                return "bg-orange-100 text-orange-700";

            case "Rejected":
                return "bg-red-100 text-red-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    const getPriorityStyle = (priority) => {
        switch (priority) {
            case "Urgent":
                return "text-red-600";

            case "High":
                return "text-orange-600";

            case "Medium":
                return "text-yellow-600";

            case "Low":
                return "text-green-600";

            default:
                return "text-gray-600";
        }
    };

    const formatDate = (date) => {
        if (!date) return "Not set";

        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const handleViewTask = () => {
        navigate(`/tasks/${task._id}`);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg hover:shadow-xl transition duration-300 overflow-hidden">

            {/* Main Content */}
            <div className="p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">

                    <div className="flex items-start gap-3 min-w-0">

                        <div className="w-11 h-11 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center shadow-md">
                            <FaTasks />
                        </div>

                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                {task.title}
                            </h3>

                            {task.taskId && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {task.taskId}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    <span
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                            task.status
                        )}`}
                    >
                        {task.status || "Pending"}
                    </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-2">
                    {task.description || "No description available."}
                </p>

                {/* Project */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-400 mb-1">
                        Project
                    </p>

                    <p className="text-sm font-semibold text-gray-800 truncate">
                        {task.project?.name || "No project assigned"}
                    </p>
                </div>

                {/* Task Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                    {/* Manager */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaUserTie className="text-gray-500 shrink-0" />

                        <div className="min-w-0">
                            <p className="text-xs text-gray-400">
                                Assigned Manager
                            </p>

                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {task.assignedManager?.name ||
                                    "Not assigned"}
                            </p>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaCalendarAlt className="text-gray-500 shrink-0" />

                        <div>
                            <p className="text-xs text-gray-400">
                                Due Date
                            </p>

                            <p className="text-sm font-semibold text-gray-800">
                                {formatDate(task.dueDate)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">
                        Priority
                    </span>

                    <span
                        className={`text-sm font-bold ${getPriorityStyle(
                            task.priority
                        )}`}
                    >
                        {task.priority || "Medium"}
                    </span>
                </div>

                {/* Progress */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                            Progress
                        </span>

                        <span className="text-sm font-bold text-gray-900">
                            {task.progress || 0}%
                        </span>
                    </div>

                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gray-900 rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(
                                    Math.max(
                                        task.progress || 0,
                                        0
                                    ),
                                    100
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">

                <div className="text-xs text-gray-500">
                    {task.createdAt
                        ? `Created ${formatDate(task.createdAt)}`
                        : "Task"}
                </div>

                <button
                    type="button"
                    onClick={handleViewTask}
                    className="flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-gray-600 transition"
                >
                    View Task
                    <FaArrowRight className="text-xs" />
                </button>
            </div>
        </div>
    );
};

export default TaskCard;