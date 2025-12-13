// const Property = require("../Models/PropertyModel");

// function toAmenitySlugs(q) {
//   if (!q) return [];
//   return q.split(",")
//     .map(s => s.trim())
//     .filter(Boolean)
//     .map(label => labelToSlug[label] || label.toLowerCase().replace(/\s+/g,"-"));
// }
// const labelToSlug = {
//   "Central A/C": "central-ac",      // adjust if your data uses e.g. "central-ac"
//   "Balcony": "balcony",
//   "Water View": "view-of-water",
//   "Private Pool": "private-pool",
//   "Beach Access": "beach-access",
//   "Gym": "shared-gym",               // or "gym" depending on your feed
//   "Shared Spa": "shared-spa",
//   "Parking": "covered-parking",      // adjust if needed
//   "Security": "security",
//   "Garden": "garden",
//   "Elevator": "elevator",
//   "Maid Room": "maids-room",
//   "Study Room": "study-room",
//   "Storage": "storage",
//   "Built-in Wardrobes": "built-in-wardrobes",
//   "Kitchen Appliances": "kitchen-appliances",
// };


// function furnishingToBool(f) {
//   if (!f) return null;
//   const v = f.toLowerCase();
//   if (v === "furnished") return true;
//   if (v === "unfurnished") return false;
//   return null;
// }
// const UniversalSpecializedFilter = async (req, res) => {
//   try {
//     const page  = parseInt(req.query.page)  || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip  = (page - 1) * limit;

//     const listingTypeParam = req.query.listingType || "Sale";
//     const listingTypes = listingTypeParam.split(",").map(t => t.trim());
//     const sortBy = (req.query.sortBy || "newest").toLowerCase();

//     const minPrice = req.query.minPrice ? parseInt(req.query.minPrice, 10) : null;
//     const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : null;

//     const minSize = req.query.minSize ? parseInt(req.query.minSize, 10) : null;
//     const maxSize = req.query.maxSize ? parseInt(req.query.maxSize, 10) : null;

//     const amenitySlugs = toAmenitySlugs(req.query.amenities);
//     const furnishedBool = furnishingToBool(req.query.furnishing);

//     // -------- base (string/regex) filters only ----------
//     const baseMatch = {};
//     baseMatch.listing_type = listingTypes.length === 1 ? listingTypes[0] : { $in: listingTypes };

//     if (req.query.propertyType && req.query.propertyType !== "") {
//       baseMatch.property_type =
//         req.query.propertyType.toLowerCase() === "studio"
//           ? /^studio$/i
//           : new RegExp(req.query.propertyType, "i");
//     }

//     if (req.query.bedrooms && req.query.bedrooms !== "") {
//       if (req.query.bedrooms.toLowerCase() === "studio") {
//         baseMatch["general_listing_information.bedrooms"] = /studio/i;
//       } else if (req.query.bedrooms === "5+") {
//         baseMatch["general_listing_information.bedrooms"] = { $regex: /^[5-9]\d*$|^[1-9]\d{1,}$/ };
//       } else {
//         baseMatch["general_listing_information.bedrooms"] = req.query.bedrooms;
//       }
//     }

//     if (req.query.address) {
//       baseMatch["custom_fields.pba__addresstext_pb"] = new RegExp(req.query.address, "i");
//     }

//     if (req.query.developer) {
//       baseMatch["custom_fields.developer"] = new RegExp(req.query.developer, "i");
//     }

//     if (req.query.bathrooms) {
//       baseMatch["general_listing_information.fullbathrooms"] = req.query.bathrooms;
//     }

//     // -------- pipeline ----------
//     const pipeline = [
//       { $match: baseMatch },

//       {
//         $addFields: {
//           numericPrice: {
//             $convert: {
//               input: {
//                 $replaceAll: {
//                   input: {
//                     $replaceAll: {
//                       input: { $toString: "$general_listing_information.listingprice" },
//                       find: ",",
//                       replacement: ""
//                     }
//                   },
//                   find: "AED",
//                   replacement: ""
//                 }
//               },
//               to: "double", onError: 0, onNull: 0
//             }
//           }
//         }
//       },

//       // Numeric area: prefer general_listing_information.totalarea, fallback to plot_size/plot_area
//       {
//         $addFields: {
//           _areaRaw: {
//             $ifNull: [
//               "$general_listing_information.totalarea",
//               { $ifNull: [ "$custom_fields.plot_size", "$custom_fields.plot_area" ] }
//             ]
//           }
//         }
//       },
//       {
//         $addFields: {
//           numericArea: {
//             $convert: {
//               input: {
//                 $replaceAll: { input: { $toString: "$_areaRaw" }, find: ",", replacement: "" }
//               },
//               to: "double", onError: 0, onNull: 0
//             }
//           }
//         }
//       },

//       // Furnishing normalization to boolean
//       {
//         $addFields: {
//           _furnLower: { $toLower: { $ifNull: ["$custom_fields.furnished", ""] } },
//           isFurnished: {
//             $cond: [
//               { $in: [{ $toLower: { $ifNull: ["$custom_fields.furnished",""] } }, ["yes","furnished","true"]] },
//               true,
//               {
//                 $cond: [
//                   { $in: [{ $toLower: { $ifNull: ["$custom_fields.furnished",""] } }, ["no","unfurnished","false"]] },
//                   false,
//                   null
//                 ]
//               }
//             ]
//           }
//         }
//       },

//       // Amenities -> array
//       {
//         $addFields: {
//           amenitiesArr: {
//             $filter: {
//               input: {
//                 $map: {
//                   input: { $split: [{ $ifNull: ["$custom_fields.private_amenities",""] }, ","] },
//                   as: "a",
//                   in: { $trim: { input: "$$a" } }
//                 }
//               },
//               as: "x",
//               cond: { $ne: ["$$x", ""] }
//             }
//           }
//         }
//       },

//       // Bedrooms numeric for sort
//       {
//         $addFields: {
//           numericBedrooms: {
//             $cond: [
//               { $eq: ["$general_listing_information.bedrooms", "Studio"] },
//               0,
//               {
//                 $convert: {
//                   input: "$general_listing_information.bedrooms",
//                   to: "int",
//                   onError: 0, onNull: 0
//                 }
//               }
//             ]
//           }
//         }
//       }
//     ];

//     // Price range after conversion
//     const priceMatch = {};
//     if (minPrice !== null) priceMatch.numericPrice = { ...(priceMatch.numericPrice || {}), $gte: minPrice };
//     if (maxPrice !== null) priceMatch.numericPrice = { ...(priceMatch.numericPrice || {}), $lte: maxPrice };
//     if (Object.keys(priceMatch).length) pipeline.push({ $match: priceMatch });

//     // Size range after conversion
//     const sizeMatch = {};
//     if (minSize !== null) sizeMatch.numericArea = { ...(sizeMatch.numericArea || {}), $gte: minSize };
//     if (maxSize !== null) sizeMatch.numericArea = { ...(sizeMatch.numericArea || {}), $lte: maxSize };
//     if (Object.keys(sizeMatch).length) pipeline.push({ $match: sizeMatch });

//     // Furnishing match
//     if (furnishedBool !== null) {
//       pipeline.push({ $match: { isFurnished: furnishedBool } });
//     }

//     // Amenities match (require ALL selected; switch to $in for ANY)
//     if (amenitySlugs.length) {
//       const amenityRegexes = amenitySlugs.map(s => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
//       pipeline.push({ $match: { amenitiesArr: { $all: amenityRegexes } } });
//     }

//     // Sorting
//     let sortStage = { createdAt: -1 };
//     switch (sortBy) {
//       case "highest_price":
//       case "price-high": sortStage = { numericPrice: -1 }; break;
//       case "lowest_price":
//       case "price-low":  sortStage = { numericPrice: 1  }; break;
//       case "most_bedrooms":  sortStage = { numericBedrooms: -1 }; break;
//       case "least_bedrooms": sortStage = { numericBedrooms: 1  }; break;
//       case "newest":
//       case "most_recent":
//       default: sortStage = { createdAt: -1 };
//     }

//     pipeline.push(
//       { $sort: sortStage },
//       { $facet: {
//           docs:  [{ $skip: skip }, { $limit: limit }],
//           total: [{ $count: "count" }]
//         }
//       }
//     );

//     const PropertyModel = Property;
//     const agg = await PropertyModel.aggregate(pipeline);
//     const docs = agg?.[0]?.docs || [];
//     const totalCount = agg?.[0]?.total?.[0]?.count || 0;
//     const totalPages = Math.max(1, Math.ceil(totalCount / limit));

