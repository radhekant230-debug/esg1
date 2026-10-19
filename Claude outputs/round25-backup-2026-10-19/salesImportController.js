/**
 * Safe sales Excel / CSV import:
 *   1. POST /api/sales/upload/preview  -> parse, map columns, validate every row,
 *      store the validated result server-side as a pending SalesImportJob
 *   2. POST /api/sales/upload/commit   -> { importJobId, duplicateMode, acknowledgeInvalid }
 *      re-checks permissions and duplicates, then writes all rows in ONE
 *      transaction (or rolls back with compensation on a standalone MongoDB)
 * Rows from the browser are never trusted: the commit uses the server copy.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const parser = require("../services/sales/importParser");
const { getManagerAuthorizedBusinessQuery } = require("../services/salesAccess");
const { audit } = require("../services/audit");
const { runInTransaction } = require("../utils/transaction");
const ist = require("../utils/istDate");
const fileStore = require("../services/sales/importFileStore");
const { notifyClientsOfNewSales } = require("../services/portal/clientSalesFeed");
const SalesEntry = require("../models/sales/SalesEntry");
const restaurantReport = require("../services/sales/reportParsers/restaurantDayWise");
const entryImport = require("../services/sales/entryImport");
const P = require("../services/sales/periods");
const User = require("../models/User");
const importTargets = require("../services/sales/importTargets");

const PREVIEW_TTL_MS = 2 * 60 * 60 * 1000;
const RECORD_FIELDS = [
  "recordType",
  "date",
  "startDate",
  "endDate",
  "periodType",
  "transactionId",
  "rowHash",
  "totalSales",
  "salesBasis",
  "orders",
  "target",
  "discount",
  "cost",
  "expenses",
  "reportedProfit",
  "remarks",
];
// UI wording -> stored mode: "add" keeps existing periods, "replace" overwrites them
const DUPLICATE_MODES = { skip: "skip", add: "skip", update: "update", replace: "update" };

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const respondError = (res, err, fallback) => {
  if (err && err.status) return res.status(err.status).json({ message: err.message, ...(err.details || {}) });
  console.error(fallback, err);
  return res.status(500).json({ message: fallback });
};

async function authorizedBusinessIds(user) {
  const filter = await getManagerAuthorizedBusinessQuery(user);
  const ids = await SalesBusiness.find(filter).distinct("_id");
  return new Set(ids.map(String));
}

async function existingRecordMap(rows) {
  const keys = rows.filter((r) => r.data).map((r) => r.data);
  if (!keys.length) return new Map();

  const bizIds = [...new Set(keys.map((k) => k.businessId).filter(Boolean))];
  const txnIds = keys.map((k) => k.transactionId).filter(Boolean);
  const hashes = keys.map((k) => k.rowHash).filter(Boolean);
  const monthOr = keys.map((k) => ({ business: k.businessId, year: k.year, month: k.month }));

  const queries = [];
  if (monthOr.length) {
    for (let i = 0; i < monthOr.length; i += 500) {
      queries.push({ $or: monthOr.slice(i, i + 500) });
    }
  }
  if (txnIds.length) {
    queries.push({ business: { $in: bizIds }, transactionId: { $in: txnIds } });
  }
  if (hashes.length) {
    queries.push({ business: { $in: bizIds }, rowHash: { $in: hashes } });
  }

  const found = queries.length
    ? await SalesRecord.find(queries.length === 1 ? queries[0] : { $or: queries })
        .select("business year month date totalSales orders source importJob transactionId rowHash recordType")
        .lean()
    : [];

  const map = new Map();
  found.forEach((r) => {
    map.set(`${r.business}:${r.year}:${r.month}`, r);
    map.set(`sum:${r.business}:${r.year}:${r.month}`, r);
    if (r.transactionId) map.set(`txn:${r.business}:${r.transactionId.toLowerCase()}`, r);
    if (r.rowHash) map.set(`hash:${r.business}:${r.rowHash}`, r);
    if (r.date) map.set(`${r.business}:${ist.istDayKey(r.date)}`, r);
  });
  return map;
}

const summarizeRow = (r) => ({
  rowNumber: r.rowNumber,
  sheet: r.sheet,
  rowLabel: r.rowLabel,
  status: r.status,
  errors: r.errors,
  warnings: r.warnings,
  existing: r.existing || null,
  raw: r.raw,
  data: r.data,
});

const normName = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const money = (paise) => (paise === null || paise === undefined ? null : paise / 100);

/**
 * Preview for a restaurant day-wise report: maps each restaurant section to a
 * registered business, turns daily rows into "day" rows, and reports the
 * metadata, summary totals, reconciliation checks and existing data.
 */
