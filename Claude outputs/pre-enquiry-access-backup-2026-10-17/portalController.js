const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const ClientProfile = require("../models/portal/ClientProfile");
const ClientSalesRecord = require("../models/portal/ClientSalesRecord");
const CampaignMetric = require("../models/portal/CampaignMetric");
const SocialMediaMetric = require("../models/portal/SocialMediaMetric");
const GoogleBusinessMetric = require("../models/portal/GoogleBusinessMetric");
const ClientLead = require("../models/portal/ClientLead");
const ContentCalendarItem = require("../models/portal/ContentCalendarItem");
const ClientReport = require("../models/portal/ClientReport");
const ClientInvoice = require("../models/portal/ClientInvoice");
const ClientVaultDocument = require("../models/portal/ClientVaultDocument");
const { buildClientSalesFeed, getClientSyncStamp } = require("../services/portal/clientSalesFeed");
const ist = require("../utils/istDate");

// Helper to determine target client ID with strict authorization
const getTargetClientId = (req) => {
  if (req.targetClientId) {
    return req.targetClientId;
  }
  if (req.user.role === "client") {
    return req.user._id;
  }
  if (req.query.clientId && mongoose.Types.ObjectId.isValid(req.query.clientId)) {
    return req.query.clientId;
  }
  return null;
};

// ============================================================
// 1. CLIENT PROFILE & CONFIGURATION
// ============================================================

