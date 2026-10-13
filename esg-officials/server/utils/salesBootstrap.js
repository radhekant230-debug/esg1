const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");

/**
 * Initializes and bootstraps state-wise sales businesses and records.
 * Ensures Rahul Sharma is configured as Ranchi/Jharkhand manager,
 * and populates the example hotels, restaurants, and monthly sales data.
 */
async function ensureSalesData() {
  try {
    // 1. Find or verify manager Rahul Sharma
    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });
    if (manager) {
      let updated = false;
      if (!manager.assignedState || manager.assignedState !== "Jharkhand") {
        manager.assignedState = "Jharkhand";
        updated = true;
      }
      if (!manager.assignedCity || manager.assignedCity !== "Ranchi") {
        manager.assignedCity = "Ranchi";
        updated = true;
      }
      if (!manager.assignedStates || manager.assignedStates.length === 0) {
        manager.assignedStates = ["Jharkhand"];
        updated = true;
      }
      if (!manager.assignedCities || manager.assignedCities.length === 0) {
        manager.assignedCities = ["Ranchi", "Dhanbad"];
        updated = true;
      }
      if (updated) {
        await manager.save();
        console.log("[salesBootstrap] Updated Rahul Sharma with Ranchi/Jharkhand regional assignments.");
      }
    }

    const managerId = manager ? manager._id : null;

    // 2. Default Businesses across States
    const initialBusinesses = [
      // Jharkhand - Ranchi (Assigned to Rahul Sharma)
      {
        name: "Hotel Royal",
        code: "BIZ-JH-RAN-001",
        category: "Hotel",
        state: "Jharkhand",
        city: "Ranchi",
        address: "Main Road, Overbridge Chowk, Ranchi, Jharkhand 834001",
        phone: "+91 651 233 4567",
        email: "reservations@hotelroyalranchi.com",
        monthlyTarget: 300000,
        notes: "Premium boutique business hotel with dining banquet.",
        assignedManager: managerId,
      },
      {
        name: "Hotel Green Horizon",
        code: "BIZ-JH-RAN-002",
        category: "Hotel",
        state: "Jharkhand",
        city: "Ranchi",
        address: "Station Road, Near Ranchi Railway Junction, Ranchi, Jharkhand 834001",
        phone: "+91 651 244 5678",
        email: "contact@greenhorizonranchi.com",
        monthlyTarget: 350000,
        notes: "4-star eco-luxury hotel with conference facilities.",
        assignedManager: managerId,
      },
      {
        name: "Maya Multicuisine Restaurant",
        code: "BIZ-JH-RAN-003",
        category: "Restaurant",
        state: "Jharkhand",
        city: "Ranchi",
        address: "Circular Road, Lalpur, Ranchi, Jharkhand 834001",
        phone: "+91 651 255 6789",
        email: "dine@mayarestaurant.com",
        monthlyTarget: 200000,
        notes: "Signature Indian, Pan-Asian and Continental dining.",
        assignedManager: managerId,
      },
      {
        name: "Heaven Lounge & Bar",
        code: "BIZ-JH-RAN-004",
        category: "Restaurant",
        state: "Jharkhand",
        city: "Ranchi",
        address: "5th Floor, Nucleus Mall, Circular Road, Ranchi, Jharkhand 834001",
        phone: "+91 651 266 7890",
        email: "events@heavenlounge.com",
        monthlyTarget: 250000,
        notes: "Rooftop lounge with cocktail bar and weekend live music.",
        assignedManager: managerId,
      },

      // Jharkhand - Dhanbad (Assigned to Rahul Sharma)
      {
        name: "Coal Capital Grand",
        code: "BIZ-JH-DHN-001",
        category: "Hotel",
        state: "Jharkhand",
        city: "Dhanbad",
        address: "Bank More, Dhanbad, Jharkhand 826001",
        phone: "+91 326 230 1122",
        email: "info@coalcapitalgrand.com",
        monthlyTarget: 220000,
        notes: "Central business hotel with 50 executive rooms.",
        assignedManager: managerId,
      },
      {
        name: "Black Diamond Diner",
        code: "BIZ-JH-DHN-002",
        category: "Restaurant",
        state: "Jharkhand",
        city: "Dhanbad",
        address: "Saraidhela, Dhanbad, Jharkhand 826127",
        phone: "+91 326 231 2233",
        email: "manager@blackdiamonddiner.com",
        monthlyTarget: 180000,
        notes: "Family fine-dining restaurant with tandoor specialties.",
        assignedManager: managerId,
      },

      // Rajasthan - Jaipur (Unassigned / Admin Portfolio)
      {
        name: "Royal Rajputana Palace",
        code: "BIZ-RJ-JAI-001",
        category: "Hotel",
        state: "Rajasthan",
        city: "Jaipur",
        address: "Amer Road, Jaipur, Rajasthan 302002",
        phone: "+91 141 260 3344",
        email: "heritage@royalrajputanapalace.com",
        monthlyTarget: 500000,
        notes: "Heritage luxury palace hotel with courtyards and spa.",
        assignedManager: null,
      },
      {
        name: "Chokhi Dhani Delights",
        code: "BIZ-RJ-JAI-002",
        category: "Restaurant",
        state: "Rajasthan",
        city: "Jaipur",
        address: "Tonk Road, Jaipur, Rajasthan 302018",
        phone: "+91 141 277 4455",
        email: "flavors@chokhidhanidelights.com",
        monthlyTarget: 320000,
        notes: "Authentic Rajasthani thali restaurant with cultural ambiance.",
        assignedManager: null,
      },

      // Assam - Guwahati (Unassigned / Admin Portfolio)
      {
        name: "Brahmaputra Grand",
        code: "BIZ-AS-GUW-001",
        category: "Hotel",
        state: "Assam",
        city: "Guwahati",
        address: "GS Road, Khanapara, Guwahati, Assam 781022",
        phone: "+91 361 222 5566",
        email: "frontdesk@brahmaputragrand.com",
        monthlyTarget: 280000,
        notes: "Riverview corporate transit hotel.",
        assignedManager: null,
      },
      {
        name: "Kaziranga Dine",
        code: "BIZ-AS-GUW-002",
        category: "Restaurant",
        state: "Assam",
        city: "Guwahati",
        address: "Christian Basti, GS Road, Guwahati, Assam 781005",
        phone: "+91 361 234 6677",
        email: "taste@kazirangadine.com",
        monthlyTarget: 190000,
        notes: "Traditional Assamese and North-Eastern indigenous dining.",
        assignedManager: null,
      },

      // Odisha - Bhubaneswar (Unassigned / Admin Portfolio)
      {
        name: "Temple City Residency",
        code: "BIZ-OD-BHU-001",
        category: "Hotel",
        state: "Odisha",
        city: "Bhubaneswar",
        address: "Janpath, Saheed Nagar, Bhubaneswar, Odisha 751007",
        phone: "+91 674 250 7788",
        email: "stay@templecityresidency.com",
        monthlyTarget: 310000,
        notes: "Business hotel near IT corridor.",
        assignedManager: null,
      },
      {
        name: "Utkal Kitchen",
        code: "BIZ-OD-BHU-002",
        category: "Restaurant",
        state: "Odisha",
        city: "Bhubaneswar",
        address: "Master Canteen Square, Bhubaneswar, Odisha 751001",
        phone: "+91 674 251 8899",
        email: "food@utkalkitchen.com",
        monthlyTarget: 170000,
        notes: "Odia heritage seafood and thali restaurant.",
        assignedManager: null,
      },
    ];

    for (const bizData of initialBusinesses) {
      const existing = await SalesBusiness.findOne({ name: bizData.name, city: bizData.city });
      if (!existing) {
        await SalesBusiness.create(bizData);
      } else if (!existing.assignedManager && bizData.assignedManager) {
        existing.assignedManager = bizData.assignedManager;
        await existing.save();
      }
    }

    // 3. Seed Monthly Sales Records for September 2026 and October 2026
    const hotelRoyal = await SalesBusiness.findOne({ name: "Hotel Royal", city: "Ranchi" });
    const mayaRestaurant = await SalesBusiness.findOne({ name: "Maya Multicuisine Restaurant", city: "Ranchi" });
    const hotelGreenHorizon = await SalesBusiness.findOne({ name: "Hotel Green Horizon", city: "Ranchi" });
    const heavenLounge = await SalesBusiness.findOne({ name: "Heaven Lounge & Bar", city: "Ranchi" });
    const coalCapital = await SalesBusiness.findOne({ name: "Coal Capital Grand", city: "Dhanbad" });

    const admin = await User.findOne({ role: "admin" });
    const uploaderId = managerId || (admin ? admin._id : null);
    const uploaderName = manager ? manager.name : "System";

    if (uploaderId) {
      const sampleRecords = [
        // Hotel Royal (September 2026 & October 2026)
        hotelRoyal && {
          business: hotelRoyal._id,
          businessName: hotelRoyal.name,
          category: hotelRoyal.category,
          state: hotelRoyal.state,
          city: hotelRoyal.city,
          month: 9,
          year: 2026,
          monthName: "September 2026",
          totalSales: 250000,
          orders: 120,
          target: 300000,
          remarks: "Good",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
        hotelRoyal && {
          business: hotelRoyal._id,
          businessName: hotelRoyal.name,
          category: hotelRoyal.category,
          state: hotelRoyal.state,
          city: hotelRoyal.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 280000,
          orders: 135,
          target: 300000,
          remarks: "Good",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Maya Multicuisine Restaurant (September 2026 & October 2026)
        mayaRestaurant && {
          business: mayaRestaurant._id,
          businessName: mayaRestaurant.name,
          category: mayaRestaurant.category,
          state: mayaRestaurant.state,
          city: mayaRestaurant.city,
          month: 9,
          year: 2026,
          monthName: "September 2026",
          totalSales: 180000,
          orders: 95,
          target: 200000,
          remarks: "Improving",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
        mayaRestaurant && {
          business: mayaRestaurant._id,
          businessName: mayaRestaurant.name,
          category: mayaRestaurant.category,
          state: mayaRestaurant.state,
          city: mayaRestaurant.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 210000,
          orders: 110,
          target: 200000,
          remarks: "Target Achieved",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Hotel Green Horizon (September 2026 & October 2026)
        hotelGreenHorizon && {
          business: hotelGreenHorizon._id,
          businessName: hotelGreenHorizon.name,
          category: hotelGreenHorizon.category,
          state: hotelGreenHorizon.state,
          city: hotelGreenHorizon.city,
          month: 9,
          year: 2026,
          monthName: "September 2026",
          totalSales: 310000,
          orders: 140,
          target: 350000,
          remarks: "Steady occupancy",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
        hotelGreenHorizon && {
          business: hotelGreenHorizon._id,
          businessName: hotelGreenHorizon.name,
          category: hotelGreenHorizon.category,
          state: hotelGreenHorizon.state,
          city: hotelGreenHorizon.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 345000,
          orders: 155,
          target: 350000,
          remarks: "Near Target",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Heaven Lounge & Bar (September 2026 & October 2026)
        heavenLounge && {
          business: heavenLounge._id,
          businessName: heavenLounge.name,
          category: heavenLounge.category,
          state: heavenLounge.state,
          city: heavenLounge.city,
          month: 9,
          year: 2026,
          monthName: "September 2026",
          totalSales: 220000,
          orders: 105,
          target: 250000,
          remarks: "Good weekend traffic",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
        heavenLounge && {
          business: heavenLounge._id,
          businessName: heavenLounge.name,
          category: heavenLounge.category,
          state: heavenLounge.state,
          city: heavenLounge.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 240000,
          orders: 115,
          target: 250000,
          remarks: "Events boosted sales",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Coal Capital Grand - Dhanbad
        coalCapital && {
          business: coalCapital._id,
          businessName: coalCapital.name,
          category: coalCapital.category,
          state: coalCapital.state,
          city: coalCapital.city,
          month: 9,
          year: 2026,
          monthName: "September 2026",
          totalSales: 190000,
          orders: 90,
          target: 220000,
          remarks: "Regular corporate stays",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
        coalCapital && {
          business: coalCapital._id,
          businessName: coalCapital.name,
          category: coalCapital.category,
          state: coalCapital.state,
          city: coalCapital.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 215000,
          orders: 100,
          target: 220000,
          remarks: "Festival surge",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },
      ].filter(Boolean);

      for (const rec of sampleRecords) {
        const exists = await SalesRecord.findOne({
          business: rec.business,
          year: rec.year,
          month: rec.month,
        });
        if (!exists) {
          await SalesRecord.create(rec);
        }
      }
    }

    console.log("[salesBootstrap] Verified state-wise businesses and initial sales records.");
  } catch (error) {
    console.error("[salesBootstrap] Failed to bootstrap sales data:", error.message);
  }
}

module.exports = { ensureSalesData };