async function previewRestaurantReport({ req, kind, report, businesses, authorizedIds, targetBusiness, dateRange, restaurantMap }) {
  const byName = new Map();
  businesses.forEach((b) => {
    const k = normName(b.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(b);
  });
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const period = {
    start: report.meta.periodStart || report.coverage.firstDate,
    end: report.meta.periodEnd || report.coverage.lastDate,
  };
  if (dateRange && (dateRange.start !== period.start || dateRange.end !== period.end)) {
    report.warnings.push(`The period chosen in the form (${P.rangeLabel(dateRange.start, dateRange.end)}) differs from the report's own period (${P.rangeLabel(period.start, period.end)}). Rows outside the chosen period are rejected.`);
  }

  const validRows = [];
  const invalidRows = report.invalidRows.map((d) => ({
    rowNumber: d.rowNumber,
    sheet: d.sheet,
    rowLabel: `Row ${d.rowNumber}`,
    status: "invalid",
    errors: d.errors,
    warnings: d.warnings,
    raw: d.raw,
    data: null,
  }));
  const restaurants = report.sections.map((sec) => {
    let business = null;
    let problem = null;
    const mapped = restaurantMap && restaurantMap[sec.restaurant];
    if (mapped) business = bizById.get(String(mapped)) || null;
    if (!business && targetBusiness && report.sections.length === 1) business = targetBusiness;
    if (!business) {
      const matches = byName.get(normName(sec.restaurant)) || [];
      if (matches.length === 1) business = matches[0];
      else if (matches.length > 1) problem = `"${sec.restaurant}" matches ${matches.length} businesses (${matches.map((b) => b.city).join(", ")}) — choose the business.`;
      else problem = `"${sec.restaurant}" is not registered in the portal — choose the business it belongs to.`;
    }
    if (business && authorizedIds && !authorizedIds.has(String(business._id))) {
      problem = `You are not authorized to import sales for "${business.name}" (${business.city}).`;
      business = null;
    }
    const nameDiffers = business && normName(business.name) !== normName(sec.restaurant);
    sec.days.forEach((d) => {
      const errors = [...d.errors];
      if (!business) errors.push(problem);
      if (dateRange && (d.date < dateRange.start || d.date > dateRange.end)) errors.push(`Date ${d.date} is outside the selected reporting period.`);
      const [y, m] = d.date.split("-").map(Number);
      const row = {
        rowNumber: d.rowNumber,
        sheet: d.sheet,
        rowLabel: `Row ${d.rowNumber}`,
        errors,
        warnings: d.warnings,
        raw: d.raw,
        data: business && !errors.length
          ? {
              kind: "day",
              date: d.date,
              transactionId: null,
              businessId: String(business._id),
              businessName: business.name,
              category: business.category,
              state: business.state,
              city: business.city,
              month: m,
              year: y,
              monthName: `${ist.MONTH_NAMES[m - 1]} ${y}`,
              target: null,
              cost: null,
              expenses: null,
              reportedProfit: null,
              remarks: "",
              sourceFormat: report.format,
              restaurant: sec.restaurant,
              ...restaurantReport.toEntryValues(d),
            }
          : null,
      };
      row.status = row.errors.length ? "invalid" : "valid";
      (row.status === "valid" ? validRows : invalidRows).push(row);
    });
    const tot = sec.summaries.total ? sec.summaries.total.values : null;
    return {
      restaurant: sec.restaurant,
      businessId: business ? business._id : null,
      businessName: business ? business.name : null,
      city: business ? business.city : null,
      nameDiffers: Boolean(nameDiffers),
      problem,
      dailyRows: sec.days.length,
      totals: tot ? Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, restaurantReport.COUNT_KEYS.includes(k) ? v : money(v)])) : null,
      reconciliation: sec.reconciliation,
      summaryRows: Object.keys(sec.summaries),
    };
  });

  // Existing data for the same outlets and period (corrections must be explicit)
  const bizIds = [...new Set(validRows.map((r) => r.data.businessId))];
  const existing = bizIds.length
    ? await SalesEntry.find({ business: { $in: bizIds }, startKey: { $lte: period.end }, endKey: { $gte: period.start } })
        .select("business kind startKey endKey totalSales importJob")
        .lean()
    : [];
  const existingByBiz = bizIds.map((id) => {
    const list = existing.filter((e) => String(e.business) === id);
    return {
      businessId: id,
      businessName: bizById.get(id).name,
      entries: list.length,
      days: new Set(list.map((e) => e.startKey)).size,
      totalSales: Math.round(list.reduce((s, e) => s + Math.round((e.totalSales || 0) * 100), 0)) / 100,
      importJobs: [...new Set(list.map((e) => String(e.importJob)).filter((x) => x !== "null"))],
    };
  });
  const existingDayKeys = new Set(existing.filter((e) => e.kind === "day").map((e) => `${e.business}:${e.startKey}`));
  validRows.forEach((r) => {
    if (existingDayKeys.has(`${r.data.businessId}:${r.data.date}`)) {
      r.existing = true;
      r.warnings.push(`${r.data.businessName} already has sales for ${r.data.date}. Use "Replace with this corrected report" to overwrite the period, or "Add new days only" to keep the existing day.`);
    }
  });

  // Identical file already imported (and its data still present)?
  const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const identical = await SalesImportJob.findOne({ fileHash, status: { $in: ["completed", "partial"] } }).sort({ createdAt: -1 }).lean();
  let identicalFile = null;
  if (identical && (await SalesEntry.exists({ importJob: identical._id }))) {
    identicalFile = { importJobId: identical._id, atLabel: ist.formatISTDateTime(identical.createdAt), by: identical.uploaderName };
  }

  // Cancel this user's older pending previews
  const stale = await SalesImportJob.find({ uploadedBy: req.user._id, status: "pending" }).select("originalFile").lean();
  if (stale.length) {
    await SalesImportJob.updateMany({ _id: { $in: stale.map((j) => j._id) } }, { $set: { status: "cancelled", validRows: [], invalidRows: [] } });
    await Promise.all(stale.map((j) => fileStore.deleteFile(j.originalFile && j.originalFile.fileId).catch(() => {})));
  }

  const User = require("../models/User");
  const clientIds = [...new Set(bizIds.map((id) => bizById.get(id).clientAccount).filter(Boolean).map(String))];
  const clients = await User.find({ _id: { $in: clientIds } }).select("name companyName").lean();
  const portalTargets = bizIds.map((id) => {
    const b = bizById.get(id);
    const c = b.clientAccount ? clients.find((x) => String(x._id) === String(b.clientAccount)) : null;
    return { businessId: id, businessName: b.name, city: b.city, clientId: c ? c._id : null, clientName: c ? c.companyName || c.name : null, rows: validRows.filter((r) => r.data.businessId === id).length };
  });

  const jobId = new mongoose.Types.ObjectId();
  const storedFile = await fileStore.saveFile(req.file.buffer, { filename: req.file.originalname, mimeType: kind.mime, uploadedBy: req.user._id, importJobId: jobId });
  const reportMeta = {
    reportName: report.meta.reportName,
    periodStart: report.meta.periodStart,
    periodEnd: report.meta.periodEnd,
    metadataLines: report.meta.lines.slice(0, 10),
    headerRow: report.headerRow,
    columns: report.columns,
    missingColumns: report.missingColumns,
    restaurants,
    subTotal: report.reportSummaries.find((x) => x.type === "subTotal")
      ? Object.fromEntries(Object.entries(report.reportSummaries.find((x) => x.type === "subTotal").values).map(([k, v]) => [k, restaurantReport.COUNT_KEYS.includes(k) ? v : money(v)]))
      : null,
    subTotalRelation: report.subTotalRelation,
    reconciliation: report.reconciliation,
    coverage: report.coverage,
    warnings: report.warnings,
  };
  const periods = [...new Set(validRows.map((r) => r.data.monthName))];
  const entryCounts = { day: validRows.length, txn: 0, month: 0, possibleDuplicates: 0 };

  const job = await SalesImportJob.create({
    _id: jobId,
    uploadedBy: req.user._id,
    uploaderName: req.user.name,
    filename: req.file.originalname,
    fileSize: req.file.size || req.file.buffer.length,
    fileHash,
    originalFile: storedFile,
    sheetName: report.sheetName,
    headerRow: report.headerRow,
    sheets: [{ sheetName: report.sheetName, headerRow: report.headerRow, rows: validRows.length + invalidRows.length }],
    columnMapping: report.columns,
    targetBusiness: targetBusiness ? targetBusiness._id : null,
    targetClient: req.importTargetClient || null,
    reportFormat: report.format,
    reportMeta,
    reportPeriod: period,
    entryCounts,
    periods,
    businesses: bizIds,
    affectedClients: clientIds,
    totalRows: validRows.length + invalidRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    validRows: validRows.map(summarizeRow),
    invalidRows: invalidRows.map(summarizeRow),
    status: "pending",
    expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
  });
  await audit({
    entityType: "SalesImportJob",
    entityId: job._id,
    action: "IMPORT_PREVIEWED",
    actor: req.user,
    metadata: { filename: job.filename, format: report.format, period, valid: validRows.length, invalid: invalidRows.length, fileId: storedFile.fileId, identicalFile: Boolean(identicalFile) },
  });

  return {
    storedFile,
    response: {
      importJobId: job._id,
      filename: job.filename,
      expiresAt: job.expiresAt,
      reportFormat: report.format,
      report: reportMeta,
      reportPeriod: { ...period, label: P.rangeLabel(period.start, period.end) },
      columnInfo: { sheetName: report.sheetName, headerRow: report.headerRow, headers: report.headers.filter(Boolean), mapping: report.columns, missingRequired: [], notices: [], ignoredSheets: [] },
      entryCounts,
      periods,
      portalTargets,
      existingData: existingByBiz.filter((x) => x.entries > 0),
      existingCount: validRows.filter((r) => r.existing).length,
      identicalFile,
      totalRows: validRows.length + invalidRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validTotalSales: Math.round(validRows.reduce((s, r) => s + Math.round((r.data.totalSales || 0) * 100), 0)) / 100,
      replacesImports: [],
      validRows: validRows.map(summarizeRow),
      invalidRows: invalidRows.map(summarizeRow),
    },
  };
}

/**
 * Commit for a restaurant day-wise report job: writes SalesEntry day rows for
 * each outlet, with explicit replace/add for days that already exist, blocks a
 * byte-identical re-upload, refreshes the monthly roll-ups and notifies clients.
 */
