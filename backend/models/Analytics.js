const mongoose = require("mongoose");

const AnalyticsSchema = new mongoose.Schema({
  shortUrl: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  osType: { type: String },
  deviceType: { type: String },
  country: { type: String },
  city: { type: String },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Analytics", AnalyticsSchema);
