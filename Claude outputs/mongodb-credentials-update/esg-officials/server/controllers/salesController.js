const xlsx = require("xlsx");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const SalesLocation = require("../models/sales/SalesLocation");
const User = require("../models/User");
const { audit } = require("../services/audit");

const FINANCIAL_FIELDS = ["totalSales", "salesBasis", "orders", "target", "discount", "cost", "expenses", "remarks"];
const financialSnapshot = (r) => Object.fromEntries(FINANCIAL_FIELDS.map((f) => [f, r[f] === undefined ? null : r[f]]));

/**
 * Optional financial value: "" / null -> null (not recorded), else a non-negative number.
 * Returns { value } or { error }.
 */
function optionalAmount(v, label) {
  if (v === undefined) return { skip: true };
  if (v === null || v === "") return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { error: `${label} must be a non-negative number or left blank.` };
  return { value: n };
}

// Month names helper
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_MAP = {
  jan: 1, january: 1, "01": 1, "1": 1,
  feb: 2, february: 2, "02": 2, "2": 2,
  mar: 3, march: 3, "03": 3, "3": 3,
  apr: 4, april: 4, "04": 4, "4": 4,
  may: 5, "05": 5, "5": 5,
  jun: 6, june: 6, "06": 6, "6": 6,
  jul: 7, july: 7, "07": 7, "7": 7,
  aug: 8, august: 8, "08": 8, "8": 8,
  sep: 9, sept: 9, september: 9, "09": 9, "9": 9,
  oct: 10, october: 10, "10": 10,
  nov: 11, november: 11, "11": 11,
  dec: 12, december: 12, "12": 12,
};

/**
 * Parses diverse month-year representations into structured { month: 1..12, year: YYYY, monthName: "Month YYYY" }
 */
function parseMonthYear(val) {
  if (!val) return null;

  // Handle Excel date serial numbers
  if (typeof val === "number") {
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      const month = jsDate.getUTCMonth() + 1;
      const year = jsDate.getUTCFullYear();
      return { month, year, monthName: `${MONTH_NAMES[month - 1]} ${year}` };
    }
  }

  const str = String(val).trim();

  // Pattern 1: "September 2026" or "Sep 2026"
  const wordMatch = str.match(/^([A-Za-z]+)\s+[,/-]?\s*(\d{4})$/);
  if (wordMatch) {
    const mName = wordMatch[1].toLowerCase();
    const year = parseInt(wordMatch[2], 10);
    const month = MONTH_MAP[mName];
    if (month && year >= 2000 && year <= 2100) {
      return { month, year, monthName: `${MONTH_NAMES[month - 1]} ${year}` };
    }
  }

  // Pattern 2: "2026-09" or "2026/09"
  const yFirstMatch = str.match(/^(\d{4})[-/.](\d{1,2})/);
  if (yFirstMatch) {
    const year = parseInt(yFirstMatch[1], 10);
    const month = parseInt(yFirstMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { month, year, monthName: `${MONTH_NAMES[month - 1]} ${year}` };
    }
  }

  // Pattern 3: "09/2026" or "9-2026"
  const mFirstMatch = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (mFirstMatch) {
    const month = parseInt(mFirstMatch[1], 10);
    const year = parseInt(mFirstMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { month, year, monthName: `${MONTH_NAMES[month - 1]} ${year}` };
    }
  }

  return null;
}


/** clientAccount must be an existing client user (or empty to unlink). */
async function resolveClientAccount(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === "") return { value: null };
  const mongoose = require("mongoose");
  if (!mongoose.Types.ObjectId.isValid(value)) return { error: "Invalid client portal account." };
  const client = await User.findOne({ _id: value, role: "client" }).select("_id");
  if (!client) return { error: "The selected client portal account does not exist." };
  return { value: client._id };
}

// Manager business scoping lives in services/salesAccess.js (shared with the planner)
const { getManagerAuthorizedBusinessQuery } = require("../services/salesAccess");

