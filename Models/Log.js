const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  level: String,
  message: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  meta: Object, // optional (userId, route, etc.)
});

module.exports = mongoose.model("Log", logSchema);