import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/axios";
import AdminUniversalDataModal from "../../components/admin/AdminUniversalDataModal";
import {
  FaPlus,
  FaSyncAlt,
  FaSearch,
  FaFileAlt,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaArrowRight,
} from "react-icons/fa";

export default function AdminDataModule({ sectionType, title, subtitle, icon: Icon, modalType }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/clients");
      setClients(res.data || []);
    } catch (e) {
      console.error(`Error loading data for ${sectionType}:`, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sectionType]);

  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.companyName?.toLowerCase().includes(term) ||
      c.clientId?.toLowerCase().includes(term) ||
      c.businessType?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#1A1918] text-[#F5F0E8] rounded-2xl p-6 sm:p-8 border border-[#33312E] shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#C5A880]/20 text-[#C5A880] border border-[#C5A880]/30">
              ADMIN CONTROL
            </span>
            <span className="text-xs text-stone-400 font-mono uppercase tracking-wider">
              {sectionType.toUpperCase()}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-3">
            {Icon && <Icon className="text-[#C5A880] text-xl" />}
            {title}
          </h1>

          <p className="text-stone-300 text-sm max-w-2xl mt-1">
            {subtitle || "Manage records and configure business metrics across agency clients."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
            title="Refresh"
          >
            <FaSyncAlt className={loading ? "animate-spin text-amber-400" : ""} />
          </button>

          {modalType && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#C5A880] hover:bg-[#B39369] text-stone-950 font-bold text-xs transition shadow-sm flex items-center gap-2"
            >
              <FaPlus />
              + Add {modalType === "sales" ? "Sales" : modalType === "campaign" ? "Campaign" : modalType === "lead" ? "Lead" : "Record"}
            </button>
          )}
        </div>
      </div>

      {/* Main Records Container */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-serif font-bold text-stone-900">
              Agency Accounts Directory ({filteredClients.length})
            </h2>
            <p className="text-xs text-stone-500 font-mono">
              Select any client below to inspect their full {title} data or record new performance metrics.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <FaSearch className="absolute left-3 top-2.5 text-stone-400 text-xs" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs outline-none focus:border-[#C5A880]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredClients.map((client) => (
            <div
              key={client._id}
              className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-[#C5A880]/60 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-[#8B6E3F] font-bold uppercase">{client.clientId}</span>
                  <span className="text-stone-500 capitalize">{client.businessType?.replace("_", " ")}</span>
                </div>
                <h3 className="font-bold text-sm text-stone-900 truncate">
                  {client.companyName || client.name}
                </h3>
                <p className="text-xs text-stone-500 truncate">{client.name} • {client.email}</p>
              </div>

              <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-stone-600">
                  Retainer: ₹{(client.retainerAmount || 45000).toLocaleString("en-IN")}/mo
                </span>
                <Link
                  to={`/admin/clients/${client._id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-900 hover:bg-[#8B6E3F] text-white text-[11px] font-semibold transition"
                >
                  <span>Manage</span>
                  <FaArrowRight className="text-[10px]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdminUniversalDataModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialType={modalType || "sales"}
        onSuccess={fetchData}
      />
    </div>
  );
}
