const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesLocation = require("../models/sales/SalesLocation");

/**
 * Initializes and bootstraps state-wise sales locations, businesses, and records.
 * Ensures Rahul Sharma is configured as Ranchi/Jharkhand manager,
 * seeds the initial locations (Raichur, Ranchi, Dhanbad, Jaipur, Coimbatore, Guwahati, Bhubaneswar),
 * and populates example hotels, restaurants, and monthly sales data.
 */
async function ensureSalesData() {
  try {
    // 1. Seed the 7 Initial Manager Locations
    const initialLocations = [
      { city: "Raichur", state: "Karnataka" },
      { city: "Ranchi", state: "Jharkhand" },
      { city: "Dhanbad", state: "Jharkhand" },
      { city: "Jaipur", state: "Rajasthan" },
      { city: "Coimbatore", state: "Tamil Nadu" },
      { city: "Guwahati", state: "Assam" },
      { city: "Bhubaneswar", state: "Odisha" },
    ];

    for (const loc of initialLocations) {
      await SalesLocation.findOneAndUpdate(
        { city: loc.city, state: loc.state },
        { ...loc, isDefault: true },
        { upsert: true, new: true }
      );
    }

    // 2. Find or verify manager Rahul Sharma (Ranchi Manager)
    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });
    if (manager) {
      let updated = false;
      if (manager.assignedState !== "Jharkhand") {
        manager.assignedState = "Jharkhand";
        updated = true;
      }
      if (manager.assignedCity !== "Ranchi") {
        manager.assignedCity = "Ranchi";
        updated = true;
      }
      if (!manager.assignedStates || manager.assignedStates.length === 0 || manager.assignedStates[0] !== "Jharkhand") {
        manager.assignedStates = ["Jharkhand"];
        updated = true;
      }
      if (!manager.assignedCities || manager.assignedCities.length === 0 || manager.assignedCities[0] !== "Ranchi") {
        manager.assignedCities = ["Ranchi"];
        updated = true;
      }
      if (updated) {
        await manager.save();
        console.log("[salesBootstrap] Updated Rahul Sharma with Ranchi/Jharkhand assignment.");
      }
    }

    const managerId = manager ? manager._id : null;

    // 3. Default Businesses across States & Cities
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

      // Jharkhand - Dhanbad
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
        notes: "Premier commercial hotel in the heart of Dhanbad.",
        assignedManager: null,
      },
      {
        name: "Black Diamond Diner",
        code: "BIZ-JH-DHN-002",
        category: "Restaurant",
        state: "Jharkhand",
        city: "Dhanbad",
        address: "Saraidhela Main Road, Dhanbad, Jharkhand 826004",
        phone: "+91 326 231 2233",
        email: "contact@blackdiamonddiner.com",
        monthlyTarget: 180000,
        notes: "Fine dining North Indian and Mughlai specialty restaurant.",
        assignedManager: null,
      },

      // Rajasthan - Jaipur
      {
        name: "Royal Rajputana Palace",
        code: "BIZ-RJ-JAI-001",
        category: "Hotel",
        state: "Rajasthan",
        city: "Jaipur",
        address: "MI Road, Pink City, Jaipur, Rajasthan 302001",
        phone: "+91 141 237 8899",
        email: "reservations@rajputanapalace.com",
        monthlyTarget: 450000,
        notes: "Heritage palace hotel offering authentic Rajasthani hospitality.",
        assignedManager: null,
      },
      {
        name: "Chokhi Dhani Delights",
        code: "BIZ-RJ-JAI-002",
        category: "Restaurant",
        state: "Rajasthan",
        city: "Jaipur",
        address: "Tonk Road, Jaipur, Rajasthan 302018",
        phone: "+91 141 238 9900",
        email: "dine@chokhidhanidelights.com",
        monthlyTarget: 280000,
        notes: "Traditional Rajasthani thali and cultural dining experience.",
        assignedManager: null,
      },

      // Tamil Nadu - Coimbatore
      {
        name: "Hotel Tamil Residency",
        code: "BIZ-TN-CBE-001",
        category: "Hotel",
        state: "Tamil Nadu",
        city: "Coimbatore",
        address: "Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu 641004",
        phone: "+422 257 3344",
        email: "contact@tamilresidency.com",
        monthlyTarget: 320000,
        notes: "Upscale business hotel near Coimbatore Airport.",
        assignedManager: null,
      },
      {
        name: "Kovai Flavors Kitchen",
        code: "BIZ-TN-CBE-002",
        category: "Restaurant",
        state: "Tamil Nadu",
        city: "Coimbatore",
        address: "DB Road, RS Puram, Coimbatore, Tamil Nadu 641002",
        phone: "+422 258 4455",
        email: "dine@kovaiflavors.com",
        monthlyTarget: 210000,
        notes: "Kongunadu culinary traditional and chettinad delicacies.",
        assignedManager: null,
      },

      // Karnataka - Raichur
      {
        name: "Krishna River View Hotel",
        code: "BIZ-KA-RAI-001",
        category: "Hotel",
        state: "Karnataka",
        city: "Raichur",
        address: "Station Road, Beside APMC Yard, Raichur, Karnataka 584101",
        phone: "+8532 224 556",
        email: "reservations@krishnariverview.com",
        monthlyTarget: 200000,
        notes: "Commercial executive hotel for business travelers and tourists.",
        assignedManager: null,
      },
      {
        name: "Raichur Spices Diner",
        code: "BIZ-KA-RAI-002",
        category: "Restaurant",
        state: "Karnataka",
        city: "Raichur",
        address: "Lingasugur Road, Raichur, Karnataka 584102",
        phone: "+8532 225 667",
        email: "info@raichurspices.com",
        monthlyTarget: 160000,
        notes: "North Karnataka jowar rotti and spicy South Indian meals.",
        assignedManager: null,
      },

      // Assam - Guwahati
      {
        name: "Brahmaputra Grand",
        code: "BIZ-AS-GUW-001",
        category: "Hotel",
        state: "Assam",
        city: "Guwahati",
        address: "GS Road, Christian Basti, Guwahati, Assam 781005",
        phone: "+91 361 246 1122",
        email: "stay@brahmaputragrand.com",
        monthlyTarget: 300000,
        notes: "Luxury riverside hotel with state-of-the-art corporate event suites.",
        assignedManager: null,
      },
      {
        name: "Kaziranga Dine",
        code: "BIZ-AS-GUW-002",
        category: "Restaurant",
        state: "Assam",
        city: "Guwahati",
        address: "Uzan Bazar, Riverside Road, Guwahati, Assam 781001",
        phone: "+91 361 247 2233",
        email: "taste@kazirangadine.com",
        monthlyTarget: 190000,
        notes: "Authentic Assamese and North-Eastern indigenous cuisine.",
        assignedManager: null,
      },

      // Odisha - Bhubaneswar
      {
        name: "Temple City Residency",
        code: "BIZ-OD-BHU-001",
        category: "Hotel",
        state: "Odisha",
        city: "Bhubaneswar",
        address: "Janpath, Kharvel Nagar, Bhubaneswar, Odisha 751001",
        phone: "+91 674 250 7788",
        email: "bookings@templecityresidency.com",
        monthlyTarget: 260000,
        notes: "Modern smart-stay hotel near Bhubaneswar Smart City hub.",
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

    // 4. Seed Monthly Sales Records for September 2026 and October 2026
    const hotelRoyal = await SalesBusiness.findOne({ name: "Hotel Royal", city: "Ranchi" });
    const mayaRestaurant = await SalesBusiness.findOne({ name: "Maya Multicuisine Restaurant", city: "Ranchi" });
    const hotelGreenHorizon = await SalesBusiness.findOne({ name: "Hotel Green Horizon", city: "Ranchi" });
    const heavenLounge = await SalesBusiness.findOne({ name: "Heaven Lounge & Bar", city: "Ranchi" });
    const coalCapital = await SalesBusiness.findOne({ name: "Coal Capital Grand", city: "Dhanbad" });
    const cbeHotel = await SalesBusiness.findOne({ name: "Hotel Tamil Residency", city: "Coimbatore" });
    const raiHotel = await SalesBusiness.findOne({ name: "Krishna River View Hotel", city: "Raichur" });

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
          remarks: "Exceeded target",
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
          remarks: "Conference surge",
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
          remarks: "Nearly met quota",
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
          orders: 130,
          target: 250000,
          remarks: "Weekend crowds",
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
          orders: 142,
          target: 250000,
          remarks: "Festive kickoff",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Coal Capital Grand (Dhanbad)
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
          orders: 88,
          target: 220000,
          remarks: "Stable corporate bookings",
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
          orders: 98,
          target: 220000,
          remarks: "Approaching target",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Hotel Tamil Residency (Coimbatore)
        cbeHotel && {
          business: cbeHotel._id,
          businessName: cbeHotel.name,
          category: cbeHotel.category,
          state: cbeHotel.state,
          city: cbeHotel.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 310000,
          orders: 140,
          target: 320000,
          remarks: "Textile expo visitors",
          uploadedBy: uploaderId,
          uploaderName,
          source: "manual",
        },

        // Krishna River View Hotel (Raichur)
        raiHotel && {
          business: raiHotel._id,
          businessName: raiHotel.name,
          category: raiHotel.category,
          state: raiHotel.state,
          city: raiHotel.city,
          month: 10,
          year: 2026,
          monthName: "October 2026",
          totalSales: 195000,
          orders: 95,
          target: 200000,
          remarks: "Thermal plant delegates",
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

    console.log("[salesBootstrap] Verified locations, businesses and sales records.");
  } catch (error) {
    console.error("[salesBootstrap] Error:", error.message);
  }
}

module.exports = { ensureSalesData };
