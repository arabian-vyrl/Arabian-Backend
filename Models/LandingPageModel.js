const mongoose = require("mongoose");

const landingPageSchema = new mongoose.Schema({
  _id: String,
  content: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model("LandingPage", landingPageSchema);