async function commitReportJob(req, res, claimed, toWrite, lateRejected, duplicateMode) {
  const rows = claimed.validRows || [];
  if (!req.body.duplicateMode && rows.some((r) => r.existing)) {
    await SalesImportJob.updateOne({ _id: claimed._id }, { $set: { status: "pending" } });
    throw fail(409, 'Sales already exist for some of these days. Choose "Replace with this corrected report" or "Add new days only".', { details: { requiresDuplicateChoice: true } });
  }
  if (claimed.fileHash) {
    const twin = await SalesImportJob.findOne({ _id: { $ne: claimed._id }, fileHash: claimed.fileHash, status: { $in: ["completed", "partial"] } }).sort({ createdAt: -1 }).lean();
    if (twin && (await SalesEntry.exists({ importJob: twin._id }))) {
      await SalesImportJob.updateOne({ _id: claimed._id }, { $set: { status: "cancelled", validRows: [] } });
      throw fail(409, `This exact file was already imported on ${ist.formatISTDateTime(twin.createdAt)} by ${twin.uploaderName || "a manager"}. Nothing was imported again.`, { details: { identicalFile: true } });
    }
  }
  const reportPeriod = claimed.reportPeriod && claimed.reportPeriod.start ? { start: claimed.reportPeriod.start, end: claimed.reportPeriod.end } : null;
  const counters = { inserted: 0, replaced: 0, skipped: 0, totalSales: 0 };
  const replacedImports = new Set();
  const skippedRows = [];
  let rollups = [];

  const work = async (session) => {
    Object.assign(counters, { inserted: 0, replaced: 0, skipped: 0, totalSales: 0 });
    replacedImports.clear();
    skippedRows.length = 0;
    const comp = { inserted: [], deleted: [] };
    try {
      const spans = entryImport.coveredSpans(toWrite, reportPeriod);
      const { docs } = entryImport.buildEntryDocs(toWrite, { importJobId: claimed._id, user: req.user, sourceFormat: claimed.reportFormat });
      let toInsert = docs;
      for (const [biz, span] of spans) {
        // eslint-disable-next-line no-await-in-loop
        const before = await SalesEntry.find({ business: biz, startKey: { $gte: span.start }, endKey: { $lte: span.end } }).session(session).lean();
        if (!before.length) continue;
        const keyOf = (e) => (e.kind === "txn" ? `t:${e.transactionId}` : `d:${e.startKey}`);
        if (duplicateMode === "update") {
          // eslint-disable-next-line no-await-in-loop
          await SalesEntry.deleteMany({ _id: { $in: before.map((e) => e._id) } }).session(session);
          if (!session) comp.deleted.push(...before);
          before.forEach((e) => e.importJob && String(e.importJob) !== String(claimed._id) && replacedImports.add(String(e.importJob)));
          const had = new Set(before.map(keyOf));
          const mine = docs.filter((d) => String(d.business) === biz);
          counters.replaced += mine.filter((d) => had.has(keyOf(d))).length;
          const sum = (list) => Math.round(list.reduce((t, e) => t + Math.round((e.totalSales || 0) * 100), 0)) / 100;
          // eslint-disable-next-line no-await-in-loop
          await audit(
            {
              entityType: "SalesEntry",
              action: "SALES_ENTRIES_REPLACED_BY_IMPORT",
              actor: req.user,
              before: { business: biz, period: span, entries: before.length, totalSales: sum(before), importJobs: [...new Set(before.map((e) => String(e.importJob)))] },
              after: { entries: mine.length, totalSales: sum(mine) },
              metadata: { importJob: claimed._id },
            },
            { session, strict: Boolean(session) }
          );
        } else {
          const have = new Set(before.filter((e) => e.kind !== "period").map(keyOf));
          toInsert = toInsert.filter((d) => {
            if (String(d.business) !== biz || !have.has(keyOf(d))) return true;
            counters.skipped++;
            skippedRows.push({ businessName: d.businessName, month: d.startKey, reason: "Sales for this day already exist (kept — choose Replace to correct them)" });
            return false;
          });
        }
      }
      if (toInsert.length) {
        const created = await SalesEntry.insertMany(toInsert, session ? { session, ordered: true } : { ordered: true });
        if (!session) comp.inserted.push(...created.map((c) => c._id));
        counters.totalSales = Math.round(toInsert.reduce((t, d) => t + Math.round(d.totalSales * 100), 0)) / 100;
      }
      counters.inserted = toInsert.length - counters.replaced;
      rollups = await entryImport.refreshRollups(entryImport.monthsOfSpans(spans), { user: req.user, session });
      await audit(
        {
          entityType: "SalesImportJob",
          entityId: claimed._id,
          action: "SALES_ENTRIES_IMPORTED",
          actor: req.user,
          after: { entries: toInsert.length, totalSales: counters.totalSales },
          metadata: { format: claimed.reportFormat, spans: [...spans].map(([b, sp]) => ({ business: b, ...sp })), rollups },
        },
        { session, strict: Boolean(session) }
      );
    } catch (err) {
      if (!session) {
        if (comp.inserted.length) await SalesEntry.deleteMany({ _id: { $in: comp.inserted } });
        if (comp.deleted.length) await SalesEntry.insertMany(comp.deleted, { ordered: false }).catch(() => {});
      }
      throw err;
    }
  };

  let transactional = true;
  try {
    ({ transactional } = await runInTransaction(work));
  } catch (err) {
    await SalesImportJob.updateOne({ _id: claimed._id }, { $set: { status: "failed", errorLogs: [{ reason: `Import rolled back — nothing was saved: ${err.message}` }] } });
    await audit({ entityType: "SalesImportJob", entityId: claimed._id, action: "IMPORT_FAILED_ROLLED_BACK", actor: req.user, metadata: { error: err.message } });
    throw fail(err.code === 11000 ? 409 : 500, err.code === 11000 ? "Another import saved the same days at the same time. Nothing was saved — please preview again." : "The import failed and was rolled back. No records were saved.");
  }

  const rejected = [...(claimed.invalidRows || []), ...lateRejected];
  const errorLogs = rejected.map((r) => ({ rowNumber: r.rowNumber, sheet: r.sheet || "", businessName: (r.data && r.data.businessName) || "", month: (r.data && r.data.date) || "", reason: (r.errors || []).join(" | ") }));
  const written = counters.inserted + counters.replaced;
  const status = rejected.length ? (written > 0 ? "partial" : "rejected") : "completed";
  await SalesImportJob.updateOne(
    { _id: claimed._id },
    {
      $set: {
        status,
        successCount: counters.inserted,
        updatedCount: counters.replaced,
        skippedCount: counters.skipped,
        rejectedCount: rejected.length,
        failedCount: rejected.length,
        totalRevenue: counters.totalSales,
        errorLogs,
        committedAt: new Date(),
        replacedImports: [...replacedImports],
        validRows: [],
        invalidRows: claimed.invalidRows || [],
      },
    }
  );
  let notifiedClients = [];
  if (written > 0) {
    notifiedClients = await notifyClientsOfNewSales({
      importJobId: claimed._id,
      businessIds: [...new Set(toWrite.map((r) => r.data.businessId))],
      periods: reportPeriod ? [P.rangeLabel(reportPeriod.start, reportPeriod.end)] : [],
      replaced: counters.replaced > 0,
    }).catch(() => []);
  }
  await audit({ entityType: "SalesImportJob", entityId: claimed._id, action: "IMPORT_COMMITTED", actor: req.user, metadata: { ...counters, rejected: rejected.length, duplicateMode: duplicateMode === "update" ? "replace" : "add", transactional, replacedImports: [...replacedImports], clientsUpdated: notifiedClients } });

  return res.json({
    message: `Import complete: ${counters.inserted} new day(s), ${counters.replaced} replaced, ${counters.skipped} kept (already existed), ${rejected.length} rejected.${notifiedClients.length ? ` ${notifiedClients.length} client portal(s) now show this data.` : ""}`,
    summary: {
      totalProcessed: claimed.totalRows,
      successCount: counters.inserted,
      updatedCount: counters.replaced,
      skippedCount: counters.skipped,
      rejectedCount: rejected.length,
      failedCount: rejected.length,
      totalRevenue: counters.totalSales,
      transactional,
      duplicateMode: duplicateMode === "update" ? "replace" : "add",
      periods: reportPeriod ? [P.rangeLabel(reportPeriod.start, reportPeriod.end)] : [],
      reportPeriod: reportPeriod ? { ...reportPeriod, label: P.rangeLabel(reportPeriod.start, reportPeriod.end) } : null,
      clientPortalsUpdated: notifiedClients.length,
      entriesInserted: counters.inserted + counters.replaced,
      entriesReplaced: counters.replaced,
      rollups,
    },
    skippedRows,
    rejectedRows: errorLogs,
  });
}

