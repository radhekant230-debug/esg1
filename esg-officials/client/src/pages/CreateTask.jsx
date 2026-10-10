import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import {
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import {
    FaArrowLeft,
    FaTasks,
    FaSave,
} from "react-icons/fa";

const CreateTask = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const projectFromUrl =
        searchParams.get("project");

    const [projects, setProjects] = useState([]);
    const [managers, setManagers] = useState([]);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        project: projectFromUrl || "",
        assignedManager: "",
        status: "Pending",
        priority: "Medium",
        dueDate: "",
        progress: 0,
    });

    const [loadingData, setLoadingData] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    // ==========================================
    // AUTHORIZATION
    // ==========================================
    useEffect(() => {
        if (!user) return;

        if (
            user.role !== "admin" &&
            user.role !== "manager"
        ) {
            navigate("/tasks");
            return;
        }

        fetchFormData();
    }, [user, navigate]);

    // ==========================================
    // LOAD PROJECTS + MANAGERS
    // ==========================================
    const fetchFormData = async () => {
        try {
            setLoadingData(true);
            setError("");

            const requests = [
                api.get("/projects"),
                api.get("/clients/managers/all"),
            ];

            const results =
                await Promise.allSettled(
                    requests
                );

            // ------------------------------
            // PROJECTS
            // ------------------------------
            if (
                results[0].status ===
                "fulfilled"
            ) {
                const data =
                    results[0].value.data;

                setProjects(
                    Array.isArray(data)
                        ? data
                        : data?.projects || []
                );
            }

            // ------------------------------
            // MANAGERS
            // ------------------------------
            if (
                results[1].status ===
                "fulfilled"
            ) {
                const data =
                    results[1].value.data;

                setManagers(
                    Array.isArray(data)
                        ? data
                        : data?.managers || []
                );
            }
        } catch (err) {
            console.error(
                "Error loading task form:",
                err
            );

            setError(
                err.response?.data?.message ||
                    "Unable to load projects and managers."
            );
        } finally {
            setLoadingData(false);
        }
    };

    // ==========================================
    // HANDLE INPUT
    // ==========================================
    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        // If project changes, automatically select
        // its assigned manager.
        if (name === "project") {
            const selectedProject =
                projects.find(
                    (item) =>
                        item._id === value
                );

            const projectManager =
                selectedProject?.assignedManager;

            const managerId =
                typeof projectManager ===
                "object"
                    ? projectManager?._id
                    : projectManager;

            setFormData((previous) => ({
                ...previous,
                project: value,
                assignedManager:
                    managerId || "",
            }));
        }
    };

    // ==========================================
    // PROGRESS
    // ==========================================
    const handleProgressChange = (e) => {
        let value = Number(
            e.target.value
        );

        if (Number.isNaN(value)) {
            value = 0;
        }

        if (value < 0) value = 0;
        if (value > 100) value = 100;

        setFormData((previous) => ({
            ...previous,
            progress: value,
        }));
    };

    // ==========================================
    // CREATE TASK
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (!formData.title.trim()) {
            setError(
                "Please enter a task title."
            );
            return;
        }

        if (
            !formData.description.trim()
        ) {
            setError(
                "Please enter a task description."
            );
            return;
        }

        if (!formData.project) {
            setError(
                "Please select a project."
            );
            return;
        }

        if (!formData.assignedManager) {
            setError(
                "Please select an assigned manager."
            );
            return;
        }

        try {
            setSaving(true);

            const payload = {
                title:
                    formData.title.trim(),

                description:
                    formData.description.trim(),

                project:
                    formData.project,

                assignedManager:
                    formData.assignedManager,

                status:
                    formData.status,

                priority:
                    formData.priority,

                dueDate:
                    formData.dueDate || null,

                progress:
                    Number(formData.progress),
            };

            const { data } =
                await api.post(
                    "/tasks",
                    payload
                );

            const createdTask =
                data?.task || data;

            navigate(
                `/tasks/${createdTask._id}`
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to create task."
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // LOADING
    // ==========================================
    if (loadingData) {
        return (
            <div className="max-w-5xl mx-auto py-20 text-center">

                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />

                <p className="text-gray-500 font-medium">
                    Loading task form...
                </p>

            </div>
        );
    }

    // ==========================================
    // MANAGER PROJECTS
    // ==========================================
    const availableProjects =
        user?.role === "manager"
            ? projects.filter((project) => {
                  const manager =
                      project.assignedManager;

                  const managerId =
                      typeof manager ===
                      "object"
                          ? manager?._id
                          : manager;

                  return (
                      managerId?.toString() ===
                      user._id?.toString()
                  );
              })
            : projects;

    // ==========================================
    // AVAILABLE MANAGERS
    // ==========================================
    const selectedProject =
        availableProjects.find(
            (project) =>
                project._id ===
                formData.project
        );

    const selectedProjectManager =
        selectedProject?.assignedManager;

    const selectedManagerId =
        typeof selectedProjectManager ===
        "object"
            ? selectedProjectManager?._id
            : selectedProjectManager;

    const availableManagers =
        user?.role === "manager"
            ? managers.filter(
                  (manager) =>
                      manager._id?.toString() ===
                      user._id?.toString()
              )
            : managers;

    return (
        <div className="max-w-5xl mx-auto">

            {/* ======================================
                BACK
            ====================================== */}
            <button
                type="button"
                onClick={() =>
                    navigate("/tasks")
                }
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition mb-6"
            >
                <FaArrowLeft />
                Back to Tasks
            </button>

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-black text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">

                <div className="flex items-center gap-4">

                    <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl">
                        <FaTasks />
                    </div>

                    <div>

                        <p className="text-gray-400 text-sm font-semibold">
                            TASK MANAGEMENT
                        </p>

                        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
                            Create New Task
                        </h1>

                        <p className="text-gray-300 text-sm mt-1">
                            Add a task and assign it
                            to a project manager.
                        </p>

                    </div>

                </div>

            </div>

            {/* ======================================
                ERROR
            ====================================== */}
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-4 mb-6">
                    {error}
                </div>
            )}

            {/* ======================================
                FORM
            ====================================== */}
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden"
            >

                <div className="p-6 sm:p-8">

                    {/* ==================================
                        BASIC INFORMATION
                    ================================== */}
                    <div className="mb-8">

                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Task Information
                        </h2>

                        <p className="text-sm text-gray-500 mb-5">
                            Enter the main details of
                            the task.
                        </p>

                        <div className="space-y-5">

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Task Title
                                </label>

                                <input
                                    type="text"
                                    name="title"
                                    required
                                    value={
                                        formData.title
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Enter task title"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Description
                                </label>

                                <textarea
                                    name="description"
                                    required
                                    rows="5"
                                    value={
                                        formData.description
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Describe the task..."
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition shadow-sm resize-none"
                                />
                            </div>

                        </div>

                    </div>

                    {/* ==================================
                        ASSIGNMENT
                    ================================== */}
                    <div className="border-t border-gray-100 pt-8 mb-8">

                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Assignment
                        </h2>

                        <p className="text-sm text-gray-500 mb-5">
                            Choose the project and manager
                            responsible for this task.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            {/* PROJECT */}
                            <div>

                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Project
                                </label>

                                <select
                                    name="project"
                                    required
                                    value={
                                        formData.project
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition cursor-pointer"
                                >

                                    <option value="">
                                        Select Project
                                    </option>

                                    {availableProjects.map(
                                        (project) => (
                                            <option
                                                key={
                                                    project._id
                                                }
                                                value={
                                                    project._id
                                                }
                                            >
                                                {
                                                    project.name
                                                }

                                                {project.projectId
                                                    ? ` - ${project.projectId}`
                                                    : ""}
                                            </option>
                                        )
                                    )}

                                </select>

                                {availableProjects.length ===
                                    0 && (
                                    <p className="text-xs text-orange-600 mt-2">
                                        No assigned projects
                                        available.
                                    </p>
                                )}

                            </div>

                            {/* MANAGER */}
                            <div>

                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Assigned Manager
                                </label>

                                <select
                                    name="assignedManager"
                                    required
                                    value={
                                        formData.assignedManager
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    disabled={
                                        user?.role ===
                                        "manager"
                                    }
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >

                                    <option value="">
                                        Select Manager
                                    </option>

                                    {availableManagers.map(
                                        (manager) => (
                                            <option
                                                key={
                                                    manager._id
                                                }
                                                value={
                                                    manager._id
                                                }
                                            >
                                                {
                                                    manager.name
                                                }
                                            </option>
                                        )
                                    )}

                                </select>

                                {user?.role ===
                                    "manager" && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Tasks created by you
                                        are assigned to you.
                                    </p>
                                )}

                                {availableManagers.length ===
                                    0 && (
                                    <p className="text-xs text-orange-600 mt-2">
                                        No managers available.
                                    </p>
                                )}

                            </div>

                        </div>

                    </div>

                    {/* ==================================
                        TASK SETTINGS
                    ================================== */}
                    <div className="border-t border-gray-100 pt-8 mb-8">

                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Task Settings
                        </h2>

                        <p className="text-sm text-gray-500 mb-5">
                            Configure the initial state
                            of the task.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                            {/* STATUS */}
                            <div>

                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Status
                                </label>

                                <select
                                    name="status"
                                    value={
                                        formData.status
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition cursor-pointer"
                                >

                                    <option>
                                        Pending
                                    </option>

                                    <option>
                                        In Progress
                                    </option>

                                    <option>
                                        Review
                                    </option>

                                    <option>
                                        Waiting for Approval
                                    </option>

                                    <option>
                                        Approved
                                    </option>

                                    <option>
                                        Rejected
                                    </option>

                                    <option>
                                        Completed
                                    </option>

                                </select>

                            </div>

                            {/* PRIORITY */}
                            <div>

                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Priority
                                </label>

                                <select
                                    name="priority"
                                    value={
                                        formData.priority
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition cursor-pointer"
                                >

                                    <option>
                                        Low
                                    </option>

                                    <option>
                                        Medium
                                    </option>

                                    <option>
                                        High
                                    </option>

                                    <option>
                                        Urgent
                                    </option>

                                </select>

                            </div>

                            {/* PROGRESS */}
                            <div>

                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Initial Progress
                                </label>

                                <div className="relative">

                                    <input
                                        type="number"
                                        name="progress"
                                        min="0"
                                        max="100"
                                        value={
                                            formData.progress
                                        }
                                        onChange={
                                            handleProgressChange
                                        }
                                        className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition"
                                    />

                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                                        %
                                    </span>

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* ==================================
                        DEADLINE
                    ================================== */}
                    <div className="border-t border-gray-100 pt-8">

                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Deadline
                        </h2>

                        <p className="text-sm text-gray-500 mb-5">
                            Set when this task should
                            be completed.
                        </p>

                        <div className="max-w-md">

                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Due Date
                            </label>

                            <input
                                type="date"
                                name="dueDate"
                                value={
                                    formData.dueDate
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition"
                            />

                        </div>

                    </div>

                </div>

                {/* ======================================
                    FOOTER
                ====================================== */}
                <div className="border-t border-gray-100 bg-gray-50 px-6 sm:px-8 py-5 flex flex-col sm:flex-row justify-end gap-3">

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/tasks")
                        }
                        disabled={saving}
                        className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-white transition disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={
                            saving ||
                            availableProjects.length ===
                                0
                        }
                        className="px-6 py-3 rounded-lg bg-gray-900 text-white font-bold hover:bg-black transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >

                        <FaSave />

                        {saving
                            ? "Creating..."
                            : "Create Task"}

                    </button>

                </div>

            </form>

        </div>
    );
};

export default CreateTask;