const mongoose = require("mongoose");
const { Schema } = mongoose;

const clientSalesRecordSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "daily",
    },
    reportingMonth: {
      type: String,
      trim: true,
      index: true,
    },
    grossSales: {
      type: Number,
      default: 0,
    },
    discounts: {
      type: Number,
      default: 0,
    },
    refunds: {
      type: Number,
      default: 0,
    },
    netRevenue: {
      type: Number,
      default: 0,
    },
    costOfGoodsSold: {
      type: Number,
      default: 0,
    },
    salesChannel: {
      type: String,
      default: "In-Store / Direct",
    },
    totalRevenue: {
      type: Number,
      required: true,
      default: 0,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
    },
    returnsCount: {
      type: Number,
      default: 0,
    },
    returnsAmount: {
      type: Number,
      default: 0,
    },
    adAttributedRevenue: {
      type: Number,
      default: 0,
    },
    verificationStatus: {
      type: String,
      enum: ["Verified", "Pending Review", "Estimated", "verified", "pending", "Pending", "estimated"],
      default: "Verified",
    },
    dataSource: {
      type: String,
      default: "Manual Entry",
    },
    categoryBreakdown: [
      {
        category: { type: String, required: true },
        amount: { type: Number, default: 0 },
        itemsSold: { type: Number, default: 0 },
      },
    ],
    topProducts: [
      {
        name: { type: String, required: true },
        category: { type: String, default: "General" },
        revenue: { type: Number, default: 0 },
        unitsSold: { type: Number, default: 0 },
      },
    ],
    // Industry-specific data
    cafeDetails: {
      reservationsCount: { type: Number, default: 0 },
      diningCovers: { type: Number, default: 0 },
      topMenuItems: [
        {
          name: String,
          orders: Number,
          revenue: Number,
        },
      ],
      promotionsRedeemed: { type: Number, default: 0 },
    },
    clothingDetails: {
      sizeBreakdown: [
        {
          size: String,
          unitsSold: Number,
        },
      ],
      colorBreakdown: [
        {
          color: String,
          unitsSold: Number,
        },
      ],
      returnRatePercent: { type: Number, default: 0 },
      inventoryStockOnHand: { type: Number, default: 0 },
    },
    jewelleryDetails: {
      metalBreakdown: [
        {
          metal: String,
          purity: String,
          weightGrams: Number,
          revenue: Number,
        },
      ],
      itemSales: [
        {
          itemCode: String,
          name: String,
          revenue: Number,
        },
      ],
      inventoryValue: { type: Number, default: 0 },
    },
    source: {
      type: String,
      default: "Manual Entry",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Auto compute revenue and average order value if missing
clientSalesRecordSchema.pre("save", function () {
  if (this.grossSales > 0 && !this.netRevenue) {
    this.netRevenue = Math.max(0, this.grossSales - (this.discounts || 0) - (this.refunds || 0));
  }
  if (this.netRevenue > 0 && !this.totalRevenue) {
    this.totalRevenue = this.netRevenue;
  } else if (this.totalRevenue > 0 && !this.netRevenue) {
    this.netRevenue = this.totalRevenue;
  }
  if (!this.grossSales && this.totalRevenue > 0) {
    this.grossSales = this.totalRevenue + (this.discounts || 0) + (this.refunds || 0);
  }
  if (this.ordersCount > 0 && !this.averageOrderValue) {
    this.averageOrderValue = Math.round((this.totalRevenue || this.grossSales || 0) / this.ordersCount);
  }
});

module.exports = mongoose.model("ClientSalesRecord", clientSalesRecordSchema);
