import React, { useCallback, useEffect, useState } from "react";
import api from "../../utils/axios";
import LeadsPipelineTab from "../portal/LeadsPipelineTab";
import CustomerInsightsPanel, { EMPTY_CUSTOMER_FILTERS, isCustomerView } from "./CustomerInsightsPanel";
import CustomerLeaderboard from "./CustomerLeaderboard";

/**
 * Manager Portal → Leads & Enquiries. Lists the clients assigned to this
 * manager (admins see all) and shows the same enquiry pipeline as the Client
 * Portal, with add / edit. The server only allows assigned clients.
 */
export default function ManagerEnquiries() {
  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState("");
  const [leadsData, setLeadsData] = useState(null);
  const [error, setError] = useState("");
  const [customerFilters, setCustomerFilters] = useState(EMPTY_CUSTOMER_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .get("/portal/clients-selector")
      .then(({ data }) => {
        const list = data.clients || [];
        setClients(list);
        if (list.length) setClientId(String(list[0].id));
      })
      .catch((err) => {
        setClients([]);
        setError(err.response?.data?.message || "Could not load your clients.");
      });
  }, []);

  const loadLeads = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data } = await api.get(`/portal/leads?clientId=${clientId}`);
      setLeadsData(data);
      setRefreshKey((n) => n + 1); // add/edit/import also refresh the analytics
      setError("");
    } catch (err) {
      setLeadsData(null);
      setError(err.response?.data?.message || "Could not load enquiries.");
    }
  }, [clientId]);

  useEffect(() => {
    setLeadsData(null);
    setCustomerFilters(EMPTY_CUSTOMER_FILTERS); // filters belong to one client
    loadLeads();
  }, [loadLeads]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Leads &amp; Enquiries</h2>
          <p className="text-xs text-gray-500 mt-0.5">Add, edit and track customer enquiries and their estimated value for your clients.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          Client
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={!clients || clients.length === 0}
            className="min-w-[220px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-normal"
          >
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
                {c.clientId ? ` (${c.clientId})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {clients === null ? (
        <p className="text-sm text-gray-500">Loading clients…</p>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">No clients are assigned to you yet.</div>
      ) : !leadsData ? (
        !error && <p className="text-sm text-gray-500">Loading enquiries…</p>
      ) : (
        <>
          <CustomerInsightsPanel
            clientId={clientId}
            filters={customerFilters}
            onApply={setCustomerFilters}
            refreshKey={refreshKey}
            sources={leadsData.options?.sources || []}
            statuses={leadsData.options?.statuses || []}
          />
          <CustomerLeaderboard
            clientId={clientId}
            baseFilters={{ ...customerFilters, customer: "" }}
            refreshKey={refreshKey}
            onSelect={(c) => {
              // show this customer's enquiries (Edit / Notes) in the table below
              setCustomerFilters({ ...EMPTY_CUSTOMER_FILTERS, customer: c.phone || c.email || c.name });
              setTimeout(() => document.getElementById("enquiry-pipeline")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
          />
          <div id="enquiry-pipeline" className="scroll-mt-24">
          <LeadsPipelineTab
            leadsData={leadsData}
            onRefresh={loadLeads}
            clientId={clientId}
            customerParams={isCustomerView(customerFilters) ? customerFilters : null}
          />
          </div>
        </>
      )}
    </div>
  );
}