// ---------------------------------------------------------------------------
// 1. Preview
// ---------------------------------------------------------------------------
exports.previewSalesExcel = async (req, res) => {
  let storedFile = null;
  try {
    if (!req.file || !req.file.buffer) {
      throw fail(400, "No file uploaded. Please upload a .xlsx, .xls or .csv file.");
    }
    // 1. Validate the real file type (not just the extension)
    const kind = parser.detectFileKind(req.file.buffer, req.file.originalname);
    if (!kind.ok) throw fail(400, kind.error);

    let mappingOverride = null;
    if (req.body && req.body.mapping) {
      try {
        mappingOverride = typeof req.body.mapping === "string" ? JSON.parse(req.body.mapping) : req.body.mapping;
      } catch (_) {
        throw fail(400, "Invalid column mapping.");
      }
    }

    const authorizedIds = req.user.role === "admin" ? null : await authorizedBusinessIds(req.user);

    // 2. Upload-form context: target business (stable ID), location, reporting period and dates
    const body = req.body || {};
    let targetBusiness = null;
    if (body.targetBusinessId) {
      if (!mongoose.Types.ObjectId.isValid(body.targetBusinessId)) throw fail(400, "Invalid target business.");
      targetBusiness = await SalesBusiness.findById(body.targetBusinessId).select("name code city state category monthlyTarget clientAccount").lean();
      if (!targetBusiness) throw fail(404, "Target business not found.");
      if (authorizedIds && !authorizedIds.has(String(targetBusiness._id))) {
        throw fail(403, `You are not authorized to upload data for "${targetBusiness.name}" (${targetBusiness.city}).`);
      }
    }

    // Client portal chosen in the form: the target business must be linked to that client's ID
    if (body.targetClientId) {
      if (!mongoose.Types.ObjectId.isValid(body.targetClientId)) throw fail(400, "Invalid target client.");
      const client = await visibleClients(req.user, { _id: body.targetClientId });
      if (!client.length) throw fail(403, "You are not authorized to import sales for this client.");
      if (!targetBusiness) {
        const linked = await SalesBusiness.find({ clientAccount: body.targetClientId, isActive: { $ne: false } }).select("name code city state category monthlyTarget clientAccount").lean();
        const allowed = authorizedIds ? linked.filter((b) => authorizedIds.has(String(b._id))) : linked;
        if (allowed.length !== 1) {
          throw fail(400, allowed.length ? "This client has several businesses. Choose the business to import into." : "This client has no sales business linked yet. Link or create one in the Client / Business selector first.");
        }
        targetBusiness = allowed[0];
      }
      const problem = importTargets.checkTargetForClient(targetBusiness, body.targetClientId);
      if (problem) throw fail(400, problem);
      req.importTargetClient = new mongoose.Types.ObjectId(String(body.targetClientId));
    }

    const reportingPeriod = body.reportingPeriod || "auto";
    const startDate = body.startDate ? String(body.startDate).trim() : null;
    const endDate = body.endDate ? String(body.endDate).trim() : null;
    const manualDateOverride = body.manualDateOverride === "true" || body.manualDateOverride === true;

    let defaultPeriod = null;
    const pm = body.reportingMonth ? Number(body.reportingMonth) : null;
    const py = body.reportingYear ? Number(body.reportingYear) : null;
    if (pm || py) {
      if (!(pm >= 1 && pm <= 12) || !(py >= 2000 && py <= 2100)) throw fail(400, "Choose both a valid reporting month and year.");
      defaultPeriod = { month: pm, year: py, monthName: `${ist.MONTH_NAMES[pm - 1]} ${py}` };
    }

    const businesses = await SalesBusiness.find({}).select("name code city state category monthlyTarget clientAccount").lean();

    // Restaurant POS day-wise reports (e.g. Petpooja "All Restaurant Report -
    // Day Wise"): metadata lines, header further down, forward-filled restaurant
    // names, Total/Min./Max./Avg./Sub Total rows. Handled by a dedicated parser.
    {
      const rawSheets = parser.readRawSheets(req.file.buffer, req.file.originalname);
      let report = null;
      for (const sh of rawSheets) {
        report = restaurantReport.parseSheet(sh.rows, sh.sheetName);
        if (report) break;
      }
      if (report) {
        let restaurantMap = {};
        if (body.restaurantMap) {
          try {
            restaurantMap = typeof body.restaurantMap === "string" ? JSON.parse(body.restaurantMap) : body.restaurantMap;
          } catch (_) {
            throw fail(400, "Invalid restaurant mapping.");
          }
        }
        const dateRange = startDate && endDate && P.isValidKey(startDate) && P.isValidKey(endDate) ? { start: startDate, end: endDate } : null;
        const out = await previewRestaurantReport({ req, kind, report, businesses, authorizedIds, targetBusiness, dateRange, restaurantMap });
        storedFile = out.storedFile;
        return res.json(out.response);
      }
    }

    const ctx = {
      filename: req.file.originalname,
      mappingOverride,
      businesses,
      authorizedIds,
      targetBusiness,
      defaultPeriod,
      startDate,
      endDate,
      reportingPeriod,
      manualDateOverride,
    };

    // 3. First pass (learn business/months/dates), then check what already exists in the DB
    const first = parser.parseAndValidate(req.file.buffer, { ...ctx, existingKeys: new Map() });
    const allHeaders = [...new Set(first.sheets.flatMap((sh) => sh.table.headers.filter(Boolean)))];
    const columnInfo = {
      sheetName: first.table.sheetName,
      headerRow: first.table.headerRowIndex + 1,
      headers: allHeaders,
      mapping: first.mappingInfo.named,
      missingRequired: first.missingRequired,
      incompleteSheets: first.incompleteSheets,
      unmappedColumns: [...new Set(first.sheets.flatMap((sh) => sh.mappingInfo.unmapped))],
      notices: first.mappingInfo.notices,
      sheets: first.sheets.map((sh) => ({ sheetName: sh.table.sheetName, headerRow: sh.table.headerRowIndex + 1, mapping: sh.mappingInfo.named })),
      ignoredSheets: first.ignoredSheets,
      expectedColumns: parser.COLUMNS.map((c) => ({
        key: c.key,
        label: c.label,
        required: parser.requiredKeys({ targetBusiness, defaultPeriod, startDate, manualDateOverride }).includes(c.key),
      })),
    };

    if (first.missingRequired.length) {
      return res.status(422).json({
        message: `Could not identify: ${first.missingRequired.join(", ")}${
          first.incompleteSheets.length > 1 ? ` (sheets: ${first.incompleteSheets.join(", ")})` : ""
        }. Map the columns below${!targetBusiness || (!defaultPeriod && !startDate) ? ", or select the target business / reporting period in the form controls" : ""}.`,
        needsMapping: true,
        filename: req.file.originalname,
        columnInfo,
      });
    }

    const existingKeys = await existingRecordMap(first.rows);
    const result = parser.parseAndValidate(req.file.buffer, { ...ctx, existingKeys });
    if (!result.rows.length) {
      throw fail(400, `No data rows found below the header row on ${result.sheets.map((sh) => `"${sh.table.sheetName}"`).join(", ")}.`);
    }

    const validRows = result.rows.filter((r) => r.status === "valid");
    const invalidRows = result.rows.filter((r) => r.status === "invalid");
    const duplicateExisting = validRows.filter((r) => r.existing).length;
    const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const detectedPeriod = result.detectedPeriod;

    // Which client portals will receive this data
    const bizIds = [...new Set(validRows.map((r) => r.data.businessId))];
    const bizById = new Map(businesses.map((b) => [String(b._id), b]));
    const User = require("../models/User");
    const clientIds = [...new Set(bizIds.map((id) => bizById.get(id) && bizById.get(id).clientAccount).filter(Boolean).map(String))];
    const clients = await User.find({ _id: { $in: clientIds } }).select("name companyName").lean();
    const clientById = new Map(clients.map((c) => [String(c._id), c]));
    const portalTargets = bizIds.map((id) => {
      const b = bizById.get(id);
      const c = b.clientAccount ? clientById.get(String(b.clientAccount)) : null;
      return {
        businessId: id,
        businessName: b.name,
        city: b.city,
        clientId: c ? c._id : null,
        clientName: c ? c.companyName || c.name : null,
        rows: validRows.filter((r) => r.data.businessId === id).length,
      };
    });
    const periods = [...new Set(validRows.map((r) => (r.data.recordType === "transaction" && r.data.dateStr ? r.data.dateStr : r.data.monthName)))];

    const previous = await SalesImportJob.findOne({ fileHash, status: { $in: ["completed", "partial"] } })
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "name")
      .lean();
    const previousImportIds = [...new Set(validRows.filter((r) => r.existing && r.existing.importJob).map((r) => String(r.existing.importJob)))];
    const previousImports = await SalesImportJob.find({ _id: { $in: previousImportIds } }).select("filename createdAt uploaderName").lean();

    // Cancel this user's older un-confirmed previews so they cannot be committed later by mistake.
    const stale = await SalesImportJob.find({ uploadedBy: req.user._id, status: "pending" }).select("originalFile").lean();
    if (stale.length) {
      await SalesImportJob.updateMany(
        { _id: { $in: stale.map((j) => j._id) } },
        { $set: { status: "cancelled", validRows: [], invalidRows: [] } }
      );
      await Promise.all(stale.map((j) => fileStore.deleteFile(j.originalFile && j.originalFile.fileId).catch(() => {})));
    }

    // 4. Keep the original file (private GridFS attachment)
    const jobId = new mongoose.Types.ObjectId();
    storedFile = await fileStore.saveFile(req.file.buffer, {
      filename: req.file.originalname,
      mimeType: kind.mime,
      uploadedBy: req.user._id,
      importJobId: jobId,
    });

    const job = await SalesImportJob.create({
      _id: jobId,
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      filename: req.file.originalname,
      fileSize: req.file.size || req.file.buffer.length,
      fileHash,
      originalFile: storedFile,
      sheetName: columnInfo.sheetName,
      headerRow: columnInfo.headerRow,
      sheets: result.sheets.map((sh) => ({
        sheetName: sh.table.sheetName,
        headerRow: sh.table.headerRowIndex + 1,
        rows: result.rows.filter((r) => r.sheet === sh.table.sheetName).length,
      })),
      ignoredSheets: result.ignoredSheets,
      columnMapping: columnInfo.mapping,
      unmappedColumns: columnInfo.unmappedColumns,
      targetBusiness: targetBusiness ? targetBusiness._id : null,
      targetClient: req.importTargetClient || null,
      defaultPeriod: defaultPeriod ? { month: defaultPeriod.month, year: defaultPeriod.year } : { month: null, year: null },
      reportingPeriod: (detectedPeriod && detectedPeriod.periodType) || reportingPeriod || "custom",
      reportingPeriodLabel: (detectedPeriod && detectedPeriod.periodLabel) || "",
      startDate: (detectedPeriod && detectedPeriod.startDate) || (startDate ? ist.parseISTDateTime(startDate) : null),
      endDate: (detectedPeriod && detectedPeriod.endDate) || (endDate ? ist.parseISTDateTime(endDate) : null),
      detectedDateRange: detectedPeriod
        ? {
            startDate: detectedPeriod.minDate,
            endDate: detectedPeriod.maxDate,
            totalDays: detectedPeriod.totalDays,
            periodType: detectedPeriod.periodType,
            granularity: detectedPeriod.granularity,
          }
        : null,
      recordType: (detectedPeriod && detectedPeriod.recordType) || "summary",
      periods,
      businesses: bizIds,
      affectedClients: clientIds,
      totalRows: result.rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows: validRows.map(summarizeRow),
      invalidRows: invalidRows.map(summarizeRow),
      status: "pending",
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    });

    await audit({
      entityType: "SalesImportJob",
      entityId: job._id,
      action: "IMPORT_PREVIEWED",
      actor: req.user,
      metadata: {
        filename: job.filename,
        totalRows: job.totalRows,
        valid: validRows.length,
        invalid: invalidRows.length,
        targetBusiness: targetBusiness ? targetBusiness._id : null,
        reportingPeriod: job.reportingPeriod,
        startDate: job.startDate,
        endDate: job.endDate,
        defaultPeriod,
        fileId: storedFile.fileId,
      },
    });

    return res.json({
      importJobId: job._id,
      filename: job.filename,
      expiresAt: job.expiresAt,
      columnInfo,
      target: targetBusiness ? { _id: targetBusiness._id, name: targetBusiness.name, city: targetBusiness.city } : null,
      defaultPeriod,
      reportingPeriod: job.reportingPeriod,
      reportingPeriodLabel: job.reportingPeriodLabel,
      detectedPeriod,
      detectedDateRange: job.detectedDateRange,
      recordType: job.recordType,
      periods,
      portalTargets,
      totalRows: result.rows.length,
      blankRowsIgnored: result.blankRows,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      existingCount: duplicateExisting,
      validTotalSales: validRows.reduce((s, r) => s + (r.data.totalSales || 0), 0),
      previouslyImported: previous
        ? {
            at: previous.createdAt,
            atLabel: ist.formatISTDateTime(previous.createdAt),
            by: previous.uploadedBy ? previous.uploadedBy.name : previous.uploaderName,
          }
        : null,
      replacesImports: previousImports.map((j) => ({
        _id: j._id,
        filename: j.filename,
        atLabel: ist.formatISTDateTime(j.createdAt),
        by: j.uploaderName,
      })),
      validRows: validRows.map(summarizeRow),
      invalidRows: invalidRows.map(summarizeRow),
    });
  } catch (err) {
    if (storedFile) fileStore.deleteFile(storedFile.fileId).catch(() => {});
    return respondError(res, err, "Failed to process the file for preview.");
  }
};

