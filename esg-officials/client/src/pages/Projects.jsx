import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import {
    FaPlus,
    FaProjectDiagram,
    FaSearch,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";
import ProjectCard from "../components/ProjectCard";
import { AuthContext } from "../context/AuthContext";

const Projects = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [projects, setProjects] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // ==========================================
    // FETCH PROJECTS
    // ==========================================
    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get(
                "/projects"
            );

            setProjects(
                Array.isArray(data)
                    ? data
                    : data?.projects || []
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load projects."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FILTER PROJECTS
    // ==========================================
    const filteredProjects =
        projects.filter((project) => {
            const searchText = search
                .toLowerCase()
                .trim();

            const matchesSearch =
                !searchText ||
                project.name
                    ?.toLowerCase()
                    .includes(searchText) ||
                project.projectId
                    ?.toLowerCase()
                    .includes(searchText) ||
                project.description
                    ?.toLowerCase()
                    .includes(searchText);

            const matchesStatus =
                status === "All" ||
                project.status === status;

            return (
                matchesSearch &&
                matchesStatus
            );
        });

    // ==========================================
    // CREATE PERMISSION
    // ==========================================
    const canCreateProject =
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
                            <FaProjectDiagram />
                        </div>

                        <h1 className="text-3xl font-extrabold text-gray-900">
                            Projects
                        </h1>

                    </div>

                    <p className="text-gray-500">
                        Manage and track your projects.
                    </p>

                </div>

                {/* ==================================
                    CREATE PROJECT
                ================================== */}
                {canCreateProject && (
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/projects/create"
                            )
                        }
                        className="bg-gray-900 text-white px-5 py-3 rounded-lg font-bold hover:bg-black transition shadow-md flex items-center justify-center gap-2"
                    >
                        <FaPlus />
                        Create Project
                    </button>
                )}

            </div>

            {/* ======================================
                FILTERS
            ====================================== */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-8">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* SEARCH */}
                    <div className="relative">

                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition"
                        />

                    </div>

                    {/* STATUS */}
                    <select
                        value={status}
                        onChange={(e) =>
                            setStatus(
                                e.target.value
                            )
                        }
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-700 focus:border-gray-700 outline-none transition"
                    >

                        <option value="All">
                            All Statuses
                        </option>

                        <option value="Not Started">
                            Not Started
                        </option>

                        <option value="Planning">
                            Planning
                        </option>

                        <option value="In Progress">
                            In Progress
                        </option>

                        <option value="Waiting for Client">
                            Waiting for Client
                        </option>

                        <option value="On Hold">
                            On Hold
                        </option>

                        <option value="Completed">
                            Completed
                        </option>

                        <option value="Cancelled">
                            Cancelled
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

                    <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />

                    <p className="text-gray-500">
                        Loading projects...
                    </p>

                </div>
            ) : filteredProjects.length === 0 ? (

                /* ==================================
                   EMPTY
                ================================== */
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">

                    <FaProjectDiagram className="mx-auto text-4xl text-gray-300 mb-4" />

                    <h2 className="text-xl font-bold text-gray-900">
                        No Projects Found
                    </h2>

                    <p className="text-gray-500 mt-2">
                        No projects match your
                        current filters.
                    </p>

                </div>
            ) : (

                /* ==================================
                   PROJECT LIST
                ================================== */
                <>

                    <div className="flex items-center justify-between mb-5">

                        <p className="text-sm text-gray-500">
                            {filteredProjects.length}{" "}
                            {filteredProjects.length ===
                            1
                                ? "project"
                                : "projects"}
                        </p>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                        {filteredProjects.map(
                            (project) => (
                                <ProjectCard
                                    key={
                                        project._id
                                    }
                                    project={
                                        project
                                    }
                                />
                            )
                        )}

                    </div>

                </>
            )}

        </div>
    );
};

export default Projects;