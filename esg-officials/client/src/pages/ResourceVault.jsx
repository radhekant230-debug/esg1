import React, { useState } from "react";
import {
  FaFolderOpen,
  FaFilePdf,
  FaFileExcel,
  FaFileWord,
  FaDownload,
  FaSearch,
  FaEye,
  FaShieldAlt,
  FaFileContract,
  FaChartPie,
  FaLock,
  FaCheckCircle,
} from "react-icons/fa";

export default function ResourceVault() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewItem, setPreviewItem] = useState(null);

  const resources = [
    {
      id: "VAULT-001",
      title: "ESG Strategic Brand Governance Framework 2026",
      category: "frameworks",
      categoryLabel: "Risk & Governance",
      format: "PDF",
      size: "4.2 MB",
      icon: FaFilePdf,
      iconColor: "text-rose-600",
      description:
        "Comprehensive consulting blueprint covering brand dilution control, pricing integrity, and commercial exposure management.",
      updatedAt: "2026-09-15",
      isRestricted: false,
    },
    {
      id: "VAULT-002",
      title: "Automated 24-Hour Client Mitigation Policy Manual",
      category: "policies",
      categoryLabel: "Operational Policies",
      format: "PDF",
      size: "2.8 MB",
      icon: FaFilePdf,
      iconColor: "text-rose-600",
      description:
        "Official protocol outlining manager submission criteria, countdown triggers, exception handling, and client disclosures.",
      updatedAt: "2026-10-01",
      isRestricted: false,
    },
    {
      id: "VAULT-003",
      title: "State-Wise Sales Ingestion & Excel Validation Template",
      category: "templates",
      categoryLabel: "Financial Templates",
      format: "XLSX",
      size: "1.5 MB",
      icon: FaFileExcel,
      iconColor: "text-emerald-600",
      description:
        "Standardized multi-location sales reporting spreadsheet with automated formula verification and data cleansing headers.",
      updatedAt: "2026-10-10",
      isRestricted: false,
    },
    {
      id: "VAULT-004",
      title: "Master Agency Advisory & Client Service Level Agreement (SLA)",
      category: "contracts",
      categoryLabel: "Legal & Contracts",
      format: "DOCX",
      size: "1.1 MB",
      icon: FaFileWord,
      iconColor: "text-blue-600",
      description:
        "Standard retained advisory terms, turnaround time commitments, confidentiality, and commercial retainers schedule.",
      updatedAt: "2026-08-20",
      isRestricted: true,
    },
    {
      id: "VAULT-005",
      title: "Café & Fine Dining Multi-Outlet Risk Audit Checklist",
      category: "frameworks",
      categoryLabel: "Risk & Governance",
      format: "PDF",
      size: "3.4 MB",
      icon: FaFilePdf,
      iconColor: "text-rose-600",
      description:
        "Operational assessment matrix evaluating food cost inflation, guest sentiment drops, hygiene certifications, and footfall variance.",
      updatedAt: "2026-10-05",
      isRestricted: false,
    },
    {
      id: "VAULT-006",
      title: "Brand Assets Package & Executive Typography Guidelines",
      category: "assets",
      categoryLabel: "Brand Assets",
      format: "ZIP",
      size: "18.6 MB",
      icon: FaFolderOpen,
      iconColor: "text-[#8C6D37]",
      description:
        "Vector insignia emblems, typography licenses, bespoke color palettes, and stationery layouts for official communications.",
      updatedAt: "2026-07-12",
      isRestricted: false,
    },
  ];

  const categories = [
    { id: "all", label: "All Resources" },
    { id: "frameworks", label: "Risk & Governance" },
    { id: "policies", label: "Operational Policies" },
    { id: "templates", label: "Financial Templates" },
    { id: "contracts", label: "Legal & Contracts" },
    { id: "assets", label: "Brand Assets" },
  ];

  const filtered = resources.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory)
      return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchId) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#9C7A42]"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#8C6D37] font-bold">
              KNOWLEDGE ASSETS &amp; DOCUMENTATION
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1816] tracking-tight">
            Resource Vault
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Central repository of governance frameworks, mitigation policies, brand assets, and advisory contracts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-stone-500 bg-[#FAF8F5] border border-[#E7DFD5] px-3 py-1.5 rounded-xl">
            {resources.length} Verified Vault Items
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === c.id
                  ? "bg-[#1A1816] text-[#FAF8F5] font-bold"
                  : "text-stone-600 hover:text-stone-900 hover:bg-[#F5F0E6]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative pt-1 border-t border-[#E7DFD5]">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs" />
          <input
            type="text"
            placeholder="Search vault by title, format, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl text-xs text-[#1A1816] placeholder-stone-400 focus:outline-hidden focus:border-[#9C7A42]"
          />
        </div>
      </div>

      {/* Grid of Vault Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-5 shadow-2xs flex flex-col justify-between hover:border-[#D0C4B2] transition group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E7DFD5] flex items-center justify-center shrink-0">
                    <Icon className={`text-xl ${item.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-stone-400">
                      {item.format} • {item.size}
                    </span>
                    {item.isRestricted && (
                      <span className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Restricted to Partners">
                        <FaLock className="text-[9px]" />
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-mono uppercase text-[#8C6D37] font-bold">
                  {item.categoryLabel}
                </span>
                <h3 className="font-serif font-bold text-sm text-[#1A1816] mt-0.5 group-hover:text-[#8C6D37] transition">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-600 mt-1.5 line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#EFE9DF] mt-4 flex items-center justify-between text-xs">
                <span className="text-[10px] font-mono text-stone-400">
                  Updated: {item.updatedAt}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-[#F2EDE4] transition"
                    title="Preview Abstract"
                  >
                    <FaEye className="text-xs" />
                  </button>
                  <button
                    onClick={() => {
                      alert(`Downloading resource "${item.title}" (${item.format})`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#8C6D37] font-semibold text-xs border border-[#E0D7C9] transition"
                  >
                    <FaDownload className="text-[10px]" /> Download
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Abstract Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150 text-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] text-[#8C6D37] font-bold">
                  {previewItem.id} • {previewItem.categoryLabel}
                </span>
                <h3 className="font-serif font-bold text-base text-[#1A1816] mt-0.5">
                  {previewItem.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-stone-400 hover:text-stone-700 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-stone-700 leading-relaxed bg-[#FAF8F5] p-4 rounded-xl border border-[#E7DFD5]">
              {previewItem.description}
            </p>

            <div className="font-mono text-[11px] text-stone-500 space-y-1">
              <p>Format: {previewItem.format}</p>
              <p>File Size: {previewItem.size}</p>
              <p>Security Classification: {previewItem.isRestricted ? "Restricted" : "Authorized Client Access"}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E7DFD5]">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`Downloading "${previewItem.title}"`);
                  setPreviewItem(null);
                }}
                className="px-4 py-2 bg-[#9C7A42] text-white rounded-xl font-bold"
              >
                Download Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
