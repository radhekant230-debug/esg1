import React, { useContext, useEffect, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import api from "../../utils/axios";
import {
  FaThLarge,
  FaShieldAlt,
  FaCalendarAlt,
  FaClipboardList,
  FaUsers,
  FaCheckCircle,
  FaChartLine,
  FaFolderOpen,
  FaUserTie,
  FaExternalLinkAlt,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaTimes,
  FaExclamationCircle,
} from "react-icons/fa";

export default function AdminSidebar({ isOpen, onClose }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Dynamic notification & overdue badges
  const [badgeCounts, setBadgeCounts] = useState({
    pendingApprovals: 0,
    overdueTasks: 0,
    activeRisks: 0,
  });

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchBadgeCounts = async () => {
    try {
      // 1. Approvals & Risks counts
      const resRisk = await api.get("/risks/approvals/center").catch(() => null);
      let pendingApprovals = 0;
      let activeRisks = 0;
      if (resRisk?.data?.counts) {
        pendingApprovals =
          (resRisk.data.counts.pendingClient || 0) +
          (resRisk.data.counts.pendingManager || 0);
      }

      // 2. Overdue tasks count
      const resTasks = await api.get("/tasks").catch(() => null);
      let overdueTasks = 0;
      if (Array.isArray(resTasks?.data)) {
        const now = new Date();
        overdueTasks = resTasks.data.filter(
          (t) =>
            t.status !== "Completed" &&
            t.dueDate &&
            new Date(t.dueDate) < now
        ).length;
      }

      setBadgeCounts({
        pendingApprovals,
        overdueTasks,
        activeRisks,
      });
    } catch {
      // Non-critical badge count fallback
    }
  };

  const navSections = [
    {
      title: "MAIN",
      items: [
        {
          label: "Dashboard",
          to: "/admin/dashboard",
          icon: FaThLarge,
          end: true,
        },
      ],
    },
    {
      title: "WORKSPACE",
      items: [
        {
          label: "Risk Management",
          to: "/admin/risks",
          icon: FaShieldAlt,
        },
        {
          label: "Calendar",
          to: "/admin/calendar",
          icon: FaCalendarAlt,
        },
        {
          label: "Tasks & Follow-ups",
          to: "/admin/tasks",
          icon: FaClipboardList,
          badge: badgeCounts.overdueTasks > 0 ? badgeCounts.overdueTasks : null,
          badgeType: "overdue",
        },
        {
          label: "Clients",
          to: "/admin/clients",
          icon: FaUsers,
        },
        {
          label: "Approvals",
          to: "/admin/approvals",
          icon: FaCheckCircle,
          badge:
            badgeCounts.pendingApprovals > 0
              ? badgeCounts.pendingApprovals
              : null,
          badgeType: "pending",
        },
        {
          label: "Reports & Insights",
          to: "/admin/reports",
          icon: FaChartLine,
        },
        {
          label: "Resource Vault",
          to: "/admin/vault",
          icon: FaFolderOpen,
        },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        {
          label: "Manager Portal",
          to: "/manager/dashboard",
          icon: FaUserTie,
          isExternalPortal: true,
        },
        {
          label: "Client Portal",
          to: "/client/dashboard",
          icon: FaExternalLinkAlt,
          isExternalPortal: true,
        },
        {
          label: "Notifications",
          to: "/admin/notifications",
          icon: FaBell,
        },
        {
          label: "Settings",
          to: "/admin/settings",
          icon: FaCog,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Clean, Premium Light Cream / White Sidebar */}
      <aside
        id="admin-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#FAF8F5] text-[#2D2A26] border-r border-[#E7DFD5] flex flex-col shadow-xs transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E7DFD5] bg-[#FFFFFF] flex items-center justify-between">
          <Link
            to="/admin/dashboard"
            onClick={() => onClose && onClose()}
            className="flex items-center gap-3 group"
          >
            {/* Elegant Golden Compass / Diamond Mark */}
            <div className="w-9 h-9 rounded-xl bg-[#F7F3EB] border border-[#DCD2C4] flex items-center justify-center text-[#9C7A42] shadow-xs group-hover:border-[#9C7A42] transition">
              <svg
                className="w-5 h-5 text-[#9C7A42]"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" strokeWidth="0.8" strokeDasharray="2 2" />
                <polygon points="12 7 14 12 12 17 10 12" fill="#9C7A42" fillOpacity="0.2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-[#1A1816] text-base tracking-tight">
                  ESG Officials
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-[#F2EDE4] text-[#8C6D37] border border-[#E0D7C9]">
                  PORTAL
                </span>
              </div>
              <p className="text-[10.5px] font-mono text-stone-500 tracking-wider">
                Executive Control Hub
              </p>
            </div>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-[#F2EDE4] transition"
              aria-label="Close sidebar"
            >
              <FaTimes className="text-sm" />
            </button>
          )}
        </div>

        {/* User Card */}
        <div className="px-5 py-3 bg-[#FBF9F5] border-b border-[#E7DFD5] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#EFE9DE] border border-[#D5C9B8] flex items-center justify-center text-[#8C6D37] font-serif font-bold text-xs shrink-0">
              {user?.name?.[0] || "A"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-[#1A1816] truncate">
                {user?.name || "Administrator"}
              </p>
              <p className="text-[10px] font-mono text-stone-500 truncate">
                {user?.email || "admin@esgofficial.com"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase bg-[#F2EDE4] text-[#8C6D37] border border-[#E0D7C9] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9C7A42]" />
            ADMIN
          </span>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <p className="px-3 mb-1.5 text-[9.5px] font-mono tracking-widest uppercase text-stone-400 font-bold">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={itemIdx}
                      to={item.to}
                      end={item.end}
                      onClick={() => onClose && onClose()}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition group ${
                          isActive
                            ? "bg-[#FFFFFF] text-[#1A1816] font-semibold shadow-xs border border-[#DFD6C8]"
                            : "text-stone-600 hover:text-[#1A1816] hover:bg-[#F3EFE8]"
                        }`
                      }
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon className="text-sm shrink-0 opacity-80 text-[#9C7A42] group-hover:scale-105 transition-transform" />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {/* Dynamic Badges */}
                      {item.badge && (
                        <span
                          className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 shadow-2xs ${
                            item.badgeType === "overdue"
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                          title={`${item.badge} ${
                            item.badgeType === "overdue"
                              ? "Overdue Items"
                              : "Pending Approvals"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#E7DFD5] bg-[#FFFFFF] space-y-1">
          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:text-rose-700 hover:bg-rose-50 transition"
          >
            <FaSignOutAlt className="text-xs" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
