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
    rows.forEach((r) => {
      if (authorizedIds && !authorizedIds.has(String(r.data.businessId))) {
        lateRejected.push({ ...r, errors: ["You are no longer authorized for this business."] });
      } else toWrite.push(r);
    });

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

          if (existing) {
            if (duplicateMode !== "update") {
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
