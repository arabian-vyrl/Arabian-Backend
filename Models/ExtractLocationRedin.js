const mongoose = require("mongoose");

const PropertyExtractRedinSchema = new mongoose.Schema({
  property: {
    id: { type: Number, required: true },
    name: { type: String, required: true }
  },
  main_subtype_name: { type: String, required: true },
  main_type_name: { type: String, required: true }
}, { _id: false });

const GeoPointSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  }
}, { _id: false });

const ExtractRedinLocation = new mongoose.Schema({
  location_id: {
    type: Number,
    required: true,
    unique: true
  },

  geo_point:{
    type: GeoPointSchema, 
    default: []
  },
  properties: {
    type: [PropertyExtractRedinSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("ExtractRedinLocation", ExtractRedinLocation);