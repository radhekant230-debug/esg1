# Manager Upload → Client Portal Sync

## How it works

```
Manager selects file (+ optional target business / reporting month)
  → POST /api/sales/upload/preview   validates type & content, reads every sheet, maps columns,
                                     validates every row, stores the original file (GridFS),
                                     returns preview + "which client portal will receive this"
  → POST /api/sales/upload/commit    one MongoDB transaction: SalesRecord documents keyed by
                                     SalesBusiness._id (stable ID) + audit log; notifies clients
  → Manager dashboard refreshes      (modal onSuccess)
  → Client Portal                    reads the SAME SalesRecord documents for businesses whose
                                     clientAccount = that client; polls /api/portal/sync-status
                                     every 30 s and on tab focus and refreshes automatically
```

Nothing is copied into a second collection, so manager and client views cannot drift apart, and a
"Replace" re-upload is visible to the client on the next sync check.

## Root cause of "0 Valid / 7 Invalid" (Month, Business Name, Total Sales missing)

1. **Header detection** — the old importer used `sheet_to_json` on the first sheet, which takes
   **row 1 as the header**. Files with a title row ("Monthly Sales Report") or a blank first row, or
   whose first sheet is instructions, produced keys like `__EMPTY_1`, so *every* field looked missing.
2. **Exact header names** — only a fixed list of lowercase names matched. `Total Sales (INR)` (the
   app's own export header), `Business_Name`, `Client/Business Name`, `Sales Target`, separate
   `Month` + `Year` columns etc. did not map.
3. **Dates** — Excel date cells in the Month column were stringified to serial numbers (e.g. `46296`)
   and rejected; `Oct-2026` was not accepted.
4. **No client association** — the manager could not choose the business/month for files that don't
   contain them, and imported `SalesRecord`s were never read by the Client Portal, which only read the
   separate `ClientSalesRecord` collection. That is why clients never saw manager uploads.
5. The template contained sample business names ("Hotel Royal") that might not exist in the database.

Validation was **not** removed: every row is still checked, invalid rows are listed with reasons and
can be downloaded as an error report, and they are only excluded after explicit confirmation.

## One-time setup: link businesses to client portal accounts

A business appears in a client portal only after it is linked (stable IDs, never names):

- **Admin UI**: Admin → State Sales → edit business → *Client portal account*.
- **CLI**: `npm run link:clients` lists businesses, current links and name-based suggestions;
  `node scripts/linkBusinessClients.js --business BIZ-JH-RAN-0001 --client owner@example.com` links one.

The upload preview shows, per business, which client portal will receive the data (or that it is
not linked yet).

## Re-uploads

The preview reports rows whose business + month already exist and which earlier import they came
from. The manager chooses:

- **Add new months only** (default) — existing months are kept.
- **Replace** — those business/months are overwritten. Nothing else (other months, other clients) is
  touched. Before/after values are kept in `auditlogs`, and the import history links the replaced import.

The `(business, year, month)` unique index makes double-appending impossible even under concurrent uploads.

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/sales/upload/preview` (multipart: `file`, optional `targetBusinessId`, `reportingMonth`, `reportingYear`, `mapping`) | admin, manager (own businesses) |
| POST | `/api/sales/upload/commit` `{ importJobId, duplicateMode: "add"\|"replace", acknowledgeInvalid }` | uploader / admin |
| GET | `/api/sales/upload/:id/file` — original file | uploader, managers of the affected businesses, admin |
| GET | `/api/sales/upload/:id/invalid-rows` — error report CSV | same |
| GET | `/api/sales/template?format=csv\|xlsx` | admin, manager |
| GET | `/api/sales/import-history` | admin, manager |
| GET | `/api/portal/sales`, `/api/portal/overview` | client (own data only), assigned manager, admin |
| GET | `/api/portal/sync-status` | same |
| GET | `/api/portal/analytics/monthly?year&month&months&businessId` | same — monthly KPIs, trend, sales vs target, P&L breakdown, location comparison, profitability rows, import pipeline + history |
| GET | `/api/portal/analytics/monthly/export?format=csv\|xlsx` | same |

## Client Portal sales analytics

The Client Portal's **Monthly Analytics** tab (next to Executive Overview) shows the same Monthly Sales / Discount / P&L dashboard as the Manager Portal
(`client/src/components/sales/MonthlyAnalytics.jsx`, rendered with `audience="client"`). Both portals
call the same server function (`buildAnalytics` in `salesAnalyticsController.js`); only the business
scope differs:

- **Manager**: businesses allowed by the existing city/state/assignment rules.
- **Client**: businesses whose `clientAccount` is that client. `businessId`/`clientId` query parameters
  can narrow this but never widen it. Import counts and file names only include files whose rows were
  all for the client's own businesses; for multi-client files the client only sees how many of
  *their* records it contained.

Missing discount/cost/expenses are shown as "Data unavailable" (never ₹0) and partial coverage is
labelled. Manual entries made directly in the client portal (older `ClientSalesRecord` collection) are
counted in the pipeline but not used for P&L, because blank cost/discount fields in that collection
default to 0 and would be indistinguishable from real zeros.

## Local testing

```bash
cd server
npm install
npm test                              # unit tests (parser, financials, …)
npm run db:backup                     # backup before any schema change
npm run migrate:planner               # idempotent; adds indexes only, deletes nothing
npm run link:clients                  # see which businesses are linked to client portals
# integration tests (scenarios 11-15 cover upload → client portal sync, isolation, re-upload):
MONGO_URI_TEST="mongodb://127.0.0.1:27017/esg-test" npm run test:integration
npm run dev

cd ../client
npm install
npm run dev                           # http://localhost:5173
npm run build
```

Manual check: log in as a manager → Sales → *Import Excel / CSV* → pick the target business and month →
upload → confirm. Open the linked client's portal in another browser: within 30 s (or on tab focus)
the Sales tab shows the month with a green "New sales data" banner, without reloading.

## Deployment

1. `npm run db:backup` against production (`MONGO_URI` set).
2. Commit and push → Render redeploys the API (`render.yaml`), Vercel rebuilds the client.
3. In Render, run `npm run migrate:planner` once (Shell tab) — safe to re-run.
4. Link each business to its client account (Admin UI or `npm run link:clients`).
No new environment variables are required: original files are stored in MongoDB GridFS.
