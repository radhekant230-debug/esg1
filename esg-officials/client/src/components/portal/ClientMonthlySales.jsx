import React from "react";
import MonthlyAnalytics from "../sales/MonthlyAnalytics";

/**
 * Client Portal monthly sales analytics.
 *
 * Renders the same Monthly Sales / Discount / P&L dashboard the Manager Portal
 * uses, backed by GET /api/portal/analytics/monthly. The server scopes it to the
 * businesses linked to this client account (a client is always forced to their
 * own account; a manager may only open clients assigned to them), so the same
 * calculations run on the same SalesRecord documents without exposing other
 * clients' data.
 *
 * clientId: only for admins/managers viewing a client's portal; ignored by the
 * server for client logins.
 */
export default function ClientMonthlySales({ clientId = "", refreshKey = 0 }) {
  return (
    <section aria-labelledby="client-monthly-analytics" className="space-y-3">
      <div>
        <h2 id="client-monthly-analytics" className="font-serif text-xl font-bold text-stone-900">
          Monthly Analytics
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Sales, discounts and profit/loss for your business(es), from the data your account manager uploads. Updates automatically.
        </p>
      </div>
      <MonthlyAnalytics audience="client" extraParams={clientId ? { clientId } : null} refreshKey={refreshKey} />
    </section>
  );
}
