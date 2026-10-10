import React from "react";
import {
  FaTasks,
  FaProjectDiagram,
  FaCheckCircle,
  FaClock,
  FaUserTie,
  FaCalendarAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

export default function WorkInProgressTab({ workspaceData }) {
  const projects = workspaceData?.projects || [];
  const tasks = workspaceData?.tasks || [];
  const summary = workspaceData?.summary || {};

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "In Progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Awaiting Client":
      case "Waiting for Client":
        return "bg-amber-100 text-amber-900 border-amber-200";
      case "Delayed":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Planning":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Agency Workspace & Work In Progress (WIP)
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Transparent visibility into active strategy roadmaps, creative sprints, and ongoing deliverables.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="bg-white border border-[#E0D8CE] px-3 py-1.5 rounded-lg text-stone-700">
              Active Projects: <strong>{summary.activeProjects || projects.length}</strong>
            </span>
            <span className="bg-white border border-[#E0D8CE] px-3 py-1.5 rounded-lg text-stone-700">
              Pending Deliverables: <strong>{summary.pendingTasks || tasks.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Strategic Projects Section */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <div className="pb-4 border-b border-[#EFE9E0] mb-5">
          <h4 className="font-serif text-base font-bold text-stone-900">
            Active Strategic Campaigns & Projects
          </h4>
          <p className="text-xs text-stone-500">Milestones, progression bar and target deliverables</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-xl border border-[#E7DFD5] bg-[#FAF7F2]/60 hover:bg-white transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h5 className="font-serif font-bold text-stone-900 text-sm">{p.name}</h5>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusColor(
                      p.status
                    )}`}
                  >
                    {p.status}
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed mb-4">
                  {p.description}
                </p>

                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-[11px] text-stone-500">
                    <span>Sprint Completion</span>
                    <span className="font-mono font-bold text-stone-900">{p.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#9C7A42] rounded-full transition-all duration-300"
                      style={{ width: `${p.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7DFD5] flex items-center justify-between text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <FaUserTie className="w-3 h-3 text-[#9C7A42]" /> {p.manager}
                </span>
                <span className="font-mono text-[11px]">
                  Target: {new Date(p.deadline).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task & Deliverables Breakdown */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-6 shadow-sm">
        <div className="pb-4 border-b border-[#EFE9E0] mb-5">
          <h4 className="font-serif text-base font-bold text-stone-900">
            Marketing Tasks & Sprint Deliverables
          </h4>
          <p className="text-xs text-stone-500">Detailed execution items assigned to agency creative team</p>
        </div>

        <div className="divide-y divide-[#F0EBE3]">
          {tasks.map((t) => (
            <div key={t.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900">{t.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusColor(
                      t.status
                    )}`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] max-w-xl">{t.description}</p>
              </div>

              <div className="flex items-center gap-4 text-stone-500 shrink-0">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <FaCalendarAlt className="w-3 h-3 text-[#9C7A42]" />
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "Rolling"}
                </span>
                <span className="text-stone-700 font-medium">{t.manager}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
