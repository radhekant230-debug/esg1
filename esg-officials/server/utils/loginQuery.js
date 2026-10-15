/**
 * The login form has one identifier field: email, client ID (CLI-2026-0001)
 * or username (e.g. "maya@2040", which looks like an email but is not one).
 */
function buildLoginQuery(rawId) {
  const id = String(rawId || "").trim();
  const lower = id.toLowerCase();
  if (id.includes("@")) return { $or: [{ email: lower }, { username: lower }] };
  return { $or: [{ clientId: id }, { email: lower }, { username: lower }] };
}

module.exports = { buildLoginQuery };