//     const sortDescriptions = {
//       most_recent: "most recent first",
//       newest: "newest first",
//       highest_price: "highest price first",
//       "price-high": "highest price first",
//       lowest_price: "lowest price first",
//       "price-low": "lowest price first",
//       most_bedrooms: "most bedrooms first",
//       least_bedrooms: "least bedrooms first",
//     };

//     res.status(200).json({
//       success: true,
//       message: `Found ${docs.length} properties (${listingTypes.join(", ")}) - sorted by ${sortDescriptions[sortBy] || "most recent first"}`,
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalCount,
//         limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       filters: {
//         listingTypes,
//         propertyType: req.query.propertyType || null,
//         priceRange: { min: minPrice, max: maxPrice },
//         sizeRange: { min: minSize, max: maxSize },
//         furnishing: req.query.furnishing || null,
//         amenities: amenitySlugs,
//         bedrooms: req.query.bedrooms || null,
//         address: req.query.address || null,
//         developer: req.query.developer || null,
//         sortBy,
//         sortDescription: sortDescriptions[sortBy] || "most recent first",
//       },
//       count: docs.length,
//       data: docs,
//     });

//   } catch (err) {
//     console.error("Error in Universal Filter:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to filter and sort properties",
//       error: err.message,
//       pagination: { currentPage: 1, totalPages: 0, totalCount: 0, limit: parseInt(req.query.limit) || 10, hasNextPage: false, hasPrevPage: false },
//       data: [],
//     });
//   }
// };



// const SortProperties = async (req, res) => {
//   try {
//     // FIXED: Normalize offering type
//     const rawOfferingType = req.query.offeringType || req.query.type || "Sale";
//     const offeringType = normalizeOfferingType(rawOfferingType);
//     const PropertyModel = getPropertyModelByOfferingType(offeringType);
//     const collectionName = getCollectionName(offeringType);

//     console.log("Raw Offering Type:", rawOfferingType);
//     console.log("Normalized Offering Type:", offeringType);
//     console.log(`Using ${PropertyModel.modelName} collection for sorting`);

//     const sortBy = req.query.sortBy || "most_recent";
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 30;
//     const skip = (page - 1) * limit;

//     // UPDATED: Remove status filter since all properties in collections are now Live
//     const baseQuery = {};

//     let sortOptions = {};
//     let useAggregation = false;
//     let aggregationPipeline = [];

//     switch (sortBy.toLowerCase()) {
//       case "most_recent":
//       case "newest":
//         sortOptions = { createdAt: -1 };
//         break;
//       case "highest_price":
//       case "price-high":
//         sortOptions = { "general_listing_information.listingprice": -1 };
//         break;
//       case "lowest_price":
//       case "price-low":
//         sortOptions = { "general_listing_information.listingprice": 1 };
//         break;
//       case "most_bedrooms":
//         useAggregation = true;
//         aggregationPipeline = [
//           { $match: baseQuery },
//           {
//             $addFields: {
//               numericBedrooms: {
//                 $cond: {
//                   if: {
//                     $eq: ["$general_listing_information.bedrooms", "Studio"],
//                   },
//                   then: 0,
//                   else: {
//                     $convert: {
//                       input: "$general_listing_information.bedrooms",
//                       to: "int",
//                       onError: 0,
//                       onNull: 0,
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           { $sort: { numericBedrooms: -1 } },
//           { $skip: skip },
//           { $limit: limit },
//         ];
//         break;
//       case "least_bedrooms":
//         useAggregation = true;
//         aggregationPipeline = [
//           { $match: baseQuery },
//           {
//             $addFields: {
//               numericBedrooms: {
//                 $cond: {
//                   if: {
//                     $eq: ["$general_listing_information.bedrooms", "Studio"],
//                   },
//                   then: 0,
//                   else: {
//                     $convert: {
//                       input: "$general_listing_information.bedrooms",
//                       to: "int",
//                       onError: 0,
//                       onNull: 0,
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           { $sort: { numericBedrooms: 1 } },
//           { $skip: skip },
//           { $limit: limit },
//         ];
//         break;
//       case "oldest":
//         sortOptions = { createdAt: 1 };
//         break;
//       case "popular":
//       default:
//         sortOptions = { createdAt: -1 };
//         break;
//     }

//     const totalCount = await PropertyModel.countDocuments(baseQuery);
//     const totalPages = Math.ceil(totalCount / limit);

//     let properties = [];
//     if (useAggregation) {
//       properties = await PropertyModel.aggregate(aggregationPipeline);
//     } else {
//       properties = await PropertyModel.find(baseQuery)
//         .sort(sortOptions)
//         .skip(skip)
//         .limit(limit)
//         .lean();
//     }

//     const sortDescriptions = {
//       most_recent: "most recent first",
//       newest: "newest first",
//       highest_price: "highest price first",
//       "price-high": "highest price first",
//       lowest_price: "lowest price first",
//       "price-low": "lowest price first",
//       most_bedrooms: "most bedrooms first",
//       least_bedrooms: "least bedrooms first",
//       oldest: "oldest first",
//       popular: "most popular first",
//     };

//     const sortDescription =
//       sortDescriptions[sortBy.toLowerCase()] || "most recent first";

//     res.status(200).json({
//       success: true,
//       message: `${collectionName} properties sorted by ${sortDescription}`,
//       pagination: {
//         currentPage: page,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       sort: sortBy,
//       count: properties.length,
//       data: properties,
//       debug: {
//         modelUsed: PropertyModel.modelName,
//         rawOfferingType: rawOfferingType,
//         normalizedOfferingType: offeringType,
//         collectionName: collectionName,
//       },
//     });
//   } catch (error) {
//     console.error("Error in SortProperties:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to sort properties",
//       error: error.message,
//     });
//   }
// };

// // const specializedFilter = async (req, res) => {
// //   try {
// //     console.log("Working - Specialized Filter");

// //     // FIXED: Normalize offering type
// //     const rawOfferingType =
// //       req.query.offeringType ||
// //       req.query.type ||
// //       req.query.propertyCollection ||
// //       "Sale";
// //     const offeringType = normalizeOfferingType(rawOfferingType);
// //     const PropertyModel = getPropertyModelByOfferingType(offeringType);
// //     const collectionName = getCollectionName(offeringType);

// //     console.log("Raw Offering Type:", rawOfferingType);
// //     console.log("Normalized Offering Type:", offeringType);
// //     console.log(`Using ${PropertyModel.modelName} collection for filtering`);

// //     // FIXED: Better parameter handling
// //     const minPrice =
// //       req.query.minPrice &&
// //       req.query.minPrice !== "" &&
// //       req.query.minPrice !== "any"
// //         ? req.query.minPrice
// //         : "0";
// //     const maxPrice =
// //       req.query.maxPrice &&
// //       req.query.maxPrice !== "" &&
// //       req.query.maxPrice !== "any"
// //         ? req.query.maxPrice
// //         : "10000000";
// //     const propertyType =
// //       req.query.propertyType && req.query.propertyType !== ""
// //         ? req.query.propertyType
// //         : "all";
// //     const bedrooms =
// //       req.query.bedrooms &&
// //       req.query.bedrooms !== "" &&
// //       req.query.bedrooms !== "any"
// //         ? req.query.bedrooms
// //         : "all";
// //     const location = req.query.location || req.query.address || "";

// //     const page = parseInt(req.query.page) || 1;
// //     const limit = parseInt(req.query.limit) || 30;

// //     // Build the filter query
// //     const filterQuery = {};

// //     // FIXED: Add price range filter with proper numeric conversion
// //     if (minPrice !== "0" || maxPrice !== "10000000") {
// //       filterQuery["general_listing_information.listingprice"] = {};
// //       if (minPrice !== "0") {
// //         const minPriceNum = parseInt(minPrice);
// //         if (!isNaN(minPriceNum)) {
// //           filterQuery["general_listing_information.listingprice"]["$gte"] =
// //             minPriceNum;
// //         }
// //       }
// //       if (maxPrice !== "10000000") {
// //         const maxPriceNum = parseInt(maxPrice);
// //         if (!isNaN(maxPriceNum)) {
// //           filterQuery["general_listing_information.listingprice"]["$lte"] =
// //             maxPriceNum;
// //         }
// //       }
// //     }

// //     // Add property type filter
// //     if (
// //       propertyType &&
// //       propertyType.toLowerCase() !== "all" &&
// //       propertyType.toLowerCase() !== ""
// //     ) {
// //       if (propertyType.includes(",")) {
// //         const propertyTypes = propertyType
// //           .split(",")
// //           .map((type) => type.trim());
// //         filterQuery["general_listing_information.propertytype"] = {
// //           $in: propertyTypes,
// //         };
// //       } else {
// //         filterQuery["general_listing_information.propertytype"] = propertyType;
// //       }
// //     }

