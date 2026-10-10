const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientProfileSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      enum: ["cafe_restaurant", "cafe", "restaurant", "clothing_fashion", "clothing", "jewellery", "retail", "retail_service", "other"],
      default: "other",
    },
    contactPersonName: {
      type: String,
      trim: true,
      default: "",
    },
    serviceStartDate: {
      type: Date,
      default: Date.now,
    },
    reportingPeriod: {
      type: String,
      default: "Monthly",
    },
    retainerAmount: {
      type: Number,
      default: 0,
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    tagline: {
      type: String,
      trim: true,
      default: "Marketing & Business Performance",
    },
    welcomeMessage: {
      type: String,
      trim: true,
      default: "Welcome to your ESG Officials Marketing & Performance Portal.",
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    // Account Manager Override / Details
    accountManagerDetails: {
      name: { type: String, default: "Rahul Sharma" },
      email: { type: String, default: "rahul.manager@esgofficial.com" },
      phone: { type: String, default: "+91 98765 43210" },
      role: { type: String, default: "Senior Growth Strategist" },
    },
    // Services purchased by this specific client (Controls visible dashboard widgets)
    servicesPurchased: {
      type: [String],
      default: [
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
    },
    // External Integrations & Honest Statuses
    integrations: {
      metaAds: {
        status: {
          type: String,
          enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed", "Last Synced"],
          default: "Connected",
        },
        accountId: { type: String, default: "act_49201948210" },
        lastSyncedAt: { type: Date, default: Date.now },
      },
      googleAds: {
        status: {
          type: String,
          enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed", "Last Synced"],
          default: "Connected",
        },
        accountId: { type: String, default: "629-401-8821" },
        lastSyncedAt: { type: Date, default: Date.now },
      },
      instagram: {
        status: {
          type: String,
          enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed", "Last Synced"],
          default: "Connected",
        },
        handle: { type: String, default: "@cafemysa.official" },
        lastSyncedAt: { type: Date, default: Date.now },
      },
      facebook: {
        status: {
          type: String,
          enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed", "Last Synced"],
          default: "Connected",
        },
        pageName: { type: String, default: "Café Mysa" },
        lastSyncedAt: { type: Date, default: Date.now },
      },
      googleBusinessProfile: {
        status: {
          type: String,
          enum: ["Connected", "Not Connected", "Configuration Required", "Sync Failed", "Last Synced"],
          default: "Connected",
        },
        locationId: { type: String, default: "loc_89214710" },
        lastSyncedAt: { type: Date, default: Date.now },
      },
    },
    // Commercials / Package configuration
    servicePackage: {
      name: { type: String, default: "Full-Stack Brand & Performance Growth" },
      monthlyFee: { type: Number, default: 45000 },
      billingCycle: { type: String, default: "Monthly" },
      servicesIncluded: {
        type: [String],
        default: [
          "Meta & Google Ads Campaign Management",
          "Social Media Content Production (Reels, Static, Carousels)",
          "Lead Nurturing & Follow-up Tracking",
          "Local SEO & Google Business Optimization",
          "Weekly Performance Reporting & Analytics Review",
        ],
      },
    },
    lastReportUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClientProfile", clientProfileSchema);
