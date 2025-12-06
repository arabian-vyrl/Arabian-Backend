const mongoose = require('mongoose');

const LocationRedinSchema = new mongoose.Schema({
  city_id: {
    type: Number,
    required: true
  },
  city_name: {
    type: String,
    required: true
  },
  country_code: {
    type: String,
    required: true
  },
  county_id: {
    type: Number,
    default: null
  },
  county_name: {
    type: String,
    default: null
  },
  district_id: {
    type: Number,
    default: null
  },
  district_name: {
    type: String,
    default: null
  },
  geo_point: {
    type: {
      lat: Number,
      lon: Number
    },
    default: null
  },
  location_id: {
    type: Number,
    required: true,
    unique: true  
  },
  location_name: {
    type: String,
    required: true
  }
}, { timestamps: true });

LocationRedinSchema.index({ city_name: 1 });
LocationRedinSchema.index({ location_id: 1 });

module.exports = mongoose.model('LocationRedin', LocationRedinSchema);