const mongoose = require("mongoose");

const OffplanDownloadSchema = new mongoose.Schema({
  firstName:        { type: String, required: true, trim: true },
  lastName:         { type: String, required: true, trim: true },
  email:            { type: String, required: true, trim: true, lowercase: true },
  phone:            { type: String, required: true, trim: true },
  propertyLink:     { type: String, required: true, trim: true },
  downloadType:     { type: String, required: true, trim: true },
  salesforceSynced: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now },
});

module.exports = mongoose.model("OffplanDownload", OffplanDownloadSchema);