// ---------------------------------------------------------------------------
// 2. Commit
// ---------------------------------------------------------------------------
exports.commitSalesExcel = async (req, res) => {
  const { importJobId, acknowledgeInvalid = false } = req.body || {};
  const duplicateMode = DUPLICATE_MODES[(req.body && req.body.duplicateMode) || "skip"];
  let claimed = null;
  try {
    if (!importJobId || !mongoose.Types.ObjectId.isValid(importJobId)) {
      throw fail(400, "Missing import reference. Please upload and preview the file again.");
    }
    if (!duplicateMode) throw fail(400, "duplicateMode must be 'add' (keep existing data) or 'replace' (overwrite the same business/month).");

    const ownerFilter = req.user.role === "admin" ? {} : { uploadedBy: req.user._id };
    // Atomic claim: a preview can only be committed once (double-clicks / retries are safe).
    claimed = await SalesImportJob.findOneAndUpdate(
      { _id: importJobId, ...ownerFilter, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { status: "processing", duplicateMode } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      const job = await SalesImportJob.findOne({ _id: importJobId, ...ownerFilter }).select("status expiresAt");
      if (!job) throw fail(404, "Import not found.");
      if (["completed", "partial"].includes(job.status)) throw fail(409, "This file has already been imported.");
      if (job.status === "processing") throw fail(409, "This import is already being processed.");
      throw fail(410, "This preview has expired or was replaced. Please upload the file again.");
    }

    if (claimed.invalidCount > 0 && !acknowledgeInvalid) {
      await SalesImportJob.updateOne({ _id: claimed._id }, { $set: { status: "pending" } });
      claimed = null;
      throw fail(
        400,
        "Some rows have errors. Fix them and upload again, or confirm that only the valid rows should be imported (invalid rows will be rejected).",
        { details: { requiresAcknowledgement: true } }
      );
    }

    // Re-check authorization at commit time (assignments may have changed).
    const authorizedIds = req.user.role === "admin" ? null : await authorizedBusinessIds(req.user);
    const rows = claimed.validRows || [];
    const lateRejected = [];
    const toWrite = [];
    // Imports started for a client portal only write to businesses still linked to that client ID
    let clientOf = null;
    if (claimed.targetClient) {
      const ids = [...new Set(rows.map((r) => String(r.data.businessId)))];
      const bizs = await SalesBusiness.find({ _id: { $in: ids } }).select("clientAccount").lean();
      clientOf = new Map(bizs.map((b) => [String(b._id), String(b.clientAccount || "")]));
    }
    rows.forEach((r) => {
      if (authorizedIds && !authorizedIds.has(String(r.data.businessId))) {
        lateRejected.push({ ...r, errors: ["You are no longer authorized for this business."] });
      } else if (clientOf && clientOf.get(String(r.data.businessId)) !== String(claimed.targetClient)) {
        lateRejected.push({ ...r, errors: ["This business is not linked to the selected client portal."] });
      } else toWrite.push(r);
    });
    if (claimed.reportFormat) return await commitReportJob(req, res, claimed, toWrite, lateRejected, duplicateMode);

    const counters = { inserted: 0, updated: 0, skipped: 0, totalSales: 0 };
    const replacedImports = new Set();
    const skippedRows = [];

    const work = async (session) => {
      counters.inserted = 0;
      counters.updated = 0;
      counters.skipped = 0;
      counters.totalSales = 0;
      skippedRows.length = 0;
      replacedImports.clear();
      const compensation = { inserted: [], updated: [] };
      try {
        for (const r of toWrite) {
          const d = r.data;
          let existing = null;
          if (d.recordType === "transaction") {
            if (d.transactionId) {
              existing = await SalesRecord.findOne({ business: d.businessId, transactionId: d.transactionId }).session(session);
            }
            if (!existing && d.rowHash) {
              existing = await SalesRecord.findOne({ business: d.businessId, rowHash: d.rowHash }).session(session);
            }
            if (!existing && d.date) {
              existing = await SalesRecord.findOne({
                business: d.businessId,
                date: { $gte: d.startDate || ist.startOfISTDay(d.date), $lte: d.endDate || ist.endOfISTDay(d.date) },
                totalSales: d.totalSales,
              }).session(session);
            }
          } else {
            existing = await SalesRecord.findOne({
              business: d.businessId,
              year: d.year,
              month: d.month,
              recordType: { $ne: "transaction" },
            }).session(session);
            if (!existing) {
              existing = await SalesRecord.findOne({ business: d.businessId, year: d.year, month: d.month }).session(session);
            }
          }

          // A derived roll-up (from day-wise reports) is not data: a real monthly
          // summary replaces it whatever the duplicate mode.
          const rowMode = existing && existing.source === "daily_rollup" ? "update" : duplicateMode;
          if (existing) {
            if (rowMode !== "update") {
              counters.skipped++;
              const label = d.recordType === "transaction" ? (d.dateStr || d.monthName) : d.monthName;
              skippedRows.push({ rowNumber: r.rowNumber, sheet: r.sheet, businessName: d.businessName, month: label, reason: "Data for this record already exists (kept — choose Replace to overwrite)" });
              continue;
            }
            const before = Object.fromEntries(RECORD_FIELDS.map((f) => [f, existing[f] === undefined ? null : existing[f]]));
            if (existing.importJob && String(existing.importJob) !== String(claimed._id)) replacedImports.add(String(existing.importJob));
            before.importJob = existing.importJob || null;
            if (!session) compensation.updated.push({ _id: existing._id, before: existing.toObject() });
            RECORD_FIELDS.forEach((f) => {
              if (f === "remarks") existing.remarks = d.remarks || existing.remarks;
              else if (d[f] !== undefined) existing[f] = d[f];
            });
            existing.source = "excel_upload";
            if (existing.rollupDays !== undefined) existing.rollupDays = null;
            existing.importJob = claimed._id;
            existing.uploadedBy = req.user._id;
            existing.uploaderName = req.user.name;
            await existing.save({ session });
            counters.updated++;
            counters.totalSales += d.totalSales;
            await audit(
              {
                entityType: "SalesRecord",
                entityId: existing._id,
                action: "SALES_RECORD_UPDATED_BY_IMPORT",
                actor: req.user,
                before,
                after: Object.fromEntries(RECORD_FIELDS.map((f) => [f, existing[f]])),
                metadata: { importJob: claimed._id, rowNumber: r.rowNumber, sheet: r.sheet, replacedImportJob: before.importJob },
              },
              { session, strict: Boolean(session) }
            );
          } else {
            const [created] = await SalesRecord.create(
              [
                {
                  business: d.businessId,
                  businessName: d.businessName,
                  category: d.category,
                  state: d.state,
                  city: d.city,
                  recordType: d.recordType || "summary",
                  date: d.date || null,
                  dateStr: d.dateStr || null,
                  startDate: d.startDate || null,
                  endDate: d.endDate || null,
                  periodType: d.periodType || (d.recordType === "transaction" ? "daily" : "monthly"),
                  transactionId: d.transactionId || null,
                  rowHash: d.rowHash || null,
                  month: d.month,
                  year: d.year,
                  monthName: d.monthName,
                  totalSales: d.totalSales,
                  salesBasis: d.salesBasis,
                  orders: d.orders,
                  target: d.target,
                  discount: d.discount,
                  cost: d.cost,
                  expenses: d.expenses,
                  reportedProfit: d.reportedProfit === undefined ? null : d.reportedProfit,
                  remarks: d.remarks || "",
                  uploadedBy: req.user._id,
                  uploaderName: req.user.name,
                  source: "excel_upload",
                  importJob: claimed._id,
                },
              ],
              session ? { session } : {}
            );
            if (!session) compensation.inserted.push(created._id);
            counters.inserted++;
            counters.totalSales += d.totalSales;
            await audit(
              {
                entityType: "SalesRecord",
                entityId: created._id,
                action: "SALES_RECORD_CREATED_BY_IMPORT",
                actor: req.user,
                after: Object.fromEntries(RECORD_FIELDS.map((f) => [f, created[f]])),
                metadata: { importJob: claimed._id, rowNumber: r.rowNumber },
              },
              { session, strict: Boolean(session) }
            );
          }
        }
      } catch (err) {
        // Standalone MongoDB (no transactions): undo what was written.
        if (!session) {
          if (compensation.inserted.length) await SalesRecord.deleteMany({ _id: { $in: compensation.inserted } });
          for (const u of compensation.updated) {
            // eslint-disable-next-line no-await-in-loop
            await SalesRecord.replaceOne({ _id: u._id }, u.before);
          }
        }
        throw err;
      }
    };

    let transactional = true;
    try {
      ({ transactional } = await runInTransaction(work));
    } catch (err) {
      await SalesImportJob.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: "failed",
            errorLogs: [{ reason: `Import rolled back — nothing was saved: ${err.message}` }],
          },
        }
      );
      await audit({ entityType: "SalesImportJob", entityId: claimed._id, action: "IMPORT_FAILED_ROLLED_BACK", actor: req.user, metadata: { error: err.message } });
      claimed = null;
      throw fail(
        err.code === 11000 ? 409 : 500,
        err.code === 11000
          ? "Another import saved the same business/month at the same time. Nothing was saved — please preview again."
          : "The import failed and was rolled back. No records were saved."
      );
    }

    const rejected = [...(claimed.invalidRows || []), ...lateRejected];
    const errorLogs = rejected.map((r) => ({
      rowNumber: r.rowNumber,
      sheet: r.sheet || "",
      businessName: (r.data && r.data.businessName) || (r.raw && (r.raw["Business Name"] || r.raw.Business)) || "",
      state: (r.data && r.data.state) || "",
      city: (r.data && r.data.city) || "",
      month: (r.data && r.data.monthName) || "",
      reason: (r.errors || []).join(" | "),
    }));

    const status = rejected.length ? (counters.inserted + counters.updated > 0 ? "partial" : "rejected") : "completed";
    await SalesImportJob.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status,
          successCount: counters.inserted,
          updatedCount: counters.updated,
          skippedCount: counters.skipped,
          rejectedCount: rejected.length,
          failedCount: rejected.length,
          totalRevenue: counters.totalSales,
          errorLogs,
          committedAt: new Date(),
          replacedImports: [...replacedImports],
          validRows: [], // the preview copy is no longer needed
          invalidRows: claimed.invalidRows || [], // kept for "download invalid rows"
        },
      }
    );
    // Client portals read these same SalesRecord documents; tell each affected client.
    let notifiedClients = [];
    if (counters.inserted + counters.updated > 0) {
      const written = toWrite.filter((r) => !skippedRows.some((sk) => sk.rowNumber === r.rowNumber && sk.sheet === r.sheet));
      notifiedClients = await notifyClientsOfNewSales({
        importJobId: claimed._id,
        businessIds: [...new Set(written.map((r) => r.data.businessId))],
        periods: [...new Set(written.map((r) => r.data.monthName))],
        replaced: counters.updated > 0,
      }).catch((e) => {
        console.error("[import] client notification failed:", e.message);
        return [];
      });
    }

    await audit({
      entityType: "SalesImportJob",
      entityId: claimed._id,
      action: "IMPORT_COMMITTED",
      actor: req.user,
      metadata: {
        ...counters,
        rejected: rejected.length,
        duplicateMode: duplicateMode === "update" ? "replace" : "add",
        transactional,
        replacedImports: [...replacedImports],
        clientsUpdated: notifiedClients,
      },
    });

    return res.json({
      message: `Import complete: ${counters.inserted} new, ${counters.updated} replaced, ${counters.skipped} kept (already existed), ${rejected.length} rejected.${
        notifiedClients.length ? ` ${notifiedClients.length} client portal(s) now show this data.` : ""
      }`,
      summary: {
        totalProcessed: claimed.totalRows,
        successCount: counters.inserted,
        updatedCount: counters.updated,
        skippedCount: counters.skipped,
        rejectedCount: rejected.length,
        failedCount: rejected.length,
        totalRevenue: counters.totalSales,
        transactional,
        duplicateMode: duplicateMode === "update" ? "replace" : "add",
        periods: claimed.periods || [],
        clientPortalsUpdated: notifiedClients.length,
      },
      skippedRows,
      rejectedRows: errorLogs,
    });
  } catch (err) {
    if (claimed) {
      await SalesImportJob.updateOne({ _id: claimed._id, status: "processing" }, { $set: { status: "pending" } }).catch(() => {});
    }
    return respondError(res, err, "Failed to import sales data.");
  }
};

