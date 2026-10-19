/**
 * Sales import targets: which client portal each sales business feeds.
 *
 * Sales rows are stored per SalesBusiness; a client sees a business's sales
 * only through SalesBusiness.clientAccount (its User _id). The import modal
 * therefore needs, for every active client, the business(es) actually linked
 * to that client ID — never a guess from display names.
 *
 * A client needs no business to be selectable: imports for a client without
 * one are stored under its client ID (in its automatic client sales ledger).
 * Name similarity is used only to WARN (e.g. "Hotel Royal" linked to the
 * "Café Mysa" account); nothing is linked automatically.
 */
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
const idStr = (v) => (v == null ? "" : String(v._id || v));
const clientName = (c) => c.companyName || c.name || c.email || "Client";
const namesMatch = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

/**
 * Pure. clients: active client users the requester may import for.
 * businesses: sales businesses the requester is authorized for.
 */
function buildImportTargets({ clients, businesses }) {
  const byClient = new Map();
  businesses.forEach((b) => {
    const k = idStr(b.clientAccount);
    if (!k) return;
    if (!byClient.has(k)) byClient.set(k, []);
    byClient.get(k).push(b);
  });
  const unlinked = businesses.filter((b) => !b.clientAccount);
  const biz = (b, c) => ({
    _id: idStr(b),
    name: b.name,
    code: b.code,
    city: b.city,
    state: b.state,
    isClientLedger: Boolean(b.isClientLedger),
    nameMatchesClient: c ? Boolean(b.isClientLedger) || namesMatch(b.name, clientName(c)) : null,
  });

  const clientRows = clients
    .map((c) => {
      const linked = (byClient.get(idStr(c)) || []).map((b) => biz(b, c));
      const warnings = linked
        .filter((b) => !b.nameMatchesClient)
        .map((b) => `"${b.name}" (${b.city}) is linked to ${clientName(c)}'s client portal. If that is not intended, ask an admin to correct the link before importing.`);
      return {
        _id: idStr(c),
        clientId: c.clientId || null,
        name: clientName(c),
        businesses: linked,
        warnings,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // businesses linked to a client the requester cannot see (e.g. inactive) stay listed, with a note
  const visibleClientIds = new Set(clientRows.map((c) => c._id));
  const otherLinked = businesses
    .filter((b) => b.clientAccount && !visibleClientIds.has(idStr(b.clientAccount)))
    .map((b) => ({ ...biz(b, null), note: "Linked to a client portal that is inactive or not assigned to you." }));

  return {
    clients: clientRows,
    unlinkedBusinesses: unlinked.map((b) => ({ ...biz(b, null), note: "No client portal: imported sales will not appear in any client dashboard." })),
    otherLinkedBusinesses: otherLinked,
  };
}

/** Pure: is this business a valid import target for this client? */
function checkTargetForClient(business, clientId) {
  if (!business) return "Target business not found.";
  if (!clientId) return null;
  if (idStr(business.clientAccount) !== String(clientId)) {
    return `"${business.name}" (${business.city}) is not linked to the selected client. Choose one of that client's businesses.`;
  }
  return null;
}

module.exports = { buildImportTargets, checkTargetForClient, namesMatch, norm };
