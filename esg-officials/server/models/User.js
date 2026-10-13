const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ['admin', 'manager', 'client'],
      default: 'client'
    },

    // Unique ID given to each client
    // Example: CLI-2026-0001
    clientId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    companyName: {
      type: String,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    // Manager assigned to this client
    assignedManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Geographical assignments for State Sales Managers
    assignedState: {
      type: String,
      trim: true,
      default: ""
    },

    assignedCity: {
      type: String,
      trim: true,
      default: ""
    },

    assignedStates: [
      {
        type: String,
        trim: true
      }
    ],

    assignedCities: [
      {
        type: String,
        trim: true
      }
    ],

    assignedBusinesses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SalesBusiness"
      }
    ],

    isVerified: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Generate a unique Client ID automatically
userSchema.pre("save", async function () {
  if (this.role === "client" && !this.clientId) {
    const year = new Date().getFullYear();

    const lastClient = await mongoose
      .model("User")
      .findOne({
        role: "client",
        clientId: { $exists: true },
      })
      .sort({ createdAt: -1 });

    let number = 1;

    if (lastClient && lastClient.clientId) {
      const match = lastClient.clientId.match(/(\d+)$/);

      if (match) {
        number = parseInt(match[1], 10) + 1;
      }
    }

    this.clientId = `CLI-${year}-${String(number).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model('User', userSchema);