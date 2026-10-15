/**
 * Permanently removes ONE client's sales data (both portals) while keeping the
 * client account, profile, businesses, marketing, ads, leads, content, invoices,
 * documents and every other client's data.
 *
 * Identification is by relationship only, never by display name:
 *   User.clientId (e.g. "CLI-2026-0002")  ->  User._id
 *   SalesBusiness.clientAccount = User._id  ->  the client's businesses
 *
 * Removed:
 *   salesrecords        business in those businesses (monthly summaries, dated rows, daily roll-ups)
 *   salesentries        business in those businesses (restaurant day-wise report rows)
 *   clientsalesrecords  client = the user (manual Client Portal sales entries)
 *   salesimportjobs     only jobs that touch NO other business or client
 *   salesImportFiles.*  GridFS originals of those jobs, unless another kept job uses the file
 *
 * Kept and reported: shared import jobs, audit logs, notifications, client orders,
 * the SalesBusiness documents themselves (marked salesDataPurgedAt so the startup
 * sample-data bootstrap does not re-create sales for them).
 *
 * Works on native driver collections so the same code runs from the CLI script
 * and in tests. Nothing is deleted before a backup has been written and read back.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const idStr = (v) => (v == null ? "" : String(v));

class PurgeError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "PurgeError";
    this.details = details;
  }
}

/** Collection names used by the app's Mongoose models. */
const DEFAULT_NAMES = {
  users: "users",
  profiles: "clientprofiles",
  businesses: "salesbusinesses",
  records: "salesrecords",
  entries: "salesentries",
  clientSales: "clientsalesrecords",
  jobs: "salesimportjobs",
  gridFiles: "salesImportFiles.files",
  gridChunks: "salesImportFiles.chunks",
  audit: "auditlogs",
  notifications: "notifications",
  orders: "clientorders",
};

/** Non-sales client data that must be identical before and after (collection -> client field). */
const DEFAULT_PRESERVED = {
  clientprofiles: "client",
  clientorders: "client",
  clientleads: "client",
  campaignmetrics: "client",
  socialmediametrics: "client",
  googlebusinessmetrics: "client",
  contentcalendaritems: "client",
  clientreports: "client",
  clientinvoices: "client",
  clientvaultdocuments: "client",
};