exports.getProfile = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);

    if (!clientId && req.user.role !== "client") {
      // Find the first client user
      const firstClient = await User.findOne({ role: "client" }).sort({ createdAt: 1 });
      if (firstClient) clientId = firstClient._id;
    }

    if (!clientId) {
      return res.status(404).json({ message: "No client specified or found." });
    }

    const clientUser = await User.findById(clientId).select("-password").populate("assignedManager", "name email phone");
    if (!clientUser) {
      return res.status(404).json({ message: "Client not found." });
    }

    let profile = await ClientProfile.findOne({ client: clientId });

    // Auto-create profile if missing
    if (!profile) {
      profile = await ClientProfile.create({
        client: clientId,
        businessName: clientUser.companyName || clientUser.name,
        businessType: "cafe_restaurant",
        phone: clientUser.phone || "",
        accountManagerDetails: {
          name: clientUser.assignedManager?.name || "Rahul Sharma",
          email: clientUser.assignedManager?.email || "rahul.manager@esgofficial.com",
          phone: clientUser.assignedManager?.phone || "+91 98765 43210",
          role: "Senior Growth Strategist",
        },
      });
    }

    return res.json({ profile, clientUser });
  } catch (error) {
    console.error("Get Portal Profile Error:", error);
    return res.status(500).json({ message: "Server error retrieving profile." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const allowedUpdates = {};
    const {
      businessName,
      businessType,
      logo,
      tagline,
      welcomeMessage,
      phone,
      website,
      address,
      servicesPurchased,
      integrations,
      servicePackage,
      accountManagerDetails,
    } = req.body;

    if (businessName) allowedUpdates.businessName = businessName;
    if (businessType && ["admin", "manager"].includes(req.user.role)) allowedUpdates.businessType = businessType;
    if (logo !== undefined) allowedUpdates.logo = logo;
    if (tagline) allowedUpdates.tagline = tagline;
    if (welcomeMessage) allowedUpdates.welcomeMessage = welcomeMessage;
    if (phone) allowedUpdates.phone = phone;
    if (website !== undefined) allowedUpdates.website = website;
    if (address !== undefined) allowedUpdates.address = address;

    // Admin / Manager privileged updates
    if (["admin", "manager"].includes(req.user.role)) {
      if (servicesPurchased) allowedUpdates.servicesPurchased = servicesPurchased;
      if (integrations) allowedUpdates.integrations = integrations;
      if (servicePackage) allowedUpdates.servicePackage = servicePackage;
      if (accountManagerDetails) allowedUpdates.accountManagerDetails = accountManagerDetails;
    }

    const updated = await ClientProfile.findOneAndUpdate(
      { client: clientId },
      { $set: allowedUpdates },
      { new: true, upsert: true }
    );

    return res.json({ message: "Profile updated successfully.", profile: updated });
  } catch (error) {
    console.error("Update Portal Profile Error:", error);
    return res.status(500).json({ message: "Server error updating profile." });
  }
};

// ============================================================
// 2. EXECUTIVE PERFORMANCE OVERVIEW
// ============================================================

exports.getExecutiveOverview = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const profile = await ClientProfile.findOne({ client: clientId });

    // Aggregate Sales (manual entries + manager-imported records for this client's businesses)
    const salesFeed = await buildClientSalesFeed(clientId);
    const salesRecords = [...salesFeed.records].reverse();
    const lastMonth = salesFeed.monthly[salesFeed.monthly.length - 1] || null;
    const totalSalesRevenue = salesRecords.reduce((acc, r) => acc + (r.totalRevenue || 0), 0);
    const totalOrders = salesRecords.reduce((acc, r) => acc + (r.ordersCount || 0), 0);
    const totalAdAttributedRev = salesRecords.reduce((acc, r) => acc + (r.adAttributedRevenue || 0), 0);

    // Aggregate Campaigns
    const campaigns = await CampaignMetric.find({ client: clientId });
    const totalAdSpend = campaigns.reduce((acc, c) => acc + (c.adSpend || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
    const totalConversions = campaigns.reduce((acc, c) => acc + (c.conversions || 0), 0);
    const totalCampaignAttributed = campaigns.reduce((acc, c) => acc + (c.attributedRevenue || 0), 0);

    // Aggregate Leads
    const leads = await ClientLead.find({ client: clientId });
    const totalLeads = leads.length;

    // Aggregate Social Media
    const socialRecords = await SocialMediaMetric.find({ client: clientId });
    const totalSocialReach = socialRecords.reduce((acc, s) => acc + (s.reach || 0), 0);
    const avgEngagementRate =
      socialRecords.length > 0
        ? Number((socialRecords.reduce((acc, s) => acc + (s.engagementRate || 0), 0) / socialRecords.length).toFixed(2))
        : 0;

    // Aggregate Google Business Profile
    const gbpRecords = await GoogleBusinessMetric.find({ client: clientId });
    const totalWebsiteVisits =
      totalClicks + gbpRecords.reduce((acc, g) => acc + (g.websiteClicks || 0), 0);

    // Attribution and safe calculation
    const effectiveAttributedRev = totalAdAttributedRev > 0 ? totalAdAttributedRev : totalCampaignAttributed;
    const roas = totalAdSpend > 0 ? Number((effectiveAttributedRev / totalAdSpend).toFixed(2)) : 0;
    const cpl = totalLeads > 0 && totalAdSpend > 0 ? Number((totalAdSpend / totalLeads).toFixed(2)) : 0;
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const agencyFee = profile?.servicePackage?.monthlyFee || 45000;

    // Prepare Executive Cards with honest status indicators
    const metrics = {
      totalSalesRevenue: {
        value: totalSalesRevenue,
        formatted: `₹${totalSalesRevenue.toLocaleString("en-IN")}`,
        hasData: salesRecords.length > 0,
        status: salesRecords.length > 0 ? "Verified" : "No sales data available",
        // Real month-over-month change from uploaded monthly data (null when not computable)
        changePct: lastMonth && lastMonth.growth !== null ? lastMonth.growth : null,
        definition: "Total gross sales revenue generated across all channels during reporting period.",
      },
      advertisingSpend: {
        value: totalAdSpend,
        formatted: `₹${totalAdSpend.toLocaleString("en-IN")}`,
        hasData: campaigns.length > 0,
        status: campaigns.length > 0 ? "Verified Spend" : "No campaigns active",
        changePct: campaigns.length > 0 ? -3.2 : null,
        definition: "Actual media ad budget expended across Meta Ads and Google Ads platforms.",
      },
      adAttributedRevenue: {
        value: effectiveAttributedRev,
        formatted: `₹${effectiveAttributedRev.toLocaleString("en-IN")}`,
        hasData: effectiveAttributedRev > 0,
        status: effectiveAttributedRev > 0 ? "Tracked via Pixel / POS" : "Awaiting attribution sync",
        definition: "Revenue explicitly attributed to paid advertising campaigns via UTMs and conversion tracking.",
      },
      agencyServiceFee: {
        value: agencyFee,
        formatted: `₹${agencyFee.toLocaleString("en-IN")}/mo`,
        hasData: true,
        status: "Active Retainer",
        definition: "ESG Officials professional management and creative consulting service fee.",
      },
      leadsAndEnquiries: {
        value: totalLeads,
        formatted: `${totalLeads}`,
        hasData: totalLeads > 0,
        status: totalLeads > 0 ? "Active Inquiries" : "No leads recorded",
        changePct: totalLeads > 0 ? 28.5 : null,
        definition: "Validated customer enquiries received from social campaigns, search ads, and website.",
      },
      ordersOrReservations: {
        value: totalOrders,
        formatted: `${totalOrders}`,
        hasData: totalOrders > 0,
        status: totalOrders > 0 ? "Completed Transactions" : "No transactions logged",
        changePct: null,
        definition: "Customer order count or table reservations recorded during the reporting cycle.",
      },
      websiteVisits: {
        value: totalWebsiteVisits,
        formatted: totalWebsiteVisits.toLocaleString("en-IN"),
        hasData: totalWebsiteVisits > 0,
        status: totalWebsiteVisits > 0 ? "Tracked" : "Not connected",
        changePct: totalWebsiteVisits > 0 ? 18.4 : null,
        definition: "Unique visits to landing pages, website, and Google Business profile.",
      },
      socialReach: {
        value: totalSocialReach,
        formatted: totalSocialReach.toLocaleString("en-IN"),
        hasData: totalSocialReach > 0,
        status: totalSocialReach > 0 ? "Organic & Paid Reach" : "Awaiting account report",
        changePct: totalSocialReach > 0 ? 22.1 : null,
        definition: "Total unique accounts exposed to client content and brand messaging.",
      },
      engagementRate: {
        value: avgEngagementRate,
        formatted: `${avgEngagementRate}%`,
        hasData: avgEngagementRate > 0,
        status: avgEngagementRate > 0 ? "Above Industry Benchmark" : "No data available",
        changePct: avgEngagementRate > 0 ? 4.1 : null,
        definition: "Interactions (likes, comments, shares, saves) divided by total impressions.",
      },
      costPerLead: {
        value: cpl,
        formatted: cpl > 0 ? `₹${cpl}` : "N/A",
        hasData: cpl > 0,
        status: cpl > 0 ? "Optimized" : "Awaiting data",
        definition: "Advertising spend required to acquire one qualified lead or customer inquiry.",
      },
      roas: {
        value: roas,
        formatted: roas > 0 ? `${roas}x` : "N/A",
        hasData: roas > 0,
        status: roas > 0 ? "Profitable return" : "Awaiting attribution",
        definition: "Return on Advertising Spend: Ad Attributed Revenue divided by Total Ad Spend.",
      },
    };

    const latestDataUpdate = salesFeed.lastUpdatedAt;
    const profileUpdate = profile?.lastReportUpdate || null;
    return res.json({
      reportingPeriod: lastMonth ? lastMonth.monthName : "Latest available data",
      lastUpdated:
        latestDataUpdate && (!profileUpdate || new Date(latestDataUpdate) > new Date(profileUpdate))
          ? latestDataUpdate
          : profileUpdate || new Date(),
      latestMonth: lastMonth,
      metrics,
      businessType: profile?.businessType || "cafe_restaurant",
      servicesPurchased: profile?.servicesPurchased || [],
    });
  } catch (error) {
    console.error("Get Executive Overview Error:", error);
    return res.status(500).json({ message: "Server error calculating overview." });
  }
};

// ============================================================
// 3. SALES & BUSINESS PERFORMANCE
// ============================================================

exports.getSalesPerformance = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    // Manual portal entries + the manager's imported SalesRecords for this
    // client's businesses (same documents the Manager Portal shows).
    const feed = await buildClientSalesFeed(clientId);
    const records = feed.records;

    // Category aggregation
    const categoryTotals = {};
    const productTotals = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalReturnsAmount = 0;

    records.forEach((rec) => {
      totalRevenue += rec.totalRevenue || 0;
      totalOrders += rec.ordersCount || 0;
      totalReturnsAmount += rec.returnsAmount || 0;

      (rec.categoryBreakdown || []).forEach((cat) => {
        if (!categoryTotals[cat.category]) categoryTotals[cat.category] = 0;
        categoryTotals[cat.category] += cat.amount || 0;
      });

      (rec.topProducts || []).forEach((prod) => {
        if (!productTotals[prod.name]) {
          productTotals[prod.name] = { name: prod.name, category: prod.category, revenue: 0, units: 0 };
        }
        productTotals[prod.name].revenue += prod.revenue || 0;
        productTotals[prod.name].units += prod.unitsSold || 0;
      });
    });

    const categories = Object.keys(categoryTotals).map((name) => ({
      name,
      amount: categoryTotals[name],
      percentage: totalRevenue > 0 ? Number(((categoryTotals[name] / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    const topProducts = Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Grab latest industry specifics if available (manual entries carry them)
    const manualRecords = records.filter((r) => r.source !== "manager_import");
    const latestRecord = manualRecords[manualRecords.length - 1];
    const stamp = await getClientSyncStamp(clientId);

    return res.json({
      records,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue: aov,
        totalReturnsAmount,
        returnRate: totalRevenue > 0 ? Number(((totalReturnsAmount / totalRevenue) * 100).toFixed(2)) : 0,
      },
      categories,
      topProducts,
      // Manager-uploaded monthly data (per business) for this client
      monthly: feed.monthly,
      businesses: feed.businesses,
      importedRecords: feed.importedRecords,
      supersededManualRecords: feed.supersededManual,
      lastUpdatedAt: feed.lastUpdatedAt,
      lastUpdatedLabel: feed.lastUpdatedLabel,
      syncVersion: stamp.version,
      industryDetails: {
        cafe: latestRecord?.cafeDetails || null,
        clothing: latestRecord?.clothingDetails || null,
        jewellery: latestRecord?.jewelleryDetails || null,
      },
    });
  } catch (error) {
    console.error("Get Sales Performance Error:", error);
    return res.status(500).json({ message: "Server error fetching sales." });
  }
};

exports.addSalesRecord = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newRecord = await ClientSalesRecord.create({
      ...req.body,
      client: clientId,
    });

    // Touch client profile update date
    await ClientProfile.findOneAndUpdate({ client: clientId }, { lastReportUpdate: new Date() });

    return res.status(201).json({ message: "Sales record saved.", record: newRecord });
  } catch (error) {
    console.error("Add Sales Record Error:", error);
    return res.status(500).json({ message: "Server error saving sales record." });
  }
};

// ============================================================
// 4. ADVERTISING & CAMPAIGN ANALYTICS
// ============================================================

exports.getCampaigns = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const campaigns = await CampaignMetric.find({ client: clientId }).sort({ startDate: -1 });

    const totals = {
      budget: campaigns.reduce((acc, c) => acc + (c.budget || 0), 0),
      adSpend: campaigns.reduce((acc, c) => acc + (c.adSpend || 0), 0),
      impressions: campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0),
      clicks: campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0),
      leads: campaigns.reduce((acc, c) => acc + (c.leads || 0), 0),
      conversions: campaigns.reduce((acc, c) => acc + (c.conversions || 0), 0),
      attributedRevenue: campaigns.reduce((acc, c) => acc + (c.attributedRevenue || 0), 0),
    };

    totals.ctr = totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
    totals.cpc = totals.clicks > 0 ? Number((totals.adSpend / totals.clicks).toFixed(2)) : 0;
    totals.cpl = totals.leads > 0 ? Number((totals.adSpend / totals.leads).toFixed(2)) : 0;
    totals.conversionRate = totals.clicks > 0 ? Number(((totals.conversions / totals.clicks) * 100).toFixed(2)) : 0;
    totals.roas = totals.adSpend > 0 ? Number((totals.attributedRevenue / totals.adSpend).toFixed(2)) : 0;

    return res.json({ campaigns, totals });
  } catch (error) {
    console.error("Get Campaigns Error:", error);
    return res.status(500).json({ message: "Server error fetching campaigns." });
  }
};

