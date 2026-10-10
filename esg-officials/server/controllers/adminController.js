const mongoose = require("mongoose");
const User = require("../models/User");
const ClientProfile = require("../models/portal/ClientProfile");
const ClientSalesRecord = require("../models/portal/ClientSalesRecord");
const CampaignMetric = require("../models/portal/CampaignMetric");
const ClientLead = require("../models/portal/ClientLead");
const ClientOrder = require("../models/portal/ClientOrder");
const SocialMediaMetric = require("../models/portal/SocialMediaMetric");
const GoogleBusinessMetric = require("../models/portal/GoogleBusinessMetric");
const ClientInvoice = require("../models/portal/ClientInvoice");
const ClientReport = require("../models/portal/ClientReport");
const ClientVaultDocument = require("../models/portal/ClientVaultDocument");
const Approval = require("../models/Approval");
const ActivityLog = require("../models/ActivityLog");

// ============================================================
// 1. ADMIN OVERVIEW — SEE ALL CLIENTS AT ONCE
// ============================================================
exports.getOverview = async (req, res) => {
  try {
    const { businessType, month, quarter, clientId, startDate, endDate } = req.query;

    // 1. Fetch all client users
    const clientUserQuery = { role: "client" };
    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      clientUserQuery._id = clientId;
    }

    const allClients = await User.find(clientUserQuery)
      .select("-password")
      .populate("assignedManager", "name email phone")
      .sort({ createdAt: -1 });

    const clientIds = allClients.map((c) => c._id);

    // 2. Fetch all profiles
    const profiles = await ClientProfile.find({ client: { $in: clientIds } });
    const profileMap = new Map();
    profiles.forEach((p) => profileMap.set(p.client.toString(), p));

    // Filter by businessType if provided
    let filteredClients = allClients;
    if (businessType && businessType !== "all") {
      filteredClients = allClients.filter((c) => {
        const p = profileMap.get(c._id.toString());
        const type = p?.businessType || "other";
        return type.toLowerCase().includes(businessType.toLowerCase());
      });
    }

    const filteredClientIds = filteredClients.map((c) => c._id);

    // 3. Date / Month filtering query helper
    const buildDateQuery = (dateField = "date") => {
      const q = { client: { $in: filteredClientIds } };
      if (startDate && endDate) {
        q[dateField] = { $gte: new Date(startDate), $lte: new Date(endDate) };
      } else if (month) {
        // e.g. "2026-03" -> match month string or date range
        const [y, m] = month.split("-").map(Number);
        if (y && m) {
          const start = new Date(y, m - 1, 1);
          const end = new Date(y, m, 0, 23, 59, 59, 999);
          q.$or = [
            { reportingMonth: month },
            { [dateField]: { $gte: start, $lte: end } },
          ];
        }
      }
      return q;
    };

    // 4. Aggregate Sales
    const salesRecords = await ClientSalesRecord.find(buildDateQuery("date"));
    const totalGrossSales = salesRecords.reduce(
      (sum, r) => sum + (r.grossSales || r.totalRevenue || 0),
      0
    );
    const totalNetRevenue = salesRecords.reduce(
      (sum, r) => sum + (r.netRevenue || r.totalRevenue || 0),
      0
    );
    const totalSalesOrders = salesRecords.reduce(
      (sum, r) => sum + (r.ordersCount || 0),
      0
    );

    // 5. Aggregate Campaigns
    const campaigns = await CampaignMetric.find(buildDateQuery("startDate"));
    const totalAdSpend = campaigns.reduce((sum, c) => sum + (c.adSpend || 0), 0);
    const totalAttributedRevenue = campaigns.reduce(
      (sum, c) => sum + (c.attributedRevenue || 0),
      0
    );
    const overallRoas =
      totalAdSpend > 0
        ? Number((totalAttributedRevenue / totalAdSpend).toFixed(2))
        : 0;

    // 6. Aggregate Leads
    const leads = await ClientLead.find(buildDateQuery("enquiryDate"));
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(
      (l) => l.isQualified || l.status === "Qualified" || l.status === "Converted"
    ).length;
    const convertedLeads = leads.filter(
      (l) => l.isConverted || l.status === "Converted"
    ).length;

    // 7. Aggregate Orders & Reservations
    const orders = await ClientOrder.find(buildDateQuery("date"));
    const totalDirectOrders = orders.reduce((sum, o) => sum + (o.count || 1), 0);
    const totalCombinedOrders = totalSalesOrders + totalDirectOrders;

    // 8. Social Media Metrics
    const socialMetrics = await SocialMediaMetric.find({
      client: { $in: filteredClientIds },
    });
    const avgEngagementRate =
      socialMetrics.length > 0
        ? Number(
            (
              socialMetrics.reduce((sum, s) => sum + (s.engagementRate || 0), 0) /
              socialMetrics.length
            ).toFixed(2)
          )
        : 0;
    const totalSocialReach = socialMetrics.reduce(
      (sum, s) => sum + (s.reach || 0),
      0
    );

    // 9. Pending Approvals
    const pendingApprovalsCount = await Approval.countDocuments({
      status: "pending",
    });

    // 10. Agency Retainers & Invoices
    const monthlyAgencyRetainers = filteredClients.reduce((sum, c) => {
      const p = profileMap.get(c._id.toString());
      return sum + (p?.retainerAmount || p?.servicePackage?.monthlyFee || 45000);
    }, 0);

    const invoices = await ClientInvoice.find({
      client: { $in: filteredClientIds },
    });
    const outstandingInvoices = invoices
      .filter((i) => i.status === "Pending" || i.status === "Overdue")
      .reduce((sum, i) => sum + (i.totalAmount || 0), 0);

    // 11. Client-by-Client Performance Breakdown
    const clientPerformance = filteredClients.map((client) => {
      const p = profileMap.get(client._id.toString());
      const clientSales = salesRecords.filter(
        (s) => s.client.toString() === client._id.toString()
      );
      const clientCampaigns = campaigns.filter(
        (c) => c.client.toString() === client._id.toString()
      );
      const clientLeads = leads.filter(
        (l) => l.client.toString() === client._id.toString()
      );
      const clientOrders = orders.filter(
        (o) => o.client.toString() === client._id.toString()
      );

      const clientGrossSales = clientSales.reduce(
        (sum, s) => sum + (s.grossSales || s.totalRevenue || 0),
        0
      );
      const clientRevenue = clientSales.reduce(
        (sum, s) => sum + (s.netRevenue || s.totalRevenue || 0),
        0
      );
      const clientSpend = clientCampaigns.reduce(
        (sum, c) => sum + (c.adSpend || 0),
        0
      );
      const clientAttributed = clientCampaigns.reduce(
        (sum, c) => sum + (c.attributedRevenue || 0),
        0
      );
      const clientRoas =
        clientSpend > 0 ? Number((clientAttributed / clientSpend).toFixed(2)) : 0;
      const clientOrdersCount =
        clientSales.reduce((sum, s) => sum + (s.ordersCount || 0), 0) +
        clientOrders.reduce((sum, o) => sum + (o.count || 1), 0);

      return {
        id: client._id,
        clientId: client.clientId || `CLI-${client._id.toString().slice(-4).toUpperCase()}`,
        name: client.name,
        companyName: client.companyName || p?.businessName || client.name,
        email: client.email,
        phone: client.phone || p?.phone || "",
        businessType: p?.businessType || "other",
        totalSales: clientGrossSales,
        revenue: clientRevenue,
        adSpend: clientSpend,
        adAttributedRevenue: clientAttributed,
        leads: clientLeads.length,
        orders: clientOrdersCount,
        roas: clientRoas,
        retainerAmount: p?.retainerAmount || p?.servicePackage?.monthlyFee || 0,
        reportingPeriod: p?.reportingPeriod || "Monthly",
        status: client.isActive !== false ? "Active" : "Inactive",
        isActive: client.isActive !== false,
        assignedManager: client.assignedManager || p?.accountManagerDetails || null,
        hasSalesData: clientSales.length > 0,
        hasCampaignData: clientCampaigns.length > 0,
        lastUpdated: client.updatedAt,
      };
    });

    const activeClientsCount = allClients.filter((c) => c.isActive !== false).length;
    const inactiveClientsCount = allClients.length - activeClientsCount;

    return res.json({
      summary: {
        totalClients: allClients.length,
        activeClients: activeClientsCount,
        inactiveClients: inactiveClientsCount,
        totalSales: totalGrossSales,
        totalRevenue: totalNetRevenue,
        totalAdSpend,
        adAttributedRevenue: totalAttributedRevenue,
        overallRoas,
        totalLeads,
        qualifiedLeads,
        convertedLeads,
        totalOrders: totalCombinedOrders,
        avgEngagementRate,
        totalSocialReach,
        pendingApprovals: pendingApprovalsCount,
        monthlyAgencyRetainers,
        outstandingInvoices,
      },
      clientPerformance,
      filters: {
        businessType: businessType || "all",
        month: month || "all",
        quarter: quarter || "all",
        selectedClientId: clientId || "all",
      },
    });
  } catch (error) {
    console.error("Admin Overview Error:", error);
    return res.status(500).json({ message: "Server error fetching overview metrics." });
  }
};

