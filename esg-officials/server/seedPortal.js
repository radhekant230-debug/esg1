const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const ClientProfile = require("./models/portal/ClientProfile");
const ClientSalesRecord = require("./models/portal/ClientSalesRecord");
const CampaignMetric = require("./models/portal/CampaignMetric");
const SocialMediaMetric = require("./models/portal/SocialMediaMetric");
const GoogleBusinessMetric = require("./models/portal/GoogleBusinessMetric");
const ClientLead = require("./models/portal/ClientLead");
const ContentCalendarItem = require("./models/portal/ContentCalendarItem");
const ClientReport = require("./models/portal/ClientReport");
const ClientInvoice = require("./models/portal/ClientInvoice");
const ClientVaultDocument = require("./models/portal/ClientVaultDocument");

dotenv.config();

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("Connected to MongoDB Atlas: esg-official-clients");

    const hashedPassword = await bcrypt.hash("password123", 10);
    const manager = await User.findOne({ role: "manager" });

    // 1. Ensure Café Mysa client exists
    let cafeUser = await User.findOne({ email: "cafemysa@client.com" });
    if (!cafeUser) {
      cafeUser = await User.create({
        name: "Aman Kapoor",
        email: "cafemysa@client.com",
        password: hashedPassword,
        role: "client",
        companyName: "Café Mysa",
        phone: "+91 98765 11223",
        assignedManager: manager ? manager._id : null,
        isVerified: true,
        isActive: true,
      });
      console.log("Created user: cafemysa@client.com");
    }

    // 2. Ensure Vogue Clothing client exists
    let clothingUser = await User.findOne({ email: "vogue@client.com" });
    if (!clothingUser) {
      clothingUser = await User.create({
        name: "Meera Nair",
        email: "vogue@client.com",
        password: hashedPassword,
        role: "client",
        companyName: "Vogue Clothing Studio",
        phone: "+91 98765 33445",
        assignedManager: manager ? manager._id : null,
        isVerified: true,
        isActive: true,
      });
      console.log("Created user: vogue@client.com");
    }

    // 3. Ensure Luxe Jewels client exists
    let jewelUser = await User.findOne({ email: "luxejewels@client.com" });
    if (!jewelUser) {
      jewelUser = await User.create({
        name: "Dev Singhania",
        email: "luxejewels@client.com",
        password: hashedPassword,
        role: "client",
        companyName: "Luxe Jewels & Diamonds",
        phone: "+91 98765 55667",
        assignedManager: manager ? manager._id : null,
        isVerified: true,
        isActive: true,
      });
      console.log("Created user: luxejewels@client.com");
    }

    // ============================================================
    // SEED CAFÉ MYSA (Café & Restaurant)
    // ============================================================
    await ClientProfile.findOneAndUpdate(
      { client: cafeUser._id },
      {
        client: cafeUser._id,
        businessName: "Café Mysa",
        businessType: "cafe_restaurant",
        logo: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=150&auto=format&fit=crop&q=80",
        tagline: "Artisan Coffee, Gourmet Brunch & Social Dining",
        welcomeMessage: "Track your café footfall, marketing campaigns, ad ROAS, and social reach in real time.",
        phone: "+91 98765 11223",
        website: "https://cafemysa.in",
        address: "Plot 42, Jubilee Hills Road No. 36, Hyderabad",
        accountManagerDetails: {
          name: "Rahul Sharma",
          email: "rahul.manager@esgofficial.com",
          phone: "+91 98765 43210",
          role: "Senior Growth Strategist",
        },
        servicesPurchased: [
          "executive_overview",
          "sales",
          "advertising",
          "social_media",
          "google_business",
          "leads",
          "content_calendar",
          "agency_workspace",
          "reports",
          "vault",
          "invoices",
        ],
        integrations: {
          metaAds: { status: "Connected", accountId: "act_49201948210", lastSyncedAt: new Date() },
          googleAds: { status: "Connected", accountId: "629-401-8821", lastSyncedAt: new Date() },
          instagram: { status: "Connected", handle: "@cafemysa.official", lastSyncedAt: new Date() },
          facebook: { status: "Connected", pageName: "Café Mysa Hyderabad", lastSyncedAt: new Date() },
          googleBusinessProfile: { status: "Connected", locationId: "loc_89214710", lastSyncedAt: new Date() },
        },
        servicePackage: {
          name: "Full-Stack Brand & Performance Growth",
          monthlyFee: 45000,
          billingCycle: "Monthly",
          servicesIncluded: [
            "Meta & Google Ads Campaign Management",
            "Social Media Content Production (Reels, Static, Carousels)",
            "Lead Nurturing & Weekend Table Bookings",
            "Local SEO & Google Business Profile Optimization",
            "Bi-Weekly Analytics Review & Content Calendar",
          ],
        },
        lastReportUpdate: new Date(),
      },
      { upsert: true }
    );

    // Sales Records for Café Mysa (Daily trend for October 2026)
    await ClientSalesRecord.deleteMany({ client: cafeUser._id });
    const dates = [
      "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
      "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"
    ];
    const dailyRevs = [42500, 38200, 68400, 74200, 41000, 39500, 44200, 41800, 71200, 78600];
    const dailyOrders = [58, 52, 94, 102, 56, 54, 60, 57, 98, 108];

    for (let i = 0; i < dates.length; i++) {
      await ClientSalesRecord.create({
        client: cafeUser._id,
        date: new Date(dates[i]),
        periodType: "daily",
        totalRevenue: dailyRevs[i],
        ordersCount: dailyOrders[i],
        averageOrderValue: Math.round(dailyRevs[i] / dailyOrders[i]),
        adAttributedRevenue: Math.round(dailyRevs[i] * 0.42),
        returnsCount: 1,
        returnsAmount: 450,
        categoryBreakdown: [
          { category: "Artisan Specialty Coffee", amount: Math.round(dailyRevs[i] * 0.35), itemsSold: Math.round(dailyOrders[i] * 1.4) },
          { category: "Bakery & Viennoiserie", amount: Math.round(dailyRevs[i] * 0.25), itemsSold: Math.round(dailyOrders[i] * 0.9) },
          { category: "Gourmet Breakfast & Brunch", amount: Math.round(dailyRevs[i] * 0.28), itemsSold: Math.round(dailyOrders[i] * 0.7) },
          { category: "Beverages & Cold Brews", amount: Math.round(dailyRevs[i] * 0.12), itemsSold: Math.round(dailyOrders[i] * 0.5) },
        ],
        topProducts: [
          { name: "Truffle Avocado Sourdough", category: "Brunch", revenue: 18400, unitsSold: 42 },
          { name: "Signature Spanish Latte", category: "Coffee", revenue: 15600, unitsSold: 58 },
          { name: "Pistachio Babka French Toast", category: "Bakery", revenue: 14200, unitsSold: 36 },
          { name: "Cold Brew Cascara Tonic", category: "Coffee", revenue: 9800, unitsSold: 38 },
        ],
        cafeDetails: {
          reservationsCount: Math.round(dailyOrders[i] * 0.3),
          diningCovers: Math.round(dailyOrders[i] * 1.8),
          topMenuItems: [
            { name: "Truffle Avocado Sourdough", orders: 42, revenue: 18400 },
            { name: "Signature Spanish Latte", orders: 58, revenue: 15600 },
            { name: "Almond Croissant", orders: 35, revenue: 8750 },
          ],
          promotionsRedeemed: 14,
        },
        source: "POS Sync + Verified Manual Entry",
      });
    }

    // Campaigns for Café Mysa
    await CampaignMetric.deleteMany({ client: cafeUser._id });
    const cafeCampaigns = [
      {
        client: cafeUser._id,
        campaignName: "Café Mysa - Weekend Brunch Table Reservations",
        platform: "Meta Ads",
        status: "Active",
        objective: "Lead Generation",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-31"),
        budget: 25000,
        adSpend: 11400,
        impressions: 84200,
        reach: 58900,
        clicks: 2980,
        leads: 142,
        conversions: 88,
        attributedRevenue: 48600,
        dataSource: "Meta Ads API (Connected)",
        isLiveConnected: true,
      },
      {
        client: cafeUser._id,
        campaignName: "Café Mysa - Artisan Coffee Reel Traffic Boost",
        platform: "Meta Ads",
        status: "Active",
        objective: "Store Visits",
        startDate: new Date("2026-10-03"),
        endDate: new Date("2026-10-24"),
        budget: 15000,
        adSpend: 6800,
        impressions: 62400,
        reach: 48100,
        clicks: 1840,
        leads: 64,
        conversions: 42,
        attributedRevenue: 24800,
        dataSource: "Meta Ads API (Connected)",
        isLiveConnected: true,
      },
      {
        client: cafeUser._id,
        campaignName: "Google Local Search - Best Specialty Café Hyderabad",
        platform: "Google Ads",
        status: "Active",
        objective: "Website & Direction Enquiries",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-31"),
        budget: 20000,
        adSpend: 8900,
        impressions: 34100,
        reach: 28400,
        clicks: 1420,
        leads: 76,
        conversions: 54,
        attributedRevenue: 38200,
        dataSource: "Google Ads API (Connected)",
        isLiveConnected: true,
      },
    ];
    for (const c of cafeCampaigns) {
      await CampaignMetric.create(c);
    }

    // Social Media for Café Mysa
    await SocialMediaMetric.deleteMany({ client: cafeUser._id });
    await SocialMediaMetric.create({
      client: cafeUser._id,
      platform: "Instagram",
      reportingMonth: "2026-10",
      followers: 18450,
      followerGrowth: 1240,
      reach: 142800,
      impressions: 198400,
      likes: 8940,
      comments: 642,
      shares: 1120,
      saves: 890,
      engagementRate: 4.82,
      profileVisits: 6420,
      linkClicks: 1840,
      postsCount: 12,
      topPosts: [
        {
          title: "Artisan Latte Pour Reel",
          caption: "Morning rituals perfected. Have you tried our Spanish Latte with oat milk yet? ☕✨ #CafeMysa",
          imageUrl: "https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=500&auto=format&fit=crop&q=80",
          postDate: new Date("2026-10-04"),
          format: "Reel",
          reach: 48200,
          engagement: 3420,
          likes: 2890,
          comments: 210,
          shares: 320,
        },
        {
          title: "Truffle Avocado Toast Feature",
          caption: "Crispy seeded sourdough, whipped goat cheese, and fresh truffles. Weekend brunch is now served.",
          imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80",
          postDate: new Date("2026-10-07"),
          format: "Carousel",
          reach: 32400,
          engagement: 2180,
          likes: 1840,
          comments: 142,
          shares: 198,
        },
      ],
      dataSource: "Instagram Graph API Sync",
    });

    // Google Business Profile for Café Mysa
    await GoogleBusinessMetric.deleteMany({ client: cafeUser._id });
    await GoogleBusinessMetric.create({
      client: cafeUser._id,
      reportingMonth: "2026-10",
      profileViews: 3840,
      searchImpressions: 12600,
      websiteClicks: 940,
      calls: 310,
      directionRequests: 680,
      averageRating: 4.9,
      totalReviews: 248,
      recentReviews: [
        { author: "Kavya Reddy", rating: 5, comment: "Best sourdough toast in town! Ambience is gorgeous and calm.", date: new Date("2026-10-08"), reply: "Thank you Kavya! See you again this weekend!" },
        { author: "Vikram Seth", rating: 5, comment: "Their cascara cold brew tonic is a must try. Fast service.", date: new Date("2026-10-06"), reply: "Glad you loved it Vikram!" },
      ],
      connectionStatus: "Connected",
      dataSource: "Google Business Profile Verified API",
    });

    // Leads for Café Mysa
    await ClientLead.deleteMany({ client: cafeUser._id });
    const cafeLeads = [
      {
        client: cafeUser._id,
        name: "Rohit Varma",
        email: "rohit.varma@gmail.com",
        phone: "+91 98490 22334",
        source: "Meta Ads",
        campaign: "Weekend Brunch Table Reservations",
        status: "Converted",
        estimatedValue: 4800,
        notes: [{ text: "Booked private terrace for birthday brunch for 8 people.", author: "Rahul Sharma" }],
      },
      {
        client: cafeUser._id,
        name: "Shreya Ghoshal",
        email: "shreya.g@corporate.org",
        phone: "+91 97000 88991",
        source: "Google Ads",
        campaign: "Google Local Search",
        status: "Qualified",
        estimatedValue: 24000,
        notes: [{ text: "Enquired about corporate breakfast catering for 40 delegates.", author: "Rahul Sharma" }],
      },
      {
        client: cafeUser._id,
        name: "Anand Rathi",
        email: "anand.rathi@outlook.com",
        phone: "+91 99881 12233",
        source: "Instagram DM",
        campaign: "Artisan Coffee Reel Boost",
        status: "Contacted",
        estimatedValue: 3200,
        notes: [{ text: "Enquired about specialty bean subscription and cold brew cans.", author: "Priya Singh" }],
      },
      {
        client: cafeUser._id,
        name: "Pooja Malhotra",
        email: "pooja.m@gmail.com",
        phone: "+91 91234 56789",
        source: "Website Enquiry",
        status: "New",
        estimatedValue: 1800,
        notes: [{ text: "Requested table reservation for Saturday evening 7 PM.", author: "System" }],
      },
    ];
    for (const l of cafeLeads) {
      await ClientLead.create(l);
    }

    // Content Calendar for Café Mysa
    await ContentCalendarItem.deleteMany({ client: cafeUser._id });
    const cafeContent = [
      {
        client: cafeUser._id,
        title: "Weekend Chef's Special: Smoked Salmon Brioche",
        platform: "Instagram",
        format: "Reel",
        caption: "Layers of house-cured salmon, lemon dill cream cheese, and toasted brioche. Reserved only for this Saturday & Sunday. 🍳🌿",
        creativeUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80",
        scheduledDate: new Date("2026-10-12"),
        status: "Pending Approval",
        clientFeedback: "",
        history: [{ action: "Draft Created", byName: "ESG Creative Team", timestamp: new Date(), comment: "Creative drafted for client approval." }],
      },
      {
        client: cafeUser._id,
        title: "Behind The Beans: Single-Origin Ethiopian Yirgacheffe",
        platform: "Instagram",
        format: "Carousel",
        caption: "Notes of bergamot, peach blossoms, and jasmine honey. Swipe through to discover how our head roaster brews this harvest.",
        creativeUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
        scheduledDate: new Date("2026-10-14"),
        status: "Approved",
        approvedAt: new Date("2026-10-09"),
        clientFeedback: "Looks great Aman!",
        history: [{ action: "Approved", byName: "Aman Kapoor", timestamp: new Date(), comment: "Approved for scheduling." }],
      },
      {
        client: cafeUser._id,
        title: "Evening Acoustics & Wood-Fired Sourdough Pizza",
        platform: "Multi-Platform",
        format: "High-Res Photo",
        caption: "As the sun sets, our wood fire ignites. Unwind with artisanal sourdough crusts and curated live jazz this Thursday night.",
        creativeUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80",
        scheduledDate: new Date("2026-10-16"),
        status: "Scheduled",
        history: [{ action: "Scheduled", byName: "Rahul Sharma", timestamp: new Date(), comment: "Prepared for automated distribution." }],
      },
    ];
    for (const c of cafeContent) {
      await ContentCalendarItem.create(c);
    }

    // Reports for Café Mysa
    await ClientReport.deleteMany({ client: cafeUser._id });
    await ClientReport.create({
      client: cafeUser._id,
      title: "Monthly Marketing & Performance Report - September 2026",
      reportType: "Monthly Marketing Report",
      period: "01 Sep 2026 - 30 Sep 2026",
      summary: "Exceptional performance across weekend brunch footfall and specialty coffee sales. Paid ads generated a 4.1x blended ROAS, while organic Instagram reach expanded by 34% through viral recipe reels.",
      keyMetrics: {
        totalSales: 1684000,
        adSpend: 42000,
        roas: 4.12,
        leads: 312,
        socialReach: 184000,
        engagementRate: 4.8,
      },
      previousPeriodComparison: {
        salesChangePct: 18.2,
        spendChangePct: 5.0,
        leadsChangePct: 24.5,
        reachChangePct: 34.0,
      },
      achievements: [
        "Record weekend footfall with 100% table occupancy between 11 AM - 3 PM",
        "Meta Ads cost per reservation lead reduced from ₹112 to ₹80",
        "Google Business Profile searches grew +42% ranking #1 for 'artisan cafe jubilee hills'",
      ],
      areasForImprovement: [
        "Weekday afternoon hours (3 PM - 6 PM) have dip in footfall",
        "Dessert add-on conversion at billing counter can be elevated",
      ],
      nextMonthPlan: [
        "Launch 'Work & Brew' laptop-friendly weekday pass campaigns",
        "Introduce seasonal autumn pumpkin spice & spiced cascara specials",
        "Expand micro-influencer tasting sessions on Thursdays",
      ],
      recommendations: [
        "Introduce pre-booking deposit for tables exceeding 6 guests to prevent no-shows",
        "Implement QR code Google Review incentive for café guests",
      ],
      pdfUrl: "https://esg-officials.com/reports/cafemysa-september-2026.pdf",
      dataSource: "Verified POS, Meta Ads API & Agency Attribution Engine",
    });

    // Invoices for Café Mysa
    await ClientInvoice.deleteMany({ client: cafeUser._id });
    await ClientInvoice.create({
      client: cafeUser._id,
      invoiceNumber: "INV-ESG-2026-0042",
      servicePackage: "Full-Stack Brand & Performance Growth",
      servicesIncluded: [
        "Digital Advertising Campaign Management (Meta & Google)",
        "Social Media Content Production (4 Reels, 6 Carousels, 8 Stories)",
        "Local SEO & Google Business Profile Optimization",
        "Lead Generation & Table Booking Flow Setup",
      ],
      billingPeriod: "01 Oct 2026 - 31 Oct 2026",
      invoiceDate: new Date("2026-10-01"),
      dueDate: new Date("2026-10-15"),
      subtotal: 45000,
      taxRate: 18,
      taxAmount: 8100,
      totalAmount: 53100,
      currency: "INR",
      status: "Paid",
      paidAmount: 53100,
      paidDate: new Date("2026-10-03"),
      pdfUrl: "https://esg-officials.com/invoices/INV-ESG-2026-0042.pdf",
      notes: "Payment received via NEFT Transfer. Thank you for your partnership!",
    });

    // Vault Documents for Café Mysa
    await ClientVaultDocument.deleteMany({ client: cafeUser._id });
    const cafeVault = [
      {
        client: cafeUser._id,
        title: "Café Mysa - Comprehensive Brand Book & Style Guide",
        category: "Brand Guidelines",
        fileUrl: "https://esg-officials.com/vault/cafemysa-brand-guide.pdf",
        fileType: "PDF Document",
        fileSize: "8.4 MB",
        description: "Typography rules, warm color palettes, photography angles, and logo usage guidelines.",
      },
      {
        client: cafeUser._id,
        title: "Q4 2026 Seasonal Marketing Strategy & Growth Blueprint",
        category: "Marketing Strategy",
        fileUrl: "https://esg-officials.com/vault/cafemysa-q4-strategy.pdf",
        fileType: "PDF Document",
        fileSize: "4.2 MB",
        description: "Festive season campaigns, catering packages, and influencer partnership roadmap.",
      },
      {
        client: cafeUser._id,
        title: "High-Resolution Vector Logos & Brand Mark SVG Package",
        category: "Logos & Brand Assets",
        fileUrl: "https://esg-officials.com/vault/cafemysa-vector-assets.zip",
        fileType: "ZIP Archive",
        fileSize: "14.8 MB",
        description: "Official SVG, PNG, EPS transparent logos in charcoal, cream, and brass tones.",
      },
      {
        client: cafeUser._id,
        title: "Annual Agency Service Agreement & Retainer Contract",
        category: "Contracts & Proposals",
        fileUrl: "https://esg-officials.com/vault/esg-cafemysa-contract-2026.pdf",
        fileType: "PDF Document",
        fileSize: "1.8 MB",
        description: "Executed master service agreement between ESG Officials and Café Mysa.",
      },
    ];
    for (const v of cafeVault) {
      await ClientVaultDocument.create(v);
    }

    // ============================================================
    // SEED VOGUE CLOTHING & LUXE JEWELS PROFILES
    // ============================================================
    await ClientProfile.findOneAndUpdate(
      { client: clothingUser._id },
      {
        client: clothingUser._id,
        businessName: "Vogue Clothing Studio",
        businessType: "clothing_fashion",
        logo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=150&auto=format&fit=crop&q=80",
        tagline: "Contemporary Pret & Luxury Ethnic Wear",
        welcomeMessage: "Monitor fashion catalog conversions, inventory velocity, ad ROAS, and customer acquisitions.",
        servicesPurchased: ["executive_overview", "sales", "advertising", "social_media", "leads", "content_calendar", "reports", "vault", "invoices"],
        servicePackage: {
          name: "E-Commerce & Retail Fashion Growth",
          monthlyFee: 55000,
          billingCycle: "Monthly",
        },
      },
      { upsert: true }
    );

    // Sales for clothing
    await ClientSalesRecord.deleteMany({ client: clothingUser._id });
    await ClientSalesRecord.create({
      client: clothingUser._id,
      date: new Date("2026-10-09"),
      periodType: "daily",
      totalRevenue: 142000,
      ordersCount: 28,
      averageOrderValue: 5071,
      returnsCount: 2,
      returnsAmount: 9800,
      adAttributedRevenue: 94000,
      categoryBreakdown: [
        { category: "Handcrafted Silk Sarees", amount: 68000, itemsSold: 8 },
        { category: "Contemporary Co-ord Sets", amount: 44000, itemsSold: 12 },
        { category: "Festive Anarkalis", amount: 30000, itemsSold: 8 },
      ],
      clothingDetails: {
        sizeBreakdown: [{ size: "M", unitsSold: 12 }, { size: "L", unitsSold: 8 }, { size: "S", unitsSold: 6 }, { size: "XL", unitsSold: 2 }],
        colorBreakdown: [{ color: "Emerald Green", unitsSold: 10 }, { color: "Blush Pink", unitsSold: 9 }, { color: "Ivory Gold", unitsSold: 9 }],
        returnRatePercent: 4.8,
        inventoryStockOnHand: 420,
      },
      source: "Shopify Store Sync",
    });

    await ClientProfile.findOneAndUpdate(
      { client: jewelUser._id },
      {
        client: jewelUser._id,
        businessName: "Luxe Jewels & Diamonds",
        businessType: "jewellery",
        logo: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=150&auto=format&fit=crop&q=80",
        tagline: "Fine Polki, Gold & Solitaire Jewellery",
        welcomeMessage: "Track high-ticket jewellery inquiries, VIP showroom appointments, and campaign attribution.",
        servicesPurchased: ["executive_overview", "sales", "advertising", "social_media", "leads", "content_calendar", "reports", "vault", "invoices"],
        servicePackage: {
          name: "High-Ticket Luxury Brand Strategy",
          monthlyFee: 75000,
          billingCycle: "Monthly",
        },
      },
      { upsert: true }
    );

    // Sales for jewellery
    await ClientSalesRecord.deleteMany({ client: jewelUser._id });
    await ClientSalesRecord.create({
      client: jewelUser._id,
      date: new Date("2026-10-08"),
      periodType: "daily",
      totalRevenue: 580000,
      ordersCount: 4,
      averageOrderValue: 145000,
      adAttributedRevenue: 340000,
      categoryBreakdown: [
        { category: "22K Bridal Gold Sets", amount: 340000, itemsSold: 2 },
        { category: "Solitaire Diamond Rings", amount: 160000, itemsSold: 1 },
        { category: "Polki Heritage Chokers", amount: 80000, itemsSold: 1 },
      ],
      jewelleryDetails: {
        metalBreakdown: [
          { metal: "Gold", purity: "22K (916 Hallmarked)", weightGrams: 84.5, revenue: 420000 },
          { metal: "Platinum", purity: "950 Platinum", weightGrams: 14.2, revenue: 160000 },
        ],
        itemSales: [
          { itemCode: "LUX-GLD-402", name: "Kundan & Temple Choker", revenue: 210000 },
          { itemCode: "LUX-DIA-109", name: "1.5ct Solitaire Ring", revenue: 160000 },
        ],
        inventoryValue: 14500000,
      },
      source: "Luxury Showroom ERP",
    });

    console.log("Portal seed complete! All client businesses configured with realistic, verified data.");
    process.exit(0);
  } catch (err) {
    console.error("Portal Seed Error:", err);
    process.exit(1);
  }
};

runSeed();
