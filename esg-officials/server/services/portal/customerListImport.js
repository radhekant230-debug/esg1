/**
 * Imports a customer list / enquiry sheet into one client's Leads & Enquiries.
 * Shared by POST /portal/leads/import (UI) and scripts/importCustomerList.js (CLI).
 *
 * - Scoped to exactly one client: every lookup and write filters on `client`.
 * - Idempotent: an existing enquiry of the same client with the same phone
 *   (else email) is updated, never duplicated, so re-uploading the same file
 *   only refreshes it.
 * - Actual figures (visits, total spent, average spend, last visit) go to
 *   customerStats; the RFM segment goes to campaign ("RFM: <segment>").
 */
const ist = require("../../utils/istDate");
const leadImport = require("./leadImport");

const monthKey = (d) => {
  const p = ist.toISTParts(d);
  return p ? `${p.year}-${String(p.month).padStart(2, "0")}` : undefined;
};

/** Pure: splits mapped rows into creates/updates against the client's existing enquiries. */
function planImport(leads, existing) {
  const byPhone = new Map();
  const byEmail = new Map();
  existing.forEach((e) => {
    if (e.phone) byPhone.set(leadImport.normPhone(e.phone) || e.phone, e);
    if (e.email) byEmail.set(String(e.email).toLowerCase(), e);
  });
  const creates = [];
  const updates = [];
  leads.forEach((l) => {
    const match = (l.phone && byPhone.get(l.phone)) || (l.email && byEmail.get(l.email));
    (match ? updates : creates).push({ ...l, match });
  });
  return { creates, updates };
}

/** Pure: the documents/ops a commit writes. */
function buildWrites(plan, clientId, { author = "Import", now = new Date() } = {}) {
  const docs = plan.creates.map((l) => ({
    ...l.doc,
    client: clientId,
    reportingMonth: monthKey(l.doc.enquiryDate),
    isQualified: ["Qualified", "Converted"].includes(l.doc.status),
    isConverted: l.doc.status === "Converted",
    ...(l.stats ? { customerStats: { ...l.stats } } : {}),
    notes: l.note ? [{ text: l.note, author, createdAt: now }] : [],
  }));
  const ops = plan.updates.map((l) => {
    // keep the stage and name the team may have edited; refresh value, segment, latest visit, contact and stats
    const set = { estimatedValue: l.doc.estimatedValue };
    if (l.doc.campaign) set.campaign = l.doc.campaign;
    if (l.dated && (!l.match.enquiryDate || l.doc.enquiryDate > l.match.enquiryDate)) {
      set.enquiryDate = l.doc.enquiryDate;
      set.reportingMonth = monthKey(l.doc.enquiryDate);
    }
    if (l.phone && !l.match.phone) set.phone = l.phone;
    if (l.email && !l.match.email) set.email = l.email;
    // no timestamp here, so re-uploading an identical file reports "already up to date"
    if (l.stats) set.customerStats = { ...l.stats };
    return { updateOne: { filter: { _id: l.match._id, client: clientId }, update: { $set: set } } };
  });
  return { docs, ops };
}

async function importCustomerList({ ClientLead, clientId, buffer, filename, sources, defaultSource = "Walk-in", mode = "preview", author = "Import" }) {
  if (!clientId) throw Object.assign(new Error("Target client ID required."), { status: 400 });
  const sheet = leadImport.readSheetRows(buffer, filename);
  if (!sheet.rows.length) throw Object.assign(new Error("The file has no data rows."), { status: 400 });
  if (sheet.rows.length > 50000) throw Object.assign(new Error("Files are limited to 50,000 rows. Please split the file."), { status: 400 });
  const { leads, skipped, columns } = leadImport.mapRows(sheet, { sources, defaultSource });

  const phones = leads.map((l) => l.phone).filter(Boolean);
  const emails = leads.map((l) => l.email).filter(Boolean);
  const existing = phones.length || emails.length ? await ClientLead.find({ client: clientId, $or: [{ phone: { $in: phones } }, { email: { $in: emails } }] }).select("_id phone email enquiryDate").lean() : [];
  const plan = planImport(leads, existing);

  const withStats = leads.filter((l) => l.stats);
  const summary = {
    file: filename,
    rows: sheet.rows.length,
    columns,
    toCreate: plan.creates.length,
    toUpdate: plan.updates.length,
    skipped: skipped.length,
    skippedRows: skipped.slice(0, 50),
    totalValue: Math.round(leads.reduce((sum, l) => sum + Math.round(l.doc.estimatedValue * 100), 0)) / 100,
    byStatus: leads.reduce((m, l) => ((m[l.doc.status] = (m[l.doc.status] || 0) + 1), m), {}),
    customerData: {
      withVisits: withStats.filter((l) => l.stats.visits != null).length,
      withSpend: withStats.filter((l) => l.stats.totalSpent != null).length,
      withLastVisit: withStats.filter((l) => l.stats.lastVisitAt).length,
      totalVisits: withStats.reduce((a, l) => a + (l.stats.visits || 0), 0),
      totalSpent: Math.round(withStats.reduce((a, l) => a + (l.stats.totalSpent || 0) * 100, 0)) / 100,
    },
    sample: leads.slice(0, 8).map((l) => ({ ...l.doc, note: l.note })),
    defaultSource,
  };
  if (mode !== "commit") return { mode: "preview", summary };

  const { docs, ops } = buildWrites(plan, clientId, { author, now: new Date() });
  let created = 0;
  for (let i = 0; i < docs.length; i += 1000) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await ClientLead.insertMany(docs.slice(i, i + 1000), { ordered: false });
      created += r.length;
    } catch (e) {
      const n = e.insertedCount ?? e.result?.nInserted ?? (Array.isArray(e.insertedDocs) ? e.insertedDocs.length : null);
      if (n == null) throw e;
      created += n;
    }
  }
  let updated = 0;
  for (let i = 0; i < ops.length; i += 1000) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await ClientLead.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
      updated += r.modifiedCount ?? r.nModified ?? 0;
    } catch (e) {
      if (e.result?.nModified == null) throw e;
      updated += e.result.nModified;
    }
  }
  return { mode: "commit", summary, result: { created, updated, unchanged: ops.length - updated, skipped: skipped.length } };
}

module.exports = { importCustomerList, planImport, buildWrites, monthKey };