// ============================================================
// 2. GET CLIENT DETAIL (FOR ADMIN DETAIL PAGE)
// ============================================================
exports.getClientDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid client ID format." });
    }

    const client = await User.findOne({ _id: id, role: "client" })
      .select("-password")
      .populate("assignedManager", "name email phone");

    if (!client) {
      return res.status(404).json({ message: "Client not found." });
    }

    let profile = await ClientProfile.findOne({ client: id });
    if (!profile) {
      profile = await ClientProfile.create({
        client: id,
        businessName: client.companyName || client.name,
        businessType: "other",
        phone: client.phone || "",
      });
    }

    // Parallel fetch of client metrics
    const [sales, campaigns, leads, orders, social, seo, invoices, reports, documents, activity] =
      await Promise.all([
        ClientSalesRecord.find({ client: id }).sort({ date: -1 }),
        CampaignMetric.find({ client: id }).sort({ startDate: -1 }),
        ClientLead.find({ client: id }).sort({ enquiryDate: -1 }),
        ClientOrder.find({ client: id }).sort({ date: -1 }),
        SocialMediaMetric.find({ client: id }).sort({ createdAt: -1 }),
        GoogleBusinessMetric.find({ client: id }).sort({ createdAt: -1 }),
        ClientInvoice.find({ client: id }).sort({ dueDate: -1 }),
        ClientReport.find({ client: id }).sort({ createdAt: -1 }),
        ClientVaultDocument.find({ client: id }).sort({ createdAt: -1 }),
        ActivityLog.find({ client: id }).sort({ createdAt: -1 }).limit(20),
      ]);

    // Calculate aggregated metrics for this client
    const totalSales = sales.reduce((sum, s) => sum + (s.grossSales || s.totalRevenue || 0), 0);
    const netRevenue = sales.reduce((sum, s) => sum + (s.netRevenue || s.totalRevenue || 0), 0);
    const totalAdSpend = campaigns.reduce((sum, c) => sum + (c.adSpend || 0), 0);
    const attributedRevenue = campaigns.reduce((sum, c) => sum + (c.attributedRevenue || 0), 0);
    const roas = totalAdSpend > 0 ? Number((attributedRevenue / totalAdSpend).toFixed(2)) : 0;
    const totalOrders =
      sales.reduce((sum, s) => sum + (s.ordersCount || 0), 0) +
      orders.reduce((sum, o) => sum + (o.count || 1), 0);

    return res.json({
      client,
      profile,
      summary: {
        totalSales,
        netRevenue,
        totalAdSpend,
        attributedRevenue,
        roas,
        totalLeads: leads.length,
        totalOrders,
        reportsCount: reports.length,
        documentsCount: documents.length,
      },
      sales,
      salesRecords: sales,
      campaigns,
      leads,
      orders,
      social,
      seo,
      invoices,
      reports,
      documents,
      activity,
    });
  } catch (error) {
    console.error("Get Client Detail Error:", error);
    return res.status(500).json({ message: "Server error fetching client detail." });
  }
};

