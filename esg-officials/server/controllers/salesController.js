const xlsx = require("xlsx");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const User = require("../models/User");

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

/**
 * Resolves a manager's authorized businesses filter
 */
async function getManagerAuthorizedBusinessQuery(user) {
  if (user.role === "admin") {
    return {}; // Admin has access to all businesses
  }

  const userDoc = await User.findById(user._id);
  const managerCities = [
    userDoc?.assignedCity,
    ...(userDoc?.assignedCities || []),
  ].filter(Boolean);

  const managerStates = [
    userDoc?.assignedState,
    ...(userDoc?.assignedStates || []),
  ].filter(Boolean);

  const orConditions = [
    { assignedManager: user._id },
  ];

  if (managerCities.length > 0) {
    orConditions.push({ city: { $in: managerCities } });
  }

  if (managerStates.length > 0) {
    orConditions.push({ state: { $in: managerStates } });
  }

  return { $or: orConditions };
}

// =========================================================================
// 1. DASHBOARD & REGIONAL PERFORMANCE
// =========================================================================
exports.getSalesDashboard = async (req, res) => {
  try {
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);

    // Filter by query parameters if provided
    const queryFilter = { ...authFilter };
    if (req.query.state) queryFilter.state = req.query.state.trim();
    if (req.query.city) queryFilter.city = req.query.city.trim();
    if (req.query.category) queryFilter.category = req.query.category.trim();

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

    return res.json({
      managerInfo: {
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        assignedStates: uniqueStates,
        assignedCities: uniqueCities,
        primaryState: uniqueStates[0] || "Jharkhand",
        primaryCity: uniqueCities[0] || "Ranchi",
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
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const filter = { ...authFilter };

    if (req.query.state) filter.state = req.query.state.trim();
    if (req.query.city) filter.city = req.query.city.trim();
    if (req.query.category) filter.category = req.query.category.trim();
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search.trim(), $options: "i" } },
        { code: { $regex: req.query.search.trim(), $options: "i" } },
      ];
    }

    const businesses = await SalesBusiness.find(filter)
      .populate("assignedManager", "name email phone")
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
      createdBy: req.user._id,
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

    const fields = ["name", "category", "state", "city", "address", "phone", "email", "monthlyTarget", "notes", "assignedManager", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        business[f] = req.body[f];
      }
    });

    await business.save();

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

    await SalesBusiness.findByIdAndDelete(id);
    await SalesRecord.deleteMany({ business: id });

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

    if (req.query.businessId) filter.business = req.query.businessId;
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
    const { businessId, month, year, totalSales, orders, target, remarks } = req.body;

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
    if (mNum < 1 || mNum > 12) {
      return res.status(400).json({ message: "Month must be between 1 and 12." });
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
      remarks: remarks ? remarks.trim() : "",
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      source: "manual",
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

    if (req.body.totalSales !== undefined) record.totalSales = Math.max(0, parseFloat(req.body.totalSales) || 0);
    if (req.body.orders !== undefined) record.orders = Math.max(0, parseInt(req.body.orders, 10) || 0);
    if (req.body.target !== undefined) record.target = Math.max(0, parseFloat(req.body.target) || 0);
    if (req.body.remarks !== undefined) record.remarks = req.body.remarks.trim();

    await record.save();

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
    return res.json({ message: "Sales record deleted successfully." });
  } catch (error) {
    console.error("Delete Record Error:", error);
    return res.status(500).json({ message: "Failed to delete sales record." });
  }
};

// =========================================================================
// 4. EXCEL/CSV IMPORT & PREVIEW WORKFLOW
// =========================================================================

/**
 * Step 1: Previews uploaded file, validates rows against schema, business existence & manager authorization.
 */
