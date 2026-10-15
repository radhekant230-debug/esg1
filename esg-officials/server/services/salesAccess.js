const User = require("../models/User");

/**
 * Resolves a manager's authorized SalesBusiness filter based on their assigned
 * businesses / cities / states. Admins get an unrestricted filter.
 * (Moved unchanged from salesController so the planner can share it.)
 */
async function getManagerAuthorizedBusinessQuery(user) {
  if (user.role === "admin") {
    return {}; // Admin has access to all businesses
  }

  const userDoc = await User.findById(user._id);
  const managerCity = userDoc?.assignedCity ? userDoc.assignedCity.trim() : null;
  const rawCities = [managerCity, ...(userDoc?.assignedCities || [])].filter(Boolean);
  const managerCities = [...new Set(rawCities.map((c) => c.trim()))];

  const managerState = userDoc?.assignedState ? userDoc.assignedState.trim() : null;
  const rawStates = [managerState, ...(userDoc?.assignedStates || [])].filter(Boolean);
  const managerStates = [...new Set(rawStates.map((s) => s.trim()))];

  const assignedBizIds = userDoc?.assignedBusinesses || [];

  // If specific businesses are assigned, scope strictly to them (and their city if defined)
  if (assignedBizIds.length > 0) {
    const bizFilter = {
      $or: [
        { _id: { $in: assignedBizIds } },
        { assignedManager: user._id },
      ],
    };
    if (managerCities.length > 0) {
      bizFilter.city = { $in: managerCities };
    }
    return bizFilter;
  }

  // Location assignment:
  // If the manager is assigned to specific cities, restrict strictly to those cities
  if (managerCities.length > 0) {
    const cityFilter = { city: { $in: managerCities } };
    if (managerStates.length > 0) {
      cityFilter.state = { $in: managerStates };
    }
    return cityFilter;
  } else if (managerStates.length > 0) {
    return { state: { $in: managerStates } };
  }

  return { assignedManager: user._id };
}

module.exports = { getManagerAuthorizedBusinessQuery };