// ============================================================
// 3. SALES AND REVENUE MANAGEMENT (ADD, EDIT, DELETE)
// ============================================================
exports.addClientSales = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reportingMonth,
      date,
      grossSales,
      discounts,
      refunds,
      netRevenue,
      costOfGoodsSold,
      ordersCount,
      salesChannel,
      notes,
      dataSource,
      verificationStatus,
      adAttributedRevenue,
      periodType,
    } = req.body;

    const parsedGross = Number(grossSales) || 0;
    const parsedDisc = Number(discounts) || 0;
    const parsedRef = Number(refunds) || 0;
    const computedNet =
      netRevenue !== undefined && netRevenue !== ""
        ? Number(netRevenue)
        : Math.max(0, parsedGross - parsedDisc - parsedRef);

    const record = await ClientSalesRecord.create({
      client: id,
      date: date ? new Date(date) : new Date(),
      reportingMonth: reportingMonth || new Date().toISOString().slice(0, 7),
      periodType: periodType || "monthly",
      grossSales: parsedGross,
      discounts: parsedDisc,
      refunds: parsedRef,
      netRevenue: computedNet,
      totalRevenue: computedNet,
      costOfGoodsSold: Number(costOfGoodsSold) || 0,
      ordersCount: Number(ordersCount) || 0,
      salesChannel: salesChannel || "In-Store / Direct",
      notes: notes || "",
      dataSource: dataSource || "Manual Entry",
      verificationStatus: verificationStatus || "Verified",
      adAttributedRevenue: Number(adAttributedRevenue) || 0,
    });

    try {
      await ActivityLog.create({
        user: req.user._id,
        action: "CREATE",
        entityType: "User",
        entityId: id,
        description: `Added sales record for month ${record.reportingMonth} (Net: ₹${record.netRevenue})`,
      });
    } catch (_) {}

    return res.status(201).json({ message: "Sales record added successfully.", record });
  } catch (error) {
    console.error("Add Sales Error:", error);
    return res.status(500).json({ message: error.message || "Failed to add sales record." });
  }
};