// //     // Add bedrooms filter
// //     if (
// //       bedrooms &&
// //       bedrooms.toLowerCase() !== "all" &&
// //       bedrooms.toLowerCase() !== ""
// //     ) {
// //       if (bedrooms.toLowerCase() === "studio" || bedrooms === "0") {
// //         filterQuery["general_listing_information.bedrooms"] = {
// //           $in: ["0", "Studio", "studio"],
// //         };
// //       } else if (bedrooms.toString().endsWith("+")) {
// //         const minBedrooms = parseInt(bedrooms.replace("+", ""));
// //         if (!isNaN(minBedrooms)) {
// //           filterQuery["general_listing_information.bedrooms"] = {
// //             $gte: minBedrooms.toString(),
// //           };
// //         }
// //       } else if (bedrooms.includes(",")) {
// //         const bedroomOptions = bedrooms.split(",").map((bed) => bed.trim());
// //         filterQuery["general_listing_information.bedrooms"] = {
// //           $in: bedroomOptions,
// //         };
// //       } else {
// //         filterQuery["general_listing_information.bedrooms"] =
// //           bedrooms.toString();
// //       }
// //     }

// //     // UPDATED: Add location filter using the correct field
// //     if (location && location.trim() !== "") {
// //       const searchTerm = location.trim();
// //       console.log("Adding location filter for:", searchTerm);
// //       filterQuery["custom_fields.pba__addresstext_pb"] = {
// //         $regex: searchTerm,
// //         $options: "i",
// //       };
// //     }

// //     console.log("Final Filter Query:", JSON.stringify(filterQuery, null, 2));

// //     const skip = (page - 1) * limit;
// //     const totalCount = await PropertyModel.countDocuments(filterQuery);
// //     const totalPages = Math.ceil(totalCount / limit);

// //     if (totalCount === 0) {
// //       return res.status(200).json({
// //         success: true,
// //         message: `No ${collectionName} properties found matching the filter criteria`,
// //         pagination: {
// //           currentPage: page,
// //           totalPages: 0,
// //           totalCount: 0,
// //           perPage: limit,
// //           hasNextPage: false,
// //           hasPrevPage: page > 1,
// //         },
// //         count: 0,
// //         data: [],
// //         debug: {
// //           modelUsed: PropertyModel.modelName,
// //           rawOfferingType: rawOfferingType,
// //           normalizedOfferingType: offeringType,
// //           filterQuery: filterQuery,
// //         },
// //       });
// //     }

// //     const properties = await PropertyModel.find(filterQuery)
// //       .sort({ createdAt: -1 })
// //       .skip(skip)
// //       .limit(limit)
// //       .lean();

// //     const activeFilters = [];
// //     if (minPrice !== "0" || maxPrice !== "10000000") {
// //       activeFilters.push(
// //         `price range: ${minPrice === "0" ? "min" : minPrice} - ${
// //           maxPrice === "10000000" ? "max" : maxPrice
// //         } AED`
// //       );
// //     }
// //     if (propertyType && propertyType.toLowerCase() !== "all") {
// //       activeFilters.push(`property type: ${propertyType}`);
// //     }
// //     if (bedrooms && bedrooms.toLowerCase() !== "all") {
// //       activeFilters.push(`bedrooms: ${bedrooms}`);
// //     }
// //     if (location && location.trim() !== "") {
// //       activeFilters.push(`location: ${location}`);
// //     }

// //     const summaryText =
// //       activeFilters.length > 0
// //         ? `${collectionName} properties filtered by ${activeFilters.join(", ")}`
// //         : `All ${collectionName} properties`;

// //     res.status(200).json({
// //       success: true,
// //       message: summaryText,
// //       pagination: {
// //         currentPage: page,
// //         totalPages: totalPages,
// //         totalCount: totalCount,
// //         perPage: limit,
// //         hasNextPage: page < totalPages,
// //         hasPrevPage: page > 1,
// //       },
// //       count: properties.length,
// //       data: properties,
// //       debug: {
// //         modelUsed: PropertyModel.modelName,
// //         rawOfferingType: rawOfferingType,
// //         normalizedOfferingType: offeringType,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("Error in specializedFilter:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to filter properties",
// //       error: error.message,
// //     });
// //   }
// // };

// // Updated filterByLocation
// // const filterByLocation = async (req, res) => {
// //   try {
// //     const location = req.query.location || req.query.address;

// //     // FIXED: Normalize offering type
// //     const rawOfferingType =
// //       req.query.offeringType ||
// //       req.query.type ||
// //       req.query.propertyCollection ||
// //       "Sale";
// //     const offeringType = normalizeOfferingType(rawOfferingType);
// //     const PropertyModel = getPropertyModelByOfferingType(offeringType);
// //     const collectionName = getCollectionName(offeringType);

// //     console.log("Raw Offering Type:", rawOfferingType);
// //     console.log("Normalized Offering Type:", offeringType);

// //     const page = parseInt(req.query.page) || 1;
// //     const limit = parseInt(req.query.limit) || 30;

// //     if (!location) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Location parameter is required",
// //       });
// //     }

// //     const searchTerm = location.trim();
// //     console.log("Cleaned search term:", searchTerm);

// //     // UPDATED: Remove status filter since all properties in collections are now Live
// //     const combinedQuery = {
// //       "custom_fields.pba__addresstext_pb": {
// //         $regex: searchTerm,
// //         $options: "i",
// //       },
// //     };

// //     console.log("Combined query:", JSON.stringify(combinedQuery, null, 2));

// //     const skip = (page - 1) * limit;
// //     const totalCount = await PropertyModel.countDocuments(combinedQuery);
// //     const totalPages = Math.ceil(totalCount / limit);

// //     if (totalCount === 0) {
// //       return res.status(200).json({
// //         success: true,
// //         message: `No ${collectionName} properties found with "${searchTerm}" in the address`,
// //         pagination: {
// //           currentPage: page,
// //           totalPages: 0,
// //           totalCount: 0,
// //           perPage: limit,
// //           hasNextPage: false,
// //           hasPrevPage: page > 1,
// //         },
// //         searchTerm: searchTerm,
// //         count: 0,
// //         data: [],
// //         debug: {
// //           modelUsed: PropertyModel.modelName,
// //           rawOfferingType: rawOfferingType,
// //           normalizedOfferingType: offeringType,
// //         },
// //       });
// //     }

// //     const properties = await PropertyModel.find(combinedQuery)
// //       .sort({ createdAt: -1 })
// //       .skip(skip)
// //       .limit(limit)
// //       .lean();

// //     res.status(200).json({
// //       success: true,
// //       message: `${collectionName} properties with "${searchTerm}" in address found successfully`,
// //       pagination: {
// //         currentPage: page,
// //         totalPages: totalPages,
// //         totalCount: totalCount,
// //         perPage: limit,
// //         hasNextPage: page < totalPages,
// //         hasPrevPage: page > 1,
// //       },
// //       searchTerm: searchTerm,
// //       count: properties.length,
// //       data: properties,
// //       debug: {
// //         modelUsed: PropertyModel.modelName,
// //         rawOfferingType: rawOfferingType,
// //         normalizedOfferingType: offeringType,
// //         collectionName: collectionName,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("Error in filterByLocation:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to filter properties by location",
// //       error: error.message,
// //     });
// //   }
// // };

// // Updated getAddressSuggestions
// const getAddressSuggestions = async (req, res) => {
//   try {
//     // Get listing_type from query parameters - this is the indexed field at base level
//     const listingType =
//       req.query.listing_type ||
//       req.query.listingType ||
//       req.query.type ||
//       "Sale";

//     const prefix = req.query.prefix;
//     const maxSuggestions = parseInt(req.query.limit) || 8;

//     console.log(
//       `Getting address suggestions for listing_type: "${listingType}"`
//     );

//     if (!prefix) {
//       return res.status(400).json({
//         success: false,
//         message: "Prefix parameter is required",
//       });
//     }

//     if (prefix.length < 2) {
//       return res.json({
//         success: true,
//         message: "Prefix too short",
//         data: [],
//         debug: {
//           listingType: listingType,
//           prefix: prefix,
//         },
//       });
//     }

//     console.log(
//       `Getting address suggestions for prefix: "${prefix}" from ${listingType} properties`
//     );

//     // Build query using listing_type (indexed field at base level) and address field
//     const query = {
//       listing_type: listingType, // Use the indexed field at document root
//       "custom_fields.propertyfinder_region": {
//         $regex: new RegExp(`\\b${prefix}`, "i"),
//       },
//     };