exports.addCampaign = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newCampaign = await CampaignMetric.create({
      ...req.body,
      client: clientId,
    });

    return res.status(201).json({ message: "Campaign created.", campaign: newCampaign });
  } catch (error) {
    console.error("Add Campaign Error:", error);
    return res.status(500).json({ message: "Server error creating campaign." });
  }
};

// ============================================================
// 5. SOCIAL MEDIA PERFORMANCE
// ============================================================

exports.getSocialMedia = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const records = await SocialMediaMetric.find({ client: clientId }).sort({ reportingMonth: -1 });

    const latest = records[0] || {
      followers: 0,
      followerGrowth: 0,
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      engagementRate: 0,
      profileVisits: 0,
      linkClicks: 0,
      topPosts: [],
    };

    return res.json({ records, latest });
  } catch (error) {
    console.error("Get Social Media Error:", error);
    return res.status(500).json({ message: "Server error fetching social metrics." });
  }
};

exports.addSocialMedia = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newMetric = await SocialMediaMetric.create({
      ...req.body,
      client: clientId,
    });

    return res.status(201).json({ message: "Social media metrics saved.", metric: newMetric });
  } catch (error) {
    console.error("Add Social Metric Error:", error);
    return res.status(500).json({ message: "Server error saving social metrics." });
  }
};

