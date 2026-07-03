const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  mt5UserId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "usd",
  },
  stripeId: {
    type: String,
    required: true,
  },
  license: {
    type: mongoose.Schema.ObjectId,
    ref: "License",
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Transaction", TransactionSchema);
