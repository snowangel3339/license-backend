const mongoose = require("mongoose");

const LicenseSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  mt5UserId: {
    type: String,
    required: true,
  },
  brokerName: {
    type: String,
    required: false,
    default: "",
    trim: true,
  },
  tradingPlatform: {
    type: String,
    enum: ["mt4", "mt5"],
    default: "mt5",
  },
  stripePaymentId: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ["active", "expired", "suspended", "paused"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: null,
    required: false,
  },
  plan: {
    type: String,
    enum: ["monthly", "yearly", "three_year", "lifetime"],
    required: true,
  },
  autoTradeEnabled: {
    type: Boolean,
    default: true,
  },
  linkedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

module.exports = mongoose.model("License", LicenseSchema);