// =========================================================================
// 1. DASHBOARD & REGIONAL PERFORMANCE
// =========================================================================
exports.getSalesDashboard = async (req, res) => {
  try {
    const userDoc = req.user.role === "manager" ? await User.findById(req.user._id) : null;

    // Cross-city authorization security check: prevent managers from viewing unassigned locations
    if (req.user.role === "manager" && userDoc) {
      const allowedCities = [userDoc.assignedCity, ...(userDoc.assignedCities || [])]
        .filter(Boolean)
        .map((c) => c.toLowerCase().trim());

      if (req.query.city && req.query.city !== "All" && req.query.city.trim() !== "") {
        if (!allowedCities.includes(req.query.query ? req.query.city.toLowerCase().trim() : req.query.city.toLowerCase().trim())) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to access sales data for "${req.query.city}".`,
          });
        }
      }

      if (req.query.state && req.query.state !== "All" && userDoc.assignedState) {
        if (req.query.state.toLowerCase().trim() !== userDoc.assignedState.toLowerCase().trim()) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to access sales data for "${req.query.state}".`,
          });
        }
      }
    }

    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);

    // Filter by query parameters if provided
    const queryFilter = { ...authFilter };
    if (req.query.state && req.query.state !== "All") queryFilter.state = req.query.state.trim();
    if (req.query.city && req.query.city !== "All") queryFilter.city = req.query.city.trim();
    if (req.query.category && req.query.category !== "All") queryFilter.category = req.query.category.trim();

    // Fetch authorized businesses
    const businesses = await SalesBusiness.find(queryFilter);
    const businessIds = businesses.map((b) => b._id);

    // Selected Month & Year (defaults to October 2026 or current date)
    const now = new Date();
    const reqYear = parseInt(req.query.year, 10) || 2026;
    const reqMonth = parseInt(req.query.month, 10) || 10;

    // Previous month calculation
    let prevMonth = reqMonth - 1;
    let prevYear = reqYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = reqYear - 1;
    }

    // Fetch Current Month Records
    const currentRecords = await SalesRecord.find({
      business: { $in: businessIds },
      year: reqYear,
      month: reqMonth,
    }).populate("business", "name code category state city monthlyTarget");

    // Fetch Previous Month Records
    const prevRecords = await SalesRecord.find({
      business: { $in: businessIds },
      year: prevYear,
      month: prevMonth,
    });

    // Current month totals
    const currentSalesTotal = currentRecords.reduce((sum, r) => sum + (r.totalSales || 0), 0);
    const currentOrdersTotal = currentRecords.reduce((sum, r) => sum + (r.orders || 0), 0);
    const currentTargetTotal = businesses.reduce((sum, b) => sum + (b.monthlyTarget || 0), 0);

    // Previous month totals
    const prevSalesTotal = prevRecords.reduce((sum, r) => sum + (r.totalSales || 0), 0);
    const prevOrdersTotal = prevRecords.reduce((sum, r) => sum + (r.orders || 0), 0);

    // Sales Growth Percentage Calculation: ((Current - Prev) / Prev) * 100
    let salesGrowthPercentage = 0;
    if (prevSalesTotal > 0) {
      salesGrowthPercentage = Number((((currentSalesTotal - prevSalesTotal) / prevSalesTotal) * 100).toFixed(1));
    } else if (currentSalesTotal > 0) {
      salesGrowthPercentage = 100.0;
    }

    // Target Achievement & Pending Target
    const achievementRate = currentTargetTotal > 0
      ? Number(((currentSalesTotal / currentTargetTotal) * 100).toFixed(1))
      : 0;
    const pendingTarget = Math.max(0, currentTargetTotal - currentSalesTotal);

    // Breakdown counts by category
    const hotelsCount = businesses.filter((b) => b.category === "Hotel").length;
    const restaurantsCount = businesses.filter((b) => b.category === "Restaurant").length;
    const servicesCount = businesses.filter((b) => b.category === "Service").length;

    // Assigned State & City summaries
    const uniqueStates = [...new Set(businesses.map((b) => b.state))];
    const uniqueCities = [...new Set(businesses.map((b) => b.city))];

    // Business-wise comparison for the selected month
    const businessPerformance = businesses.map((b) => {
      const rec = currentRecords.find((r) => r.business?._id?.toString() === b._id.toString() || r.business?.toString() === b._id.toString());
      const prevRec = prevRecords.find((r) => r.business?._id?.toString() === b._id.toString() || r.business?.toString() === b._id.toString());

      const curSales = rec ? rec.totalSales : 0;
      const pSales = prevRec ? prevRec.totalSales : 0;
      const target = b.monthlyTarget || (rec ? rec.target : 0);

      let bGrowth = 0;
      if (pSales > 0) {
        bGrowth = Number((((curSales - pSales) / pSales) * 100).toFixed(1));
      } else if (curSales > 0) {
        bGrowth = 100.0;
      }

      const bAchievement = target > 0 ? Number(((curSales / target) * 100).toFixed(1)) : 0;

      return {
        _id: b._id,
        name: b.name,
        code: b.code,
        category: b.category,
        state: b.state,
        city: b.city,
        currentSales: curSales,
        prevSales: pSales,
        orders: rec ? rec.orders : 0,
        target,
        achievementRate: bAchievement,
        growthPercentage: bGrowth,
        remarks: rec ? rec.remarks : "",
      };
    });

    // Top-performing and lowest-performing businesses
    const sortedBySales = [...businessPerformance].sort((a, b) => b.currentSales - a.currentSales);
    const topPerforming = sortedBySales.slice(0, 3);
    const lowestPerforming = sortedBySales.filter((b) => b.currentSales < b.target).reverse().slice(0, 3);

    // Monthly Trend Data (Last 6 Months)
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      let tMonth = reqMonth - i;
      let tYear = reqYear;
      while (tMonth <= 0) {
        tMonth += 12;
        tYear -= 1;
      }

      const mRecords = await SalesRecord.find({
        business: { $in: businessIds },
        year: tYear,
        month: tMonth,
      });

      const mSales = mRecords.reduce((s, r) => s + (r.totalSales || 0), 0);
      const mOrders = mRecords.reduce((s, r) => s + (r.orders || 0), 0);

      trendData.push({
        monthName: `${MONTH_NAMES[tMonth - 1].substring(0, 3)} ${tYear}`,
        fullMonth: `${MONTH_NAMES[tMonth - 1]} ${tYear}`,
        month: tMonth,
        year: tYear,
        totalSales: mSales,
        orders: mOrders,
        target: currentTargetTotal,
      });
    }

    // City-wise aggregate
    const cityMap = {};
    businessPerformance.forEach((b) => {
      if (!cityMap[b.city]) {
        cityMap[b.city] = { city: b.city, state: b.state, totalSales: 0, orders: 0, count: 0 };
      }
      cityMap[b.city].totalSales += b.currentSales;
      cityMap[b.city].orders += b.orders;
      cityMap[b.city].count += 1;
    });
    const cityBreakdown = Object.values(cityMap);

    // Recent 10 Sales Records
    const recentRecords = await SalesRecord.find({
      business: { $in: businessIds },
    })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .limit(10)
      .populate("business", "name code category state city");

    const assignedCity = userDoc?.assignedCity || uniqueCities[0] || "Ranchi";
    const assignedState = userDoc?.assignedState || uniqueStates[0] || "Jharkhand";

    return res.json({
      managerInfo: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        assignedStates: userDoc?.assignedStates?.length
          ? userDoc.assignedStates
          : (userDoc?.assignedState ? [userDoc.assignedState] : (uniqueStates.length ? uniqueStates : [assignedState])),
        assignedCities: userDoc?.assignedCities?.length
          ? userDoc.assignedCities
          : (userDoc?.assignedCity ? [userDoc.assignedCity] : (uniqueCities.length ? uniqueCities : [assignedCity])),
        primaryState: assignedState,
        primaryCity: assignedCity,
      },
      selectedPeriod: {
        month: reqMonth,
        year: reqYear,
        monthName: `${MONTH_NAMES[reqMonth - 1]} ${reqYear}`,
        prevMonth,
        prevYear,
        prevMonthName: `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
      },
      summary: {
        totalBusinesses: businesses.length,
        totalHotels: hotelsCount,
        totalRestaurants: restaurantsCount,
        totalServices: servicesCount,
        currentMonthSales: currentSalesTotal,
        currentMonthOrders: currentOrdersTotal,
        previousMonthSales: prevSalesTotal,
        previousMonthOrders: prevOrdersTotal,
        salesGrowthPercentage,
        targetTotal: currentTargetTotal,
        achievementRate,
        pendingTarget,
      },
      businessPerformance,
      topPerforming,
      lowestPerforming,
      trendData,
      cityBreakdown,
      recentRecords,
    });
  } catch (error) {
    console.error("Sales Dashboard Error:", error);
    return res.status(500).json({ message: "Failed to load sales dashboard data." });
  }
};

// =========================================================================
// 2. BUSINESS MANAGEMENT (HOTELS, RESTAURANTS, SERVICES)
// =========================================================================
exports.getBusinesses = async (req, res) => {
  try {
    // Cross-city authorization security check for managers
    if (req.user.role === "manager") {
      const userDoc = await User.findById(req.user._id);
      const allowedCities = [userDoc?.assignedCity, ...(userDoc?.assignedCities || [])]
        .filter(Boolean)
        .map((c) => c.toLowerCase().trim());

      if (req.query.city && req.query.city !== "All" && req.query.city.trim() !== "") {
        if (!allowedCities.includes(req.query.city.toLowerCase().trim())) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to view businesses in "${req.query.city}".`,
          });
        }
      }

      if (req.query.state && req.query.state !== "All" && userDoc?.assignedState) {
        if (req.query.state.toLowerCase().trim() !== userDoc.assignedState.toLowerCase().trim()) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to view businesses in "${req.query.state}".`,
          });
        }
      }
    }

    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const filter = { ...authFilter };

    if (req.query.state && req.query.state !== "All") filter.state = req.query.state.trim();
    if (req.query.city && req.query.city !== "All") filter.city = req.query.city.trim();
    if (req.query.category && req.query.category !== "All") filter.category = req.query.category.trim();
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search.trim(), $options: "i" } },
        { code: { $regex: req.query.search.trim(), $options: "i" } },
      ];
    }

    const businesses = await SalesBusiness.find(filter)
      .populate("assignedManager", "name email phone")
      .populate("clientAccount", "name companyName email")
      .sort({ state: 1, city: 1, name: 1 });

    // Attach latest monthly sales data
    const enhanced = await Promise.all(
      businesses.map(async (b) => {
        const latest = await SalesRecord.findOne({ business: b._id }).sort({ year: -1, month: -1 });
        const allRecords = await SalesRecord.find({ business: b._id });
        const lifetimeSales = allRecords.reduce((sum, r) => sum + (r.totalSales || 0), 0);
        const lifetimeOrders = allRecords.reduce((sum, r) => sum + (r.orders || 0), 0);

        return {
          ...b.toObject(),
          latestRecord: latest || null,
          lifetimeSales,
          lifetimeOrders,
          recordsCount: allRecords.length,
        };
      })
    );

    return res.json(enhanced);
  } catch (error) {
    console.error("Get Businesses Error:", error);
    return res.status(500).json({ message: "Failed to fetch businesses." });
  }
};

exports.getBusinessDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await SalesBusiness.findById(id).populate("assignedManager", "name email phone");

    if (!business) {
      return res.status(404).json({ message: "Business not found." });
    }

    // Role verification: If manager, verify assignment
    if (req.user.role === "manager") {
      const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
      const isAllowed = await SalesBusiness.findOne({ _id: id, ...authFilter });
      if (!isAllowed) {
        return res.status(403).json({ message: "Access denied: You are not assigned to this business." });
      }
    }

    // Sales history sorted chronologically
    const salesRecords = await SalesRecord.find({ business: id })
      .sort({ year: -1, month: -1 })
      .populate("uploadedBy", "name email");

    const lifetimeRevenue = salesRecords.reduce((sum, r) => sum + (r.totalSales || 0), 0);
    const lifetimeOrders = salesRecords.reduce((sum, r) => sum + (r.orders || 0), 0);

    // Compute month-over-month growth for each record
    const recordsWithGrowth = salesRecords.map((rec, idx) => {
      const prevRec = salesRecords[idx + 1];
      let growth = 0;
      if (prevRec && prevRec.totalSales > 0) {
        growth = Number((((rec.totalSales - prevRec.totalSales) / prevRec.totalSales) * 100).toFixed(1));
      } else if (!prevRec && rec.totalSales > 0) {
        growth = 100;
      }
      return {
        ...rec.toObject(),
        growthPercentage: growth,
      };
    });

    const avgAchievementRate = salesRecords.length > 0
      ? Number((salesRecords.reduce((sum, r) => sum + (r.achievementRate || 0), 0) / salesRecords.length).toFixed(1))
      : 0;

    return res.json({
      business,
      salesRecords: recordsWithGrowth,
      lifetimeRevenue,
      lifetimeOrders,
      totalRecords: salesRecords.length,
      metrics: {
        totalSales: lifetimeRevenue,
        totalOrders: lifetimeOrders,
        avgAchievementRate,
      },
    });
  } catch (error) {
    console.error("Business Detail Error:", error);
    return res.status(500).json({ message: "Failed to fetch business details." });
  }
};

// Admin only: Create business
exports.createBusiness = async (req, res) => {
  try {
    const { name, category, state, city, address, phone, email, monthlyTarget, notes, assignedManager } = req.body;

    if (!name || !state || !city) {
      return res.status(400).json({ message: "Name, state, and city are required." });
    }

    const statePrefix = (state || "ST").substring(0, 2).toUpperCase();
    const cityPrefix = (city || "CT").substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    const code = req.body.code ? req.body.code.trim().toUpperCase() : `BIZ-${statePrefix}-${cityPrefix}-${random}`;

    const clientLink = await resolveClientAccount(req.body.clientAccount);
    if (clientLink.error) return res.status(400).json({ message: clientLink.error });

    const existingCode = await SalesBusiness.findOne({ code });
    if (existingCode) {
      return res.status(400).json({ message: "A business with this unique code already exists." });
    }

    const business = await SalesBusiness.create({
      name: name.trim(),
      code,
      category: category || "Restaurant",
      state: state.trim(),
      city: city.trim(),
      address: address ? address.trim() : "",
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      monthlyTarget: Number(monthlyTarget) || 0,
      notes: notes ? notes.trim() : "",
      assignedManager: assignedManager || null,
      clientAccount: clientLink.skip ? null : clientLink.value,
      createdBy: req.user._id,
    });

    await audit({
      entityType: "SalesBusiness",
      entityId: business._id,
      action: "BUSINESS_CREATED",
      actor: req.user,
      after: { name: business.name, city: business.city, state: business.state, monthlyTarget: business.monthlyTarget },
    });

    return res.status(201).json({
      message: "Business created successfully",
      business,
    });
  } catch (error) {
    console.error("Create Business Error:", error);
    return res.status(500).json({ message: "Failed to create business." });
  }
};

// Admin only: Update business
exports.updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await SalesBusiness.findById(id);

    if (!business) {
      return res.status(404).json({ message: "Business not found." });
    }

    const fields = ["name", "category", "state", "city", "address", "phone", "email", "monthlyTarget", "notes", "assignedManager", "isActive", "clientAccount"];
    const before = Object.fromEntries(fields.map((f) => [f, business[f] === undefined ? null : business[f]]));
    const clientLink = await resolveClientAccount(req.body.clientAccount);
    if (clientLink.error) return res.status(400).json({ message: clientLink.error });
    if (!clientLink.skip) req.body.clientAccount = clientLink.value;
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        business[f] = req.body[f];
      }
    });

    await business.save();

    await audit({
      entityType: "SalesBusiness",
      entityId: business._id,
      action: "BUSINESS_UPDATED",
      actor: req.user,
      before,
      after: Object.fromEntries(fields.map((f) => [f, business[f] === undefined ? null : business[f]])),
    });

    return res.json({
      message: "Business updated successfully",
      business,
    });
  } catch (error) {
    console.error("Update Business Error:", error);
    return res.status(500).json({ message: "Failed to update business." });
  }
};

// Admin only: Delete business
exports.deleteBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await SalesBusiness.findById(id);
    if (!business) {
      return res.status(404).json({ message: "Business not found." });
    }

    const recordCount = await SalesRecord.countDocuments({ business: id });
    await SalesBusiness.findByIdAndDelete(id);
    await SalesRecord.deleteMany({ business: id });
    await audit({
      entityType: "SalesBusiness",
      entityId: business._id,
      action: "BUSINESS_DELETED",
      actor: req.user,
      before: { name: business.name, city: business.city, state: business.state, monthlyTarget: business.monthlyTarget },
      metadata: { salesRecordsDeleted: recordCount },
    });

    return res.json({ message: "Business and associated sales records deleted successfully." });
  } catch (error) {
    console.error("Delete Business Error:", error);
    return res.status(500).json({ message: "Failed to delete business." });
  }
};

// =========================================================================
// 3. SALES RECORDS (MANUAL ENTRY, EDIT, DELETE)
// =========================================================================
exports.getSalesRecords = async (req, res) => {
  try {
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const businesses = await SalesBusiness.find(authFilter);
    const businessIds = businesses.map((b) => b._id);

    const filter = { business: { $in: businessIds } };

    // Keep the authorization scope when filtering by a single business
    if (req.query.businessId) {
      const allowed = businessIds.some((id) => id.toString() === String(req.query.businessId));
      if (!allowed) return res.json([]);
      filter.business = req.query.businessId;
    }
    if (req.query.year) filter.year = parseInt(req.query.year, 10);
    if (req.query.month) filter.month = parseInt(req.query.month, 10);
    if (req.query.city) filter.city = req.query.city.trim();
    if (req.query.state) filter.state = req.query.state.trim();

    const records = await SalesRecord.find(filter)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .populate("business", "name code category state city monthlyTarget")
      .populate("uploadedBy", "name email");

    return res.json(records);
  } catch (error) {
    console.error("Get Sales Records Error:", error);
    return res.status(500).json({ message: "Failed to fetch sales records." });
  }
};

exports.createSalesRecord = async (req, res) => {
  try {
    const { businessId, month, year, totalSales, orders, target, remarks, salesBasis } = req.body;
    const fin = {};
    for (const [key, label] of [["discount", "Discount"], ["cost", "Cost"], ["expenses", "Expenses"]]) {
      const r = optionalAmount(req.body[key], label);
      if (r.error) return res.status(400).json({ message: r.error });
      if (!r.skip) fin[key] = r.value;
    }
    if (salesBasis !== undefined && !["gross", "net"].includes(salesBasis)) {
      return res.status(400).json({ message: "salesBasis must be 'gross' or 'net'." });
    }
    if (totalSales === undefined || totalSales === "" || !Number.isFinite(Number(totalSales)) || Number(totalSales) < 0) {
      return res.status(400).json({ message: "Total Sales must be a non-negative number." });
    }

    if (!businessId || !month || !year) {
      return res.status(400).json({ message: "Business ID, month, and year are required." });
    }

    const business = await SalesBusiness.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Selected business not found." });
    }

    // Authorization check
    if (req.user.role === "manager") {
      const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
      const isAllowed = await SalesBusiness.findOne({ _id: businessId, ...authFilter });
      if (!isAllowed) {
        return res.status(403).json({ message: "Access denied: You are not authorized to add sales for this business." });
      }
    }

    const mNum = parseInt(month, 10);
    const yNum = parseInt(year, 10);
    if (!(mNum >= 1 && mNum <= 12)) {
      return res.status(400).json({ message: "Month must be between 1 and 12." });
    }
    if (!(yNum >= 2000 && yNum <= 2100)) {
      return res.status(400).json({ message: "Year must be between 2000 and 2100." });
    }

    const salesVal = Math.max(0, parseFloat(totalSales) || 0);
    const ordersVal = Math.max(0, parseInt(orders, 10) || 0);
    const targetVal = Math.max(0, parseFloat(target) || business.monthlyTarget || 0);

    const monthName = `${MONTH_NAMES[mNum - 1]} ${yNum}`;

    // Check duplicate
    const existing = await SalesRecord.findOne({ business: businessId, year: yNum, month: mNum });
    if (existing) {
      return res.status(400).json({
        message: `A record for ${business.name} in ${monthName} already exists. Please edit the existing record.`,
      });
    }

    const record = await SalesRecord.create({
      business: business._id,
      businessName: business.name,
      category: business.category,
      state: business.state,
      city: business.city,
      month: mNum,
      year: yNum,
      monthName,
      totalSales: salesVal,
      orders: ordersVal,
      target: targetVal,
      remarks: remarks ? String(remarks).trim() : "",
      salesBasis: salesBasis || "gross",
      ...fin,
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      source: "manual",
    });

    await audit({
      entityType: "SalesRecord",
      entityId: record._id,
      action: "SALES_RECORD_CREATED",
      actor: req.user,
      after: financialSnapshot(record),
      metadata: { business: record.business, monthName: record.monthName },
    });

    return res.status(201).json({ message: "Sales record created successfully.", record });
  } catch (error) {
    console.error("Create Record Error:", error);
    return res.status(500).json({ message: "Failed to create sales record." });
  }
};

exports.updateSalesRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await SalesRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Sales record not found." });
    }

    // Role authorization
    if (req.user.role === "manager") {
      const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
      const isAllowed = await SalesBusiness.findOne({ _id: record.business, ...authFilter });
      if (!isAllowed) {
        return res.status(403).json({ message: "Access denied: You cannot edit records for this business." });
      }
    }

    const before = financialSnapshot(record);
    if (req.body.totalSales !== undefined) {
      const n = Number(req.body.totalSales);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: "Total Sales must be a non-negative number." });
      record.totalSales = n;
    }
    if (req.body.orders !== undefined) record.orders = Math.max(0, parseInt(req.body.orders, 10) || 0);
    if (req.body.target !== undefined) record.target = Math.max(0, parseFloat(req.body.target) || 0);
    if (req.body.remarks !== undefined) record.remarks = String(req.body.remarks || "").trim();
    if (req.body.salesBasis !== undefined) {
      if (!["gross", "net"].includes(req.body.salesBasis)) return res.status(400).json({ message: "salesBasis must be 'gross' or 'net'." });
      record.salesBasis = req.body.salesBasis;
    }
    for (const [key, label] of [["discount", "Discount"], ["cost", "Cost"], ["expenses", "Expenses"]]) {
      const r = optionalAmount(req.body[key], label);
      if (r.error) return res.status(400).json({ message: r.error });
      if (!r.skip) record[key] = r.value;
    }
    if (record.salesBasis === "gross" && typeof record.discount === "number" && record.discount > record.totalSales) {
      return res.status(400).json({ message: "Discount cannot exceed gross Total Sales. If sales are already net of discounts, set Sales Basis to Net." });
    }

    await record.save();

    await audit({
      entityType: "SalesRecord",
      entityId: record._id,
      action: "SALES_RECORD_UPDATED",
      actor: req.user,
      before,
      after: financialSnapshot(record),
      metadata: { business: record.business, monthName: record.monthName },
    });

    return res.json({ message: "Sales record updated successfully.", record });
  } catch (error) {
    console.error("Update Record Error:", error);
    return res.status(500).json({ message: "Failed to update sales record." });
  }
};

exports.deleteSalesRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await SalesRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Sales record not found." });
    }

    if (req.user.role === "manager") {
      const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
      const isAllowed = await SalesBusiness.findOne({ _id: record.business, ...authFilter });
      if (!isAllowed) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    await SalesRecord.findByIdAndDelete(id);
    await audit({
      entityType: "SalesRecord",
      entityId: record._id,
      action: "SALES_RECORD_DELETED",
      actor: req.user,
      before: { ...financialSnapshot(record), business: record.business, monthName: record.monthName },
    });
    return res.json({ message: "Sales record deleted successfully." });
  } catch (error) {
    console.error("Delete Record Error:", error);
    return res.status(500).json({ message: "Failed to delete sales record." });
  }
};

// =========================================================================
// 4. EXCEL/CSV IMPORT
// Preview / commit / template now live in controllers/salesImportController.js
// (header detection, column mapping, row-level errors, transactional commit).
// =========================================================================

// =========================================================================
// 5. EXPORT REPORTS
// =========================================================================

/**
 * Exports permitted sales records into a clean formatted .xlsx workbook
 */
exports.exportSalesExcel = async (req, res) => {
  try {
    if (req.user.role === "manager") {
      const userDoc = await User.findById(req.user._id);
      const allowedCities = [userDoc?.assignedCity, ...(userDoc?.assignedCities || [])]
        .filter(Boolean)
        .map((c) => c.toLowerCase().trim());

      if (req.query.city && req.query.city !== "All" && req.query.city.trim() !== "") {
        if (!allowedCities.includes(req.query.city.toLowerCase().trim())) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to export sales data for "${req.query.city}".`,
          });
        }
      }

      if (req.query.state && req.query.state !== "All" && userDoc?.assignedState) {
        if (req.query.state.toLowerCase().trim() !== userDoc.assignedState.toLowerCase().trim()) {
          return res.status(403).json({
            message: `Access denied. You are not authorized to export sales data for "${req.query.state}".`,
          });
        }
      }
    }

    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const businesses = await SalesBusiness.find(authFilter);
    const businessIds = businesses.map((b) => b._id);

    const filter = { business: { $in: businessIds } };
    if (req.query.year) filter.year = parseInt(req.query.year, 10);
    if (req.query.month) filter.month = parseInt(req.query.month, 10);
    if (req.query.city && req.query.city !== "All") filter.city = req.query.city.trim();
    if (req.query.state && req.query.state !== "All") filter.state = req.query.state.trim();

    const records = await SalesRecord.find(filter)
      .sort({ state: 1, city: 1, year: -1, month: -1 })
      .populate("business", "code category");

    const exportData = records.map((r, i) => ({
      "S.No": i + 1,
      Month: r.monthName,
      State: r.state,
      City: r.city,
      Category: r.category,
      "Business Name": r.businessName,
      "Total Sales (INR)": r.totalSales,
      Orders: r.orders,
      "Target (INR)": r.target,
      "Achievement %": r.target > 0 ? `${((r.totalSales / r.target) * 100).toFixed(1)}%` : "N/A",
      "Sales Basis": r.salesBasis === "net" ? "Net" : "Gross",
      "Discount (INR)": typeof r.discount === "number" ? r.discount : "Not recorded",
      "Cost (INR)": typeof r.cost === "number" ? r.cost : "Not recorded",
      "Expenses (INR)": typeof r.expenses === "number" ? r.expenses : "Not recorded",
      Remarks: r.remarks,
      "Uploader": r.uploaderName || "System",
      Source: r.source === "excel_upload" ? "Excel Import" : "Manual Entry",
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(exportData);
    xlsx.utils.book_append_sheet(wb, ws, "Sales Report");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="ESG_Sales_Report.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (error) {
    console.error("Export Error:", error);
    return res.status(500).json({ message: "Failed to export sales report." });
  }
};

/**
 * Helper to fetch distinct states and cities available, combining dynamic SalesLocations and businesses
 */
exports.getLocations = async (req, res) => {
  try {
    const dbLocations = await SalesLocation.find({}).sort({ state: 1, city: 1 });
    const businesses = await SalesBusiness.find({});

    const locMap = new Map();
    dbLocations.forEach((l) => {
      locMap.set(`${l.city.trim()}___${l.state.trim()}`, {
        city: l.city.trim(),
        state: l.state.trim(),
        isDefault: l.isDefault || false,
      });
    });

    businesses.forEach((b) => {
      if (b.city && b.state) {
        const key = `${b.city.trim()}___${b.state.trim()}`;
        if (!locMap.has(key)) {
          locMap.set(key, {
            city: b.city.trim(),
            state: b.state.trim(),
            isDefault: false,
          });
        }
      }
    });

    const locations = Array.from(locMap.values());
    const states = [...new Set(locations.map((l) => l.state))].sort();
    const cities = [...new Set(locations.map((l) => l.city))].sort();

    return res.json({ locations, states, cities });
  } catch (error) {
    console.error("Locations Error:", error);
    return res.status(500).json({ message: "Failed to fetch locations." });
  }
};

/**
 * Admin: Dynamically adds a new state and city location without changing source code
 */
exports.createLocation = async (req, res) => {
  try {
    const { city, state } = req.body;
    if (!city || !state) {
      return res.status(400).json({ message: "Both City and State are required." });
    }

    const trimCity = city.trim();
    const trimState = state.trim();

    const location = await SalesLocation.findOneAndUpdate(
      { city: new RegExp(`^${trimCity}$`, "i"), state: new RegExp(`^${trimState}$`, "i") },
      { city: trimCity, state: trimState, createdBy: req.user._id, isDefault: false },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: `Location "${trimCity}, ${trimState}" added successfully.`,
      location,
    });
  } catch (error) {
    console.error("Create Location Error:", error);
    return res.status(500).json({ message: "Failed to save location." });
  }
};