//     // Use a generic Property model or determine the model based on your setup
//     // If you have different models for different listing types, adjust accordingly
//     const properties = await Property.find(query)
//       .limit(5) // Get more results to process
//       .select("custom_fields.pba__addresstext_pb listing_type")
//       .lean();

//     console.log(
//       `Found ${properties.length} ${listingType} properties matching query`
//     );

//     const suggestions = new Set();

//     const processAddress = (fullAddress) => {
//       if (!fullAddress) return;

//       // Split address by common delimiters and process each part
//       const addressParts = fullAddress
//         .split(/[,\/\-_|]+/)
//         .map((part) => part.trim());

//       for (const part of addressParts) {
//         if (part && part.length >= 2) {
//           // Check if this part matches the prefix
//           if (
//             part.toLowerCase().match(new RegExp(`\\b${prefix.toLowerCase()}`))
//           ) {
//             suggestions.add(part);
//             if (suggestions.size >= maxSuggestions) return;
//           }
//         }
//       }
//     };

//     // Process each property's address
//     properties.forEach((property) => {
//       if (property.custom_fields?.pba__addresstext_pb) {
//         processAddress(property.custom_fields.pba__addresstext_pb);
//         if (suggestions.size >= maxSuggestions) return;
//       }
//     });

//     let suggestionsArray = Array.from(suggestions);

//     // Sort suggestions: exact matches first, then by length, then alphabetically
//     suggestionsArray.sort((a, b) => {
//       const aExact = a.toLowerCase().startsWith(prefix.toLowerCase());
//       const bExact = b.toLowerCase().startsWith(prefix.toLowerCase());

//       if (aExact && !bExact) return -1;
//       if (!aExact && bExact) return 1;
//       if (a.length !== b.length) return a.length - b.length;
//       return a.localeCompare(b);
//     });

//     // Limit to requested number of suggestions
//     suggestionsArray = suggestionsArray.slice(0, maxSuggestions);

//     console.log(
//       `Returning ${suggestionsArray.length} suggestions for ${listingType} properties`
//     );

//     res.status(200).json({
//       success: true,
//       message: `Found ${suggestionsArray.length} address suggestions for "${prefix}" from ${listingType} properties`,
//       count: suggestionsArray.length,
//       listingType: listingType,
//       data: suggestionsArray,
//       debug: {
//         listingType: listingType,
//         prefix: prefix,
//         totalPropertiesFound: properties.length,
//       },
//     });
//   } catch (error) {
//     console.error("Error in getAddressSuggestions:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get address suggestions",
//       error: error.message,
//     });
//   }
// };

// const getOffPlanAddressSuggestions = async (req, res) => {
//   try {
//     const prefix = req.query.prefix;
//     const maxSuggestions = parseInt(req.query.limit) || 8;

//     console.log(
//       `Getting off-plan project name suggestions for prefix: "${prefix}"`
//     );

//     // Validation
//     if (!prefix) {
//       return res.status(400).json({
//         success: false,
//         message: "Prefix parameter is required",
//       });
//     }

//     if (prefix.length < 2) {
//       return res.json({
//         success: true,
//         message: "Prefix too short for meaningful search",
//         data: [],
//         count: 0,
//         debug: {
//           prefix: prefix,
//           minLength: 2,
//         },
//       });
//     }

//     // Build query to search project names that start with or contain the prefix
//     // Using word boundary regex for better matching
//     const query = {
//       name: {
//         $regex: new RegExp(`\\b${prefix}`, "i"), // Word boundary search, case insensitive
//       },
//     };

//     console.log("MongoDB query:", JSON.stringify(query, null, 2));

//     // Find matching off-plan properties
//     const properties = await OffPlanProperty.find(query)
//       .limit(maxSuggestions * 2) // Get more results to have variety
//       .select("name area developer") // Select only needed fields for suggestions
//       .lean();

//     console.log(
//       `Found ${properties.length} off-plan properties matching query`
//     );

//     // Create suggestions set to avoid duplicates
//     const suggestions = new Set();

//     // Process each property name
//     properties.forEach((property) => {
//       if (property.name && property.name.trim()) {
//         const projectName = property.name.trim();

//         // Check if the project name contains the prefix (case insensitive)
//         if (projectName.toLowerCase().includes(prefix.toLowerCase())) {
//           suggestions.add(projectName);
//         }

//         // Stop if we have enough suggestions
//         if (suggestions.size >= maxSuggestions) return;
//       }
//     });

//     // Convert to array and sort
//     let suggestionsArray = Array.from(suggestions);

//     // Sort suggestions for better user experience:
//     // 1. Exact matches first
//     // 2. Names starting with prefix
//     // 3. Names containing prefix
//     // 4. Alphabetically within each group
//     suggestionsArray.sort((a, b) => {
//       const aLower = a.toLowerCase();
//       const bLower = b.toLowerCase();
//       const prefixLower = prefix.toLowerCase();

//       // Check for exact match
//       const aExact = aLower === prefixLower;
//       const bExact = bLower === prefixLower;
//       if (aExact && !bExact) return -1;
//       if (!aExact && bExact) return 1;

//       // Check for starts with
//       const aStarts = aLower.startsWith(prefixLower);
//       const bStarts = bLower.startsWith(prefixLower);
//       if (aStarts && !bStarts) return -1;
//       if (!aStarts && bStarts) return 1;

//       // Check for word boundary match at start
//       const aWordStart = aLower.match(new RegExp(`^${prefixLower}\\b`));
//       const bWordStart = bLower.match(new RegExp(`^${prefixLower}\\b`));
//       if (aWordStart && !bWordStart) return -1;
//       if (!aWordStart && bWordStart) return 1;

//       // Sort by length (shorter first)
//       if (a.length !== b.length) return a.length - b.length;

//       // Finally sort alphabetically
//       return a.localeCompare(b);
//     });

//     // Limit to requested number
//     suggestionsArray = suggestionsArray.slice(0, maxSuggestions);

