import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaSave,
    FaTasks,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const EditTask = () => {
    const { user } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [managers, setManagers] = useState([]);

    const [form, setForm] = useState({
        title: "",
        description: "",
        project: "",
        assignedManager: "",
        status: "Pending",
        priority: "Medium",
        dueDate: "",
        progress: 0,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // ==========================================
    // ADMIN ONLY
    // ==========================================
    useEffect(() => {
        if (!user) return;

        if (user.role !== "admin") {
            navigate("/tasks", { replace: true });
            return;
        }

        loadData();
    }, [user, id]);

    // ==========================================
    // LOAD TASK + PROJECTS + MANAGERS
    // ==========================================
    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const [
                taskResponse,
                projectResponse,
                managerResponse,
            ] = await Promise.all([
                api.get(`/tasks/${id}`),
                api.get("/projects"),
                api.get("/clients/managers/all"),
            ]);

            const task =
                taskResponse.data?.task ||
                taskResponse.data;

            const projectsData =
                projectResponse.data;

            const managersData =
                managerResponse.data;

            setProjects(
                Array.isArray(projectsData)
                    ? projectsData
                    : projectsData?.projects || []
            );

            setManagers(
                Array.isArray(managersData)
                    ? managersData
                    : managersData?.managers || []
            );

            setForm({
                title: task.title || "",
                description:
                    task.description || "",

                project:
                    task.project?._id ||
                    task.project ||
                    "",

                assignedManager:
                    task.assignedManager?._id ||
                    task.assignedManager ||
                    "",

                status:
                    task.status || "Pending",

                priority:
                    task.priority || "Medium",

                dueDate: task.dueDate
                    ? new Date(task.dueDate)
                          .toISOString()
                          .split("T")[0]
                    : "",

                progress:
                    task.progress ?? 0,
            });
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
    // INPUT CHANGE
    // ==========================================
    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // ==========================================
    // UPDATE TASK
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setError("");

            if (!form.title.trim()) {
                setError(
                    "Task title is required."
                );
                return;
            }

            if (!form.description.trim()) {
                setError(
                    "Task description is required."
                );
                return;
            }

            if (!form.project) {
                setError(
                    "Please select a project."
                );
                return;
            }

            if (!form.assignedManager) {
                setError(
                    "Please select a manager."
                );
                return;
            }

            const progress = Number(
                form.progress
            );

            if (
                Number.isNaN(progress) ||
                progress < 0 ||
                progress > 100
            ) {
                setError(
                    "Progress must be between 0 and 100."
                );
                return;
            }

            await api.put(`/tasks/${id}`, {
                title: form.title.trim(),

                description:
                    form.description.trim(),

                project: form.project,

                assignedManager:
                    form.assignedManager,

                status: form.status,

                priority: form.priority,

                dueDate:
                    form.dueDate || null,

                progress,
            });

            navigate(`/tasks/${id}`);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update task."
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
                    Loading task...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">

            {/* ======================================
                BACK
            ====================================== */}
            <button
                type="button"
                onClick={() =>
                    navigate(`/tasks/${id}`)
                }
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-6 hover:text-gray-900"
            >
                <FaArrowLeft />
                Back to Task
            </button>

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8">

                <div className="flex items-center gap-4">

                    <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center">
                        <FaTasks />
                    </div>

                    <div>
                        <p className="text-gray-400 text-sm font-semibold">
                            ADMINISTRATION
                        </p>

                        <h1 className="text-2xl sm:text-3xl font-extrabold">
                            Edit Task
                        </h1>

                        <p className="text-gray-300 text-sm mt-1">
                            Update task information,
                            assignment and progress.
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

                <div className="p-6 sm:p-8 space-y-8">

                    {/* TASK INFORMATION */}
                    <section>

                        <h2 className="text-lg font-bold mb-5">
                            Task Information
                        </h2>

                        <div className="space-y-5">

                            <Input
                                label="Task Title"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                required
                            />

                            <Textarea
                                label="Description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                required
                            />

                        </div>

                    </section>

                    {/* ASSIGNMENT */}
                    <section className="border-t pt-8">

                        <h2 className="text-lg font-bold mb-5">
                            Assignment
                        </h2>

                        <div className="grid md:grid-cols-2 gap-5">

                            <Select
                                label="Project"
                                name="project"
                                value={form.project}
                                onChange={handleChange}
                                required
                            >
                                <option value="">
                                    Select Project
                                </option>

                                {projects.map(
                                    (project) => (
                                        <option
                                            key={
                                                project._id
                                            }
                                            value={
                                                project._id
                                            }
                                        >
                                            {project.name}
                                        </option>
                                    )
                                )}
                            </Select>

                            <Select
                                label="Assigned Manager"
                                name="assignedManager"
                                value={
                                    form.assignedManager
                                }
                                onChange={handleChange}
                                required
                            >
                                <option value="">
                                    Select Manager
                                </option>

                                {managers.map(
                                    (manager) => (
                                        <option
                                            key={
                                                manager._id
                                            }
                                            value={
                                                manager._id
                                            }
                                        >
                                            {manager.name}
                                        </option>
                                    )
                                )}
                            </Select>

                        </div>

                    </section>

                    {/* SETTINGS */}
                    <section className="border-t pt-8">

                        <h2 className="text-lg font-bold mb-5">
                            Task Settings
                        </h2>

                        <div className="grid md:grid-cols-3 gap-5">

                            <Select
                                label="Status"
                                name="status"
                                value={form.status}
                                onChange={handleChange}
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
                            </Select>

                            <Select
                                label="Priority"
                                name="priority"
                                value={form.priority}
                                onChange={handleChange}
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
                            </Select>

                            <Input
                                label="Progress"
                                type="number"
                                name="progress"
                                min="0"
                                max="100"
                                value={form.progress}
                                onChange={handleChange}
                            />

                        </div>

                    </section>

                    {/* DUE DATE */}
                    <section className="border-t pt-8">

                        <Input
                            label="Due Date"
                            type="date"
                            name="dueDate"
                            value={form.dueDate}
                            onChange={handleChange}
                        />

                    </section>

                </div>

                {/* FOOTER */}
                <div className="border-t bg-gray-50 px-6 sm:px-8 py-5 flex justify-end gap-3">

                    <button
                        type="button"
                        onClick={() =>
                            navigate(`/tasks/${id}`)
                        }
                        disabled={saving}
                        className="px-5 py-3 rounded-lg border border-gray-300 font-semibold hover:bg-white transition disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 rounded-lg bg-gray-900 text-white font-bold hover:bg-black transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <FaSave />

                        {saving
                            ? "Saving..."
                            : "Save Changes"}
                    </button>

                </div>

            </form>
        </div>
    );
};

// ==========================================
// INPUT
// ==========================================
const Input = ({
    label,
    name,
    type = "text",
    ...props
}) => (
    <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
            {label}
        </label>

        <input
            type={type}
            name={name}
            {...props}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none"
        />
    </div>
);

// ==========================================
// TEXTAREA
// ==========================================
const Textarea = ({
    label,
    name,
    ...props
}) => (
    <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
            {label}
        </label>

        <textarea
            name={name}
            rows="5"
            {...props}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none resize-none"
        />
    </div>
);

// ==========================================
// SELECT
// ==========================================
const Select = ({
    label,
    name,
    children,
    ...props
}) => (
    <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
            {label}
        </label>

        <select
            name={name}
            {...props}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none"
        >
            {children}
        </select>
    </div>
);

export default EditTask;