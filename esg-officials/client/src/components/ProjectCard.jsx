import React from "react";
import {
    FaProjectDiagram,
    FaCalendarAlt,
    FaUserTie,
    FaArrowRight,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const ProjectCard = ({ project }) => {
    const navigate = useNavigate();

    if (!project) return null;

    const getStatusStyle = (status) => {
        switch (status) {
            case "Completed":
                return "bg-green-100 text-green-700";

            case "In Progress":
                return "bg-blue-100 text-blue-700";

            case "Planning":
                return "bg-yellow-100 text-yellow-700";

            case "Waiting for Client":
                return "bg-orange-100 text-orange-700";

            case "On Hold":
                return "bg-gray-200 text-gray-700";

            case "Cancelled":
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

    const handleViewProject = () => {
        navigate(`/projects/${project._id}`);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-lg hover:shadow-xl transition duration-300 overflow-hidden">

            {/* Top Section */}
            <div className="p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">

                    <div className="flex items-start gap-3 min-w-0">

                        <div className="w-11 h-11 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center shadow-md">
                            <FaProjectDiagram />
                        </div>

                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                {project.name}
                            </h3>

                            {project.projectId && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {project.projectId}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    <span
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                            project.status
                        )}`}
                    >
                        {project.status || "Not Started"}
                    </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-2">
                    {project.description || "No description available."}
                </p>

                {/* Project Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                    {/* Manager */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaUserTie className="text-gray-500 shrink-0" />

                        <div className="min-w-0">
                            <p className="text-xs text-gray-400">
                                Manager
                            </p>

                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {project.assignedManager?.name ||
                                    "Not assigned"}
                            </p>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <FaCalendarAlt className="text-gray-500 shrink-0" />

                        <div>
                            <p className="text-xs text-gray-400">
                                Deadline
                            </p>

                            <p className="text-sm font-semibold text-gray-800">
                                {formatDate(project.deadline)}
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
                            project.priority
                        )}`}
                    >
                        {project.priority || "Medium"}
                    </span>
                </div>

                {/* Progress */}
                <div>

                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                            Progress
                        </span>

                        <span className="text-sm font-bold text-gray-900">
                            {project.progress || 0}%
                        </span>
                    </div>

                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gray-900 rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(
                                    Math.max(
                                        project.progress || 0,
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
                    Started:{" "}
                    <span className="font-medium text-gray-700">
                        {formatDate(project.startDate)}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handleViewProject}
                    className="flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-gray-600 transition"
                >
                    View Project
                    <FaArrowRight className="text-xs" />
                </button>
            </div>
        </div>
    );
};

export default ProjectCard;