exports.updateClientSales = async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await ClientSalesRecord.findById(recordId);
    if (!record) return res.status(404).json({ message: "Sales record not found." });

    const fields = [
      "reportingMonth",
      "date",
      "grossSales",
      "discounts",
      "refunds",
      "netRevenue",
      "costOfGoodsSold",
      "ordersCount",
      "salesChannel",
      "notes",
      "dataSource",
      "verificationStatus",
      "adAttributedRevenue",
      "periodType",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    });

    if (req.body.grossSales !== undefined || req.body.discounts !== undefined || req.body.refunds !== undefined) {
      if (!req.body.netRevenue) {
        record.netRevenue = Math.max(
          0,
          (Number(record.grossSales) || 0) - (Number(record.discounts) || 0) - (Number(record.refunds) || 0)
        );
      }
      record.totalRevenue = record.netRevenue;
    }

    await record.save();

    try {
      await ActivityLog.create({
        user: req.user._id,
        action: "UPDATE",
        entityType: "User",
        entityId: record.client,
        description: `Updated sales record ${record._id} for month ${record.reportingMonth}`,
      });
    } catch (_) {}

    return res.json({ message: "Sales record updated successfully.", record });
  } catch (error) {
    console.error("Update Sales Error:", error);
    return res.status(500).json({ message: error.message || "Failed to update sales record." });
  }
};

exports.deleteClientSales = async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await ClientSalesRecord.findByIdAndDelete(recordId);
    if (!record) return res.status(404).json({ message: "Sales record not found." });

    return res.json({ message: "Sales record deleted successfully." });
  } catch (error) {
    console.error("Delete Sales Error:", error);
    return res.status(500).json({ message: "Failed to delete sales record." });
  }
};

