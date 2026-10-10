import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import {
    FaPlus,
    FaSearch,
    FaTasks,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";
import TaskCard from "../components/TaskCard";
import { AuthContext } from "../context/AuthContext";

const Tasks = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [tasks, setTasks] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [priority, setPriority] = useState("All");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // ==========================================
    // FETCH TASKS
    // ==========================================
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get("/tasks");

            setTasks(
                Array.isArray(data)
                    ? data
                    : data?.tasks || []
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load tasks."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FILTER TASKS
    // ==========================================
    const filteredTasks = tasks.filter((task) => {
        const text = search
            .toLowerCase()
            .trim();

        const matchesSearch =
            !text ||
            task.title
                ?.toLowerCase()
                .includes(text) ||
            task.taskId
                ?.toLowerCase()
                .includes(text) ||
            task.description
                ?.toLowerCase()
                .includes(text);

        const matchesStatus =
            status === "All" ||
            task.status === status;

        const matchesPriority =
            priority === "All" ||
            task.priority === priority;

        return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority
        );
    });

    // ==========================================
    // ROLE PERMISSION
    // ==========================================
    const canCreateTask =
        user?.role === "admin" ||
        user?.role === "manager";

    return (
        <div className="max-w-7xl mx-auto">

            {/* ======================================
                HEADER
            ====================================== */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">

                <div>
                    <div className="flex items-center gap-3 mb-2">

                        <div className="w-11 h-11 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                            <FaTasks />
                        </div>

                        <h1 className="text-3xl font-extrabold text-gray-900">
                            Tasks
                        </h1>

                    </div>

                    <p className="text-gray-500">
                        Manage and track project tasks.
                    </p>
                </div>

                {/* ==================================
                    CREATE TASK
                ================================== */}
                {canCreateTask && (
                    <button
                        type="button"
                        onClick={() =>
                            navigate("/tasks/create")
                        }
                        className="bg-gray-900 text-white px-5 py-3 rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2"
                    >
                        <FaPlus />
                        Create Task
                    </button>
                )}

            </div>

            {/* ======================================
                FILTERS
            ====================================== */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-8">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* SEARCH */}
                    <div className="relative">

                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 outline-none"
                        />

                    </div>

                    {/* STATUS */}
                    <select
                        value={status}
                        onChange={(e) =>
                            setStatus(e.target.value)
                        }
                        className="px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 outline-none"
                    >
                        <option value="All">
                            All Statuses
                        </option>

                        <option value="Pending">
                            Pending
                        </option>

                        <option value="In Progress">
                            In Progress
                        </option>

                        <option value="Review">
                            Review
                        </option>

                        <option value="Waiting for Approval">
                            Waiting for Approval
                        </option>

                        <option value="Approved">
                            Approved
                        </option>

                        <option value="Rejected">
                            Rejected
                        </option>

                        <option value="Completed">
                            Completed
                        </option>
                    </select>

                    {/* PRIORITY */}
                    <select
                        value={priority}
                        onChange={(e) =>
                            setPriority(e.target.value)
                        }
                        className="px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 outline-none"
                    >
                        <option value="All">
                            All Priorities
                        </option>

                        <option value="Low">
                            Low
                        </option>

                        <option value="Medium">
                            Medium
                        </option>

                        <option value="High">
                            High
                        </option>

                        <option value="Urgent">
                            Urgent
                        </option>
                    </select>

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
                LOADING
            ====================================== */}
            {loading ? (
                <div className="py-20 text-center">

                    <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                    <p className="text-gray-500 mt-4">
                        Loading tasks...
                    </p>

                </div>
            ) : filteredTasks.length === 0 ? (

                /* ==================================
                   EMPTY STATE
                ================================== */
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">

                    <FaTasks className="mx-auto text-4xl text-gray-300 mb-4" />

                    <h2 className="text-xl font-bold text-gray-900">
                        No Tasks Found
                    </h2>

                    <p className="text-gray-500 mt-2">
                        No tasks match your current filters.
                    </p>

                </div>
            ) : (

                /* ==================================
                   TASK LIST
                ================================== */
                <div className="space-y-4">

                    {filteredTasks.map((task) => (
                        <TaskCard
                            key={task._id}
                            task={task}
                        />
                    ))}

                </div>
            )}

        </div>
    );
};

export default Tasks;