const mongoose = require("mongoose");

const valuationPropertyTableModel = new mongoose.Schema({
      
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  phone: {
    type: String
  },
  telephone: {
    type: String
  },
  preferredDate: {
    type: Date
  },
  preferredTime: {
    type: String
  },
  propertyAddress: {
    type: String
  },

  communityTowerName: {
    type: String
  },
  relation: {
    type: String,
    enum: ["Friend", "Family", "Colleague", "Other"]
  },
  propertyType: {
    type: String
  },
  numberOfBedrooms: {
    type: Number
  },
  numberOfBathrooms: {
    type: Number
  },
  unitSize: {
    type: Number // in sq ft
  },
  floor: {
    type: String
  },
  views: {
    type: String
  },
  upgrades: {
    type: String
  },

  // Step 3 Fields - Provide your details
  name: {
    type: String
  },
  email: {
    type: String
  },

  // System Fields
  submittedAt: {
    type: Date,
    default: Date.now
  },
  currentStep: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("PropertyValuation", valuationPropertyTableModel);