// ---------------------------------------------------------------------------
// 3. Template, invalid rows, cancel
// ---------------------------------------------------------------------------
exports.downloadTemplate = async (req, res) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "xlsx";
    const filter = await getManagerAuthorizedBusinessQuery(req.user);
    const businesses = await SalesBusiness.find({ ...filter, isActive: { $ne: false } })
      .select("name city state category monthlyTarget")
      .sort({ name: 1 })
      .limit(500)
      .lean();
    const now = ist.toISTParts(new Date());
    const buffer = parser.buildTemplate({
      format,
      sampleBusinesses: businesses,
      month: `${ist.MONTH_NAMES[now.month - 1]} ${now.year}`,
    });
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="ESG_Sales_Import_Template.csv"');
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="ESG_Sales_Import_Template.xlsx"');
    }
    return res.send(buffer);
  } catch (err) {
    return respondError(res, err, "Failed to generate the template.");
  }
};

exports.downloadInvalidRows = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw fail(400, "Invalid import id.");
    const job = await SalesImportJob.findOne({ _id: req.params.id, ...(await historyScope(req.user)) }).lean();
    if (!job) throw fail(404, "Import not found.");
    const rows = job.invalidRows || [];
    const headers = [];
    rows.forEach((r) => Object.keys(r.raw || {}).forEach((h) => !headers.includes(h) && headers.push(h)));
    const buffer = parser.invalidRowsCsv(rows, headers);
    const base = String(job.filename || "import").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}_invalid_rows.csv"`);
    return res.send(buffer);
  } catch (err) {
    return respondError(res, err, "Failed to export invalid rows.");
  }
};