// ============================================================
// 4. ADVERTISING AND CAMPAIGN MANAGEMENT
// ============================================================
exports.addClientCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      campaignName,
      platform,
      status,
      objective,
      reportingMonth,
      startDate,
      endDate,
      budget,
      adSpend,
      impressions,
      reach,
      clicks,
      leads,
      conversions,
      attributedRevenue,
      supportingEvidence,
      verificationStatus,
    } = req.body;

    if (!campaignName) return res.status(400).json({ message: "Campaign name is required." });

    const campaign = await CampaignMetric.create({
      client: id,
      campaignName,
      platform: platform || "Meta Ads",
      status: status || req.body.campaignStatus || "Active",
      objective: objective || "Lead Generation",
      reportingMonth: reportingMonth || new Date().toISOString().slice(0, 7),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      budget: Number(budget) || 0,
      adSpend: Number(adSpend !== undefined ? adSpend : req.body.amountSpent) || 0,
      impressions: Number(impressions) || 0,
      reach: Number(reach) || 0,
      clicks: Number(clicks) || 0,
      leads: Number(leads) || 0,
      conversions: Number(conversions) || 0,
      attributedRevenue: Number(attributedRevenue) || 0,
      supportingEvidence: supportingEvidence || "",
      verificationStatus: verificationStatus || "Verified",
    });

    try {
      await ActivityLog.create({
        user: req.user._id,
        action: "CREATE",
        entityType: "User",
        entityId: id,
        description: `Added campaign "${campaign.campaignName}" on ${campaign.platform} (Spend: ₹${campaign.adSpend})`,
      });
    } catch (_) {}

    return res.status(201).json({ message: "Campaign created successfully.", campaign });
  } catch (error) {
    console.error("Add Campaign Error:", error);
    return res.status(500).json({ message: error.message || "Failed to add campaign." });
  }
};

exports.updateClientCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await CampaignMetric.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found." });

    const fields = [
      "campaignName",
      "platform",
      "status",
      "objective",
      "reportingMonth",
      "startDate",
      "endDate",
      "budget",
      "adSpend",
      "impressions",
      "reach",
      "clicks",
      "leads",
      "conversions",
      "attributedRevenue",
      "supportingEvidence",
      "verificationStatus",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) campaign[f] = req.body[f];
    });

    await campaign.save();

    return res.json({ message: "Campaign updated successfully.", campaign });
  } catch (error) {
    console.error("Update Campaign Error:", error);
    return res.status(500).json({ message: error.message || "Failed to update campaign." });
  }
};

exports.deleteClientCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await CampaignMetric.findByIdAndDelete(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found." });

    return res.json({ message: "Campaign deleted successfully." });
  } catch (error) {
    console.error("Delete Campaign Error:", error);
    return res.status(500).json({ message: "Failed to delete campaign." });
  }
};

// ============================================================
// 5. LEADS AND ENQUIRIES MANAGEMENT
// ============================================================
exports.addClientLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customerName, email, phone, source, campaign, enquiryDate, reportingMonth, status, isQualified, isConverted, estimatedValue, note } = req.body;

    const leadName = name || customerName || `Enquiry Batch - ${source || req.body.leadSource || "Online"}`;
    const leadSource = source || req.body.leadSource || "Meta Ads";
    const leadStatus = status || req.body.conversionStatus || "New";
    const noteText = typeof (note || req.body.notes) === "string" ? (note || req.body.notes) : "";

    const lead = await ClientLead.create({
      client: id,
      name: leadName,
      email: email || "",
      phone: phone || "",
      source: leadSource,
      campaign: campaign || "",
      enquiryCount: Number(req.body.enquiryCount) || 1,
      enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
      reportingMonth: reportingMonth || new Date().toISOString().slice(0, 7),
      status: leadStatus,
      isQualified: Boolean(isQualified),
      isConverted: Boolean(isConverted),
      estimatedValue: Number(estimatedValue) || 0,
      notes: noteText ? [{ text: noteText, author: req.user?.name || "Admin", createdAt: new Date() }] : [],
    });

    return res.status(201).json({ message: "Lead added successfully.", lead });
  } catch (error) {
    console.error("Add Lead Error:", error);
    return res.status(500).json({ message: error.message || "Failed to add lead." });
  }
};