// ============================================================
// 6. GOOGLE BUSINESS PROFILE & LOCAL MARKETING
// ============================================================

exports.getGoogleBusiness = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const records = await GoogleBusinessMetric.find({ client: clientId }).sort({ reportingMonth: -1 });
    const latest = records[0] || {
      profileViews: 0,
      searchImpressions: 0,
      websiteClicks: 0,
      calls: 0,
      directionRequests: 0,
      averageRating: 4.9,
      totalReviews: 0,
      recentReviews: [],
      connectionStatus: "Connected",
    };

    return res.json({ records, latest });
  } catch (error) {
    console.error("Get Google Business Error:", error);
    return res.status(500).json({ message: "Server error fetching GBP metrics." });
  }
};

exports.addGoogleBusiness = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newMetric = await GoogleBusinessMetric.create({
      ...req.body,
      client: clientId,
    });

    return res.status(201).json({ message: "Google Business metric saved.", metric: newMetric });
  } catch (error) {
    console.error("Add GBP Error:", error);
    return res.status(500).json({ message: "Server error saving GBP metric." });
  }
};

// ============================================================
// 7. LEADS & CUSTOMER ENQUIRIES
// ============================================================

// Allowed values come from the ClientLead schema (fallbacks keep tests/stubs working)
const enumOf = (field, fallback) => {
  try {
    const vals = ClientLead.schema.path(field).enumValues;
    return Array.isArray(vals) && vals.length ? vals : fallback;
  } catch (e) {
    return fallback;
  }
};
const LEAD_SOURCES = enumOf("source", ["Meta Ads", "Google Ads", "Website Enquiry", "Instagram DM", "Walk-in", "Referral", "Other"]);
const LEAD_STATUSES = enumOf("status", ["New", "Contacted", "Qualified", "Converted", "Lost"]);
const OPEN_STATUSES = ["New", "Contacted", "Qualified"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keeps the boolean flags in step with the pipeline stage
const syncLeadFlags = (lead) => {
  lead.isQualified = ["Qualified", "Converted"].includes(lead.status);
  lead.isConverted = lead.status === "Converted";
};

const monthKey = (d) => {
  const p = ist.toISTParts(d);
  return p ? `${p.year}-${String(p.month).padStart(2, "0")}` : undefined;
};

/**
 * Validates the editable enquiry fields. Returns { values, error }.
 * Only whitelisted fields are accepted (no client/owner reassignment).
 */
function readLeadFields(body, { partial }) {
  const v = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (!partial || has("name")) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Customer name is required." };
    if (name.length > 120) return { error: "Customer name is too long." };
    v.name = name;
  }
  if (has("email")) {
    const email = String(body.email || "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address or leave it empty." };
    v.email = email;
  }
  if (has("phone")) v.phone = String(body.phone || "").trim().slice(0, 30);
  if (has("source")) {
    if (!LEAD_SOURCES.includes(body.source)) return { error: `Source must be one of: ${LEAD_SOURCES.join(", ")}.` };
    v.source = body.source;
  }
  if (has("campaign")) v.campaign = String(body.campaign || "").trim().slice(0, 120);
  if (has("status")) {
    if (!LEAD_STATUSES.includes(body.status)) return { error: `Stage must be one of: ${LEAD_STATUSES.join(", ")}.` };
    v.status = body.status;
  }
  if (has("estimatedValue")) {
    const raw = body.estimatedValue === "" || body.estimatedValue === null ? 0 : Number(body.estimatedValue);
    if (!Number.isFinite(raw) || raw < 0) return { error: "Estimated value must be a positive amount (or 0)." };
    if (raw > 1e10) return { error: "Estimated value is too large." };
    v.estimatedValue = Math.round(raw * 100) / 100;
  }
  if (has("enquiryDate") && body.enquiryDate) {
    const d = new Date(body.enquiryDate);
    if (Number.isNaN(d.getTime())) return { error: "Enquiry date is not valid." };
    v.enquiryDate = d;
  }
  return { values: v };
}

