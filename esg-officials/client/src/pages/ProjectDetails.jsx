import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaCalendarAlt,
    FaEdit,
    FaProjectDiagram,
    FaSave,
    FaUser,
    FaUserTie,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const ProjectDetails = () => {
    const { user } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [progressError, setProgressError] =
        useState("");

    const [progress, setProgress] = useState(0);

    // ==========================================
    // FETCH PROJECT
    // ==========================================
    useEffect(() => {
        fetchProject();
    }, [id]);

    const fetchProject = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get(
                `/projects/${id}`
            );

            const projectData =
                data?.project || data;

            setProject(projectData);

            setProgress(
                Math.min(
                    Math.max(
                        projectData?.progress || 0,
                        0
                    ),
                    100
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load project."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // DATE FORMAT
    // ==========================================
    const formatDate = (date) => {
        if (!date) return "Not set";

        return new Date(date).toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    // ==========================================
    // STATUS STYLE
    // ==========================================
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

            case "Cancelled":
                return "bg-red-100 text-red-700";

            case "On Hold":
                return "bg-gray-200 text-gray-700";

            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    // ==========================================
    // SAVE MANAGER PROGRESS
    // ==========================================
    const handleProgressSave = async () => {
        try {
            setSaving(true);
            setProgressError("");

            const numericProgress = Number(
                progress
            );

            if (
                Number.isNaN(numericProgress) ||
                numericProgress < 0 ||
                numericProgress > 100
            ) {
                setProgressError(
                    "Progress must be between 0 and 100."
                );
                return;
            }

            const { data } = await api.put(
                `/projects/${id}`,
                {
                    progress: numericProgress,
                }
            );

            const updatedProject =
                data?.project || data;

            setProject(updatedProject);

            setProgress(
                Math.min(
                    Math.max(
                        updatedProject?.progress || 0,
                        0
                    ),
                    100
                )
            );
        } catch (err) {
            setProgressError(
                err.response?.data?.message ||
                    "Unable to update project progress."
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // LOADING
    // ==========================================
    if (loading) {
        return (
            <div className="py-20 text-center">
                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                <p className="text-gray-500 mt-4">
                    Loading project...
                </p>
            </div>
        );
    }

    // ==========================================
    // ERROR
    // ==========================================
    if (error) {
        return (
            <div className="max-w-7xl mx-auto">

                <button
                    onClick={() =>
                        navigate("/projects")
                    }
                    className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6"
                >
                    <FaArrowLeft />
                    Back to Projects
                </button>

                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-5">
                    {error}
                </div>

            </div>
        );
    }

    if (!project) {
        return null;
    }

    // ==========================================
    // PERMISSIONS
    // ==========================================
    const isAdmin =
        user?.role === "admin";

    const isManager =
        user?.role === "manager";

    const displayProgress = Math.min(
        Math.max(progress || 0, 0),
        100
    );

    return (
        <div className="max-w-7xl mx-auto">

            {/* ======================================
                BACK
            ====================================== */}
            <button
                onClick={() =>
                    navigate("/projects")
                }
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6"
            >
                <FaArrowLeft />
                Back to Projects
            </button>

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">

                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">

                    <div className="flex items-start gap-4">

                        <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl shrink-0">
                            <FaProjectDiagram />
                        </div>

                        <div>

                            <div className="flex flex-wrap items-center gap-3">

                                <h1 className="text-2xl sm:text-3xl font-extrabold">
                                    {project.name}
                                </h1>

                                {project.projectId && (
                                    <span className="text-xs bg-gray-700 px-3 py-1 rounded-full">
                                        {project.projectId}
                                    </span>
                                )}

                            </div>

                            <p className="text-gray-300 mt-2 max-w-3xl">
                                {project.description}
                            </p>

                        </div>

                    </div>

                    <div className="flex items-center gap-3">

                        <span
                            className={`px-4 py-2 rounded-full text-sm font-bold ${getStatusStyle(
                                project.status
                            )}`}
                        >
                            {project.status ||
                                "Not Started"}
                        </span>

                        {/* ADMIN FULL EDIT */}
                        {isAdmin && (
                            <button
                                onClick={() =>
                                    navigate(
                                        `/projects/${id}/edit`
                                    )
                                }
                                className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition flex items-center gap-2"
                            >
                                <FaEdit />
                                Edit
                            </button>
                        )}

                    </div>

                </div>

            </div>

            {/* ======================================
                PROGRESS
            ====================================== */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">

                    <div>

                        <h2 className="font-bold text-gray-900">
                            Project Progress
                        </h2>

                        <p className="text-sm text-gray-500">
                            Overall completion
                        </p>

                    </div>

                    <span className="text-2xl font-black">
                        {displayProgress}%
                    </span>

                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">

                    <div
                        className="h-full bg-gray-900 rounded-full transition-all duration-500"
                        style={{
                            width: `${displayProgress}%`,
                        }}
                    />

                </div>

                {/* ==================================
                    MANAGER PROGRESS EDITOR
                ================================== */}
                {isManager && (
                    <div className="mt-6 pt-6 border-t border-gray-100">

                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Update Progress
                        </label>

                        <div className="flex flex-col sm:flex-row gap-3">

                            <div className="relative flex-1">

                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={progress}
                                    onChange={(e) =>
                                        setProgress(
                                            e.target.value
                                        )
                                    }
                                    className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none"
                                />

                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                                    %
                                </span>

                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleProgressSave
                                }
                                disabled={saving}
                                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >

                                <FaSave />

                                {saving
                                    ? "Saving..."
                                    : "Save Progress"}

                            </button>

                        </div>

                        {progressError && (
                            <p className="text-sm text-red-600 mt-2">
                                {progressError}
                            </p>
                        )}

                    </div>
                )}

            </div>

            {/* ======================================
                INFORMATION
            ====================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                <InfoCard
                    icon={<FaUser />}
                    title="Client"
                    value={
                        project.client?.name ||
                        "Not assigned"
                    }
                    extra={
                        project.client?.companyName
                    }
                />

                <InfoCard
                    icon={<FaUserTie />}
                    title="Manager"
                    value={
                        project.assignedManager?.name ||
                        "Not assigned"
                    }
                    extra={
                        project.assignedManager?.email
                    }
                />

                <InfoCard
                    icon={<FaCalendarAlt />}
                    title="Start Date"
                    value={formatDate(
                        project.startDate
                    )}
                />

                <InfoCard
                    icon={<FaCalendarAlt />}
                    title="Deadline"
                    value={formatDate(
                        project.deadline
                    )}
                />

            </div>

        </div>
    );
};

// ==========================================
// INFORMATION CARD
// ==========================================
const InfoCard = ({
    icon,
    title,
    value,
    extra,
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">

            <div className="w-10 h-10 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center mb-4">
                {icon}
            </div>

            <p className="text-xs uppercase font-semibold text-gray-400">
                {title}
            </p>

            <h3 className="font-bold text-gray-900 mt-1">
                {value}
            </h3>

            {extra && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                    {extra}
                </p>
            )}

        </div>
    );
};

export default ProjectDetails;