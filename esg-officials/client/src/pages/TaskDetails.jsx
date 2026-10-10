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
    FaTasks,
    FaUserTie,
    FaSave,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const TaskDetails = () => {
    const { user } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [savingProgress, setSavingProgress] =
        useState(false);

    const [progressInput, setProgressInput] =
        useState(0);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ==========================================
    // FETCH TASK
    // ==========================================
    useEffect(() => {
        fetchTask();
    }, [id]);

    const fetchTask = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get(
                `/tasks/${id}`
            );

            const taskData = data?.task || data;

            setTask(taskData);
            setProgressInput(
                taskData?.progress || 0
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load task."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FORMAT DATE
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
    // ROLE PERMISSIONS
    // ==========================================
    const isAdmin =
        user?.role === "admin";

    const isManager =
        user?.role === "manager";

    const canEditProgress =
        isAdmin || isManager;

    // ==========================================
    // UPDATE PROGRESS
    // ==========================================
    const handleProgressUpdate = async () => {
        const value = Number(progressInput);

        if (
            Number.isNaN(value) ||
            value < 0 ||
            value > 100
        ) {
            setError(
                "Progress must be between 0 and 100."
            );
            return;
        }

        try {
            setSavingProgress(true);
            setError("");
            setSuccess("");

            const { data } = await api.put(
                `/tasks/${id}`,
                {
                    progress: value,
                }
            );

            const updatedTask =
                data?.task || data;

            setTask(updatedTask);
            setProgressInput(
                updatedTask?.progress ?? value
            );

            setSuccess(
                "Task progress updated successfully."
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update task progress."
            );
        } finally {
            setSavingProgress(false);
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
                    Loading task...
                </p>
            </div>
        );
    }

    // ==========================================
    // ERROR
    // ==========================================
    if (error && !task) {
        return (
            <div className="max-w-7xl mx-auto">
                <button
                    type="button"
                    onClick={() =>
                        navigate("/tasks")
                    }
                    className="flex items-center gap-2 mb-6 text-sm font-semibold"
                >
                    <FaArrowLeft />
                    Back to Tasks
                </button>

                <div className="bg-red-50 text-red-600 p-5 rounded-xl">
                    {error}
                </div>
            </div>
        );
    }

    if (!task) return null;

    const progress = Math.min(
        Math.max(
            Number(task.progress) || 0,
            0
        ),
        100
    );

    return (
        <div className="max-w-7xl mx-auto">

            {/* ======================================
                BACK
            ====================================== */}
            <button
                type="button"
                onClick={() =>
                    navigate("/tasks")
                }
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-6 hover:text-gray-900"
            >
                <FaArrowLeft />
                Back to Tasks
            </button>

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8">

                <div className="flex flex-col lg:flex-row justify-between gap-5">

                    <div className="flex gap-4">

                        <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center shrink-0">
                            <FaTasks />
                        </div>

                        <div>

                            <div className="flex flex-wrap items-center gap-3">

                                <h1 className="text-2xl sm:text-3xl font-extrabold">
                                    {task.title}
                                </h1>

                                {task.taskId && (
                                    <span className="text-xs bg-gray-700 px-3 py-1 rounded-full">
                                        {task.taskId}
                                    </span>
                                )}

                            </div>

                            <p className="text-gray-300 mt-2">
                                {task.description ||
                                    "No description available."}
                            </p>

                        </div>
                    </div>

                    {/* ADMIN ONLY FULL EDIT */}
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    `/tasks/${id}/edit`
                                )
                            }
                            className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 h-fit hover:bg-gray-100 transition"
                        >
                            <FaEdit />
                            Edit Task
                        </button>
                    )}

                </div>
            </div>

            {/* ======================================
                ERROR / SUCCESS
            ====================================== */}
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-xl mb-5">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-700 border border-green-100 p-4 rounded-xl mb-5">
                    {success}
                </div>
            )}

            {/* ======================================
                PROGRESS
            ====================================== */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">

                <div className="flex items-center justify-between mb-3">

                    <h2 className="font-bold text-gray-900">
                        Progress
                    </h2>

                    <span className="font-black text-gray-900">
                        {progress}%
                    </span>

                </div>

                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gray-900 rounded-full transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                        }}
                    />
                </div>

                {/* MANAGER / ADMIN PROGRESS EDIT */}
                {canEditProgress && (
                    <div className="mt-6 pt-5 border-t border-gray-100">

                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Update Progress
                        </label>

                        <div className="flex flex-col sm:flex-row gap-3">

                            <div className="flex-1 relative">

                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={
                                        progressInput
                                    }
                                    onChange={(e) => {
                                        setProgressInput(
                                            e.target.value
                                        );
                                        setSuccess("");
                                        setError("");
                                    }}
                                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                                />

                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                                    %
                                </span>

                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleProgressUpdate
                                }
                                disabled={
                                    savingProgress
                                }
                                className="px-5 py-3 bg-gray-900 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaSave />

                                {savingProgress
                                    ? "Saving..."
                                    : "Save Progress"}
                            </button>

                        </div>

                        {isManager && (
                            <p className="text-xs text-gray-500 mt-2">
                                As a manager, you can update
                                the progress percentage of
                                your assigned tasks.
                            </p>
                        )}

                    </div>
                )}

            </div>

            {/* ======================================
                TASK INFORMATION
            ====================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                <Info
                    icon={<FaProjectDiagram />}
                    title="Project"
                    value={
                        task.project?.name ||
                        "Not assigned"
                    }
                />

                <Info
                    icon={<FaUserTie />}
                    title="Manager"
                    value={
                        task.assignedManager?.name ||
                        "Not assigned"
                    }
                />

                <Info
                    icon={<FaCalendarAlt />}
                    title="Due Date"
                    value={formatDate(
                        task.dueDate
                    )}
                />

                <Info
                    icon={<FaTasks />}
                    title="Priority"
                    value={
                        task.priority ||
                        "Medium"
                    }
                />

            </div>

        </div>
    );
};

// ==========================================
// INFO CARD
// ==========================================
const Info = ({
    icon,
    title,
    value,
}) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">

        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            {icon}
        </div>

        <p className="text-xs uppercase font-semibold text-gray-400">
            {title}
        </p>

        <p className="font-bold text-gray-900 mt-1">
            {value}
        </p>

    </div>
);

export default TaskDetails;