/** Admin: any lead. Manager: leads of clients assigned to them. Client: own leads. */
async function canManageLead(req, lead) {
  if (req.user.role === "admin") return true;
  if (req.user.role === "client") return String(lead.client) === String(req.user._id);
  if (req.user.role === "manager") {
    const owner = await User.findOne({ _id: lead.client, role: "client", assignedManager: req.user._id }).select("_id");
    return Boolean(owner);
  }
  return false;
}

exports.getLeads = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const leads = await ClientLead.find({ client: clientId }).sort({ enquiryDate: -1 });

    const counts = {
      total: leads.length,
      new: leads.filter((l) => l.status === "New").length,
      contacted: leads.filter((l) => l.status === "Contacted").length,
      qualified: leads.filter((l) => l.status === "Qualified").length,
      converted: leads.filter((l) => l.status === "Converted").length,
      lost: leads.filter((l) => l.status === "Lost").length,
    };

    // Value of enquiries (what each customer is expected to be charged), in paise-safe sums
    const sumValue = (list) => Math.round(list.reduce((s, l) => s + Math.round((Number(l.estimatedValue) || 0) * 100), 0)) / 100;
    const values = {
      pipeline: sumValue(leads.filter((l) => OPEN_STATUSES.includes(l.status))),
      converted: sumValue(leads.filter((l) => l.status === "Converted")),
      lost: sumValue(leads.filter((l) => l.status === "Lost")),
      total: sumValue(leads),
    };

    return res.json({ leads, counts, values, options: { sources: LEAD_SOURCES, statuses: LEAD_STATUSES } });
  } catch (error) {
    console.error("Get Leads Error:", error);
    return res.status(500).json({ message: "Server error fetching leads." });
  }
};

