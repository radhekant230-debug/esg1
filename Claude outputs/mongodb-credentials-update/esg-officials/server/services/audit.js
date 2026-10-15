const AuditLog = require("../models/AuditLog");

/**
 * Writes an audit entry. Never throws for the caller unless `strict` is set
 * (inside a transaction we want failures to abort the whole operation).
 */
async function audit(
  { entityType, entityId = null, action, actor = null, before = null, after = null, metadata = {} },
  { session = null, strict = false } = {}
) {
  const doc = {
    entityType,
    entityId,
    action,
    actor: actor && actor._id ? actor._id : null,
    actorName: actor && actor.name ? actor.name : "SYSTEM",
    actorRole: actor && actor.role ? actor.role : "system",
    before,
    after,
    metadata,
  };
  try {
    const [entry] = await AuditLog.create([doc], session ? { session } : {});
    return entry;
  } catch (err) {
    if (strict) throw err;
    console.error(`[audit] Failed to write audit log (${entityType}:${action}):`, err.message);
    return null;
  }
}

/** Pick a plain snapshot of selected fields for before/after diffs. */
function snapshot(doc, fields) {
  if (!doc) return null;
  const src = typeof doc.toObject === "function" ? doc.toObject({ depopulate: true }) : doc;
  const out = {};
  fields.forEach((f) => {
    const v = f.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), src);
    out[f] = v === undefined ? null : v;
  });
  return out;
}

module.exports = { audit, snapshot };
