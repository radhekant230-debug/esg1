import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaProjectDiagram,
    FaSave,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const EditProject = () => {
    const { user } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [clients, setClients] = useState([]);
    const [managers, setManagers] = useState([]);

    const [form, setForm] = useState({
        name: "",
        description: "",
        client: "",
        assignedManager: "",
        startDate: "",
        deadline: "",
        status: "Not Started",
        priority: "Medium",
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
            navigate("/projects", {
                replace: true,
            });
            return;
        }

        loadData();
    }, [user, id]);

    // ==========================================
    // LOAD PROJECT DATA
    // ==========================================
    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const [
                projectResponse,
                clientResponse,
                managerResponse,
            ] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get("/clients"),
                api.get("/clients/managers/all"),
            ]);

            const project =
                projectResponse.data?.project ||
                projectResponse.data;

            const clientsData =
                clientResponse.data;

            const managersData =
                managerResponse.data;

            setClients(
                Array.isArray(clientsData)
                    ? clientsData
                    : clientsData?.clients || []
            );

            setManagers(
                Array.isArray(managersData)
                    ? managersData
                    : managersData?.managers || []
            );

            setForm({
                name: project.name || "",

                description:
                    project.description || "",

                client:
                    project.client?._id ||
                    project.client ||
                    "",

                assignedManager:
                    project.assignedManager?._id ||
                    project.assignedManager ||
                    "",

                startDate: toInputDate(
                    project.startDate
                ),

                deadline: toInputDate(
                    project.deadline
                ),

                status:
                    project.status ||
                    "Not Started",

                priority:
                    project.priority ||
                    "Medium",

                progress:
                    project.progress ?? 0,
            });
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
    const toInputDate = (date) => {
        if (!date) return "";

        return new Date(date)
            .toISOString()
            .split("T")[0];
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
    // UPDATE PROJECT
    // ==========================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (!form.name.trim()) {
            setError(
                "Project name is required."
            );
            return;
        }

        if (!form.description.trim()) {
            setError(
                "Project description is required."
            );
            return;
        }

        if (!form.client) {
            setError(
                "Please select a client."
            );
            return;
        }

        if (!form.startDate) {
            setError(
                "Please select a start date."
            );
            return;
        }

        if (!form.deadline) {
            setError(
                "Please select a deadline."
            );
            return;
        }

        if (
            new Date(form.deadline) <
            new Date(form.startDate)
        ) {
            setError(
                "Deadline cannot be before the start date."
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

        try {
            setSaving(true);

            await api.put(`/projects/${id}`, {
                name: form.name.trim(),

                description:
                    form.description.trim(),

                client: form.client,

                assignedManager:
                    form.assignedManager || null,

                startDate:
                    form.startDate,

                deadline:
                    form.deadline,

                status:
                    form.status,

                priority:
                    form.priority,

                progress,
            });

            navigate(`/projects/${id}`);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update project."
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

    return (
        <div className="max-w-5xl mx-auto">

            {/* ======================================
                BACK
            ====================================== */}
            <button
                type="button"
                onClick={() =>
                    navigate(`/projects/${id}`)
                }
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6"
            >
                <FaArrowLeft />
                Back to Project
            </button>

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8">

                <div className="flex items-center gap-4">

                    <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center">
                        <FaProjectDiagram />
                    </div>

                    <div>

                        <p className="text-gray-400 text-sm font-semibold">
                            ADMINISTRATION
                        </p>

                        <h1 className="text-2xl sm:text-3xl font-extrabold">
                            Edit Project
                        </h1>

                        <p className="text-gray-300 text-sm mt-1">
                            Update project information,
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

                    {/* ==================================
                        BASIC INFORMATION
                    ================================== */}
                    <section>

                        <h2 className="text-lg font-bold mb-5">
                            Basic Information
                        </h2>

                        <div className="space-y-5">

                            <Input
                                label="Project Name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                            />

                            <Textarea
                                label="Description"
                                name="description"
                                value={
                                    form.description
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />

                        </div>

                    </section>

                    {/* ==================================
                        ASSIGNMENT
                    ================================== */}
                    <section className="border-t pt-8">

                        <h2 className="text-lg font-bold mb-5">
                            Assignment
                        </h2>

                        <div className="grid md:grid-cols-2 gap-5">

                            <Select
                                label="Client"
                                name="client"
                                value={form.client}
                                onChange={handleChange}
                                required
                            >
                                <option value="">
                                    Select Client
                                </option>

                                {clients.map(
                                    (client) => (
                                        <option
                                            key={
                                                client._id
                                            }
                                            value={
                                                client._id
                                            }
                                        >
                                            {client.name}
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
                            >
                                <option value="">
                                    No Manager
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

                    {/* ==================================
                        TIMELINE
                    ================================== */}
                    <section className="border-t pt-8">

                        <h2 className="text-lg font-bold mb-5">
                            Timeline
                        </h2>

                        <div className="grid md:grid-cols-2 gap-5">

                            <Input
                                label="Start Date"
                                type="date"
                                name="startDate"
                                value={
                                    form.startDate
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />

                            <Input
                                label="Deadline"
                                type="date"
                                name="deadline"
                                value={
                                    form.deadline
                                }
                                min={
                                    form.startDate
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />

                        </div>

                    </section>

                    {/* ==================================
                        PROJECT SETTINGS
                    ================================== */}
                    <section className="border-t pt-8">

                        <h2 className="text-lg font-bold mb-5">
                            Project Settings
                        </h2>

                        <div className="grid md:grid-cols-3 gap-5">

                            <Select
                                label="Status"
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                            >
                                <option>
                                    Not Started
                                </option>

                                <option>
                                    Planning
                                </option>

                                <option>
                                    In Progress
                                </option>

                                <option>
                                    Waiting for Client
                                </option>

                                <option>
                                    On Hold
                                </option>

                                <option>
                                    Completed
                                </option>

                                <option>
                                    Cancelled
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
                                value={
                                    form.progress
                                }
                                onChange={
                                    handleChange
                                }
                            />

                        </div>

                    </section>

                </div>

                {/* ======================================
                    FOOTER
                ====================================== */}
                <div className="border-t bg-gray-50 px-6 sm:px-8 py-5 flex justify-end gap-3">

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                `/projects/${id}`
                            )
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
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 outline-none resize-none"
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
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 outline-none"
        >
            {children}
        </select>
    </div>
);

export default EditProject;