//     console.log(
//       `Returning ${suggestionsArray.length} project name suggestions`
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Found ${suggestionsArray.length} off-plan project suggestions for "${prefix}"`,
//       count: suggestionsArray.length,
//       data: suggestionsArray,
//       debug: {
//         prefix: prefix,
//         totalPropertiesFound: properties.length,
//         uniqueSuggestions: suggestionsArray.length,
//       },
//     });
//   } catch (error) {
//     console.error("Error in getOffPlanAddressSuggestions:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to get off-plan project suggestions",
//       error: error.message,
//       data: [],
//     });
//   }
// };

// const filterByCommunity = async (req, res) => {
//   try {
//     const community = req.query.community;
//     const listingTypeParam = req.query.listingType || req.query.type || "Sale";

//     const listingTypes = listingTypeParam.split(",").map(t => t.trim());
//     console.log("LT", listingTypes);

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 12;

//     if (!community) {
//       return res.status(400).json({
//         success: false,
//         message: "Community parameter is required",
//       });
//     }

//     // Normalize listing types
//     const normalizedListingTypes = listingTypes.map(type =>
//       type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
//     );

//     const searchWords = community
//       .trim()
//       .split(/\s+/)
//       .filter((word) => word.length > 0);

//     const wordRegexPatterns = searchWords.map((word) => {
//       const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//       return new RegExp(`\\b${escapedWord}\\b`, "i");
//     });

//     // Build the query based on listing types
//     let listingTypeQuery;

//     if (normalizedListingTypes.length === 1 && normalizedListingTypes[0] === "Offplan") {
//       // For OffPlan properties only
//       listingTypeQuery = {
//         "custom_fields.completion_status": {
//           $in: ["off_plan_primary", "off_plan_secondary"],
//         },
//       };
//     } else if (normalizedListingTypes.includes("Offplan")) {
//       // If Offplan is included with other types, need $or query
//       const offeringTypes = normalizedListingTypes
//         .filter(type => type !== "Offplan")
//         .map(type => type === "Sale" ? "RS" : "RR");

//       const orConditions = [];

//       // Add offplan condition
//       orConditions.push({
//         "custom_fields.completion_status": {
//           $in: ["off_plan_primary", "off_plan_secondary"],
//         },
//       });

//       // Add sale/rent conditions
//       if (offeringTypes.length > 0) {
//         orConditions.push({
//           offering_type: { $in: offeringTypes },
//           "custom_fields.completion_status": {
//             $nin: ["off_plan_primary", "off_plan_secondary"],
//           },
//         });
//       }

//       listingTypeQuery = { $or: orConditions };
//     } else {
//       // For Sale and/or Rent properties (no Offplan)
//       const offeringTypes = normalizedListingTypes.map(type =>
//         type === "Sale" ? "RS" : "RR"
//       );

//       listingTypeQuery = {
//         offering_type: offeringTypes.length === 1 ? offeringTypes[0] : { $in: offeringTypes },
//         "custom_fields.completion_status": {
//           $nin: ["off_plan_primary", "off_plan_secondary"],
//         },
//       };
//     }

//     // Build the combined query
//     const combinedQuery = {
//       $and: [
//         {
//           "custom_fields.community": {
//             $all: wordRegexPatterns,
//           },
//         },
//         listingTypeQuery,
//         {
//           "general_listing_information.status": "Live",
//         },
//       ],
//     };

//     console.log("Community search terms:", searchWords);
//     console.log("Listing types:", normalizedListingTypes);
//     console.log("Combined query:", JSON.stringify(combinedQuery, null, 2));

//     const skip = (page - 1) * limit;

//     const totalCount = await Property.countDocuments(combinedQuery);
//     const totalPages = Math.ceil(totalCount / limit);

//     if (totalCount === 0) {
//       return res.status(200).json({
//         success: true,
//         message: `No ${normalizedListingTypes.join(" or ").toLowerCase()} properties found in "${community}" community`,
//         pagination: {
//           currentPage: page,
//           totalPages: 0,
//           totalCount: 0,
//           perPage: limit,
//           hasNextPage: false,
//           hasPrevPage: page > 1,
//         },
//         count: 0,
//         data: [],
//         debug: {
//           listingTypes: normalizedListingTypes,
//           filterQuery: combinedQuery,
//           searchTerms: searchWords,
//         },
//       });
//     }

//     const properties = await Property.find(combinedQuery)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     console.log(
//       `Found ${properties.length} ${normalizedListingTypes.join(" and ").toLowerCase()} properties for page ${page} in "${community}" community`
//     );

//     res.status(200).json({
//       success: true,
//       message: `${normalizedListingTypes.join(" and ")} properties in "${community}" community found successfully`,
//       pagination: {
//         currentPage: page,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       searchTerms: searchWords,
//       searchField: "custom_fields.community",
//       listingTypes: normalizedListingTypes,
//       count: properties.length,
//       data: properties,
//       debug: {
//         listingTypes: normalizedListingTypes,
//         filterQuery: combinedQuery,
//       },
//     });
//   } catch (error) {
//     console.error("Error in filterByCommunity:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to filter properties by community",
//       error: error.message,
//     });
//   }
// };

// const filterByCommunityFlexible = async (req, res) => {
//   try {
//     const community = req.query.community;
//     const listingType = req.query.listingType || req.query.type || "Sale";

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 12;

//     if (!community) {
//       return res.status(400).json({
//         success: false,
//         message: "Community parameter is required",
//       });
//     }

//     const normalizedListingType =
//       listingType.charAt(0).toUpperCase() + listingType.slice(1).toLowerCase();

//     const searchWords = community
//       .trim()
//       .split(/\s+/)
//       .filter((word) => word.length > 0);

//     const wordRegexPatterns = searchWords.map((word) => {
//       const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//       return new RegExp(`\\b${escapedWord}\\b`, "i");
//     });
//     const combinedQuery = {
//       $and: [
//         {
//           "custom_fields.community": {
//             $all: wordRegexPatterns,
//           },
//         },
//         {
//           $or: [
//             { listing_type: normalizedListingType },
//             { "_classification.listingType": normalizedListingType },
//             {
//               offering_type: normalizedListingType === "Sale" ? "RS" : "RR",
//             },
//           ],
//         },
//         {
//           "general_listing_information.status": "Live",
//         },
//       ],
//     };

//     console.log("Community search terms:", searchWords);
//     console.log("Listing type:", normalizedListingType);
//     console.log("Combined query:", JSON.stringify(combinedQuery, null, 2));

//     const skip = (page - 1) * limit;
//     const totalCount = await Property.countDocuments(combinedQuery);
//     const totalPages = Math.ceil(totalCount / limit);

//     if (totalCount === 0) {
//       return res.status(200).json({
//         success: true,
//         message: `No ${normalizedListingType.toLowerCase()} properties found in "${community}" community`,
//         pagination: {
//           currentPage: page,
//           totalPages: 0,
//           totalCount: 0,
//           perPage: limit,
//           hasNextPage: false,
//           hasPrevPage: page > 1,
//         },
//         count: 0,
//         data: [],
//       });
//     }

//     const properties = await Property.find(combinedQuery)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     res.status(200).json({
//       success: true,
//       message: `${normalizedListingType} properties in "${community}" community found successfully`,
//       pagination: {
//         currentPage: page,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       searchTerms: searchWords,
//       listingType: normalizedListingType,
//       count: properties.length,
//       data: properties,
//     });
//   } catch (error) {
//     console.error("Error in filterByCommunity:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to filter properties by community",
//       error: error.message,
//     });
//   }
// };
// module.exports = {
//   SortProperties,
//   getAddressSuggestions,
//   filterByCommunity,
//   //New filter
//   UniversalSpecializedFilter,
// };


// Import the Property model (main collection for listings)
const Property = require("../Models/PropertyModel");

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Convert a comma-separated amenities query string into normalized amenity slugs.
 * Example:
 *   "Balcony, Gym" -> ["balcony", "shared-gym"] (depending on labelToSlug map)
 */
function toAmenitySlugs(q) {
  if (!q) return []; // If no amenities in query, return empty array

  return q
    .split(",")                     // Split by comma: "Balcony,Gym" -> ["Balcony","Gym"]
    .map((s) => s.trim())           // Trim spaces off each piece
    .filter(Boolean)                // Remove empty strings
    .map((label) => {
      // If label exists in the mapping, use the mapped slug
      // else fall back to a simple kebab-case version
      return (
        labelToSlug[label] ||
        label.toLowerCase().replace(/\s+/g, "-") // "Central A/C" -> "central-a/c" (you can tweak)
      );
    });
}

/**
 * Mapping of human-friendly amenity names to internal slug values
 * used in your private_amenities field.
 */
const labelToSlug = {
  "Central A/C": "central-ac", // adjust if your data uses e.g. "central-ac"
  Balcony: "balcony",
  "Water View": "view-of-water",
  "Private Pool": "private-pool",
  "Beach Access": "beach-access",
  Gym: "shared-gym", // or "gym" depending on your feed
  "Shared Spa": "shared-spa",
  Parking: "covered-parking", // adjust if needed
  Security: "security",
  Garden: "garden",
  Elevator: "elevator",
  "Maid Room": "maids-room",
  "Study Room": "study-room",
  Storage: "storage",
  "Built-in Wardrobes": "built-in-wardrobes",
  "Kitchen Appliances": "kitchen-appliances",
};

/**
 * Normalize a furnishing string into a boolean:
 *  - "furnished"   -> true
 *  - "unfurnished" -> false
 *  - anything else -> null
 */
function furnishingToBool(f) {
  if (!f) return null;          // No furnishing info
  const v = f.toLowerCase();    // Case-insensitive compare

  if (v === "furnished") return true;
  if (v === "unfurnished") return false;

  return null;                  // For "partly furnished", "unknown", etc.
}

/* -------------------------------------------------------------------------- */
/*                       Universal Specialized Filter API                     */
/* -------------------------------------------------------------------------- */

/**
 * UniversalSpecializedFilter
 *
 * Main server-side filtering endpoint for property search.
 * Supports:
 *  - listing type (Sale, Rent, OffPlan)
 *  - price range
 *  - size range
 *  - bedrooms, bathrooms
 *  - property type
 *  - location / developer text search
 *  - amenities
 *  - furnishing (furnished/unfurnished)
 *  - sort options (price, date, bedrooms)
 *  - pagination
 */
const UniversalSpecializedFilter = async (req, res) => {
  try {
    /* ------------------------------- Pagination ------------------------------ */

    // Current page number (default: 1)
    const page = parseInt(req.query.page) || 1;

    // How many items per page (default: 10)
    const limit = parseInt(req.query.limit) || 10;

    // Number of documents to skip based on page
    const skip = (page - 1) * limit;

    /* ----------------------------- Listing Types ----------------------------- */

    // listingType can be a single value or comma-separated: "Sale", "Rent", "Sale,Rent"
    const listingTypeParam = req.query.listingType || "Sale";

    // Normalize into an array of trimmed types
    const listingTypes = listingTypeParam.split(",").map((t) => t.trim());

    // Sorting key (e.g. "newest", "highest_price", etc.)
    const sortBy = (req.query.sortBy || "newest").toLowerCase();

    /* ------------------------------- Price Range ----------------------------- */

    // Minimum price (numeric) or null if not provided
    const minPrice = req.query.minPrice
      ? parseInt(req.query.minPrice, 10)
      : null;

    // Maximum price (numeric) or null if not provided
    const maxPrice = req.query.maxPrice
      ? parseInt(req.query.maxPrice, 10)
      : null;

    /* -------------------------------- Size Range ---------------------------- */

    // Minimum size / area
    const minSize = req.query.minSize
      ? parseInt(req.query.minSize, 10)
      : null;

    // Maximum size / area
    const maxSize = req.query.maxSize
      ? parseInt(req.query.maxSize, 10)
      : null;

    /* ---------------------------- Amenities & Furnishing -------------------- */

    // Convert query string amenities to normalized slugs
    const amenitySlugs = toAmenitySlugs(req.query.amenities);

    // Convert furnishing textual value to boolean or null
    const furnishedBool = furnishingToBool(req.query.furnishing);

    /* -------------------------- Base String/Regex Filters ------------------- */

    // baseMatch contains filters that can use direct matching or regex
    const baseMatch = {};

    // listing_type filter: either single value or $in for multiple
    baseMatch.listing_type =
      listingTypes.length === 1 ? listingTypes[0] : { $in: listingTypes };

    // Property type: handle special "studio" case with regex; otherwise generic regex
    if (req.query.propertyType && req.query.propertyType !== "") {
      baseMatch.property_type =
        req.query.propertyType.toLowerCase() === "studio"
          ? /^studio$/i // exact "studio" (case-insensitive)
          : new RegExp(req.query.propertyType, "i"); // partial match
    }

    // Bedrooms handling (Studio / specific number / 5+)
    if (req.query.bedrooms && req.query.bedrooms !== "") {
      if (req.query.bedrooms.toLowerCase() === "studio") {
        // "Studio" bedrooms stored as string
        baseMatch["general_listing_information.bedrooms"] = /studio/i;
      } else if (req.query.bedrooms === "5+") {
        // 5 or more bedrooms: regex to match >=5
        baseMatch["general_listing_information.bedrooms"] = {
          $regex: /^[5-9]\d*$|^[1-9]\d{1,}$/,
        };
      } else {
        // specific number, e.g. "2", "3"
        baseMatch["general_listing_information.bedrooms"] =
          req.query.bedrooms;
      }
    }

    // Address text search on pba__addresstext_pb
    if (req.query.address) {
      baseMatch["custom_fields.pba__addresstext_pb"] = new RegExp(
        req.query.address,
        "i"
      );
    }

    // Developer name search
    if (req.query.developer) {
      baseMatch["custom_fields.developer"] = new RegExp(
        req.query.developer,
        "i"
      );
    }

    // Bathrooms equality filter (simple exact match)
    if (req.query.bathrooms) {
      baseMatch["general_listing_information.fullbathrooms"] =
        req.query.bathrooms;
    }

    /* ---------------------------- Aggregation Pipeline ---------------------- */

    // MongoDB aggregation pipeline
    const pipeline = [
      // 1) Apply base filters (listing type, property type, beds, address, etc.)
      { $match: baseMatch },

      // 2) Add numericPrice field: convert listingprice "1,200,000 AED" to a number
      {
        $addFields: {
          numericPrice: {
            $convert: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      // listingprice may be string or number; force to string
                      input: {
                        $toString:
                          "$general_listing_information.listingprice",
                      },
                      find: ",",
                      replacement: "",
                    },
                  },
                  find: "AED", // strip currency if present
                  replacement: "",
                },
              },
              to: "double",   // final numeric type
              onError: 0,     // fallback to 0 on error
              onNull: 0,      // fallback to 0 if null
            },
          },
        },
      },

      // 3) Extract raw area from either totalarea or plot size / plot area
      {
        $addFields: {
          _areaRaw: {
            $ifNull: [
              "$general_listing_information.totalarea", // main area
              {
                $ifNull: [
                  "$custom_fields.plot_size",          // fallback 1
                  "$custom_fields.plot_area",          // fallback 2
                ],
              },
            ],
          },
        },
      },

      // 4) Convert raw area to numericArea (strip commas, then number)
      {
        $addFields: {
          numericArea: {
            $convert: {
              input: {
                $replaceAll: {
                  input: { $toString: "$_areaRaw" },
                  find: ",",
                  replacement: "",
                },
              },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },

      // 5) Normalize furnishing to boolean isFurnished
      {
        $addFields: {
          // Lower-case version of furnished field for internal use (optional)
          _furnLower: {
            $toLower: { $ifNull: ["$custom_fields.furnished", ""] },
          },
          // isFurnished: true/false/null based on textual values
          isFurnished: {
            $cond: [
              // Check if furnished is "yes", "furnished", or "true"
              {
                $in: [
                  {
                    $toLower: {
                      $ifNull: ["$custom_fields.furnished", ""],
                    },
                  },
                  ["yes", "furnished", "true"],
                ],
              },
              true,
              {
                // Else if is "no", "unfurnished", or "false" -> false
                $cond: [
                  {
                    $in: [
                      {
                        $toLower: {
                          $ifNull: ["$custom_fields.furnished", ""],
                        },
                      },
                      ["no", "unfurnished", "false"],
                    ],
                  },
                  false,
                  // Otherwise, null (unknown / partial / not set)
                  null,
                ],
              },
            ],
          },
        },
      },

      // 6) Convert private_amenities string into an array amenitiesArr
      {
        $addFields: {
          amenitiesArr: {
            $filter: {
              input: {
                $map: {
                  input: {
                    // Split comma-separated amenity string into array
                    $split: [
                      {
                        $ifNull: [
                          "$custom_fields.private_amenities",
                          "",
                        ],
                      },
                      ",",
                    ],
                  },
                  as: "a",
                  in: {
                    $trim: { input: "$$a" }, // trim spaces in each amenity
                  },
                },
              },
              as: "x",
              cond: { $ne: ["$$x", ""] }, // remove empty strings
            },
          },
        },
      },

      // 7) numericBedrooms: convert bedroom string into a number (Studio -> 0)
      {
        $addFields: {
          numericBedrooms: {
            $cond: [
              // If bedrooms is literally "Studio"
              { $eq: ["$general_listing_information.bedrooms", "Studio"] },
              0,
              {
                // Otherwise try to convert string to int
                $convert: {
                  input: "$general_listing_information.bedrooms",
                  to: "int",
                  onError: 0,
                  onNull: 0,
                },
              },
            ],
          },
        },
      },
    ];

    /* ------------------------- Numeric Price Range Filter ------------------- */

    // Separate match object for price after conversion
    const priceMatch = {};

    if (minPrice !== null) {
      // Add lower bound for numericPrice
      priceMatch.numericPrice = {
        ...(priceMatch.numericPrice || {}),
        $gte: minPrice,
      };
    }

    if (maxPrice !== null) {
      // Add upper bound for numericPrice
      priceMatch.numericPrice = {
        ...(priceMatch.numericPrice || {}),
        $lte: maxPrice,
      };
    }

    // If we defined any price bounds, push a $match stage
    if (Object.keys(priceMatch).length) {
      pipeline.push({ $match: priceMatch });
    }

    /* -------------------------- Numeric Size Range Filter ------------------- */

    const sizeMatch = {};

    if (minSize !== null) {
      sizeMatch.numericArea = {
        ...(sizeMatch.numericArea || {}),
        $gte: minSize,
      };
    }

    if (maxSize !== null) {
      sizeMatch.numericArea = {
        ...(sizeMatch.numericArea || {}),
        $lte: maxSize,
      };
    }

    if (Object.keys(sizeMatch).length) {
      pipeline.push({ $match: sizeMatch });
    }

    /* ------------------------ Furnishing Boolean Filter --------------------- */

    if (furnishedBool !== null) {
      // Filter on isFurnished (true/false) only if the query asked for it
      pipeline.push({ $match: { isFurnished: furnishedBool } });
    }

    /* ---------------------------- Amenities Filter -------------------------- */

    if (amenitySlugs.length) {
      // Regex list matching EXACT slug (case-insensitive)
      const amenityRegexes = amenitySlugs.map((s) => {
        // Escape regex special characters in slug
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`^${escaped}$`, "i");
      });

      // Require ALL selected amenities to be present (use $in for "any")
      pipeline.push({
        $match: { amenitiesArr: { $all: amenityRegexes } },
      });
    }

    /* --------------------------------- Sorting ------------------------------ */

    let sortStage = { createdAt: -1 }; // default: newest first

    switch (sortBy) {
      case "highest_price":
      case "price-high":
        sortStage = { numericPrice: -1 }; // high to low
        break;

      case "lowest_price":
      case "price-low":
        sortStage = { numericPrice: 1 }; // low to high
        break;

      case "most_bedrooms":
        sortStage = { numericBedrooms: -1 }; // max bedrooms first
        break;

      case "least_bedrooms":
        sortStage = { numericBedrooms: 1 }; // min bedrooms first
        break;

      case "newest":
      case "most_recent":
      default:
        sortStage = { createdAt: -1 }; // newest first
    }

    // Add final sort + facet for pagination + count
    pipeline.push(
      { $sort: sortStage },
      {
        $facet: {
          docs: [{ $skip: skip }, { $limit: limit }], // page of data
          total: [{ $count: "count" }],               // total matching docs
        },
      }
    );

    /* -------------------------- Execute Aggregation ------------------------- */

    // Using the single Property model for all types in this universal filter
    const PropertyModel = Property;

    // Run aggregation pipeline
    const agg = await PropertyModel.aggregate(pipeline);

    // Extract paginated docs
    const docs = agg?.[0]?.docs || [];

    // Extract total count (from facet)
    const totalCount = agg?.[0]?.total?.[0]?.count || 0;

    // Compute total pages for pagination
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    /* ---------------------------- Sort Descriptions ------------------------- */

    // Map sort key to a human-friendly description
    const sortDescriptions = {
      most_recent: "most recent first",
      newest: "newest first",
      highest_price: "highest price first",
      "price-high": "highest price first",
      lowest_price: "lowest price first",
      "price-low": "lowest price first",
      most_bedrooms: "most bedrooms first",
      least_bedrooms: "least bedrooms first",
    };

    /* ------------------------------- Response ------------------------------- */

    res.status(200).json({
      success: true,
      message: `Found ${docs.length} properties (${listingTypes.join(
        ", "
      )}) - sorted by ${
        sortDescriptions[sortBy] || "most recent first"
      }`,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters: {
        listingTypes,
        propertyType: req.query.propertyType || null,
        priceRange: { min: minPrice, max: maxPrice },
        sizeRange: { min: minSize, max: maxSize },
        furnishing: req.query.furnishing || null,
        amenities: amenitySlugs,
        bedrooms: req.query.bedrooms || null,
        address: req.query.address || null,
        developer: req.query.developer || null,
        sortBy,
        sortDescription: sortDescriptions[sortBy] || "most recent first",
      },
      count: docs.length,
      data: docs,
    });
  } catch (err) {
    // Log full error on server
    console.error("Error in Universal Filter:", err);

    // Graceful failure response with basic pagination info
    res.status(500).json({
      success: false,
      message: "Failed to filter and sort properties",
      error: err.message,
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        limit: parseInt(req.query.limit) || 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
      data: [],
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                             Sort Properties API                            */
/* -------------------------------------------------------------------------- */
/**
 * NOTE:
 * This endpoint relies on helpers that are not included in this snippet:
 *   - normalizeOfferingType
 *   - getPropertyModelByOfferingType
 *   - getCollectionName
 * Make sure they are imported/defined in your real file.
 */
const SortProperties = async (req, res) => {
  try {
    // Normalize offering type (Sale, Rent, OffPlan, etc.)
    const rawOfferingType =
      req.query.offeringType || req.query.type || "Sale";
    const offeringType = normalizeOfferingType(rawOfferingType);

    // Get correct Mongoose model & collection name based on offeringType
    const PropertyModel = getPropertyModelByOfferingType(offeringType);
    const collectionName = getCollectionName(offeringType);

    console.log("Raw Offering Type:", rawOfferingType);
    console.log("Normalized Offering Type:", offeringType);
    console.log(
      `Using ${PropertyModel.modelName} collection for sorting`
    );

    // Sort and pagination parameters
    const sortBy = req.query.sortBy || "most_recent";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Base query — previously used to filter Live only; now everything is Live in collections
    const baseQuery = {};

    let sortOptions = {};
    let useAggregation = false;
    let aggregationPipeline = [];

    // Decide sort logic based on sortBy
    switch (sortBy.toLowerCase()) {
      case "most_recent":
      case "newest":
        sortOptions = { createdAt: -1 };
        break;

      case "highest_price":
      case "price-high":
        sortOptions = {
          "general_listing_information.listingprice": -1,
        };
        break;

      case "lowest_price":
      case "price-low":
        sortOptions = {
          "general_listing_information.listingprice": 1,
        };
        break;

      case "most_bedrooms":
        // Use aggregation to compute numericBedrooms for sorting
        useAggregation = true;
        aggregationPipeline = [
          { $match: baseQuery },
          {
            $addFields: {
              numericBedrooms: {
                $cond: {
                  if: {
                    $eq: [
                      "$general_listing_information.bedrooms",
                      "Studio",
                    ],
                  },
                  then: 0,
                  else: {
                    $convert: {
                      input:
                        "$general_listing_information.bedrooms",
                      to: "int",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                },
              },
            },
          },
          { $sort: { numericBedrooms: -1 } },
          { $skip: skip },
          { $limit: limit },
        ];
        break;

      case "least_bedrooms":
        useAggregation = true;
        aggregationPipeline = [
          { $match: baseQuery },
          {
            $addFields: {
              numericBedrooms: {
                $cond: {
                  if: {
                    $eq: [
                      "$general_listing_information.bedrooms",
                      "Studio",
                    ],
                  },
                  then: 0,
                  else: {
                    $convert: {
                      input:
                        "$general_listing_information.bedrooms",
                      to: "int",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                },
              },
            },
          },
          { $sort: { numericBedrooms: 1 } },
          { $skip: skip },
          { $limit: limit },
        ];
        break;

      case "oldest":
        sortOptions = { createdAt: 1 };
        break;

      case "popular":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // Count total documents for pagination
    const totalCount = await PropertyModel.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalCount / limit);

    let properties = [];

    if (useAggregation) {
      // When we need numericBedrooms sorting
      properties = await PropertyModel.aggregate(aggregationPipeline);
    } else {
      // Simple .find().sort().skip().limit() when no computed fields
      properties = await PropertyModel.find(baseQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // Same sort descriptions mapping
    const sortDescriptions = {
      most_recent: "most recent first",
      newest: "newest first",
      highest_price: "highest price first",
      "price-high": "highest price first",
      lowest_price: "lowest price first",
      "price-low": "lowest price first",
      most_bedrooms: "most bedrooms first",
      least_bedrooms: "least bedrooms first",
      oldest: "oldest first",
      popular: "most popular first",
    };

    const sortDescription =
      sortDescriptions[sortBy.toLowerCase()] ||
      "most recent first";

    res.status(200).json({
      success: true,
      message: `${collectionName} properties sorted by ${sortDescription}`,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      sort: sortBy,
      count: properties.length,
      data: properties,
      debug: {
        modelUsed: PropertyModel.modelName,
        rawOfferingType: rawOfferingType,
        normalizedOfferingType: offeringType,
        collectionName: collectionName,
      },
    });
  } catch (error) {
    console.error("Error in SortProperties:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sort properties",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                         Address Suggestions (Resale)                       */
/* -------------------------------------------------------------------------- */

const getAddressSuggestions = async (req, res) => {
  try {
    // listing_type is the top-level field used & indexed in Property
    const listingType =
      req.query.listing_type ||
      req.query.listingType ||
      req.query.type ||
      "Sale";

    // Prefix typed by user (autocomplete text)
    const prefix = req.query.prefix;

    // Max suggestions to return (defaults to 8)
    const maxSuggestions = parseInt(req.query.limit) || 8;

    console.log(
      `Getting address suggestions for listing_type: "${listingType}"`
    );

    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: "Prefix parameter is required",
      });
    }

    if (prefix.length < 2) {
      // Too short to search meaningfully
      return res.json({
        success: true,
        message: "Prefix too short",
        data: [],
        debug: {
          listingType: listingType,
          prefix: prefix,
        },
      });
    }

    console.log(
      `Getting address suggestions for prefix: "${prefix}" from ${listingType} properties`
    );

    // Build query: filter by listing_type and region field with prefix regex
    const query = {
      listing_type: listingType,
      "custom_fields.propertyfinder_region": {
        $regex: new RegExp(`\\b${prefix}`, "i"),
      },
    };

    // Fetch properties that match the region, but only some fields
    const properties = await Property.find(query)
      .limit(5) // get a few docs; we will parse addresses inside them
      .select("custom_fields.pba__addresstext_pb listing_type")
      .lean();

    console.log(
      `Found ${properties.length} ${listingType} properties matching query`
    );

    // Use Set to ensure unique suggestions
    const suggestions = new Set();

    // Helper to process one full address text into candidate parts
    const processAddress = (fullAddress) => {
      if (!fullAddress) return;

      // Split by common delimiters: comma, slash, dash, pipe, underscore
      const addressParts = fullAddress
        .split(/[,\/\-_|]+/)
        .map((part) => part.trim());

      for (const part of addressParts) {
        if (part && part.length >= 2) {
          // If part matches the prefix at a word boundary
          if (
            part
              .toLowerCase()
              .match(new RegExp(`\\b${prefix.toLowerCase()}`))
          ) {
            suggestions.add(part);

            // Stop early if we reached the cap
            if (suggestions.size >= maxSuggestions) return;
          }
        }
      }
    };

    // Process each property's address field
    properties.forEach((property) => {
      if (property.custom_fields?.pba__addresstext_pb) {
        processAddress(property.custom_fields.pba__addresstext_pb);
      }
    });

    // Convert Set to array
    let suggestionsArray = Array.from(suggestions);

    // Sort suggestions:
    // 1) ones starting with prefix
    // 2) by length (shorter first)
    // 3) alphabetically
    suggestionsArray.sort((a, b) => {
      const aExact = a.toLowerCase().startsWith(prefix.toLowerCase());
      const bExact = b.toLowerCase().startsWith(prefix.toLowerCase());

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      if (a.length !== b.length) return a.length - b.length;

      return a.localeCompare(b);
    });

    // Trim to maxSuggestions
    suggestionsArray = suggestionsArray.slice(0, maxSuggestions);

    console.log(
      `Returning ${suggestionsArray.length} suggestions for ${listingType} properties`
    );

    res.status(200).json({
      success: true,
      message: `Found ${suggestionsArray.length} address suggestions for "${prefix}" from ${listingType} properties`,
      count: suggestionsArray.length,
      listingType: listingType,
      data: suggestionsArray,
      debug: {
        listingType: listingType,
        prefix: prefix,
        totalPropertiesFound: properties.length,
      },
    });
  } catch (error) {
    console.error("Error in getAddressSuggestions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get address suggestions",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                             Community Filters                              */
/* -------------------------------------------------------------------------- */

/**
 * filterByCommunity:
 * - Handles Sale / Rent / Offplan mix with strict logic
 * - Uses completion_status + offering_type combination
 */
const filterByCommunity = async (req, res) => {
  try {
    const community = req.query.community;
    const listingTypeParam = req.query.listingType || req.query.type || "Sale";

    // listingTypeParam can be "Sale", "Rent", "Sale,Offplan" etc.
    const listingTypes = listingTypeParam.split(",").map((t) => t.trim());
    console.log("LT", listingTypes);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!community) {
      return res.status(400).json({
        success: false,
        message: "Community parameter is required",
      });
    }

    // Normalize listing types: "sale" -> "Sale", "offplan" -> "Offplan"
    const normalizedListingTypes = listingTypes.map(
      (type) => type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    );

    // Break community string into words for flexible matching
    const searchWords = community
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Create regex patterns for each word with word-boundaries
    const wordRegexPatterns = searchWords.map((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedWord}\\b`, "i");
    });

    // Build listingType-specific query
    let listingTypeQuery;

    if (
      normalizedListingTypes.length === 1 &&
      normalizedListingTypes[0] === "Offplan"
    ) {
      // Pure Offplan search: use completion_status
      listingTypeQuery = {
        "custom_fields.completion_status": {
          $in: ["off_plan_primary", "off_plan_secondary"],
        },
      };
    } else if (normalizedListingTypes.includes("Offplan")) {
      // Mixed Offplan + others (Sale/Rent)
      const offeringTypes = normalizedListingTypes
        .filter((type) => type !== "Offplan")
        .map((type) => (type === "Sale" ? "RS" : "RR"));

      const orConditions = [];

      // Offplan condition
      orConditions.push({
        "custom_fields.completion_status": {
          $in: ["off_plan_primary", "off_plan_secondary"],
        },
      });

      // Sale/Rent condition (non-offplan)
      if (offeringTypes.length > 0) {
        orConditions.push({
          offering_type: { $in: offeringTypes },
          "custom_fields.completion_status": {
            $nin: ["off_plan_primary", "off_plan_secondary"],
          },
        });
      }

      listingTypeQuery = { $or: orConditions };
    } else {
      // Only Sale/Rent (no Offplan)
      const offeringTypes = normalizedListingTypes.map((type) =>
        type === "Sale" ? "RS" : "RR"
      );

      listingTypeQuery = {
        offering_type:
          offeringTypes.length === 1
            ? offeringTypes[0]
            : { $in: offeringTypes },
        "custom_fields.completion_status": {
          $nin: ["off_plan_primary", "off_plan_secondary"],
        },
      };
    }

    // Combined query:
    // - community must match all words
    // - listing type logic above
    // - Live properties only
    const combinedQuery = {
      $and: [
        {
          "custom_fields.community": {
            $all: wordRegexPatterns,
          },
        },
        listingTypeQuery,
        {
          "general_listing_information.status": "Live",
        },
      ],
    };

    console.log("Community search terms:", searchWords);
    console.log("Listing types:", normalizedListingTypes);
    console.log("Combined query:", JSON.stringify(combinedQuery, null, 2));

    const skip = (page - 1) * limit;

    const totalCount = await Property.countDocuments(combinedQuery);
    const totalPages = Math.ceil(totalCount / limit);

    if (totalCount === 0) {
      return res.status(200).json({
        success: true,
        message: `No ${normalizedListingTypes
          .join(" or ")
          .toLowerCase()} properties found in "${community}" community`,
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          perPage: limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
        count: 0,
        data: [],
        debug: {
          listingTypes: normalizedListingTypes,
          filterQuery: combinedQuery,
          searchTerms: searchWords,
        },
      });
    }

    const properties = await Property.find(combinedQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(
      `Found ${properties.length} ${normalizedListingTypes
        .join(" and ")
        .toLowerCase()} properties for page ${page} in "${community}" community`
    );

    res.status(200).json({
      success: true,
      message: `${normalizedListingTypes.join(
        " and "
      )} properties in "${community}" community found successfully`,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      searchTerms: searchWords,
      searchField: "custom_fields.community",
      listingTypes: normalizedListingTypes,
      count: properties.length,
      data: properties,
      debug: {
        listingTypes: normalizedListingTypes,
        filterQuery: combinedQuery,
      },
    });
  } catch (error) {
    console.error("Error in filterByCommunity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to filter properties by community",
      error: error.message,
    });
  }
};

