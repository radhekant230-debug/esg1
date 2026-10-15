# Date-range sales imports and restaurant day-wise reports

## What can be imported

| File | How it is recognised | Stored as |
|---|---|---|
| Restaurant POS **day-wise report** (e.g. Petpooja "All Restaurant Report - Day Wise"), `.xlsx`/`.xls`/`.csv` | A header row (anywhere in the first 30 rows) with *Date* plus at least two of *My Amount / Net Sales / Total Sales* and *Total Discount* or *Total no. of bills* | One **daily** `SalesEntry` per restaurant per day, with every report column kept as reported |
| Any sheet with a **Date** column (one row per sale or per day) | Handled by the existing importer (`importParser.js`) | Dated `SalesRecord` rows (`recordType`, `date`, `transactionId`), as before. Range analytics read them as transactions or day totals. |
| Monthly summaries (existing template) | `Month` (+ `Year`) column, or a month chosen in the form | `SalesRecord` (unchanged) |

### Restaurant day-wise report rules

- The report period and report name are read from the lines above the table.
- The header row is detected; it is not assumed to be row 1.
- The restaurant name appears only on the first row of its section. It is carried down until that section's Total/Sub Total row. A blank name after a section has ended is an error.
- **Total, Min., Max., Avg. and Sub Total rows are never imported.** They are used only to check the daily rows:
  - the daily rows must add up to the Total row;
  - Min., Max. and Avg. must match the daily rows;
  - Sub Total is compared with the Total rows and is not counted again.
- **Invoice Nos.** are stored as text, so a range such as `10781-10862` stays as written.
- Money is summed in whole paise, so there are no floating-point errors.
- Source values are stored unchanged. These checks are flagged as warnings and never corrected:
  - **My Amount − Total Discount = Net Sales** (2 paise tolerance);
  - payments (Cash+Card+Due+Other+Wallet+UPI+Online+Not Paid) = **Total Sales**;
  - Net Sales + charges + tax + round off − waived off = Total Sales.
- **Metric labels:**
  - "Total sales (recorded)" = **My Amount** (before discount);
  - "Net sales" = My Amount − Total Discount;
  - "Total Sales (report)" is shown separately, because it includes tax and charges.
  - Profit is shown only when cost and expenses exist; this report has neither.

## Re-uploads

| Case | Result |
|---|---|
| Byte-identical file whose data is still stored | Flagged in the preview. **The import is blocked (409)**, so nothing is counted twice. |
| Corrected report, same outlet and period | The preview shows the existing days. The manager must choose: **Replace with this corrected report** deletes that outlet's entries in the report period and saves the new ones. **Add new days only** keeps existing days. Both are audited (`SALES_ENTRIES_REPLACED_BY_IMPORT` with before/after totals). |
| Overlapping generic files | Handled by the existing importer's duplicate rules (`rowHash` / transaction ID). Monthly roll-ups derived from daily data are updated in place rather than duplicated. |

Other businesses and other periods are never touched.

## Where the data lives

- Restaurant day-wise reports → new `salesentries` collection (unique per business + day).
- Generic dated rows and monthly summaries → `salesrecords` (existing).
- The range engine reads both and applies the rules below. Records with `source = "daily_rollup"` are skipped.

## Analytics for any date range

- **Endpoints:** `GET /api/sales/analytics/range` (manager) and `GET /api/portal/analytics/range` (client).
- **Parameters:**
  - `preset`: today, last_7_days, last_30_days, this_week, previous_week, this_month, previous_month, this_quarter, previous_quarter, this_year
  - or `start` and `end` (`YYYY-MM-DD`, IST)
  - `granularity`: auto, day, week, month, quarter
  - `businessId`
- **Exports:** `…/range/export?format=csv|xlsx`.
- **Calculation:** both portals use the same function (`services/sales/rangeAnalytics.js`) on the same stored records. Only the business scope differs, and the server enforces it.

How double counting is prevented:

1. Itemised transactions replace a day total for the same day.
2. Within the selected period, a monthly or period summary is replaced by daily data **only when the daily data covers every day of it**. Otherwise the summary is used.
3. A record counts only when it lies completely inside the selected period. Monthly totals are never split into days. Partly overlapping records are listed as excluded.
4. The derived monthly roll-ups (`SalesRecord.source = "daily_rollup"`) keep older monthly views working. The range analytics ignore them.

Monthly targets are compared only for whole calendar months. Growth is measured against the comparable previous period, and only when that period has data.

## Deployment

1. `npm run db:backup`
2. `npm run migrate:planner` creates the indexes for the new `salesentries` collection. This is additive; nothing is deleted.
3. Deploy the server, then the client.
4. Save the real exported day-wise report as `server/tests/fixtures/restaurant-daywise-real.xlsx`; `npm test` then also checks it.
