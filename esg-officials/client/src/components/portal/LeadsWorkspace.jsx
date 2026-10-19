import React, { useEffect, useRef, useState } from "react";
import LeadsPipelineTab from "./LeadsPipelineTab";
import CustomerInsightsPanel, { EMPTY_CUSTOMER_FILTERS, isCustomerView } from "../sales/CustomerInsightsPanel";
import CustomerLeaderboard from "../sales/CustomerLeaderboard";

/**
 * Leads & Enquiries workspace shared by the Manager Portal and the Client Portal:
 * Customer Insights (KPI cards + filters), Top Customers Leaderboard and the
 * enquiry pipeline (status filters, search, pagination, Edit, Notes).
 *
 * Every request carries `clientId`; the server resolves the client itself
 * (resolvePortalClient): a client user always gets only their own records,
 * a manager only assigned clients.
 */
export default function LeadsWorkspace({ clientId, leadsData, onRefresh }) {
  const [customerFilters, setCustomerFilters] = useState(EMPTY_CUSTOMER_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);

  // filters belong to one client
  const lastClient = useRef(clientId);
  useEffect(() => {
    if (lastClient.current !== clientId) {
      lastClient.current = clientId;
      setCustomerFilters(EMPTY_CUSTOMER_FILTERS);
    }
  }, [clientId]);

  // new enquiry data (after add / edit / notes / import) refreshes the analytics too
  const firstData = useRef(true);
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    if (leadsData) setRefreshKey((n) => n + 1);
  }, [leadsData]);

  if (!clientId) {
    return <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">Select a client to see its customers and enquiries.</div>;
  }

  return (
    <div className="space-y-5">
      <CustomerInsightsPanel
        clientId={clientId}
        filters={customerFilters}
        onApply={setCustomerFilters}
        refreshKey={refreshKey}
        sources={leadsData?.options?.sources || []}
        statuses={leadsData?.options?.statuses || []}
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
          key={clientId}
          leadsData={leadsData}
          onRefresh={onRefresh}
          clientId={clientId}
          customerParams={isCustomerView(customerFilters) ? customerFilters : null}
        />
      </div>
    </div>
  );
}