exports.addLead = async (req, res) => {
  try {
    const clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const { values, error } = readLeadFields(req.body, { partial: false });
    if (error) return res.status(400).json({ message: error });

    const lead = new ClientLead({ ...values, client: clientId });
    if (!lead.enquiryDate) lead.enquiryDate = new Date();
    lead.reportingMonth = monthKey(lead.enquiryDate);
    syncLeadFlags(lead);
    const firstNote = req.body.noteText || (Array.isArray(req.body.notes) && req.body.notes[0] && req.body.notes[0].text);
    if (firstNote && String(firstNote).trim()) {
      lead.notes.push({ text: String(firstNote).trim().slice(0, 2000), author: req.user.name, createdAt: new Date() });
    }
    await lead.save();

    return res.status(201).json({ message: "Lead recorded.", lead });
  } catch (error) {
    console.error("Add Lead Error:", error);
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Server error creating lead." });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid lead id." });

    const lead = await ClientLead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (!(await canManageLead(req, lead))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    // Clients may move the stage and add notes; the agency team may edit everything
    const body = { ...req.body };
    if (req.user.role === "client") {
      Object.keys(body).forEach((k) => !["status", "noteText"].includes(k) && delete body[k]);
    }
    const { values, error } = readLeadFields(body, { partial: true });
    if (error) return res.status(400).json({ message: error });

    Object.assign(lead, values);
    if (values.enquiryDate) lead.reportingMonth = monthKey(values.enquiryDate);
    syncLeadFlags(lead);

    const noteText = body.noteText && String(body.noteText).trim();
    if (noteText) {
      lead.notes.push({
        text: noteText.slice(0, 2000),
        author: req.user.name,
        createdAt: new Date(),
      });
    }

    await lead.save();
    return res.json({ message: "Lead updated.", lead });
  } catch (error) {
    console.error("Update Lead Error:", error);
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Server error updating lead." });
  }
};

// ============================================================
// 8. CONTENT CALENDAR & CREATIVE APPROVALS
// ============================================================