function createPurger({ db, EJSON, ObjectId, withTransaction, names = {}, preserved = DEFAULT_PRESERVED }) {
  const N = { ...DEFAULT_NAMES, ...names };
  const toObjectId = (v) => (v instanceof ObjectId ? v : new ObjectId(String(v)));
  const col = (n) => db.collection(n);
  const opt = (session) => (session ? { session } : {});

  /** Fingerprint of everything NOT being deleted, to prove other data is unchanged. */
  async function fingerprintOthers(plan) {
    const del = {
      records: new Set(plan.ids.records.map(idStr)),
      entries: new Set(plan.ids.entries.map(idStr)),
      clientSales: new Set(plan.ids.clientSales.map(idStr)),
      jobs: new Set(plan.ids.jobs.map(idStr)),
    };
    const out = {};
    const spec = [
      ["records", N.records, "totalSales"],
      ["entries", N.entries, "totalSales"],
      ["clientSales", N.clientSales, "totalRevenue"],
      ["jobs", N.jobs, "totalRevenue"],
    ];
    for (const [key, name, money] of spec) {
      // eslint-disable-next-line no-await-in-loop
      const docs = await col(name).find({}, { projection: { _id: 1, [money]: 1, updatedAt: 1, business: 1 } }).toArray();
      const kept = docs.filter((d) => !del[key].has(idStr(d._id)));
      const lines = kept.map((d) => `${idStr(d._id)}|${d[money] == null ? "" : d[money]}|${d.updatedAt ? new Date(d.updatedAt).toISOString() : ""}`).sort();
      const paise = kept.reduce((s, d) => s + (typeof d[money] === "number" ? Math.round(d[money] * 100) : 0), 0);
      out[key] = { count: kept.length, total: paise / 100, digest: crypto.createHash("sha256").update(lines.join("\n")).digest("hex") };
    }
    return out;
  }

  async function fingerprintPreserved(clientId) {
    const out = {};
    for (const [name, field] of Object.entries(preserved)) {
      // eslint-disable-next-line no-await-in-loop
      const docs = await col(name).find({ [field]: clientId }, { projection: { _id: 1, updatedAt: 1 } }).toArray();
      const lines = docs.map((d) => `${idStr(d._id)}|${d.updatedAt ? new Date(d.updatedAt).toISOString() : ""}`).sort();
      out[name] = { count: docs.length, digest: crypto.createHash("sha256").update(lines.join("\n")).digest("hex") };
    }
    // the account itself and its businesses (sales flag aside)
    const user = await col(N.users).findOne({ _id: clientId }, { projection: { _id: 1, email: 1, role: 1, clientId: 1, password: 1, isActive: 1 } });
    out.user = user
      ? { exists: true, role: user.role, clientId: user.clientId, credentialsDigest: crypto.createHash("sha256").update(String(user.password || "")).digest("hex").slice(0, 16), isActive: user.isActive }
      : { exists: false };
    return out;
  }

  /**
   * Works out exactly what would be removed. Throws PurgeError (nothing changed)
   * whenever the data cannot be attributed to this client with certainty.
   */
  async function plan({ clientCode, expectName = "", includeBusinessIds = [], acknowledgeUnlinked = false }) {
    if (!clientCode) throw new PurgeError("A client ID such as CLI-2026-0002 is required.");
    const users = await col(N.users).find({ clientId: clientCode }).toArray();
    if (users.length !== 1) throw new PurgeError(`Expected exactly one account with client ID ${clientCode}, found ${users.length}. Nothing was changed.`);
    const user = users[0];
    if (user.role !== "client") throw new PurgeError(`${clientCode} belongs to a "${user.role}" account, not a client. Nothing was changed.`);
    const profile = await col(N.profiles).findOne({ client: user._id });

    const names = [user.companyName, user.name, profile && profile.businessName].filter(Boolean);
    if (expectName && !names.some((n) => norm(n).includes(norm(expectName)) || norm(expectName).includes(norm(n)))) {
      throw new PurgeError(`${clientCode} is "${names.join(" / ")}", which does not match "${expectName}". Nothing was changed.`);
    }

    // Businesses owned by this client (foreign key), plus any explicitly named
    const linked = await col(N.businesses).find({ clientAccount: user._id }).toArray();
    const extra = [];
    for (const raw of includeBusinessIds) {
      // eslint-disable-next-line no-await-in-loop
      const b = await col(N.businesses).findOne({ $or: [{ code: String(raw).toUpperCase() }, ...(/^[0-9a-f]{24}$/i.test(String(raw)) ? [{ _id: toObjectId(raw) }] : [])] });
      if (!b) throw new PurgeError(`Business ${raw} was not found. Nothing was changed.`);
      if (b.clientAccount && idStr(b.clientAccount) !== idStr(user._id)) {
        throw new PurgeError(`Business ${b.name} (${b.code}) belongs to another client account. Nothing was changed.`);
      }
      if (!linked.some((x) => idStr(x._id) === idStr(b._id))) extra.push(b);
    }
    const businesses = [...linked, ...extra];
    const bizIds = businesses.map((b) => b._id);
    const bizSet = new Set(bizIds.map(idStr));

    // Look-alike businesses NOT linked to this client: never deleted; stop if they hold sales
    const tokens = names.map(norm).filter((t) => t.length >= 3);
    const allBiz = await col(N.businesses).find({}, { projection: { _id: 1, name: 1, code: 1, city: 1, clientAccount: 1 } }).toArray();
    const lookAlikes = allBiz.filter((b) => !bizSet.has(idStr(b._id)) && tokens.some((t) => norm(b.name).includes(t) || t.includes(norm(b.name))));
    const lookAlikeReport = [];
    for (const b of lookAlikes) {
      // eslint-disable-next-line no-await-in-loop
      const [r, e] = await Promise.all([col(N.records).countDocuments({ business: b._id }), col(N.entries).countDocuments({ business: b._id })]);
      lookAlikeReport.push({ _id: idStr(b._id), name: b.name, code: b.code, city: b.city, linkedClient: idStr(b.clientAccount) || null, salesRecords: r, salesEntries: e });
    }
    const unresolved = lookAlikeReport.filter((b) => b.salesRecords + b.salesEntries > 0);
    if (unresolved.length && !acknowledgeUnlinked) {
      throw new PurgeError(
        "Other businesses with a similar name hold sales data and are not linked to this client. " +
          "Re-run with --include-business <code> for the ones that are this client's, or --acknowledge-unlinked to leave them untouched. Nothing was changed.",
        { lookAlikes: unresolved }
      );
    }

    const bizFilter = { business: { $in: bizIds } };
    const [records, entries, clientSales] = await Promise.all([
      bizIds.length ? col(N.records).find(bizFilter).toArray() : [],
      bizIds.length ? col(N.entries).find(bizFilter).toArray() : [],
      col(N.clientSales).find({ client: user._id }).toArray(),
    ]);

    // Import jobs: delete only those that concern this client alone
    const jobRefs = new Set([...records, ...entries].map((d) => idStr(d.importJob)).filter(Boolean));
    const jobOr = [{ affectedClients: user._id }];
    if (bizIds.length) jobOr.push({ targetBusiness: { $in: bizIds } }, { businesses: { $in: bizIds } });
    if (jobRefs.size) jobOr.push({ _id: { $in: [...jobRefs].map(toObjectId) } });
    const candidateJobs = await col(N.jobs).find({ $or: jobOr }).toArray();
    const exclusiveJobs = [];
    const sharedJobs = [];
    for (const j of candidateJobs) {
      const refBiz = new Set([idStr(j.targetBusiness), ...(j.businesses || []).map(idStr), ...(j.validRows || []).map((r) => idStr(r && r.data && r.data.businessId))].filter(Boolean));
      const refClients = (j.affectedClients || []).map(idStr);
      const otherBiz = [...refBiz].filter((b) => !bizSet.has(b));
      const otherClients = refClients.filter((c) => c !== idStr(user._id));
      // eslint-disable-next-line no-await-in-loop
      const [otherRec, otherEnt] = await Promise.all([
        col(N.records).countDocuments({ importJob: j._id, business: { $nin: bizIds } }),
        col(N.entries).countDocuments({ importJob: j._id, business: { $nin: bizIds } }),
      ]);
      const attributable = refBiz.size > 0 || refClients.length > 0;
      const reason = !attributable
        ? "names no business or client"
        : otherBiz.length || otherClients.length
          ? "also covers other businesses/clients"
          : otherRec + otherEnt
            ? "other businesses' rows reference it"
            : null;
      (reason ? sharedJobs : exclusiveJobs).push({ job: j, reason });
    }
    // a job still referenced by a kept job's history stays (no dangling references)
    const exclusiveIds = new Set(exclusiveJobs.map((x) => idStr(x.job._id)));
    const keptJobRefs = await col(N.jobs).find({ replacedImports: { $in: exclusiveJobs.map((x) => x.job._id) } }, { projection: { _id: 1, replacedImports: 1 } }).toArray();
    keptJobRefs
      .filter((k) => !exclusiveIds.has(idStr(k._id)))
      .forEach((k) =>
        (k.replacedImports || []).forEach((rid) => {
          const i = exclusiveJobs.findIndex((x) => idStr(x.job._id) === idStr(rid));
          if (i > -1) sharedJobs.push({ job: exclusiveJobs.splice(i, 1)[0].job, reason: "referenced by another import's history" });
        })
      );

    // GridFS originals of deleted jobs, unless a kept job uses the same file
    const delJobIds = exclusiveJobs.map((x) => x.job._id);
    const fileIds = exclusiveJobs.map((x) => x.job.originalFile && x.job.originalFile.fileId).filter(Boolean);
    const keptFileUse = fileIds.length
      ? await col(N.jobs).find({ "originalFile.fileId": { $in: fileIds }, _id: { $nin: delJobIds } }, { projection: { "originalFile.fileId": 1 } }).toArray()
      : [];
    const keptFileSet = new Set(keptFileUse.map((k) => idStr(k.originalFile.fileId)));
    const delFileIds = fileIds.filter((f) => !keptFileSet.has(idStr(f)));
    const [gridFiles, gridChunks] = delFileIds.length
      ? await Promise.all([col(N.gridFiles).find({ _id: { $in: delFileIds } }).toArray(), col(N.gridChunks).find({ files_id: { $in: delFileIds } }).toArray()])
      : [[], []];

    const [orders, notifications] = await Promise.all([
      col(N.orders).countDocuments({ client: user._id }),
      col(N.notifications).countDocuments({ recipient: user._id }),
    ]);

    const sum = (docs, f) => Math.round(docs.reduce((s, d) => s + (typeof d[f] === "number" ? Math.round(d[f] * 100) : 0), 0)) / 100;
    const bySource = (docs) => docs.reduce((m, d) => ((m[d.source || "unknown"] = (m[d.source || "unknown"] || 0) + 1), m), {});
    const months = [...new Set(records.filter((r) => r.year && r.month).map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`))].sort();

    return {
      clientCode,
      client: { _id: user._id, name: user.name, companyName: user.companyName || "", profileId: profile ? profile._id : null, profileName: profile ? profile.businessName : "" },
      businesses: businesses.map((b) => ({ _id: b._id, name: b.name, code: b.code, city: b.city, state: b.state, linkedBy: linked.includes(b) ? "clientAccount" : "explicit --include-business" })),
      lookAlikes: lookAlikeReport,
      docs: { records, entries, clientSales, jobs: exclusiveJobs.map((x) => x.job), gridFiles, gridChunks },
      ids: {
        records: records.map((d) => d._id),
        entries: entries.map((d) => d._id),
        clientSales: clientSales.map((d) => d._id),
        jobs: delJobIds,
        gridFiles: gridFiles.map((d) => d._id),
        gridChunks: gridChunks.map((d) => d._id),
      },
      summary: {
        salesRecords: { count: records.length, bySource: bySource(records), totalSales: sum(records, "totalSales"), months },
        salesEntries: { count: entries.length, totalSales: sum(entries, "totalSales") },
        clientSalesRecords: { count: clientSales.length, totalRevenue: sum(clientSales, "totalRevenue") },
        importJobsDeleted: exclusiveJobs.length,
        importJobsKept: sharedJobs.map((x) => ({ _id: idStr(x.job._id), filename: x.job.filename, reason: x.reason })),
        originalFilesDeleted: gridFiles.length,
        originalFileChunksDeleted: gridChunks.length,
        keptForReference: { clientOrders: orders, notifications, auditLogs: "all kept" },
      },
    };
  }

  /** Writes every document that will be removed, then reads the files back to check them. */
  function backup(p, dir, { stamp }) {
    fs.mkdirSync(dir, { recursive: true });
    const files = {};
    const write = (key, docs) => {
      const file = `${key}.ejson`;
      const text = EJSON.stringify(docs, { relaxed: false });
      fs.writeFileSync(path.join(dir, file), text);
      files[key] = { file, count: docs.length, sha256: crypto.createHash("sha256").update(text).digest("hex") };
    };
    write("records", p.docs.records);
    write("entries", p.docs.entries);
    write("clientSales", p.docs.clientSales);
    write("jobs", p.docs.jobs);
    write("gridFiles", p.docs.gridFiles);
    write("gridChunks", p.docs.gridChunks);
    const manifest = {
      kind: "client-sales-purge-backup",
      createdAt: stamp,
      clientCode: p.clientCode,
      clientUserId: idStr(p.client._id),
      businesses: p.businesses.map((b) => ({ ...b, _id: idStr(b._id) })),
      collections: { records: N.records, entries: N.entries, clientSales: N.clientSales, jobs: N.jobs, gridFiles: N.gridFiles, gridChunks: N.gridChunks },
      files,
      summary: p.summary,
    };
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    // read back and confirm before anything is deleted
    Object.entries(files).forEach(([key, f]) => {
      const text = fs.readFileSync(path.join(dir, f.file), "utf8");
      const hash = crypto.createHash("sha256").update(text).digest("hex");
      const back = EJSON.parse(text, { relaxed: false });
      if (hash !== f.sha256 || back.length !== p.ids[key].length) throw new PurgeError(`Backup check failed for ${key}. Nothing was deleted.`);
    });
    return manifest;
  }

  /** Deletes exactly the backed-up documents (by _id), in one transaction where supported. */
  async function execute(p, { backupDir, actor = null, stamp }) {
    const othersBefore = await fingerprintOthers(p);
    const preservedBefore = await fingerprintPreserved(p.client._id);
    const manifest = backup(p, backupDir, { stamp });

    const { result: deleted, transactional } = await withTransaction(async (session) => {
      const o = opt(session);
      const del = async (name, ids) => (ids.length ? (await col(name).deleteMany({ _id: { $in: ids } }, o)).deletedCount : 0);
      const counts = {
        salesrecords: await del(N.records, p.ids.records),
        salesentries: await del(N.entries, p.ids.entries),
        clientsalesrecords: await del(N.clientSales, p.ids.clientSales),
        salesimportjobs: await del(N.jobs, p.ids.jobs),
        "salesImportFiles.files": await del(N.gridFiles, p.ids.gridFiles),
        "salesImportFiles.chunks": await del(N.gridChunks, p.ids.gridChunks),
      };
      const expected = {
        salesrecords: p.ids.records.length,
        salesentries: p.ids.entries.length,
        clientsalesrecords: p.ids.clientSales.length,
        salesimportjobs: p.ids.jobs.length,
        "salesImportFiles.files": p.ids.gridFiles.length,
        "salesImportFiles.chunks": p.ids.gridChunks.length,
      };
      const mismatch = Object.keys(expected).filter((k) => counts[k] !== expected[k]);
      if (mismatch.length) {
        // inside a transaction this aborts everything; without one the backup restores it
        throw new PurgeError(`Deleted counts differ from the plan (${mismatch.join(", ")}): the data changed during the run.`, { counts, expected });
      }
      if (p.businesses.length) {
        await col(N.businesses).updateMany({ _id: { $in: p.businesses.map((b) => b._id) } }, { $set: { salesDataPurgedAt: new Date(stamp) } }, o);
      }
      await col(N.audit).insertOne(
        {
          entityType: "ClientSalesData",
          entityId: p.client._id,
          action: "CLIENT_SALES_DATA_PURGED",
          actor: actor && actor._id ? actor._id : null,
          actorName: actor && actor.name ? actor.name : "SYSTEM (purgeClientSales script)",
          actorRole: actor && actor.role ? actor.role : "system",
          before: p.summary,
          after: counts,
          metadata: { clientCode: p.clientCode, businesses: p.businesses.map((b) => b.code), backupDir: path.basename(backupDir) },
          createdAt: new Date(stamp),
          updatedAt: new Date(stamp),
        },
        o
      );
      return counts;
    });

    const verification = await verify(p, { othersBefore, preservedBefore });
    return { deleted, transactional, manifest, verification };
  }

  async function verify(p, { othersBefore, preservedBefore }) {
    const bizIds = p.businesses.map((b) => b._id);
    const remaining = {
      salesrecords: bizIds.length ? await col(N.records).countDocuments({ business: { $in: bizIds } }) : 0,
      salesentries: bizIds.length ? await col(N.entries).countDocuments({ business: { $in: bizIds } }) : 0,
      clientsalesrecords: await col(N.clientSales).countDocuments({ client: p.client._id }),
      deletedJobsStillPresent: p.ids.jobs.length ? await col(N.jobs).countDocuments({ _id: { $in: p.ids.jobs } }) : 0,
      deletedFilesStillPresent: p.ids.gridFiles.length ? await col(N.gridFiles).countDocuments({ _id: { $in: p.ids.gridFiles } }) : 0,
    };
    const othersAfter = await fingerprintOthers(p);
    const preservedAfter = await fingerprintPreserved(p.client._id);
    const othersUnchanged = Object.keys(othersBefore).every((k) => othersBefore[k].digest === othersAfter[k].digest);
    const preservedUnchanged = JSON.stringify(preservedBefore) === JSON.stringify(preservedAfter);
    const businessesKept = p.businesses.length ? await col(N.businesses).countDocuments({ _id: { $in: bizIds } }) : 0;
    return {
      remaining,
      clientSalesNowEmpty: Object.values(remaining).every((v) => v === 0),
      othersUnchanged,
      othersBefore,
      othersAfter,
      preservedUnchanged,
      preservedAfter,
      businessesKept: businessesKept === p.businesses.length,
    };
  }

  /** Puts a backup back (documents that already exist again are skipped). */
  async function restore(dir, { actor = null, stamp }) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    if (manifest.kind !== "client-sales-purge-backup") throw new PurgeError("Not a client sales purge backup.");
    const restored = {};
    for (const [key, f] of Object.entries(manifest.files)) {
      const text = fs.readFileSync(path.join(dir, f.file), "utf8");
      if (crypto.createHash("sha256").update(text).digest("hex") !== f.sha256) throw new PurgeError(`${f.file} does not match its checksum; restore stopped.`);
      const docs = EJSON.parse(text, { relaxed: false });
      const name = manifest.collections[key];
      if (!docs.length) {
        restored[name] = 0;
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await col(name).insertMany(docs, { ordered: false });
        restored[name] = r.insertedCount;
      } catch (e) {
        if (e && (e.code === 11000 || (e.writeErrors && e.writeErrors.every((w) => (w.code || (w.err && w.err.code)) === 11000)))) {
          restored[name] = e.result ? e.result.insertedCount : e.insertedCount || 0;
        } else throw e;
      }
    }
    const bizIds = manifest.businesses.map((b) => toObjectId(b._id));
    if (bizIds.length) await col(N.businesses).updateMany({ _id: { $in: bizIds } }, { $unset: { salesDataPurgedAt: "" } });
    await col(N.audit).insertOne({
      entityType: "ClientSalesData",
      entityId: toObjectId(manifest.clientUserId),
      action: "CLIENT_SALES_DATA_RESTORED",
      actor: actor && actor._id ? actor._id : null,
      actorName: actor && actor.name ? actor.name : "SYSTEM (purgeClientSales script)",
      actorRole: actor && actor.role ? actor.role : "system",
      before: null,
      after: restored,
      metadata: { clientCode: manifest.clientCode, backupDir: path.basename(dir) },
      createdAt: new Date(stamp),
      updatedAt: new Date(stamp),
    });
    return { manifest, restored };
  }

  return { plan, backup, execute, verify, restore, fingerprintOthers };
}

module.exports = { createPurger, PurgeError, DEFAULT_NAMES, DEFAULT_PRESERVED, norm };
