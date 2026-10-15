/**
 * Minimal in-memory stand-in for the MongoDB native driver Db, covering the
 * operations used by services/sales/purgeClientSales.js. Not a MongoDB
 * emulator: filters support equality (incl. array membership), $in, $nin,
 * $ne, $exists, $or and dotted paths. Documents are cloned through EJSON so
 * ObjectId and Date values keep their types.
 */
let BSON;
try {
  BSON = require("bson"); // hoisted mongoose dependency
} catch (e) {
  BSON = require("mongoose").mongo.BSON;
}
const { EJSON } = BSON;

// relaxed parse = what the driver returns: plain JS numbers, real ObjectId/Date
const clone = (v) => EJSON.parse(EJSON.stringify(v, { relaxed: false }), { relaxed: true });
const key = (v) => (v == null ? v : v instanceof Date ? `d:${v.getTime()}` : typeof v === "object" && v._bsontype === "ObjectId" ? `o:${v.toHexString()}` : `v:${String(v)}`);
const eq = (a, b) => key(a) === key(b);

function get(doc, p) {
  return p.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), doc);
}

function matchValue(val, cond) {
  const vals = Array.isArray(val) ? val : [val];
  if (cond && typeof cond === "object" && !(cond instanceof Date) && cond._bsontype !== "ObjectId" && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      if (op === "$in") return vals.some((v) => arg.some((a) => eq(v, a)));
      if (op === "$nin") return !vals.some((v) => arg.some((a) => eq(v, a)));
      if (op === "$ne") return arg === null ? val != null : !vals.some((v) => eq(v, arg));
      if (op === "$exists") return arg ? val !== undefined : val === undefined;
      throw new Error(`fakeMongo: unsupported operator ${op}`);
    });
  }
  if (cond === null) return val == null;
  return vals.some((v) => eq(v, cond));
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    return matchValue(get(doc, k), cond);
  });
}

function createFakeDb(seed = {}) {
  const data = {};
  Object.entries(seed).forEach(([n, docs]) => (data[n] = docs.map(clone)));
  const ops = [];
  const collection = (name) => {
    if (!data[name]) data[name] = [];
    const rows = () => data[name];
    return {
      find(filter = {}) {
        const out = rows().filter((d) => matches(d, filter)).map(clone);
        return { toArray: async () => out };
      },
      async findOne(filter = {}) {
        const d = rows().find((x) => matches(x, filter));
        return d ? clone(d) : null;
      },
      async countDocuments(filter = {}) {
        return rows().filter((d) => matches(d, filter)).length;
      },
      async deleteMany(filter = {}, opts = {}) {
        const before = rows().length;
        data[name] = rows().filter((d) => !matches(d, filter));
        ops.push({ op: "deleteMany", name, session: Boolean(opts.session) });
        return { deletedCount: before - data[name].length };
      },
      async insertMany(docs) {
        let inserted = 0;
        const dupes = [];
        docs.forEach((d) => {
          if (rows().some((x) => eq(x._id, d._id))) dupes.push({ code: 11000 });
          else {
            rows().push(clone(d));
            inserted++;
          }
        });
        if (dupes.length) {
          const e = new Error("E11000 duplicate key");
          e.code = 11000;
          e.writeErrors = dupes;
          e.insertedCount = inserted;
          throw e;
        }
        return { insertedCount: inserted };
      },
      async insertOne(doc, opts = {}) {
        rows().push(clone(doc));
        ops.push({ op: "insertOne", name, session: Boolean(opts.session) });
        return { insertedId: doc._id };
      },
      async updateMany(filter, update, opts = {}) {
        let n = 0;
        rows().forEach((d) => {
          if (!matches(d, filter)) return;
          n++;
          Object.entries(update.$set || {}).forEach(([k, v]) => (d[k] = v));
          Object.keys(update.$unset || {}).forEach((k) => delete d[k]);
        });
        ops.push({ op: "updateMany", name, session: Boolean(opts.session) });
        return { modifiedCount: n };
      },
    };
  };
  return {
    db: { collection },
    data,
    ops,
    /** Transaction stand-in: rolls every collection back if fn throws. */
    async withTransaction(fn) {
      const snapshot = clone(data);
      try {
        const result = await fn({ fake: "session" });
        return { result, transactional: true };
      } catch (e) {
        Object.keys(data).forEach((k) => delete data[k]);
        Object.assign(data, snapshot);
        throw e;
      }
    },
  };
}

module.exports = { createFakeDb, clone };