exports.updateClientLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await ClientLead.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const fields = ["name", "email", "phone", "source", "campaign", "enquiryDate", "reportingMonth", "status", "isQualified", "isConverted", "estimatedValue"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) lead[f] = req.body[f];
    });

    if (req.body.note) {
      lead.notes.push({ text: req.body.note, author: req.user.name, createdAt: new Date() });
    }

    await lead.save();
    return res.json({ message: "Lead updated successfully.", lead });
  } catch (error) {
    console.error("Update Lead Error:", error);
    return res.status(500).json({ message: error.message || "Failed to update lead." });
  }
};

exports.deleteClientLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await ClientLead.findByIdAndDelete(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found." });
    return res.json({ message: "Lead deleted successfully." });
  } catch (error) {
    console.error("Delete Lead Error:", error);
    return res.status(500).json({ message: "Failed to delete lead." });
  }
};

// ============================================================
// 6. ORDERS AND RESERVATIONS MANAGEMENT
// ============================================================
exports.addClientOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportingMonth, date, orderType, type, customerName, count, partySize, value, orderValue, status, channel, notes } = req.body;

    let finalOrderType = orderType || type || "Order";
    if (String(finalOrderType).toLowerCase().includes("reserv")) finalOrderType = "Reservation";

    let finalChannel = channel || "Dine-in";
    if (finalChannel === "dine_in") finalChannel = "Dine-in";

    let finalStatus = status || "Completed";
    if (finalStatus === "completed") finalStatus = "Completed";

    const order = await ClientOrder.create({
      client: id,
      reportingMonth: reportingMonth || new Date().toISOString().slice(0, 7),
      date: date ? new Date(date) : new Date(),
      orderType: finalOrderType,
      customerName: customerName || "Customer",
      count: Number(count || partySize) || 1,
      value: Number(value || orderValue) || 0,
      status: finalStatus,
      channel: finalChannel,
      notes: notes || "",
    });

    return res.status(201).json({ message: "Order/Reservation logged successfully.", order });
  } catch (error) {
    console.error("Add Order Error:", error);
    return res.status(500).json({ message: error.message || "Failed to log order." });
  }
};

exports.updateClientOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await ClientOrder.findByIdAndUpdate(orderId, req.body, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found." });
    return res.json({ message: "Order updated successfully.", order });
  } catch (error) {
    console.error("Update Order Error:", error);
    return res.status(500).json({ message: "Failed to update order." });
  }
};

exports.deleteClientOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await ClientOrder.findByIdAndDelete(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    return res.json({ message: "Order deleted successfully." });
  } catch (error) {
    console.error("Delete Order Error:", error);
    return res.status(500).json({ message: "Failed to delete order." });
  }
};

// ============================================================
// 7. EXPENSES AND AGENCY RETAINERS MANAGEMENT
// ============================================================
exports.addClientInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNumber, servicePackage, billingPeriod, invoiceDate, dueDate, subtotal, taxAmount, totalAmount, status, notes } = req.body;

    const invoice = await ClientInvoice.create({
      client: id,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      servicePackage: servicePackage || "ESG Retainer & Growth Marketing",
      billingPeriod: billingPeriod || "Current Month",
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
      subtotal: Number(subtotal) || 45000,
      taxAmount: Number(taxAmount) || 8100,
      totalAmount: Number(totalAmount) || 53100,
      status: status || "Pending",
      notes: notes || "",
    });

    return res.status(201).json({ message: "Invoice added successfully.", invoice });
  } catch (error) {
    console.error("Add Invoice Error:", error);
    return res.status(500).json({ message: error.message || "Failed to add invoice." });
  }
};

exports.updateClientInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await ClientInvoice.findByIdAndUpdate(invoiceId, req.body, { new: true });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ message: "Invoice updated successfully.", invoice });
  } catch (error) {
    console.error("Update Invoice Error:", error);
    return res.status(500).json({ message: "Failed to update invoice." });
  }
};