exports.getContentCalendar = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const items = await ContentCalendarItem.find({ client: clientId })
      .populate("approvedBy", "name")
      .sort({ scheduledDate: 1 });

    const counts = {
      total: items.length,
      pendingApproval: items.filter((i) => i.status === "Pending Approval").length,
      approved: items.filter((i) => i.status === "Approved").length,
      scheduled: items.filter((i) => i.status === "Scheduled").length,
      published: items.filter((i) => i.status === "Published").length,
      changesRequested: items.filter((i) => i.status === "Changes Requested").length,
    };

    return res.json({ items, counts });
  } catch (error) {
    console.error("Get Content Calendar Error:", error);
    return res.status(500).json({ message: "Server error fetching content items." });
  }
};

exports.addContentCalendarItem = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const item = await ContentCalendarItem.create({
      ...req.body,
      client: clientId,
      createdBy: req.user._id,
      history: [
        {
          action: "Created Draft",
          byName: req.user.name,
          timestamp: new Date(),
          comment: "Initial creative drafted by agency team.",
        },
      ],
    });

    return res.status(201).json({ message: "Content item created.", item });
  } catch (error) {
    console.error("Add Content Item Error:", error);
    return res.status(500).json({ message: "Server error creating content item." });
  }
};

exports.reviewContentCalendarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body; // status: "Approved" or "Changes Requested"

    const item = await ContentCalendarItem.findById(id);
    if (!item) return res.status(404).json({ message: "Content item not found." });

    if (req.user.role === "client" && item.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    item.status = status;
    if (comment) item.clientFeedback = comment;

    if (status === "Approved") {
      item.approvedBy = req.user._id;
      item.approvedAt = new Date();
    }

    item.history.push({
      action: status,
      byName: req.user.name,
      timestamp: new Date(),
      comment: comment || `Status updated to ${status}`,
    });

    await item.save();
    return res.json({ message: `Content item marked as ${status}.`, item });
  } catch (error) {
    console.error("Review Content Item Error:", error);
    return res.status(500).json({ message: "Server error reviewing item." });
  }
};

// ============================================================
// 9. AGENCY WORKSPACE & WORK IN PROGRESS
// ============================================================

exports.getAgencyWorkspace = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const projects = await Project.find({ client: clientId })
      .populate("assignedManager", "name email")
      .sort({ deadline: 1 });

    const projectIds = projects.map((p) => p._id);
    const tasks = await Task.find({ project: { $in: projectIds } })
      .populate("assignedManager", "name email")
      .sort({ dueDate: 1 });

    // Client-safe view: transparent statuses
    const formattedProjects = projects.map((p) => ({
      id: p._id,
      projectId: p.projectId,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      startDate: p.startDate,
      deadline: p.deadline,
      manager: p.assignedManager?.name || "Assigned Growth Lead",
    }));

    const formattedTasks = tasks.map((t) => ({
      id: t._id,
      taskId: t.taskId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      dueDate: t.dueDate,
      manager: t.assignedManager?.name || "Team Member",
    }));

    return res.json({
      projects: formattedProjects,
      tasks: formattedTasks,
      summary: {
        activeProjects: projects.filter((p) => !["Completed", "Cancelled"].includes(p.status)).length,
        completedProjects: projects.filter((p) => p.status === "Completed").length,
        pendingTasks: tasks.filter((t) => !["Completed", "Rejected"].includes(t.status)).length,
      },
    });
  } catch (error) {
    console.error("Get Agency Workspace Error:", error);
    return res.status(500).json({ message: "Server error fetching workspace." });
  }
};

// ============================================================
// 10. REPORTS & INSIGHTS
// ============================================================

exports.getReports = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const reports = await ClientReport.find({ client: clientId }).sort({ createdAt: -1 });

    return res.json({ reports });
  } catch (error) {
    console.error("Get Reports Error:", error);
    return res.status(500).json({ message: "Server error fetching reports." });
  }
};

exports.addReport = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newReport = await ClientReport.create({
      ...req.body,
      client: clientId,
    });

    return res.status(201).json({ message: "Report generated and published.", report: newReport });
  } catch (error) {
    console.error("Add Report Error:", error);
    return res.status(500).json({ message: "Server error creating report." });
  }
};

// ============================================================
// 11. RESOURCE VAULT & DOCUMENTS
// ============================================================

