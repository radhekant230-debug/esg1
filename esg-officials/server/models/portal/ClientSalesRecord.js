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

// Auto compute average order value if missing
clientSalesRecordSchema.pre("save", function () {
  if (this.ordersCount > 0 && !this.averageOrderValue) {
    this.averageOrderValue = Math.round(this.totalRevenue / this.ordersCount);
  }
});

module.exports = mongoose.model("ClientSalesRecord", clientSalesRecordSchema);
