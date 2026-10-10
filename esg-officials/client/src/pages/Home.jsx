import React from "react";
import { useContext } from "react";
import {
    FaArrowRight,
    FaClipboardCheck,
    FaFileAlt,
    FaProjectDiagram,
    FaTasks,
    FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Home = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const getDashboardPath = () => {
        if (user?.role === "admin") return "/admin";
        if (user?.role === "manager") return "/manager";
        if (user?.role === "client") return "/dashboard";

        return "/login";
    };

    const features = [
        {
            icon: <FaProjectDiagram />,
            title: "Project Management",
            description:
                "Track projects, deadlines, priorities and overall progress from one place.",
            path: "/projects",
        },
        {
            icon: <FaTasks />,
            title: "Task Tracking",
            description:
                "Monitor assigned tasks, progress, priorities and completion status.",
            path: "/tasks",
        },
        {
            icon: <FaClipboardCheck />,
            title: "Approvals",
            description:
                "Review submitted work and keep the approval workflow organized.",
            path: "/approvals",
        },
        {
            icon: <FaFileAlt />,
            title: "Documents",
            description:
                "Access and manage important project documents and files.",
            path: "/documents",
        },
    ];

    return (
        <div className="max-w-7xl mx-auto">

            {/* Hero */}
            <section className="bg-gray-900 text-white rounded-3xl overflow-hidden shadow-2xl mb-10">
                <div className="relative p-8 sm:p-12 lg:p-16">

                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />

                    <div className="relative z-10 max-w-3xl">

                        <p className="text-gray-400 text-xs sm:text-sm font-bold tracking-[0.2em] uppercase mb-4">
                            Client Management Portal
                        </p>

                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight mb-5">
                            Manage Your Work.
                            <br />
                            <span className="text-gray-400">
                                Track Your Progress.
                            </span>
                        </h1>

                        <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl mb-8">
                            A centralized workspace for managing projects,
                            tasks, approvals, documents and communication
                            between clients, managers and administrators.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">

                            <button
                                onClick={() =>
                                    navigate(getDashboardPath())
                                }
                                className="bg-white text-gray-900 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition flex items-center justify-center gap-2 shadow-md"
                            >
                                Open Dashboard
                                <FaArrowRight className="text-sm" />
                            </button>

                            <button
                                onClick={() =>
                                    navigate("/projects")
                                }
                                className="border border-gray-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
                            >
                                View Projects
                            </button>

                        </div>
                    </div>
                </div>
            </section>

            {/* Welcome */}
            {user && (
                <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-10">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">

                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">
                                Welcome back
                            </p>

                            <h2 className="text-2xl font-extrabold text-gray-900">
                                {user.name}
                            </h2>

                            <p className="text-gray-500 text-sm mt-1">
                                {user.role === "admin"
                                    ? "Administrator"
                                    : user.role === "manager"
                                    ? "Project Manager"
                                    : "Client"}
                            </p>
                        </div>

                        <button
                            onClick={() =>
                                navigate(getDashboardPath())
                            }
                            className="bg-gray-900 text-white px-5 py-3 rounded-lg font-bold hover:bg-black transition"
                        >
                            Go to Dashboard
                        </button>

                    </div>
                </section>
            )}

            {/* Features */}
            <section className="mb-10">

                <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                        Everything You Need
                    </h2>

                    <p className="text-gray-500 mt-1">
                        Manage your complete workflow from one platform.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition duration-300 p-6 flex flex-col"
                        >

                            <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-lg mb-5">
                                {feature.icon}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                {feature.title}
                            </h3>

                            <p className="text-sm text-gray-500 leading-relaxed flex-1">
                                {feature.description}
                            </p>

                            <button
                                onClick={() =>
                                    navigate(feature.path)
                                }
                                className="mt-5 flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-gray-500 transition"
                            >
                                Explore
                                <FaArrowRight className="text-xs" />
                            </button>

                        </div>
                    ))}

                </div>
            </section>

            {/* Workflow */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-10">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    <div className="flex gap-4">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black">
                            01
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">
                                Plan
                            </h3>

                            <p className="text-sm text-gray-500 leading-relaxed">
                                Projects and tasks are organized with
                                clear deadlines and priorities.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black">
                            02
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">
                                Execute
                            </h3>

                            <p className="text-sm text-gray-500 leading-relaxed">
                                Managers and teams track work and
                                continuously update progress.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black">
                            03
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">
                                Approve
                            </h3>

                            <p className="text-sm text-gray-500 leading-relaxed">
                                Clients can review submitted work
                                and provide approval or feedback.
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-200 pt-8 pb-6 text-center">

                <div className="flex justify-center items-center gap-2 mb-3">
                    <FaProjectDiagram className="text-gray-800" />

                    <span className="font-bold text-gray-900">
                        Client Portal
                    </span>
                </div>

                <p className="text-xs text-gray-400">
                    Project management and client collaboration platform.
                </p>

            </footer>

        </div>
    );
};

export default Home;