/** Managers see their own uploads and any import that touched their authorized businesses. */
async function historyScope(user) {
  if (user.role === "admin") return {};
  const ids = [...(await authorizedBusinessIds(user))].map((id) => new mongoose.Types.ObjectId(id));
  return { $or: [{ uploadedBy: user._id }, { businesses: { $in: ids } }] };
}

exports.cancelPreview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw fail(400, "Invalid import id.");
    const ownerFilter = req.user.role === "admin" ? {} : { uploadedBy: req.user._id };
    const job = await SalesImportJob.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter, status: "pending" },
      { $set: { status: "cancelled", validRows: [] } },
      { returnDocument: "after" }
    );
    // A cancelled preview's file is not needed (nothing was imported)
    if (job && job.originalFile && job.originalFile.fileId) {
      await fileStore.deleteFile(job.originalFile.fileId).catch(() => {});
      await SalesImportJob.updateOne({ _id: job._id }, { $set: { "originalFile.fileId": null } });
    }
    return res.json({ cancelled: Boolean(job) });
  } catch (err) {
    return respondError(res, err, "Failed to cancel preview.");
  }
};

/** Streams the original uploaded spreadsheet (permission-checked, never public). */
exports.downloadOriginalFile = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw fail(400, "Invalid import id.");
    const job = await SalesImportJob.findOne({ _id: req.params.id, ...(await historyScope(req.user)) })
      .select("originalFile filename")
      .lean();
    if (!job) throw fail(404, "Import not found.");
    if (!job.originalFile || !job.originalFile.fileId) throw fail(404, "The original file was not kept for this import (older import or cancelled preview).");
    await audit({ entityType: "SalesImportJob", entityId: job._id, action: "ORIGINAL_FILE_DOWNLOADED", actor: req.user });
    return await fileStore.streamFile(job.originalFile.fileId, res, {
      downloadName: job.originalFile.filename || job.filename,
      mimeType: job.originalFile.mimeType,
    });
  } catch (err) {
    if (res.headersSent) return res.end();
    return respondError(res, err, "Failed to download the original file.");
  }
};