exports.previewSalesExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No file uploaded. Please upload a valid .xlsx, .xls, or .csv file." });
    }

    // Read Workbook buffer
    let workbook;
    try {
      workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    } catch (parseErr) {
      return res.status(400).json({ message: "Invalid Excel/CSV format. Unable to parse workbook." });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ message: "The uploaded workbook does not contain any sheets." });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (rawRows.length === 0) {
      return res.status(400).json({ message: "The uploaded worksheet is empty." });
    }

    // Fetch user's authorized businesses for validation
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const authorizedBusinesses = await SalesBusiness.find(authFilter);
    const allBusinesses = await SalesBusiness.find({});

    const validRows = [];
    const invalidRows = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // Row 1 is header

      // Extract columns with case-insensitive normalization
      const getCol = (names) => {
        for (const key of Object.keys(row)) {
          const cleanKey = key.trim().toLowerCase();
          if (names.includes(cleanKey)) {
            return String(row[key]).trim();
          }
        }
        return "";
      };

      const rawMonth = getCol(["month", "period", "month year", "date"]);
      const rawState = getCol(["state", "region"]);
      const rawCity = getCol(["city", "location", "town"]);
      const rawBusinessName = getCol(["business name", "hotel/restaurant", "hotel", "restaurant", "business", "name"]);
      const rawSales = getCol(["total sales", "sales", "revenue", "monthly sales", "gross sales"]);
      const rawOrders = getCol(["orders", "order count", "transactions", "no of orders"]);
      const rawTarget = getCol(["target", "monthly target", "sales target"]);
      const rawRemarks = getCol(["remarks", "notes", "comment", "comments"]);

      const errors = [];

      // 1. Month validation
      const parsedMY = parseMonthYear(rawMonth);
      if (!parsedMY) {
        errors.push("Invalid or missing Month (expected e.g. 'September 2026', '2026-09')");
      }

      // 2. Business name validation
      if (!rawBusinessName) {
        errors.push("Missing Business Name");
      }

      // Check if business exists in system
      let matchedBiz = null;
      if (rawBusinessName) {
        matchedBiz = allBusinesses.find(
          (b) => b.name.toLowerCase() === rawBusinessName.toLowerCase() &&
                 (!rawCity || b.city.toLowerCase() === rawCity.toLowerCase())
        );

        if (!matchedBiz) {
          matchedBiz = allBusinesses.find((b) => b.name.toLowerCase() === rawBusinessName.toLowerCase());
        }

        if (!matchedBiz) {
          errors.push(`Business "${rawBusinessName}" does not exist in database.`);
        }
      }

      // 3. Manager permission check
      if (matchedBiz && req.user.role === "manager") {
        const isAuthorized = authorizedBusinesses.some((b) => b._id.toString() === matchedBiz._id.toString());
        if (!isAuthorized) {
          errors.push(`Unauthorized: You are not assigned to manage "${matchedBiz.name}" in ${matchedBiz.city}, ${matchedBiz.state}.`);
        }
      }

      // 4. Sales amount validation
      const cleanSales = rawSales.replace(/[^0-9.-]+/g, "");
      const numSales = parseFloat(cleanSales);
      if (isNaN(numSales) || numSales < 0) {
        errors.push("Invalid Total Sales (must be a positive number)");
      }

      // 5. Orders validation
      const cleanOrders = rawOrders.replace(/[^0-9.-]+/g, "");
      const numOrders = cleanOrders ? parseInt(cleanOrders, 10) : 0;
      if (isNaN(numOrders) || numOrders < 0) {
        errors.push("Orders must be a valid non-negative number");
      }

      // 6. Target validation
      const cleanTarget = rawTarget.replace(/[^0-9.-]+/g, "");
      const numTarget = cleanTarget ? parseFloat(cleanTarget) : (matchedBiz ? matchedBiz.monthlyTarget : 0);

      if (errors.length > 0) {
        invalidRows.push({
          rowNumber,
          businessName: rawBusinessName || "Unknown",
          state: rawState || (matchedBiz ? matchedBiz.state : "-"),
          city: rawCity || (matchedBiz ? matchedBiz.city : "-"),
          month: rawMonth || "-",
          totalSales: rawSales || "-",
          errors,
        });
      } else {
        validRows.push({
          rowNumber,
          businessId: matchedBiz._id,
          businessName: matchedBiz.name,
          category: matchedBiz.category,
          state: matchedBiz.state,
          city: matchedBiz.city,
          month: parsedMY.month,
          year: parsedMY.year,
          monthName: parsedMY.monthName,
          totalSales: numSales,
          orders: numOrders,
          target: numTarget,
          remarks: rawRemarks || "",
        });
      }
    });

    return res.json({
      filename: req.file.originalname,
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows,
    });
  } catch (error) {
    console.error("Preview Excel Error:", error);
    return res.status(500).json({ message: "Failed to process Excel file for preview." });
  }
};

/**
 * Step 2: Commits validated rows to the database with duplicate prevention & audit logging.
 */
