import React, { useState } from "react";
import {
  FaFolder,
  FaFilePdf,
  FaFileArchive,
  FaDownload,
  FaShieldAlt,
  FaSearch,
  FaTag,
} from "react-icons/fa";

export default function ResourceVaultTab({ vaultData }) {
  const documents = vaultData?.documents || [];
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    "ALL",
    "Marketing Strategy",
    "Brand Guidelines",
    "Logos & Brand Assets",
    "Contracts & Proposals",
  ];

  const filteredDocs = documents.filter((doc) => {
    const matchesCat = selectedCategory === "ALL" || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Brand Vault & Confidential Deliverables Library
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Encrypted repository for brand style manuals, high-res assets, strategy blueprints, and legal agreements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <FaShieldAlt className="w-3.5 h-3.5 text-emerald-600" />
              Role-Gated & Isolated Storage
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white text-stone-700 border border-[#E7DFD5] hover:bg-stone-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault files..."
            className="w-full sm:w-60 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#E0D8CE] bg-white focus:outline-hidden focus:border-[#9C7A42]"
          />
          <FaSearch className="w-3 h-3 text-stone-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredDocs.map((doc) => (
          <div
            key={doc._id}
            className="p-5 rounded-xl border border-[#E7DFD5] bg-white hover:border-[#9C7A42] hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[#FAF7F2] border border-[#E7DFD5] text-[#9C7A42]">
                    {doc.fileType.includes("ZIP") ? (
                      <FaFileArchive className="w-4 h-4" />
                    ) : (
                      <FaFilePdf className="w-4 h-4 text-red-700" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#9C7A42] uppercase tracking-wider block">
                      {doc.category}
                    </span>
                    <h4 className="font-serif font-bold text-stone-900 text-sm">
                      {doc.title}
                    </h4>
                  </div>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed my-3">
                {doc.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#F0EBE3] flex items-center justify-between text-xs text-stone-500">
              <span className="font-mono text-[11px] text-stone-400">
                {doc.fileSize} • {doc.fileType}
              </span>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-stone-800 bg-[#FAF7F2] hover:bg-stone-200/60 rounded-md border border-[#E0D8CE] transition"
              >
                <FaDownload className="w-3 h-3 text-[#9C7A42]" /> Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