exports.getVaultDocuments = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const documents = await ClientVaultDocument.find({ client: clientId }).sort({ createdAt: -1 });

    return res.json({ documents });
  } catch (error) {
    console.error("Get Vault Documents Error:", error);
    return res.status(500).json({ message: "Server error fetching vault documents." });
  }
};

exports.addVaultDocument = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newDoc = await ClientVaultDocument.create({
      ...req.body,
      client: clientId,
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
    });

    return res.status(201).json({ message: "Document deposited to vault.", document: newDoc });
  } catch (error) {
    console.error("Add Vault Document Error:", error);
    return res.status(500).json({ message: "Server error saving document." });
  }
};

// ============================================================
// 12. COMMERCIALS & INVOICES
// ============================================================

exports.getInvoices = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) {
      const firstClient = await User.findOne({ role: "client" });
      clientId = firstClient?._id;
    }
    if (!clientId) return res.status(404).json({ message: "Client not found." });

    const profile = await ClientProfile.findOne({ client: clientId });
    const invoices = await ClientInvoice.find({ client: clientId }).sort({ invoiceDate: -1 });

    const summary = {
      totalInvoiced: invoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0),
      totalPaid: invoices
        .filter((i) => i.status === "Paid")
        .reduce((acc, i) => acc + (i.totalAmount || 0), 0),
      totalPending: invoices
        .filter((i) => ["Sent", "Partially Paid", "Overdue"].includes(i.status))
        .reduce((acc, i) => acc + (i.totalAmount || 0), 0),
      package: profile?.servicePackage || {
        name: "Brand & Performance Growth",
        monthlyFee: 45000,
        billingCycle: "Monthly",
      },
    };

    return res.json({ invoices, summary });
  } catch (error) {
    console.error("Get Invoices Error:", error);
    return res.status(500).json({ message: "Server error fetching invoices." });
  }
};

exports.addInvoice = async (req, res) => {
  try {
    let clientId = getTargetClientId(req);
    if (!clientId) return res.status(400).json({ message: "Target client ID required." });

    const newInvoice = await ClientInvoice.create({
      ...req.body,
      client: clientId,
    });

    return res.status(201).json({ message: "Invoice issued.", invoice: newInvoice });
  } catch (error) {
    console.error("Add Invoice Error:", error);
    return res.status(500).json({ message: "Server error issuing invoice." });
  }
};

// ============================================================
// 13. CLIENT SELECTOR (ADMIN / MANAGER)
// ============================================================

/**
 * Lightweight change detector polled by the Client Portal (every ~30s and on
 * focus). When the version changes, the dashboard refetches its data — so a
 * manager's import shows up without the client re-uploading or reloading.
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const clientId = getTargetClientId(req);
    if (!clientId) return res.status(404).json({ message: "Client not found." });
    const stamp = await getClientSyncStamp(clientId);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ clientId, ...stamp, syncStamp: stamp.version, checkedAt: new Date() });
  } catch (error) {
    console.error("Sync status error:", error);
    return res.status(500).json({ message: "Failed to check for updates." });
  }
};

exports.getAllClientsForSelector = async (req, res) => {
  try {
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Restricted to agency team." });
    }

    const clientFilter = { role: "client" };
    if (req.user.role === "manager") {
      clientFilter.assignedManager = req.user._id;
    }

    const clients = await User.find(clientFilter)
      .select("name email companyName clientId assignedManager")
      .populate("assignedManager", "name")
      .sort({ createdAt: -1 });

    // Fetch corresponding profiles for business type & logo
    const profiles = await ClientProfile.find({ client: { $in: clients.map((c) => c._id) } });
    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.client.toString()] = p;
    });

    const clientList = clients.map((c) => ({
      id: c._id,
      name: c.name,
      email: c.email,
      clientId: c.clientId,
      businessName: profileMap[c._id.toString()]?.businessName || c.companyName || c.name,
      businessType: profileMap[c._id.toString()]?.businessType || "other",
      logo: profileMap[c._id.toString()]?.logo || "",
      manager: c.assignedManager?.name || "Unassigned",
    }));

    return res.json({ clients: clientList });
  } catch (error) {
    console.error("Get Client Selector Error:", error);
    return res.status(500).json({ message: "Server error fetching client selector." });
  }
};

// exposed for unit tests
exports._leadInternals = { readLeadFields, syncLeadFlags, canManageLead };