exports.commitSalesExcel = async (req, res) => {
  try {
    const { rows, filename, updateExisting = true } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows provided to commit." });
    }

    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const authorizedBusinesses = await SalesBusiness.find(authFilter);
    const authBizIds = new Set(authorizedBusinesses.map((b) => b._id.toString()));

    let successCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalRevenue = 0;
    const errors = [];

    // Create Import Job audit record
    const importJob = await SalesImportJob.create({
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      filename: filename || "sales_import.xlsx",
      totalRows: rows.length,
    });

    for (const row of rows) {
      try {
        // Enforce authorization per row
        if (req.user.role === "manager" && !authBizIds.has(String(row.businessId))) {
          failedCount++;
          errors.push({
            rowNumber: row.rowNumber,
            businessName: row.businessName,
            month: row.monthName,
            reason: "Unauthorized business assignment.",
          });
          continue;
        }

        const existingRecord = await SalesRecord.findOne({
          business: row.businessId,
          year: row.year,
          month: row.month,
        });

        if (existingRecord) {
          if (updateExisting) {
            existingRecord.totalSales = row.totalSales;
            existingRecord.orders = row.orders;
            existingRecord.target = row.target;
            existingRecord.remarks = row.remarks || existingRecord.remarks;
            existingRecord.source = "excel_upload";
            existingRecord.importJob = importJob._id;
            existingRecord.uploadedBy = req.user._id;
            existingRecord.uploaderName = req.user.name;
            await existingRecord.save();
            updatedCount++;
            totalRevenue += row.totalSales;
          } else {
            skippedCount++;
          }
        } else {
          await SalesRecord.create({
            business: row.businessId,
            businessName: row.businessName,
            category: row.category,
            state: row.state,
            city: row.city,
            month: row.month,
            year: row.year,
            monthName: row.monthName,
            totalSales: row.totalSales,
            orders: row.orders,
            target: row.target,
            remarks: row.remarks || "",
            uploadedBy: req.user._id,
            uploaderName: req.user.name,
            source: "excel_upload",
            importJob: importJob._id,
          });
          successCount++;
          totalRevenue += row.totalSales;
        }
      } catch (rowErr) {
        failedCount++;
        errors.push({
          rowNumber: row.rowNumber,
          businessName: row.businessName,
          month: row.monthName,
          reason: rowErr.message,
        });
      }
    }

    // Update job audit summary
    importJob.successCount = successCount;
    importJob.updatedCount = updatedCount;
    importJob.failedCount = failedCount;
    importJob.totalRevenue = totalRevenue;
    importJob.status = failedCount === 0 ? "completed" : (successCount > 0 || updatedCount > 0 ? "partial" : "failed");
    importJob.errorLogs = errors;
    await importJob.save();

    return res.json({
      message: "Sales data imported successfully.",
      summary: {
        totalProcessed: rows.length,
        successCount,
        updatedCount,
        skippedCount,
        failedCount,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Commit Excel Error:", error);
    return res.status(500).json({ message: "Failed to commit imported sales data." });
  }
};

// =========================================================================
// 5. DOWNLOAD TEMPLATE & EXPORT REPORTS
// =========================================================================

/**
 * Downloads a ready-to-use .xlsx template with actual column headers and sample data
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const templateData = [
      {
        Month: "September 2026",
        State: "Jharkhand",
        City: "Ranchi",
        "Business Name": "Hotel Royal",
        "Total Sales": 250000,
        Orders: 120,
        Target: 300000,
        Remarks: "Good",
      },
      {
        Month: "September 2026",
        State: "Jharkhand",
        City: "Ranchi",
        "Business Name": "Maya Multicuisine Restaurant",
        "Total Sales": 180000,
        Orders: 95,
        Target: 200000,
        Remarks: "Improving",
      },
      {
        Month: "October 2026",
        State: "Jharkhand",
        City: "Ranchi",
        "Business Name": "Hotel Royal",
        "Total Sales": 280000,
        Orders: 135,
        Target: 300000,
        Remarks: "Good",
      },
      {
        Month: "October 2026",
        State: "Jharkhand",
        City: "Ranchi",
        "Business Name": "Hotel Green Horizon",
        "Total Sales": 345000,
        Orders: 155,
        Target: 350000,
        Remarks: "Near Target",
      },
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 18 }, // Month
      { wch: 16 }, // State
      { wch: 16 }, // City
      { wch: 32 }, // Business Name
      { wch: 14 }, // Total Sales
      { wch: 10 }, // Orders
      { wch: 14 }, // Target
      { wch: 22 }, // Remarks
    ];

    xlsx.utils.book_append_sheet(wb, ws, "Monthly Sales");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="ESG_Sales_Import_Template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (error) {
    console.error("Template Download Error:", error);
    return res.status(500).json({ message: "Failed to generate Excel template." });
  }
};

/**
 * Exports permitted sales records into a clean formatted .xlsx workbook
 */
exports.exportSalesExcel = async (req, res) => {
  try {
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const businesses = await SalesBusiness.find(authFilter);
    const businessIds = businesses.map((b) => b._id);

    const filter = { business: { $in: businessIds } };
    if (req.query.year) filter.year = parseInt(req.query.year, 10);
    if (req.query.month) filter.month = parseInt(req.query.month, 10);
    if (req.query.city) filter.city = req.query.city.trim();
    if (req.query.state) filter.state = req.query.state.trim();

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
 * Returns past upload history / audit logs
 */
exports.getImportHistory = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { uploadedBy: req.user._id };
    const history = await SalesImportJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("uploadedBy", "name email");

    return res.json(history);
  } catch (error) {
    console.error("Import History Error:", error);
    return res.status(500).json({ message: "Failed to fetch import history." });
  }
};

/**
 * Helper to fetch distinct states and cities available to the user
 */
exports.getLocations = async (req, res) => {
  try {
    const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
    const businesses = await SalesBusiness.find(authFilter);

    const states = [...new Set(businesses.map((b) => b.state))];
    const cities = [...new Set(businesses.map((b) => b.city))];

    return res.json({ states, cities });
  } catch (error) {
    console.error("Locations Error:", error);
    return res.status(500).json({ message: "Failed to fetch locations." });
  }
};