exports.getImportHistory = async (req, res) => {
  try {
    const filter = { ...(await historyScope(req.user)) };
    if (req.query.status) filter.status = { $in: String(req.query.status).split(",") };
    if (req.query.businessId && mongoose.Types.ObjectId.isValid(req.query.businessId)) filter.businesses = new mongoose.Types.ObjectId(req.query.businessId);
    const history = await SalesImportJob.find(filter)
      .select("-validRows -invalidRows")
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 50, 200))
      .populate("uploadedBy", "name email")
      .populate("businesses", "name city")
      .populate("targetBusiness", "name city")
      .populate("affectedClients", "name companyName")
      .lean();
    return res.json(
      history.map((h) => ({
        ...h,
        createdAtLabel: ist.formatISTDateTime(h.createdAt),
        committedAtLabel: h.committedAt ? ist.formatISTDateTime(h.committedAt) : "",
        hasInvalidRows: (h.invalidCount || h.rejectedCount || 0) > 0,
        hasOriginalFile: Boolean(h.originalFile && h.originalFile.fileId),
        importedCount: (h.successCount || 0) + (h.updatedCount || 0),
      }))
    );
  } catch (err) {
    return respondError(res, err, "Failed to fetch import history.");
  }
};

/** Marks expired previews and removes their (never imported) files. Called by the scheduler. */
exports.expireStalePreviews = async (now = new Date()) => {
  const stale = await SalesImportJob.find({ status: "pending", expiresAt: { $lt: now } }).select("originalFile").limit(200).lean();
  for (const j of stale) {
    await SalesImportJob.updateOne({ _id: j._id, status: "pending" }, { $set: { status: "expired", validRows: [], "originalFile.fileId": null } });
    if (j.originalFile && j.originalFile.fileId) await fileStore.deleteFile(j.originalFile.fileId).catch(() => {});
  }
  return stale.length;
};


// ===================== Import targets (client portal ↔ business) =====================

/** Active clients this user may import for: admins all; managers their assigned clients and clients of their authorized businesses. */
async function visibleClients(user, extra = {}) {
  const base = { role: "client", isActive: { $ne: false }, ...extra };
  if (user.role === "admin") return User.find(base).select("_id name companyName email clientId assignedManager").lean();
  const authFilter = await getManagerAuthorizedBusinessQuery(user);
  const linkedIds = await SalesBusiness.find({ ...authFilter, clientAccount: { $ne: null } }).distinct("clientAccount");
  return User.find({ ...base, $or: [{ assignedManager: user._id }, { _id: { $in: linkedIds } }] }).select("_id name companyName email clientId assignedManager").lean();
}

/** GET /sales/import-targets — always read fresh from the database (no caching). */
exports.getImportTargets = async (req, res) => {
  try {
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const [clients, businesses] = await Promise.all([
      visibleClients(req.user),
      SalesBusiness.find({ ...authFilter, isActive: { $ne: false } }).select("name code city state clientAccount").sort({ name: 1 }).lean(),
    ]);
    res.set("Cache-Control", "no-store");
    return res.json({ ...importTargets.buildImportTargets({ clients, businesses }), canCreate: req.user.role === "admin" || req.user.role === "manager" });
  } catch (error) {
    console.error("Import targets error:", error.message);
    return res.status(500).json({ message: "Could not load clients and businesses." });
  }
};

/**
 * POST /sales/import-targets/link
 *   { clientId, businessId }                 link an UNLINKED authorized business to the client
 *   { clientId, create: { city, state, category } }   create the client's sales business (named after the client)
 * Never re-links a business that already belongs to another client.
 */
exports.linkImportTarget = async (req, res) => {
  try {
    const { clientId, businessId, create } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(clientId)) return res.status(400).json({ message: "Choose a client." });
    const [client] = await visibleClients(req.user, { _id: clientId });
    if (!client) return res.status(403).json({ message: "You are not authorized for this client." });
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const name = client.companyName || client.name;

    if (businessId) {
      if (!mongoose.Types.ObjectId.isValid(businessId)) return res.status(400).json({ message: "Invalid business." });
      const biz = await SalesBusiness.findOne({ ...authFilter, _id: businessId });
      if (!biz) return res.status(403).json({ message: "You are not authorized for this business." });
      if (biz.clientAccount && String(biz.clientAccount) !== String(client._id)) {
        return res.status(409).json({ message: `${biz.name} is already linked to another client portal. Only an admin can change that link.` });
      }
      const before = biz.clientAccount;
      biz.clientAccount = client._id;
      await biz.save();
      await audit({ entityType: "SalesBusiness", entityId: biz._id, action: "CLIENT_ACCOUNT_LINKED", actor: req.user, before: { clientAccount: before }, after: { clientAccount: client._id }, metadata: { via: "sales-import" } });
      return res.json({ message: `${biz.name} (${biz.city}) is now linked to ${name}.`, businessId: String(biz._id) });
    }

    const city = String(create?.city || "").trim();
    const state = String(create?.state || "").trim();
    if (!city || !state) return res.status(400).json({ message: "Choose the city and state of the business." });
    if (req.user.role !== "admin") {
      // managers may only create inside their own assigned locations
      const inScope = (f, v) => !f || (f.$in ? f.$in.map((x) => String(x).toLowerCase()).includes(v.toLowerCase()) : true);
      if (authFilter._id || authFilter.$or || !inScope(authFilter.city, city) || !inScope(authFilter.state, state)) {
        return res.status(403).json({ message: `You can only create businesses in your assigned locations. Ask an admin to create ${name}'s business in ${city}.` });
      }
    }
    const same = (await SalesBusiness.find({ city: new RegExp(`^\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") }).select("name clientAccount").lean()).find((b) => importTargets.namesMatch(b.name, name));
    if (same) return res.status(409).json({ message: `A business named "${same.name}" already exists in ${city}. Link it instead of creating a duplicate.`, existingBusinessId: String(same._id) });
    const category = ["Hotel", "Restaurant", "Service"].includes(create?.category) ? create.category : "Restaurant";
    const biz = await SalesBusiness.create({
      name,
      category,
      city,
      state,
      clientAccount: client._id,
      assignedManager: req.user.role === "manager" ? req.user._id : client.assignedManager || null,
      createdBy: req.user._id,
    });
    await audit({ entityType: "SalesBusiness", entityId: biz._id, action: "BUSINESS_CREATED", actor: req.user, after: { name, city, state, clientAccount: client._id }, metadata: { via: "sales-import" } });
    return res.status(201).json({ message: `${name} (${city}) was created and linked to ${name}'s client portal.`, businessId: String(biz._id) });
  } catch (error) {
    console.error("Link import target error:", error.message);
    return res.status(500).json({ message: "Could not link the business." });
  }
};
