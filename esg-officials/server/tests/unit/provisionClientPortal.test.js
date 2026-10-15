const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createProvisioner, ProvisionError } = require("../../services/portal/provisionClientPortal");
const { buildLoginQuery } = require("../../utils/loginQuery");

// ---- tiny in-memory models (equality, RegExp, $or; unique checks like the real indexes) ----
let seq = 0;
const oid = () => `oid${String(++seq).padStart(6, "0")}`;
function matches(doc, f) {
  return Object.entries(f).every(([k, c]) => {
    if (k === "$or") return c.some((x) => matches(doc, x));
    const v = doc[k];
    if (c instanceof RegExp) return c.test(String(v || ""));
    return String(v ?? "") === String(c ?? "") && (c != null || v == null);
  });
}
function model(rows, { unique = [], preSave } = {}) {
  class M {
    constructor(data) {
      Object.assign(this, { _id: oid(), ...data });
    }
    async save() {
      if (preSave) await preSave(this);
      unique.forEach((k) => {
        if (this[k] != null && rows.some((r) => r._id !== this._id && r[k] === this[k])) throw new Error(`E11000 duplicate ${k}`);
      });
      const i = rows.findIndex((r) => r._id === this._id);
      if (i > -1) rows[i] = this;
      else rows.push(this);
      return this;
    }
    toObject() {
      return { ...this };
    }
    static async find(f = {}) {
      return rows.filter((r) => matches(r, f));
    }
    static async findOne(f = {}) {
      return rows.find((r) => matches(r, f)) || null;
    }
    static async findById(id) {
      return rows.find((r) => r._id === String(id)) || null;
    }
  }
  return M;
}

const hash = async (pw) => `$2b$10$${crypto.createHash("sha256").update(pw).digest("base64").replace(/[^A-Za-z0-9]/g, "").padEnd(53, "x").slice(0, 53)}`;
const compare = async (pw, h) => (await hash(pw)) === h;

function world(extra = {}) {
  const users = [
    { _id: "mgr1", role: "manager", name: "Ranchi Manager", email: "manager@esg.com" },
    { _id: "cli1", role: "client", clientId: "CLI-2026-0001", email: "royal@client.com", companyName: "Hotel Royal", isActive: true, isVerified: true, password: "$2b$10$" + "a".repeat(53) },
    { _id: "cli2", role: "client", clientId: "CLI-2026-0002", email: "cafemysa@client.com", companyName: "Café Mysa", isActive: true, isVerified: true, password: "$2b$10$" + "b".repeat(53) },
    ...(extra.users || []),
  ];
  const businesses = [
    { _id: "bizMaya", name: "Maya Multicuisine Restaurant", code: "BIZ-JH-RAN-0002", city: "Ranchi", state: "Jharkhand", assignedManager: "mgr1", clientAccount: null, address: "Main Road" },
    { _id: "bizRoyal", name: "Hotel Royal", code: "BIZ-JH-RAN-0001", city: "Ranchi", state: "Jharkhand", clientAccount: "cli1" },
    { _id: "bizMysa", name: "CAFE MYSA", code: "BIZ-JH-RAN-0101", city: "Ranchi", state: "Jharkhand", clientAccount: "cli2" },
    ...(extra.businesses || []),
  ];
  const profiles = [{ _id: "p1", client: "cli1", businessName: "Hotel Royal" }];
  const audits = [];
  const User = model(users, {
    unique: ["email", "username", "clientId"],
    preSave: async (u) => {
      if (u.role === "client" && !u.clientId) {
        const n = Math.max(0, ...users.filter((x) => x.clientId).map((x) => Number(x.clientId.slice(-4)))) + 1;
        u.clientId = `CLI-2026-${String(n).padStart(4, "0")}`;
      }
    },
  });
  const SalesBusiness = model(businesses);
  const ClientProfile = model(profiles, { unique: ["client"] });
  // seed rows are plain objects; give them save() by wrapping
  [users, businesses, profiles].forEach((rows, i) => {
    const M = [User, SalesBusiness, ClientProfile][i];
    rows.forEach((r, j) => (rows[j] = Object.assign(new M({}), r)));
  });
  const p = createProvisioner({ User, SalesBusiness, ClientProfile, hashPassword: hash, comparePassword: compare, buildLoginQuery, audit: async (e) => audits.push(e) });
  return { p, users, businesses, profiles, audits };
}

