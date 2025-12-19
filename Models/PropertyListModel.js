const mongoose = require('mongoose');

const PropertyListModel = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  telephone: { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true, lowercase: true },
  preferredDate: { type: String, trim: true },
  preferredTime: { type: String, trim: true },
  address: { type: String, trim: true },
  salesforceSynced:{type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PropertyListModel', PropertyListModel);
