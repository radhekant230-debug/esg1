import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BizSidebar from "./BizSidebar";
import { FaBars, FaTimes } from "react-icons/fa";

const BizLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <BizSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar (mobile) */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                    >
                        <FaBars />
                    </button>
                    <span className="font-bold text-gray-800 text-sm">Business Portal</span>
                    <div className="w-8" />
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default BizLayout;