const MAYA = { businessName: "Maya Multicuisine Restaurant", city: "Ranchi", login: "maya@2040" };

test("login identifier: maya@2040 is matched as email OR username; client IDs still work", () => {
  assert.deepEqual(buildLoginQuery("Maya@2040"), { $or: [{ email: "maya@2040" }, { username: "maya@2040" }] });
  assert.deepEqual(buildLoginQuery("CLI-2026-0001"), { $or: [{ clientId: "CLI-2026-0001" }, { email: "cli-2026-0001" }, { username: "cli-2026-0001" }] });
});

test("creates one client account linked to the existing Maya business, verifies, then activates", async () => {
  const w = world();
  const plan = await w.p.plan(MAYA);
  assert.equal(plan.business._id, "bizMaya");
  assert.equal(plan.user, null);
  const r = await w.p.apply(plan, { tempPassword: "temp-pw" });

  assert.equal(w.businesses.length, 3, "no second business");
  assert.equal(w.users.filter((u) => u.role === "client").length, 3, "exactly one new client");
  const u = r.user;
  assert.equal(u.username, "maya@2040");
  assert.match(u.email, /@client-portal\.invalid$/, "placeholder mailbox, never a fake real address");
  assert.equal(u.clientId, "CLI-2026-0003");
  assert.equal(u.assignedManager, "mgr1", "manager carried over from the business");
  assert.notEqual(u.password, "temp-pw");
  assert.ok(await compare("temp-pw", u.password));
  assert.equal(u.isActive, true);
  assert.equal(u.isVerified, true);
  assert.equal(w.businesses.find((b) => b._id === "bizMaya").clientAccount, u._id);
  assert.ok(w.profiles.find((x) => x.client === u._id && x.businessName === "Maya Multicuisine Restaurant"));
  assert.deepEqual(Object.values(r.checks).filter((v) => v === false), []);
  assert.deepEqual(r.changes, ["user created", "client profile created", "business linked to user", "account activated"]);
  assert.equal(w.audits.length, 1);
  // other clients untouched
  assert.equal(w.businesses.find((b) => b._id === "bizRoyal").clientAccount, "cli1");
});

test("re-running is a no-op: same user, no duplicates, password not overwritten", async () => {
  const w = world();
  const first = await w.p.apply(await w.p.plan(MAYA), { tempPassword: "temp-pw" });
  const before = first.user.password;
  const again = await w.p.apply(await w.p.plan(MAYA), { tempPassword: "different" });
  assert.equal(again.user._id, first.user._id);
  assert.deepEqual(again.changes, []);
  assert.equal(again.user.password, before);
  assert.equal(w.users.length, 4);
  assert.equal(w.profiles.length, 2);
});

test("repairs an existing unlinked Maya client account instead of creating another", async () => {
  const w = world({ users: [{ _id: "old", role: "client", clientId: "CLI-2026-0004", email: "owner@maya.in", companyName: "Maya Multicuisine Restaurant", isActive: false, isVerified: false, password: "$2b$10$" + "c".repeat(53) }] });
  const plan = await w.p.plan(MAYA);
  assert.equal(plan.user._id, "old");
  const r = await w.p.apply(plan, { tempPassword: "temp-pw", resetPassword: true });
  assert.equal(r.user._id, "old");
  assert.equal(r.user.email, "owner@maya.in", "real email preserved");
  assert.equal(r.user.username, "maya@2040");
  assert.equal(r.user.isActive, true);
  assert.equal(w.users.length, 4);
});

test("stops without changes when the login ID or business is ambiguous", async () => {
  let w = world({ users: [{ _id: "x", role: "manager", email: "maya@2040" }] });
  await assert.rejects(w.p.plan(MAYA), /already used by another account/);

  w = world({ businesses: [{ _id: "dup", name: "Maya  Multicuisine Restaurant", code: "BIZ-X", city: "ranchi" }] });
  await assert.rejects(w.p.plan(MAYA), (e) => e instanceof ProvisionError && e.details.matches.length === 2);

  w = world();
  await assert.rejects(w.p.plan({ ...MAYA, businessName: "Maya Restaurant" }), /No business/);

  // business already linked to a non-client
  w = world();
  w.businesses.find((b) => b._id === "bizMaya").clientAccount = "mgr1";
  await assert.rejects(w.p.plan(MAYA), /not a client/);
});
