// const mongoose = require("mongoose");

// const PropertyExtractRedinSchema = new mongoose.Schema({
//   property: {
//     id: { type: Number, required: true },
//     name: { type: String, required: true }
//   },
//   main_subtype_name: { type: String, required: true },
//   main_type_name: { type: String, required: true }
// }, { _id: false });

// const GeoPointSchema = new mongoose.Schema({
//   lat: {
//     type: Number,
//     required: true
//   },
//   lon: {
//     type: Number,
//     required: true
//   }
// }, { _id: false });

// const ExtractRedinLocation = new mongoose.Schema({
//   location_id: {
//     type: Number,
//     required: true,
//     unique: true
//   },

//   geo_point:{
//     type: GeoPointSchema, 
//     default: []
//   },
//   properties: {
//     type: [PropertyExtractRedinSchema],
//     default: []
//   }
// }, { timestamps: true });

// module.exports = mongoose.model("ExtractRedinLocation", ExtractRedinLocation);





// const mongoose = require("mongoose");

// const PropertyExtractRedinSchema = new mongoose.Schema({
//   property: {
//     id: { type: Number, required: true },
//     name: { type: String, required: true }
//   },
//   main_subtype_name: { type: String, required: true },
//   main_type_name: { type: String, required: true }
// }, { _id: false });

// const GeoPointSchema = new mongoose.Schema({
//   lat: {
//     type: Number,
//     required: true
//   },
//   lon: {
//     type: Number,
//     required: true
//   }
// }, { _id: false });

// const ExtractRedinLocation = new mongoose.Schema({
//   location_id: {
//     type: Number,
//     required: true,
//     unique: true
//   },

//   geo_point:{
//     type: GeoPointSchema, 
//     default: []
//   },
//   properties: {
//     type: [PropertyExtractRedinSchema],
//     default: []
//   }
// }, { timestamps: true });

// module.exports = mongoose.model("ExtractRedinLocation", ExtractRedinLocation);


const mongoose = require("mongoose");

const PropertyExtractRedinSchema = new mongoose.Schema(
  {
    property: {
      id: { type: Number, required: true },
      name: { type: String, required: true },
    },
    main_subtype_name: { type: String, required: true },
    main_type_name: { type: String, required: true },
  },
  { _id: false }
);

const GeoPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  { _id: false }
);

const ExtractRedinLocationSchema = new mongoose.Schema(
  {
    location_id: { type: Number, required: true, unique: true },

    geo_point: {
      type: GeoPointSchema,
      default: null,
    },

    properties: {
      type: [PropertyExtractRedinSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ✅ INDEXES MUST BE ON PARENT SCHEMA
ExtractRedinLocationSchema.index({ location_id: 1 }, { unique: true });
ExtractRedinLocationSchema.index({ "properties.property.name": 1 });
ExtractRedinLocationSchema.index({
  "properties.property.name": 1,
  "properties.main_subtype_name": 1,
});

module.exports = mongoose.model("ExtractRedinLocation", ExtractRedinLocationSchema);