/**
 * filterByCommunityFlexible:
 * - Simpler version that matches listing_type / _classification / offering_type
 */
const filterByCommunityFlexible = async (req, res) => {
  try {
    const community = req.query.community;
    const listingType = req.query.listingType || req.query.type || "Sale";

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!community) {
      return res.status(400).json({
        success: false,
        message: "Community parameter is required",
      });
    }

    const normalizedListingType =
      listingType.charAt(0).toUpperCase() +
      listingType.slice(1).toLowerCase();

    const searchWords = community
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    const wordRegexPatterns = searchWords.map((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedWord}\\b`, "i");
    });

    // Combined query:
    // - community text contains all words
    // - listing matched via 3 different fields for safety
    // - only Live properties
    const combinedQuery = {
      $and: [
        {
          "custom_fields.community": {
            $all: wordRegexPatterns,
          },
        },
        {
          $or: [
            { listing_type: normalizedListingType },
            {
              "_classification.listingType": normalizedListingType,
            },
            {
              offering_type:
                normalizedListingType === "Sale" ? "RS" : "RR",
            },
          ],
        },
        {
          "general_listing_information.status": "Live",
        },
      ],
    };

    console.log("Community search terms:", searchWords);
    console.log("Listing type:", normalizedListingType);
    console.log("Combined query:", JSON.stringify(combinedQuery, null, 2));

    const skip = (page - 1) * limit;
    const totalCount = await Property.countDocuments(combinedQuery);
    const totalPages = Math.ceil(totalCount / limit);

    if (totalCount === 0) {
      return res.status(200).json({
        success: true,
        message: `No ${normalizedListingType.toLowerCase()} properties found in "${community}" community`,
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          perPage: limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
        count: 0,
        data: [],
      });
    }

    const properties = await Property.find(combinedQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      message: `${normalizedListingType} properties in "${community}" community found successfully`,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      searchTerms: searchWords,
      listingType: normalizedListingType,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Error in filterByCommunity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to filter properties by community",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                Exports                                     */
/* -------------------------------------------------------------------------- */

module.exports = {
  SortProperties,
  getAddressSuggestions,
  filterByCommunity,
  // Main universal filter for property search
  UniversalSpecializedFilter,
};
