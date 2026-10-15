/**
 * Authorization scoping for scheduled activities.
 * Reuses the existing access model:
 *   - clients are linked to managers through User.assignedManager
 *   - sales businesses are scoped by getManagerAuthorizedBusinessQuery
 */
const mongoose = require("mongoose");
const User = require("../../models/User");
const SalesBusiness = require("../../models/sales/SalesBusiness");
const { getManagerAuthorizedBusinessQuery } = require("../salesAccess");

const idStr = (v) => (v && v._id ? String(v._id) : v ? String(v) : "");

async function getManagerScope(user) {
  const [clientIds, bizFilter] = await Promise.all([
    User.find({ role: "client", assignedManager: user._id }).distinct("_id"),
    getManagerAuthorizedBusinessQuery(user),
  ]);
  const businessIds = await SalesBusiness.find(bizFilter).distinct("_id");
  return { clientIds, businessIds };
}

async function getClientBusinessIds(user) {
  return SalesBusiness.find({ clientAccount: user._id }).distinct("_id");
}

/** Mongo filter restricting ScheduledActivity documents to what `user` may see. */
async function activityScopeFilter(user) {
  if (user.role === "admin") return {};
  if (user.role === "manager") {
    const { clientIds, businessIds } = await getManagerScope(user);
    return {
      $or: [
        { assignedManager: user._id },
        { client: { $in: clientIds } },
        { business: { $in: businessIds } },
      ],
    };
  }
  if (user.role === "client") {
    const ownBusinesses = await getClientBusinessIds(user);
    return {
      visibleToClient: true,
      $or: [{ client: user._id }, { business: { $in: ownBusinesses } }],
    };
  }
  return { _id: null }; // matches nothing
}

/** Combines the scope filter with additional query conditions safely. */
async function scopedFilter(user, extra = {}) {
  const scope = await activityScopeFilter(user);
  if (!Object.keys(scope).length) return extra;
  if (!Object.keys(extra).length) return scope;
  return { $and: [scope, extra] };
}

/** True when a manager/admin may modify the given activity. */
async function canManageActivity(user, activity) {
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  if (idStr(activity.assignedManager) === idStr(user._id)) return true;
  const { clientIds, businessIds } = await getManagerScope(user);
  if (activity.client && clientIds.some((id) => idStr(id) === idStr(activity.client))) return true;
  if (activity.business && businessIds.some((id) => idStr(id) === idStr(activity.business))) return true;
  return false;
}

/** True when a client may view (and approve) the activity. */
async function clientOwnsActivity(user, activity) {
  if (user.role !== "client" || !activity.visibleToClient) return false;
  if (idStr(activity.client) === idStr(user._id)) return true;
  if (activity.business) {
    const own = await getClientBusinessIds(user);
    return own.some((id) => idStr(id) === idStr(activity.business));
  }
  return false;
}

/**
 * Validates the client / business a manager wants to attach to an activity.
 * Returns { client, business, businessName } or throws { status, message }.
 */
async function resolveTarget(user, { clientId, businessId }) {
  const fail = (status, message) => {
    const e = new Error(message);
    e.status = status;
    throw e;
  };

  if (!clientId && !businessId) fail(400, "Select a client or a business for this activity.");
  if (clientId && !mongoose.Types.ObjectId.isValid(clientId)) fail(400, "Invalid client.");
  if (businessId && !mongoose.Types.ObjectId.isValid(businessId)) fail(400, "Invalid business.");

  let client = null;
  let business = null;

  if (businessId) {
    business = await SalesBusiness.findById(businessId);
    if (!business) fail(404, "Business not found.");
  }
  if (clientId) {
    client = await User.findOne({ _id: clientId, role: "client" }).select("name companyName assignedManager");
    if (!client) fail(404, "Client not found.");
  }

  if (user.role === "manager") {
    const { clientIds, businessIds } = await getManagerScope(user);
    if (client && !clientIds.some((id) => idStr(id) === idStr(client._id))) {
      fail(403, "You are not authorized to schedule work for this client.");
    }
    if (business && !businessIds.some((id) => idStr(id) === idStr(business._id))) {
      fail(403, "You are not authorized to schedule work for this business.");
    }
  }

  // Link the client account automatically when the business belongs to one.
  if (business && business.clientAccount) {
    if (client && idStr(client._id) !== idStr(business.clientAccount)) {
      fail(400, "The selected business belongs to a different client account.");
    }
    if (!client) {
      client = await User.findById(business.clientAccount).select("name companyName assignedManager");
    }
  }

  const businessName = business
    ? business.name
    : (client && (client.companyName || client.name)) || "";

  return { client, business, businessName };
}

module.exports = {
  getManagerScope,
  activityScopeFilter,
  scopedFilter,
  canManageActivity,
  clientOwnsActivity,
  resolveTarget,
  idStr,
};
