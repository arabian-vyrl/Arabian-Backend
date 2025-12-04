const mongoose = require('mongoose');

const OffPlanContactSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, trim: true, lowercase: true },
  mobile:      { type: String, required: true, trim: true },
  projectName: { type: String, required: true, trim: true },
  budgetRange: { type: String, trim: true },
  source:      { type: String, trim: true }, 
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('OffPlanContact', OffPlanContactSchema);
