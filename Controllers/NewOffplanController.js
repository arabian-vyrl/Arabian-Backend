// // Fixed Controller: NewOffplanController.js
// const OffPlanProperty = require("../Models/NewOffplanModel");
// const axios = require("axios");

// // Fetch data from API and save to database
// const fetchAndSaveProperties = async (req, res) => {
//   try {
//     console.log("Starting API fetch process...");

//     const baseUrl =
//       process.env.AllOffPlanPropertyiesListUrl ||
//       "https://search-listings-production.up.railway.app/v1/properties";

//     const headers = {
//       "X-API-Key": `${process.env.OffPlanApiKey}`,
//       Accept: "application/json",
//     };

//     let page = Number(req.query.page || 1);
//     const perPage = Number(req.query.per_page || 12);

//     let totalFromAPI = 0;
//     let totalProcessed = 0;
//     const errors = [];

//     while (true) {
//       console.log(`Fetching page ${page}...`);
//       const { data, status } = await axios.get(baseUrl, {
//         headers,
//         params: { page, per_page: perPage },
//       });

//       console.log("API status:", status);

//       const apiItems = data?.items || [];
//       const pagination = data?.pagination || {};
//       totalFromAPI += apiItems.length;

//       if (!Array.isArray(apiItems) || apiItems.length === 0) {
//         console.log("No items on this page; stopping.");
//         break;
//       }

//       // Prepare bulk ops (upsert by apiId)
//       const bulkOps = apiItems.map((item) => {
//         // parse lat/lng
//         let lat = null,
//           lng = null;
//         if (item.coordinates) {
//           const [a, b] = String(item.coordinates)
//             .split(",")
//             .map((v) => v.trim());
//           lat = a ? parseFloat(a) : null;
//           lng = b ? parseFloat(b) : null;
//         }

//         // parse cover image JSON string
//         let coverImage = {};
//         try {
//           if (item.cover_image_url)
//             coverImage = JSON.parse(item.cover_image_url);
//         } catch (e) {
//           console.warn(
//             `cover_image_url parse failed for ${item.name} (ID ${item.id}): ${e.message}`
//           );
//         }

//         const completionDate = item.completion_datetime
//           ? new Date(item.completion_datetime)
//           : null;

//         const doc = {
//           apiId: item.id,
//           name: item.name,
//           area: item.area,
//           developer: item.developer,
//           coordinates: item.coordinates || "",
//           latitude: lat,
//           longitude: lng,
//           minPrice: item.min_price ?? null,
//           maxPrice: item.max_price ?? null,
//           minPriceAed: item.min_price_aed ?? null,
//           minPricePerAreaUnit: item.min_price_per_area_unit ?? null,
//           priceCurrency: item.price_currency || "AED",
//           areaUnit: item.area_unit || "sqft",
//           status: item.status, // e.g. "Presale"
//           saleStatus: item.sale_status, // e.g. "Presale(EOI)"
//           completionDate,
//           isPartnerProject: !!item.is_partner_project,
//           hasEscrow: !!item.has_escrow,
//           postHandover: !!item.post_handover,
//           coverImage,
//         };

//         return {
//           updateOne: {
//             filter: { apiId: item.id },
//             update: { $set: doc },
//             upsert: true,
//           },
//         };
//       });

//       if (bulkOps.length) {
//         try {
//           const result = await OffPlanProperty.bulkWrite(bulkOps, {
//             ordered: false,
//           });
//           const modified =
//             (result.upsertedCount || 0) +
//             (result.modifiedCount || 0) +
//             (result.matchedCount || 0);
//           totalProcessed += modified;
//           console.log(
//             `Page ${page}: upserts=${result.upsertedCount || 0}, modified=${
//               result.modifiedCount || 0
//             }`
//           );
//         } catch (e) {
//           console.error("Bulk write error:", e?.message || e);
//           errors.push({
//             page,
//             error: e?.message || String(e),
//           });
//         }
//       }

//       if (!pagination?.has_next) {
//         console.log("No more pages.");
//         break;
//       }
//       page += 1;
//     }

//     const totalInDB = await OffPlanProperty.countDocuments();

//     return res.status(200).json({
//       success: true,
//       message: `Sync complete`,
//       summary: {
//         totalFromAPI,
//         totalProcessed,
//         totalErrors: errors.length,
//         totalInDatabase: totalInDB,
//       },
//       errors: errors.length ? errors : undefined,
//     });
//   } catch (error) {
//     console.error("❌ Error in fetchAndSaveProperties:", error);
//     if (error.response) {
//       return res.status(error.response.status || 500).json({
//         success: false,
//         message: `API Error: ${error.response.status} - ${error.response.statusText}`,
//         error: error.response.data || error.message,
//       });
//     }
//     if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
//       return res.status(503).json({
//         success: false,
//         message: "Unable to connect to API endpoint",
//         error: error.message,
//       });
//     }
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch and save properties",
//       error: error.message,
//     });
//   }
// };

// // Get all new off-plan properties with pagination
// // controllers/NewOffplanController.js (inside getNewOffPlanProperties)
// const getNewOffPlanProperties = async (req, res) => {
//   try {
//     console.log("WORKING")
//     const page = parseInt(req.query.page || "1", 10);
//     const limit = parseInt(req.query.limit || "12", 10);
//     const skip = (page - 1) * limit;

//     const filterQuery = {};

//     if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
//     if (req.query.developer)
//       filterQuery.developer = new RegExp(req.query.developer, "i");
//     if (req.query.status) filterQuery.status = req.query.status;
//     if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

//     if (typeof req.query.isPartnerProject !== "undefined") {
//       filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
//     }

//     if (req.query.minPrice || req.query.maxPrice) {
//       filterQuery.minPriceAed = {};
//       if (req.query.minPrice)
//         filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
//       if (req.query.maxPrice)
//         filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
//     }

//     if (req.query.search) {
//       const re = new RegExp(req.query.search, "i");
//       filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
//     }

//     const totalCount = await OffPlanProperty.countDocuments(filterQuery);
//     const totalPages = Math.ceil(totalCount / limit) || 1;

//     const offPlanProperties = await OffPlanProperty.find(filterQuery)
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     return res.status(offPlanProperties.length ? 200 : 404).json({
//       success: !!offPlanProperties.length,
//       message: offPlanProperties.length
//         ? "Off-plan properties fetched successfully"
//         : "No off-plan properties found",
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       count: offPlanProperties.length,
//       data: offPlanProperties,
//     });
//   } catch (error) {
//     console.error("Error fetching new off-plan properties:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch off-plan properties",
//       error: error.message,
//     });
//   }
// };

// const getSIngleOffplanProperty = async (req, res) => {
//   console.log("WORKING")
//   const property_id = req.query.property_id;
//   try {
//     console.log("HELLO");
//     const response = await axios.get(
//       `${process.env.SingleOffPlanApi}/${property_id}`,
//       {
//         headers: {
//           "X-API-Key": `${process.env.OffPlanApiKey}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     console.log(response.data);
//     return res.status(200).json({
//       msg: "Single Property Data Recieved",
//       data: response.data,
//     });
//   } catch (err) {
//     console.log(err);
//   }
// };

// const getOffPlanAddressSuggestions = async (req, res) => {
//   try {
//     const prefix = req.query.prefix;
//     const maxSuggestions = parseInt(req.query.limit) || 8;

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
// // Get current sync status
// const getSyncStatus = async (req, res) => {
//   try {
//     const totalProperties = await OffPlanProperty.countDocuments();
//     const recentProperties = await OffPlanProperty.countDocuments({
//       createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
//     });

//     const lastUpdated = await OffPlanProperty.findOne()
//       .sort({ updatedAt: -1 })
//       .select("updatedAt");

//     return res.status(200).json({
//       success: true,
//       message: "Sync status retrieved successfully",
//       data: {
//         totalProperties,
//         recentProperties,
//         lastUpdated: lastUpdated?.updatedAt || null,
//         apiConfig: {
//           baseUrl: process.env.AllOffPlanPropertyiesListUrl || "Not configured",
//           hasApiKey: !!process.env.OffPlanApiKey,
//           endpoint: "Off-plan properties endpoint",
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error getting sync status:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get sync status",
//       error: error.message,
//     });
//   }
// };

// const FilterDeveloperOffplanProperty = async (req, res) => {
//   try {
//     const { developer } = req.query;
//     const { page = 1, limit = 10 } = req.query;

//     // console.log("Raw developer parameter:", developer);
//     // console.log("Type of developer:", typeof developer);

//     // Check if developer parameter exists
//     if (!developer) {
//       return res.status(400).json({
//         success: false,
//         message: "Developer parameter is required",
//       });
//     }

//     // Clean the developer parameter (remove extra spaces, decode URL encoding)
//     const cleanDeveloper = decodeURIComponent(developer).trim();
//     // console.log("Cleaned developer parameter:", cleanDeveloper);

//     // Simple exact match filter
//     const filter = {
//       developer: cleanDeveloper,
//     };

//     // console.log("MongoDB filter being applied:", JSON.stringify(filter, null, 2));

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // First, let's see what developers actually exist in the database
//     const allDevelopers = await OffPlanProperty.distinct("developer");
//     console.log("All developers in database:", allDevelopers);

//     // Check if the requested developer exists in the list
//     const developerExists = allDevelopers.includes(cleanDeveloper);
//     console.log("Does requested developer exist?", developerExists);

//     // Get total count first (for debugging)
//     const totalCount = await OffPlanProperty.countDocuments(filter);
//     console.log("Total matching properties:", totalCount);

//     // Execute the main query
//     const properties = await OffPlanProperty.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     console.log("Found properties count:", properties.length);
//     console.log(
//       "Sample property developer (if found):",
//       properties[0]?.developer
//     );

//     // Process the properties to match your expected format
//     const processedProperties = properties.map((property) => ({
//       ...property,
//       formattedPrice: property.minPriceAed
//         ? `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       formattedMaxPrice: property.maxPrice
//         ? `AED ${property.maxPrice.toLocaleString()}`
//         : null,
//       priceRange: property.minPriceAed
//         ? property.maxPrice && property.maxPrice !== property.minPriceAed
//           ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
//           : `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       mainImageUrl: property.coverImage?.url || null,
//       id: property._id.toString(),
//     }));

//     // Calculate pagination info
//     const totalPages = Math.ceil(totalCount / limitNum);

//     // Response matching your expected format
//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Off-plan properties by developer: ${cleanDeveloper} fetched successfully`
//           : `No properties found for developer: ${cleanDeveloper}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//       // Debug info (remove in production)
//       debug: {
//         requestedDeveloper: cleanDeveloper,
//         developerExists: developerExists,
//         allDevelopers: allDevelopers,
//         filterUsed: filter,
//       },
//     });
//   } catch (error) {
//     console.error("Error filtering by developer:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by developer",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const filterByMinPrice = async (req, res) => {
//   try {
//     const { minPrice } = req.query;
//     const { page = 1, limit = 10 } = req.query;

//     console.log("MinPrice", minPrice);

//     // Check if minPrice parameter exists
//     if (!minPrice) {
//       return res.status(400).json({
//         success: false,
//         message: "MinPrice parameter is required",
//       });
//     }

//     const filter = {
//       minPriceAed: { $gte: parseInt(minPrice) },
//     };

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Get total count first
//     const totalCount = await OffPlanProperty.countDocuments(filter);
//     console.log("Total matching properties:", totalCount);

//     // Execute the main query
//     const properties = await OffPlanProperty.find(filter)
//       .sort({ minPriceAed: 1 }) // Sort by price ascending
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     console.log("Found properties count:", properties.length);

//     // Process the properties to match your expected format
//     const processedProperties = properties.map((property) => ({
//       ...property,
//       formattedPrice: property.minPriceAed
//         ? `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       formattedMaxPrice: property.maxPrice
//         ? `AED ${property.maxPrice.toLocaleString()}`
//         : null,
//       priceRange: property.minPriceAed
//         ? property.maxPrice && property.maxPrice !== property.minPriceAed
//           ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
//           : `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       mainImageUrl: property.coverImage?.url || null,
//       id: property._id.toString(),
//     }));

//     // Calculate pagination info
//     const totalPages = Math.ceil(totalCount / limitNum);

//     // Response matching your expected format
//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Properties with minimum price AED ${parseInt(
//               minPrice
//             ).toLocaleString()} fetched successfully`
//           : `No properties found with minimum price AED ${parseInt(
//               minPrice
//             ).toLocaleString()}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//       // Debug info (remove in production)
//       debug: {
//         requestedMinPrice: parseInt(minPrice),
//         filterUsed: filter,
//       },
//     });
//   } catch (error) {
//     console.error("Error filtering by min price:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by minimum price",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const filterByMaxPrice = async (req, res) => {
//   try {
//     const { maxPrice } = req.query;
//     const { page = 1, limit = 10 } = req.query;

//     console.log("MaxPrice", maxPrice);

//     // Check if maxPrice parameter exists
//     if (!maxPrice) {
//       return res.status(400).json({
//         success: false,
//         message: "MaxPrice parameter is required",
//       });
//     }

//     // Correct filter - use minPriceAed since that's where the actual price data is
//     const filter = {
//       minPriceAed: { $lte: parseInt(maxPrice) },
//     };

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Get total count first
//     const totalCount = await OffPlanProperty.countDocuments(filter);
//     console.log("Total matching properties:", totalCount);

//     // Execute the main query
//     const properties = await OffPlanProperty.find(filter)
//       .sort({ minPriceAed: 1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     console.log("Found properties count:", properties.length);

//     // Process the properties to match your expected format
//     const processedProperties = properties.map((property) => ({
//       ...property,
//       formattedPrice: property.minPriceAed
//         ? `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       formattedMaxPrice: property.maxPrice
//         ? `AED ${property.maxPrice.toLocaleString()}`
//         : null,
//       priceRange: property.minPriceAed
//         ? property.maxPrice && property.maxPrice !== property.minPriceAed
//           ? `AED ${property.minPriceAed.toLocaleString()} - ${property.maxPrice.toLocaleString()}`
//           : `AED ${property.minPriceAed.toLocaleString()}`
//         : "Price on Request",
//       mainImageUrl: property.coverImage?.url || null,
//       id: property._id.toString(),
//     }));

//     // Calculate pagination info
//     const totalPages = Math.ceil(totalCount / limitNum);

//     // Response matching your expected format
//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Properties with maximum price AED ${parseInt(
//               maxPrice
//             ).toLocaleString()} fetched successfully`
//           : `No properties found with maximum price AED ${parseInt(
//               maxPrice
//             ).toLocaleString()}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: totalPages,
//         totalCount: totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//       // Debug info (remove in production)
//       debug: {
//         requestedMaxPrice: parseInt(maxPrice),
//         filterUsed: filter,
//       },
//     });
//   } catch (error) {
//     console.error("Error filtering by max price:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by maximum price",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const OffSearchProperty = async (req, res) => {
//   try {
//     const { prefix, limit = 5 } = req.query;
//     const minSuggestions = parseInt(limit);

//     // Validation
//     if (!prefix) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide a prefix",
//       });
//     }

//     if (prefix.length < 2) {
//       return res.status(400).json({
//         success: false,
//         message: "Prefix must be at least 2 characters long",
//         data: [],
//       });
//     }

//     // Search only in name field for address suggestions
//     const query = {
//       name: { $regex: new RegExp(`\\b${prefix}`, "i") },
//     };

//     // Return full property details
//     const suggestions = await OffPlanProperty.find(query)
//       .limit(minSuggestions)
//       .lean();

//     return res.status(200).json({
//       success: true,
//       message: `Found ${suggestions.length} address suggestions`,
//       data: suggestions,
//       count: suggestions.length,
//     });
//   } catch (err) {
//     console.error("Address suggestion error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       data: [],
//     });
//   }
// };

// module.exports = {
//   fetchAndSaveProperties,
//   getOffPlanAddressSuggestions,
//   getNewOffPlanProperties,
//   getSyncStatus,
//   getSIngleOffplanProperty,
//   FilterDeveloperOffplanProperty,
//   filterByMinPrice,
//   filterByMaxPrice,
//   OffSearchProperty,
// };

// Fixed Controller: NewOffplanController.js



// const OffPlanProperty = require("../Models/NewOffplanModel");
// const axios = require("axios");
// const cron = require("node-cron");

// const scheduleNewOffPlanSync = () => {
//   const TZ = process.env.CRON_TZ || "Etc/UTC";

//   cron.schedule(
//     "0 1 * * *",
//     async () => {
//       console.log(`🔄 [${new Date().toISOString()}] OffPlan sync started`);
//       // Fake req/res
//       const fakeReq = {
//         query: {
//           page: 1,
//           per_page: 50,
//         },
//       };

//       const fakeRes = {
//         _status: 200,
//         status(code) {
//           this._status = code;
//           return this;
//         },
//         json(payload) {
//           console.log(
//             `✅ [${new Date().toISOString()}] OffPlan sync completed:`,
//             payload?.summary || payload,
//           );
//           return payload;
//         },
//       };

//       try {
//         await fetchAndSaveProperties(fakeReq, fakeRes);
//       } catch (error) {
//         console.error(
//           `❌ [${new Date().toISOString()}] OffPlan sync failed:`,
//           error.message,
//         );
//       }
//     },
//     { timezone: TZ },
//   );

//   console.log(
//     `NewOffPlan scheduler initialized - Running daily at 01:00 and 13:00 (${TZ})`,
//   );
// };

// function checkForChanges(existing, newDoc) {
//   // Helper to normalize values for comparison
//   const normalize = (val) => {
//     if (val === null || val === undefined || val === "" || val === 0)
//       return null;
//     return val;
//   };

//   // Helper to compare dates
//   const compareDates = (date1, date2) => {
//     if (!date1 && !date2) return true; // Both null/undefined
//     if (!date1 || !date2) return false; // One is null
//     return new Date(date1).getTime() === new Date(date2).getTime();
//   };

//   // Check simple fields
//   const fieldsToCheck = [
//     "name",
//     "area",
//     "developer",
//     "coordinates",
//     "status",
//     "saleStatus",
//     "handoverQuarter",
//     "priceCurrency",
//     "areaUnit",
//   ];

//   for (const field of fieldsToCheck) {
//     if (existing[field] !== newDoc[field]) {
//       console.log(
//         `  Change in ${field}: "${existing[field]}" -> "${newDoc[field]}"`,
//       );
//       return true;
//     }
//   }

//   // Check numeric/nullable fields with normalization
//   const numericFields = [
//     "latitude",
//     "longitude",
//     "minPrice",
//     "maxPrice",
//     "minPriceAed",
//     "minPricePerAreaUnit",
//   ];

//   for (const field of numericFields) {
//     if (normalize(existing[field]) !== normalize(newDoc[field])) {
//       console.log(
//         `  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`,
//       );
//       return true;
//     }
//   }

//   // Check boolean fields
//   const booleanFields = ["isPartnerProject", "hasEscrow", "postHandover"];
//   for (const field of booleanFields) {
//     if (!!existing[field] !== !!newDoc[field]) {
//       console.log(
//         `  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`,
//       );
//       return true;
//     }
//   }

//   // Check completion date
//   if (!compareDates(existing.completionDate, newDoc.completionDate)) {
//     console.log(
//       `  Change in completionDate: ${existing.completionDate} -> ${newDoc.completionDate}`,
//     );
//     return true;
//   }

//   // Check coverImage object
//   const existingCoverImage = JSON.stringify(existing.coverImage || {});
//   const newCoverImage = JSON.stringify(newDoc.coverImage || {});
//   if (existingCoverImage !== newCoverImage) {
//     console.log(`  Change in coverImage`);
//     return true;
//   }

//   return false; // No changes detected
// }

// const fetchAndSaveProperties = async (req, res) => {
//   console.log(process.env.AllOffPlanPropertyiesListUrl);
//   try {
//     console.log("Starting API fetch process...");
//     const baseUrl =
//       process.env.AllOffPlanPropertyiesListUrl ||
//       "https://search-listings-production.up.railway.app/v1/properties";
//     const headers = {
//       "X-API-Key": `${process.env.OffPlanApiKey}`,
//       Accept: "application/json",
//     };
//     const countryCode = "AE";

//     let page = Number(req.query.page || 1);
//     const perPage = Number(req.query.per_page || 12);
//     const force = req.query.force === "true";

//     let totalFromAPI = 0;
//     let totalProcessed = 0;
//     let newInserts = 0;
//     let updated = 0;
//     let skipped = 0;
//     const errors = [];

//     console.log(
//       `Force mode: ${force ? "ENABLED - Will update all existing records" : "DISABLED - Will only insert new records"}`,
//     );

//     while (true) {
//       console.log(`Fetching page ${page}...`);

//       let data, status;
//       try {
//         const response = await axios.get(baseUrl, {
//           headers,
//           params: { page, per_page: perPage, country: countryCode },
//           timeout: 30000, // 30 second timeout
//         });
//         data = response.data;
//         status = response.status;
//       } catch (axiosError) {
//         console.error(`API Error on page ${page}:`, axiosError.message);

//         // If it's a connection error and we've processed some data, break gracefully
//         if (
//           axiosError.code === "ECONNRESET" ||
//           axiosError.code === "ETIMEDOUT"
//         ) {
//           console.log(
//             "Connection lost. Ending sync with data processed so far.",
//           );
//           break;
//         }
//         throw axiosError; // Re-throw other errors
//       }

//       console.log("API status:", status);

//       const apiItems = data?.items || [];
//       const pagination = data?.pagination || {};
//       totalFromAPI += apiItems.length;

//       if (!Array.isArray(apiItems) || apiItems.length === 0) {
//         console.log("No items on this page; stopping.");
//         break;
//       }

//       // Process items based on force mode
//       for (const item of apiItems) {
//         try {
//           // Parse lat/lng
//           let lat = null,
//             lng = null;
//           if (item.coordinates) {
//             const [a, b] = String(item.coordinates)
//               .split(",")
//               .map((v) => v.trim());
//             lat = a ? parseFloat(a) : null;
//             lng = b ? parseFloat(b) : null;
//           }

//           // Parse cover image JSON string
//           let coverImage = {};
//           try {
//             if (item.cover_image_url)
//               coverImage = JSON.parse(item.cover_image_url);
//           } catch (e) {
//             console.warn(
//               `cover_image_url parse failed for ${item.name} (ID ${item.id}): ${e.message}`,
//             );
//           }

//           const formatQuarter = (dateStr) => {
//             if (!dateStr) return "TBA";
//             const d = new Date(dateStr);
//             if (Number.isNaN(d.getTime())) return "TBA";
//             const quarter = Math.floor(d.getMonth() / 3) + 1;
//             return `Q${quarter} ${d.getFullYear()}`;
//           };

//           const handOver = item.completion_datetime;
//           const handoverQuarter = handOver ? formatQuarter(handOver) : "TBA";
//           const completionDate = item.completion_datetime
//             ? new Date(item.completion_datetime)
//             : null;

//           const doc = {
//             apiId: item.id,
//             name: (item.name || "").trim(),
//             area: (item.area || "").trim(),
//             developer: (item.developer || "").trim(),
//             coordinates: item.coordinates || "",
//             latitude: lat,
//             longitude: lng,
//             minPrice: item.min_price ?? null,
//             maxPrice: item.max_price ?? null,
//             minPriceAed: item.min_price_aed ?? null,
//             minPricePerAreaUnit: item.min_price_per_area_unit ?? null,
//             priceCurrency: item.price_currency || "AED",
//             areaUnit: item.area_unit || "sqft",
//             status: item.status,
//             saleStatus: item.sale_status,
//             handoverQuarter: handoverQuarter,
//             completionDate,
//             isPartnerProject: !!item.is_partner_project,
//             hasEscrow: !!item.has_escrow,
//             postHandover: !!item.post_handover,
//             coverImage,
//             active: true,
//           };

//           // Check if property exists
//           const existingProperty = await OffPlanProperty.findOne({
//             apiId: item.id,
//           }).lean();

//           if (!existingProperty) {
//             // New property - always insert
//             await OffPlanProperty.create(doc);
//             newInserts++;
//             totalProcessed++;
//             console.log(
//               `✓ Inserted new property: ${item.name} (ID: ${item.id})`,
//             );
//           } else if (force) {
//             // Force mode - update everything
//             await OffPlanProperty.updateOne({ apiId: item.id }, { $set: doc });
//             updated++;
//             totalProcessed++;
//             console.log(`✓ Force updated: ${item.name} (ID: ${item.id})`);
//           } else {
//             // Normal mode - check if any field has changed
//             const hasChanges = checkForChanges(existingProperty, doc);

//             if (hasChanges) {
//               // Only update changed fields
//               await OffPlanProperty.updateOne(
//                 { apiId: item.id },
//                 { $set: doc },
//               );
//               updated++;
//               totalProcessed++;
//               console.log(
//                 `✓ Updated (changes detected): ${item.name} (ID: ${item.id})`,
//               );
//             } else {
//               // No changes - skip
//               skipped++;
//               console.log(
//                 `- Skipped (no changes): ${item.name} (ID: ${item.id})`,
//               );
//             }
//           }
//         } catch (e) {
//           console.error(`Error processing item ${item.id}:`, e?.message || e);
//           errors.push({
//             apiId: item.id,
//             name: item.name,
//             error: e?.message || String(e),
//           });
//         }
//       }

//       if (!pagination?.has_next) {
//         console.log("No more pages.");
//         break;
//       }
//       page += 1;
//     }

//     const totalInDB = await OffPlanProperty.countDocuments();

//     return res.status(200).json({
//       success: true,
//       message: `Sync complete`,
//       mode: force ? "Force Update" : "Smart Sync",
//       summary: {
//         totalFromAPI,
//         newInserts,
//         updated,
//         skipped,
//         totalProcessed,
//         totalErrors: errors.length,
//         totalInDatabase: totalInDB,
//       },
//       errors: errors.length ? errors : undefined,
//     });
//   } catch (error) {
//     console.error("❌ Error in fetchAndSaveProperties:", error);
//     if (error.response) {
//       return res.status(error.response.status || 500).json({
//         success: false,
//         message: `API Error: ${error.response.status} - ${error.response.statusText}`,
//         error: error.response.data || error.message,
//       });
//     }
//     if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
//       return res.status(503).json({
//         success: false,
//         message: "Unable to connect to API endpoint",
//         error: error.message,
//       });
//     }
//     if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
//       return res.status(503).json({
//         success: false,
//         message: "Connection to API was lost. Partial sync may have completed.",
//         error: error.message,
//       });
//     }
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch and save properties",
//       error: error.message,
//     });
//   }
// };

// // Get all new off-plan properties with pagination
// // controllers/NewOffplanController.js (inside getNewOffPlanProperties)
// // const getNewOffPlanProperties = async (req, res) => {
// //   try {
// //     const page = parseInt(req.query.page || "1", 10);
// //     const limit = parseInt(req.query.limit || "12", 10);
// //     const skip = (page - 1) * limit;

// //     const filterQuery = {};

// //     if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
// //     if (req.query.developer)
// //       filterQuery.developer = new RegExp(req.query.developer, "i");
// //     if (req.query.status) filterQuery.status = req.query.status;
// //     if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

// //     if (typeof req.query.isPartnerProject !== "undefined") {
// //       filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
// //     }

// //     if (req.query.minPrice || req.query.maxPrice) {
// //       filterQuery.minPriceAed = {};
// //       if (req.query.minPrice)
// //         filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
// //       if (req.query.maxPrice)
// //         filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
// //     }

// //     if (req.query.search) {
// //       const re = new RegExp(req.query.search, "i");
// //       filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
// //     }

// //     const totalCount = await OffPlanProperty.countDocuments(filterQuery);
// //     const totalPages = Math.ceil(totalCount / limit) || 1;

// //     const offPlanProperties = await OffPlanProperty.find(filterQuery)
// //       .skip(skip)
// //       .limit(limit)
// //       .sort({ createdAt: -1 });

// //     return res.status(offPlanProperties.length ? 200 : 404).json({
// //       success: !!offPlanProperties.length,
// //       message: offPlanProperties.length
// //         ? "Off-plan properties fetched successfully"
// //         : "No off-plan properties found",
// //       pagination: {
// //         currentPage: page,
// //         totalPages,
// //         totalCount,
// //         totalMatchingProperties: totalCount,
// //         perPage: limit,
// //         hasNextPage: page < totalPages,
// //         hasPrevPage: page > 1,
// //       },
// //       count: offPlanProperties.length,
// //       data: offPlanProperties,
// //     });
// //   } catch (error) {
// //     console.error("Error fetching new off-plan properties:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch off-plan properties",
// //       error: error.message,
// //     });
// //   }
// // };

// // const getNewOffPlanProperties = async (req, res) => {
// //   try {
// //     const page = parseInt(req.query.page || "1", 10);
// //     const limit = parseInt(req.query.limit || "12", 10);
// //     const skip = (page - 1) * limit;

// //     const filterQuery = {};

// //     if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
// //     if (req.query.developer)
// //       filterQuery.developer = new RegExp(req.query.developer, "i");
// //     if (req.query.status) filterQuery.status = req.query.status;
// //     if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

// //     if (typeof req.query.isPartnerProject !== "undefined") {
// //       filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
// //     }

// //     if (req.query.minPrice || req.query.maxPrice) {
// //       filterQuery.minPriceAed = {};
// //       if (req.query.minPrice)
// //         filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
// //       if (req.query.maxPrice)
// //         filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
// //     }

// //     if (req.query.search) {
// //       const re = new RegExp(req.query.search, "i");
// //       filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
// //     }

// //     // Add active: true to the filter
// //     filterQuery.active = true;

// //     const totalCount = await OffPlanProperty.countDocuments(filterQuery);
// //     const totalPages = Math.ceil(totalCount / limit) || 1;

// //     const offPlanProperties = await OffPlanProperty.find(filterQuery)
// //       .skip(skip)
// //       .limit(limit)
// //       .sort({ createdAt: -1 });

// //     return res.status(offPlanProperties.length ? 200 : 404).json({
// //       success: !!offPlanProperties.length,
// //       message: offPlanProperties.length
// //         ? "Off-plan properties fetched successfully"
// //         : "No off-plan properties found",
// //       pagination: {
// //         currentPage: page,
// //         totalPages,
// //         totalCount,
// //         totalMatchingProperties: totalCount,
// //         perPage: limit,
// //         hasNextPage: page < totalPages,
// //         hasPrevPage: page > 1,
// //       },
// //       count: offPlanProperties.length,
// //       data: offPlanProperties,
// //     });
// //   } catch (error) {
// //     console.error("Error fetching new off-plan properties:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch off-plan properties",
// //       error: error.message,
// //     });
// //   }
// // };

// const getNewOffPlanProperties = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page || "1", 10);
//     const limit = parseInt(req.query.limit || "12", 10);
//     const skip = (page - 1) * limit;

//     const filterQuery = {};

//     // Filters based on query params
//     if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
//     if (req.query.developer)
//       filterQuery.developer = new RegExp(req.query.developer, "i");
//     if (req.query.status) filterQuery.status = req.query.status;
//     if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

//     if (typeof req.query.isPartnerProject !== "undefined") {
//       filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
//     }

//     if (req.query.minPrice || req.query.maxPrice) {
//       filterQuery.minPriceAed = {};
//       if (req.query.minPrice)
//         filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
//       if (req.query.maxPrice)
//         filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
//     }

//     if (req.query.search) {
//       const re = new RegExp(req.query.search, "i");
//       filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
//     }

//     // Handle active filter
//     // If active=true → only active properties
//     // If active=false or not passed → no filter
//     // By default is true
//     if (req.query.active !== "false") {
//       filterQuery.active = true;
//     }

//     const totalCount = await OffPlanProperty.countDocuments(filterQuery);
//     const totalPages = Math.ceil(totalCount / limit) || 1;

//     const offPlanProperties = await OffPlanProperty.find(filterQuery)
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     return res.status(offPlanProperties.length ? 200 : 404).json({
//       success: !!offPlanProperties.length,
//       message: offPlanProperties.length
//         ? "Off-plan properties fetched successfully"
//         : "No off-plan properties found",
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       count: offPlanProperties.length,
//       data: offPlanProperties,
//     });
//   } catch (error) {
//     console.error("Error fetching new off-plan properties:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch off-plan properties",
//       error: error.message,
//     });
//   }
// };

// const getSIngleOffplanProperty = async (req, res) => {
//   console.log("WORKING");
//   const property_id = req.query.property_id;
//   try {
//     console.log("HELLO");
//     const response = await axios.get(
//       `${process.env.SingleOffPlanApi}/${property_id}`,
//       {
//         headers: {
//           "X-API-Key": `${process.env.OffPlanApiKey}`,
//           "Content-Type": "application/json",
//         },
//       },
//     );
//     console.log(response.data);
//     return res.status(200).json({
//       msg: "Single Property Data Recieved",
//       data: response.data,
//     });
//   } catch (err) {
//     console.log(err);
//   }
// };

// const getOffPlanAddressSuggestions = async (req, res) => {
//   try {
//     const prefix = req.query.prefix;
//     const maxSuggestions = parseInt(req.query.limit) || 8;

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

//     const query = {
//       active: true, //Add Active Line
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
//       `Found ${properties.length} off-plan properties matching query`,
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
//       `Returning ${suggestionsArray.length} project name suggestions`,
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

// // Get current sync status
// const getSyncStatus = async (req, res) => {
//   try {
//     const totalProperties = await OffPlanProperty.countDocuments();
//     const recentProperties = await OffPlanProperty.countDocuments({
//       createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
//     });

//     const lastUpdated = await OffPlanProperty.findOne()
//       .sort({ updatedAt: -1 })
//       .select("updatedAt");

//     return res.status(200).json({
//       success: true,
//       message: "Sync status retrieved successfully",
//       data: {
//         totalProperties,
//         recentProperties,
//         lastUpdated: lastUpdated?.updatedAt || null,
//         apiConfig: {
//           baseUrl: process.env.AllOffPlanPropertyiesListUrl || "Not configured",
//           hasApiKey: !!process.env.OffPlanApiKey,
//           endpoint: "Off-plan properties endpoint",
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error getting sync status:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to get sync status",
//       error: error.message,
//     });
//   }
// };

// // ─── Shared multi-filter builder ────────────────────────────────────────────
// // Reads ALL supported filter params from req.query and combines them into one
// // MongoDB filter. Every filter endpoint uses this so multiple filters work together.
// const buildOffPlanFilter = (query) => {
//   const filter = { active: true };

//   // Developer – exact match
//   if (query.developer) {
//     filter.developer = decodeURIComponent(query.developer).trim();
//   }

//   // Handover quarter – exact match
//   if (query.handoverQuarter) {
//     filter.handoverQuarter = query.handoverQuarter.trim();
//   }

//   // Price range – build $expr so we can use floor comparisons; both bounds optional
//   if (query.minPrice || query.maxPrice) {
//     filter.minPriceAed = { $ne: null, $exists: true, $gt: 0 };
//     const exprs = [];
//     if (query.minPrice) {
//       exprs.push({ $gte: [{ $floor: "$minPriceAed" }, parseInt(query.minPrice)] });
//     }
//     if (query.maxPrice) {
//       exprs.push({ $lte: [{ $floor: "$minPriceAed" }, parseInt(query.maxPrice)] });
//     }
//     filter.$expr = exprs.length === 1 ? exprs[0] : { $and: exprs };
//   }

//   // Location / name search – used by OffSearchProperty & location endpoints
//   if (query.prefix) {
//     const escaped = query.prefix.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     const searchRegex = new RegExp(`^${escaped}$`, "i");
//     filter.$or = [
//       { name: searchRegex },
//       { area: searchRegex },
//       { developer: searchRegex },
//     ];
//     // When prefix is active it covers developer search too, so drop the
//     // separate developer exact-match condition to avoid conflicting conditions.
//     delete filter.developer;
//   }

//   return filter;
// };

// // Shared property formatter used by all filter endpoints
// const formatProperty = (property) => ({
//   ...property,
//   formattedPrice: property.minPriceAed
//     ? `AED ${Math.floor(property.minPriceAed).toLocaleString()}`
//     : "Price on Request",
//   formattedMaxPrice: property.maxPrice
//     ? `AED ${Math.floor(property.maxPrice).toLocaleString()}`
//     : null,
//   priceRange: property.minPriceAed
//     ? property.maxPrice && property.maxPrice !== property.minPriceAed
//       ? `AED ${Math.floor(property.minPriceAed).toLocaleString()} - ${Math.floor(property.maxPrice).toLocaleString()}`
//       : `AED ${Math.floor(property.minPriceAed).toLocaleString()}`
//     : "Price on Request",
//   mainImageUrl: property.coverImage?.url || null,
//   id: property._id.toString(),
// });
// // ─────────────────────────────────────────────────────────────────────────────

// const FilterDeveloperOffplanProperty = async (req, res) => {
//   try {
//     const { developer } = req.query;
//     const { page = 1, limit = 10 } = req.query;

//     if (!developer) {
//       return res.status(400).json({
//         success: false,
//         message: "Developer parameter is required",
//       });
//     }

//     const cleanDeveloper = decodeURIComponent(developer).trim();
//     const filter = buildOffPlanFilter(req.query);

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const totalCount = await OffPlanProperty.countDocuments(filter);

//     const properties = await OffPlanProperty.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     const processedProperties = properties.map(formatProperty);
//     const totalPages = Math.ceil(totalCount / limitNum);

//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Off-plan properties by developer: ${cleanDeveloper} fetched successfully`
//           : `No properties found for developer: ${cleanDeveloper}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//     });
//   } catch (error) {
//     console.error("Error filtering by developer:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by developer",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };


// const filterByMinPrice = async (req, res) => {
//   try {
//     const { minPrice, page = 1, limit = 10 } = req.query;

//     if (!minPrice) {
//       return res.status(400).json({
//         success: false,
//         message: "MinPrice parameter is required",
//       });
//     }

//     const minPriceNum = parseInt(minPrice);
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Use the shared builder so all active filters are combined
//     const filter = buildOffPlanFilter(req.query);

//     const totalCount = await OffPlanProperty.countDocuments(filter);

//     const properties = await OffPlanProperty.find(filter)
//       .sort({ minPriceAed: 1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     const processedProperties = properties.map(formatProperty);
//     const totalPages = Math.ceil(totalCount / limitNum);

//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Properties with minimum price AED ${minPriceNum.toLocaleString()} fetched successfully`
//           : `No properties found with minimum price AED ${minPriceNum.toLocaleString()}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//     });
//   } catch (error) {
//     console.error("Error filtering by min price:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by minimum price",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const filterByMaxPrice = async (req, res) => {
//   try {
//     const { maxPrice, page = 1, limit = 10 } = req.query;

//     if (!maxPrice) {
//       return res.status(400).json({
//         success: false,
//         message: "MaxPrice parameter is required",
//       });
//     }

//     const maxPriceNum = parseInt(maxPrice);
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Use the shared builder so all active filters are combined
//     const filter = buildOffPlanFilter(req.query);

//     const totalCount = await OffPlanProperty.countDocuments(filter);

//     const properties = await OffPlanProperty.find(filter)
//       .sort({ minPriceAed: 1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     const processedProperties = properties.map(formatProperty);
//     const totalPages = Math.ceil(totalCount / limitNum);

//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Properties with maximum price AED ${maxPriceNum.toLocaleString()} fetched successfully`
//           : `No properties found with maximum price AED ${maxPriceNum.toLocaleString()}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//     });
//   } catch (error) {
//     console.error("Error filtering by max price:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by maximum price",
//       error: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// const OffSearchProperty = async (req, res) => {
//   try {
//     const { prefix, limit = 50 } = req.query;
//     const minSuggestions = parseInt(limit);

//     if (!prefix) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide a prefix",
//       });
//     }

//     if (prefix.length < 2) {
//       return res.status(400).json({
//         success: false,
//         message: "Prefix must be at least 2 characters long",
//         data: [],
//       });
//     }

//     // Use the shared builder so all active filters are combined.
//     // buildOffPlanFilter handles the prefix $or condition and any other
//     // filters (developer, minPrice, maxPrice, handoverQuarter) that the
//     // frontend may have passed alongside the location prefix.
//     const filter = buildOffPlanFilter(req.query);

//     const suggestions = await OffPlanProperty.find(filter)
//       .limit(minSuggestions)
//       .lean();

//     return res.status(200).json({
//       success: true,
//       message:
//         suggestions.length > 0
//           ? `Found ${suggestions.length} exact matches`
//           : `No exact match found`,
//       data: suggestions,
//       count: suggestions.length,
//     });
//   } catch (err) {
//     console.error("Search error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       data: [],
//       count: 0,
//     });
//   }
// };

// const StatusUpdateOffPlanProperties = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const property = await OffPlanProperty.findById(id).select("active");
//     if (!property) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Property not found" });
//     }
//     const updatedProperty = await OffPlanProperty.findByIdAndUpdate(
//       id,
//       { $set: { active: !property.active } },
//       { new: true, lean: true },
//     );
//     return res.status(200).json({
//       success: true,
//       message: "Property status updated",
//       data: {
//         _id: updatedProperty._id,
//         active: updatedProperty.active,
//       },
//     });
//   } catch (error) {
//     console.error("Toggle active error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// const filterDashboardProperties = async (req, res) => {
//   try {
//     const { q } = req.query;

//     const filter = {};
//     if (q && q.trim()) {
//       const regex = new RegExp(`^${q.trim()}`, "i");

//       filter.$or = [
//         { name: regex },
//         { area: regex },
//         { developer: regex },
//         ...(q === "active"
//           ? [{ active: true }]
//           : q === "inactive"
//             ? [{ active: false }]
//             : []),
//       ];
//     }

//     const data = await OffPlanProperty.find(filter).sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: data.length,
//       data,
//     });
//   } catch (err) {
//     console.error("Filter offplan properties error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

// const offPlanFilterByCommunity = async (req, res) => {
//   try {
//     let area = req.query.area || "";
//     const apiId = req.query.apiId;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 12;
//     if (!area) {
//       return res.status(400).json({
//         success: false,
//         message: "Area is required",
//       });
//     }
//     // Normalize area
//     area = area.split("(")[0].trim();
//     const searchWords = area.split(/\s+/).filter((word) => word.length > 0);
//     const wordRegexPatterns = searchWords.map((word) => {
//       const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//       return new RegExp(`\\b${escapedWord}\\b`, "i");
//     });
//     const queryConditions = [
//       { area: { $all: wordRegexPatterns } },
//       { status: { $ne: "Deleted" } },
//       { active: true },
//     ];
//     // Exclude current property if apiId exists
//     if (apiId) {
//       queryConditions.push({ apiId: { $ne: Number(apiId) } });
//     }
//     const query = { $and: queryConditions };

//     const skip = (page - 1) * limit;

//     const totalCount = await OffPlanProperty.countDocuments(query);
//     const totalPages = Math.ceil(totalCount / limit);

//     const properties = await OffPlanProperty.find(query)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     return res.status(200).json({
//       success: true,
//       message: `Properties found in "${area}"`,
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalCount,
//         perPage: limit,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//       count: properties.length,
//       data: properties,
//     });
//   } catch (error) {
//     console.error("Error in filterByArea:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to filter properties by area",
//       error: error.message,
//     });
//   }
// };

// const getOffPlanDeveloperSuggestions = async (req, res) => {
//   try {
//     const prefix = req.query.prefix;
//     const limit = parseInt(req.query.limit) || 8;

//     if (!prefix || prefix.length < 2) {
//       return res.json({
//         success: true,
//         data: [],
//         count: 0,
//       });
//     }

//     const regex = new RegExp(`^${prefix}`, "i");

//     const developers = await OffPlanProperty.distinct("developer", {
//       active: true,
//       developer: { $regex: regex },
//     });

//     const suggestions = developers.slice(0, limit);

//     return res.status(200).json({
//       success: true,
//       data: suggestions,
//       count: suggestions.length,
//     });
//   } catch (error) {
//     console.error("Developer suggestion error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch developer suggestions",
//       error: error.message,
//     });
//   }
// };

// // HandOverQuarter
// const filterByHandoverQuarter = async (req, res) => {
//   try {
//     const { handoverQuarter } = req.query;
//     const { page = 1, limit = 10 } = req.query;

//     if (!handoverQuarter) {
//       return res.status(400).json({
//         success: false,
//         message: "handoverQuarter parameter is required",
//       });
//     }

//     // Use the shared builder so all active filters are combined
//     const filter = buildOffPlanFilter(req.query);

//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const totalCount = await OffPlanProperty.countDocuments(filter);

//     const properties = await OffPlanProperty.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean();

//     const processedProperties = properties.map(formatProperty);
//     const totalPages = Math.ceil(totalCount / limitNum);

//     res.status(200).json({
//       success: true,
//       message:
//         totalCount > 0
//           ? `Properties with handover quarter ${handoverQuarter} fetched successfully`
//           : `No properties found with handover quarter ${handoverQuarter}`,
//       pagination: {
//         currentPage: pageNum,
//         totalPages,
//         totalCount,
//         totalMatchingProperties: totalCount,
//         totalAllProperties: await OffPlanProperty.countDocuments({}),
//         filteredProperties: totalCount,
//         perPage: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//       count: processedProperties.length,
//       data: processedProperties,
//     });
//   } catch (error) {
//     console.error("Error filtering by handover quarter:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error filtering by handover quarter",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   fetchAndSaveProperties,
//   getOffPlanAddressSuggestions,
//   getNewOffPlanProperties,
//   getSyncStatus,
//   getSIngleOffplanProperty,
//   FilterDeveloperOffplanProperty,
//   filterByMinPrice,
//   filterByMaxPrice,
//   OffSearchProperty,
//   StatusUpdateOffPlanProperties,
//   filterDashboardProperties,
//   offPlanFilterByCommunity,
//   getOffPlanDeveloperSuggestions,
//   filterByHandoverQuarter,
//   scheduleNewOffPlanSync,
// };























const OffPlanProperty = require("../Models/NewOffplanModel");
const axios = require("axios");
const cron = require("node-cron");

const scheduleNewOffPlanSync = () => {
  const TZ = process.env.CRON_TZ || "Etc/UTC";

  cron.schedule(
    "0 1 * * *",
    async () => {
      console.log(`🔄 [${new Date().toISOString()}] OffPlan sync started`);
      const fakeReq = {
        query: {
          page: 1,
          per_page: 50,
        },
      };

      const fakeRes = {
        _status: 200,
        status(code) {
          this._status = code;
          return this;
        },
        json(payload) {
          console.log(
            `✅ [${new Date().toISOString()}] OffPlan sync completed:`,
            payload?.summary || payload,
          );
          return payload;
        },
      };

      try {
        await fetchAndSaveProperties(fakeReq, fakeRes);
      } catch (error) {
        console.error(
          `❌ [${new Date().toISOString()}] OffPlan sync failed:`,
          error.message,
        );
      }
    },
    { timezone: TZ },
  );

  console.log(
    `NewOffPlan scheduler initialized - Running daily at 01:00 (${TZ})`,
  );
};

// ─── Helper: Check for changes between existing and new doc ─────────────────
function checkForChanges(existing, newDoc) {
  const normalize = (val) => {
    if (val === null || val === undefined || val === "" || val === 0)
      return null;
    return val;
  };

  const compareDates = (date1, date2) => {
    if (!date1 && !date2) return true;
    if (!date1 || !date2) return false;
    return new Date(date1).getTime() === new Date(date2).getTime();
  };

  const fieldsToCheck = [
    "name",
    "area",
    "developer",
    "coordinates",
    "status",
    "saleStatus",
    "handoverQuarter",
    "priceCurrency",
    "areaUnit",
  ];

  for (const field of fieldsToCheck) {
    if (existing[field] !== newDoc[field]) {
      console.log(`  Change in ${field}: "${existing[field]}" -> "${newDoc[field]}"`);
      return true;
    }
  }

  const numericFields = [
    "latitude",
    "longitude",
    "minPrice",
    "maxPrice",
    "minPriceAed",
    "minPricePerAreaUnit",
  ];

  for (const field of numericFields) {
    if (normalize(existing[field]) !== normalize(newDoc[field])) {
      console.log(`  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`);
      return true;
    }
  }

  const booleanFields = ["isPartnerProject", "hasEscrow", "postHandover"];
  for (const field of booleanFields) {
    if (!!existing[field] !== !!newDoc[field]) {
      console.log(`  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`);
      return true;
    }
  }

  if (!compareDates(existing.completionDate, newDoc.completionDate)) {
    console.log(`  Change in completionDate: ${existing.completionDate} -> ${newDoc.completionDate}`);
    return true;
  }

  const existingCoverImage = JSON.stringify(existing.coverImage || {});
  const newCoverImage = JSON.stringify(newDoc.coverImage || {});
  if (existingCoverImage !== newCoverImage) {
    console.log(`  Change in coverImage`);
    return true;
  }

  return false;
}

// ─── Fetch and Save Properties (Sync) ───────────────────────────────────────
const fetchAndSaveProperties = async (req, res) => {
  console.log(process.env.AllOffPlanPropertyiesListUrl);
  try {
    console.log("Starting API fetch process...");
    const baseUrl =
      process.env.AllOffPlanPropertyiesListUrl ||
      "https://search-listings-production.up.railway.app/v1/properties";
    const headers = {
      "X-API-Key": `${process.env.OffPlanApiKey}`,
      Accept: "application/json",
    };
    const countryCode = "AE";

    let page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || 12);
    const force = req.query.force === "true";

    let totalFromAPI = 0;
    let totalProcessed = 0;
    let newInserts = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    console.log(
      `Force mode: ${force ? "ENABLED - Will update all existing records" : "DISABLED - Will only insert new records"}`,
    );

    while (true) {
      console.log(`Fetching page ${page}...`);

      let data, status;
      try {
        const response = await axios.get(baseUrl, {
          headers,
          params: { page, per_page: perPage, country: countryCode },
          timeout: 30000,
        });
        data = response.data;
        status = response.status;
      } catch (axiosError) {
        console.error(`API Error on page ${page}:`, axiosError.message);
        if (
          axiosError.code === "ECONNRESET" ||
          axiosError.code === "ETIMEDOUT"
        ) {
          console.log("Connection lost. Ending sync with data processed so far.");
          break;
        }
        throw axiosError;
      }

      console.log("API status:", status);

      const apiItems = data?.items || [];
      const pagination = data?.pagination || {};
      totalFromAPI += apiItems.length;

      if (!Array.isArray(apiItems) || apiItems.length === 0) {
        console.log("No items on this page; stopping.");
        break;
      }

      for (const item of apiItems) {
        try {
          let lat = null, lng = null;
          if (item.coordinates) {
            const [a, b] = String(item.coordinates)
              .split(",")
              .map((v) => v.trim());
            lat = a ? parseFloat(a) : null;
            lng = b ? parseFloat(b) : null;
          }

          let coverImage = {};
          try {
            if (item.cover_image_url)
              coverImage = JSON.parse(item.cover_image_url);
          } catch (e) {
            console.warn(
              `cover_image_url parse failed for ${item.name} (ID ${item.id}): ${e.message}`,
            );
          }

          const formatQuarter = (dateStr) => {
            if (!dateStr) return "TBA";
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) return "TBA";
            const quarter = Math.floor(d.getMonth() / 3) + 1;
            return `Q${quarter} ${d.getFullYear()}`;
          };

          const handOver = item.completion_datetime;
          const handoverQuarter = handOver ? formatQuarter(handOver) : "TBA";
          const completionDate = item.completion_datetime
            ? new Date(item.completion_datetime)
            : null;

          const doc = {
            apiId: item.id,
            name: (item.name || "").trim(),
            area: (item.area || "").trim(),
            developer: (item.developer || "").trim(),
            coordinates: item.coordinates || "",
            latitude: lat,
            longitude: lng,
            minPrice: item.min_price ?? null,
            maxPrice: item.max_price ?? null,
            minPriceAed: item.min_price_aed ?? null,
            minPricePerAreaUnit: item.min_price_per_area_unit ?? null,
            priceCurrency: item.price_currency || "AED",
            areaUnit: item.area_unit || "sqft",
            status: item.status,
            saleStatus: item.sale_status,
            handoverQuarter: handoverQuarter,
            completionDate,
            isPartnerProject: !!item.is_partner_project,
            hasEscrow: !!item.has_escrow,
            postHandover: !!item.post_handover,
            coverImage,
            active: true,
          };

          const existingProperty = await OffPlanProperty.findOne({
            apiId: item.id,
          }).lean();

          if (!existingProperty) {
            await OffPlanProperty.create(doc);
            newInserts++;
            totalProcessed++;
            console.log(`✓ Inserted new property: ${item.name} (ID: ${item.id})`);
          } else if (force) {
            await OffPlanProperty.updateOne({ apiId: item.id }, { $set: doc });
            updated++;
            totalProcessed++;
            console.log(`✓ Force updated: ${item.name} (ID: ${item.id})`);
          } else {
            const hasChanges = checkForChanges(existingProperty, doc);
            if (hasChanges) {
              await OffPlanProperty.updateOne({ apiId: item.id }, { $set: doc });
              updated++;
              totalProcessed++;
              console.log(`✓ Updated (changes detected): ${item.name} (ID: ${item.id})`);
            } else {
              skipped++;
              console.log(`- Skipped (no changes): ${item.name} (ID: ${item.id})`);
            }
          }
        } catch (e) {
          console.error(`Error processing item ${item.id}:`, e?.message || e);
          errors.push({
            apiId: item.id,
            name: item.name,
            error: e?.message || String(e),
          });
        }
      }

      if (!pagination?.has_next) {
        console.log("No more pages.");
        break;
      }
      page += 1;
    }

    const totalInDB = await OffPlanProperty.countDocuments();

    return res.status(200).json({
      success: true,
      message: `Sync complete`,
      mode: force ? "Force Update" : "Smart Sync",
      summary: {
        totalFromAPI,
        newInserts,
        updated,
        skipped,
        totalProcessed,
        totalErrors: errors.length,
        totalInDatabase: totalInDB,
      },
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Error in fetchAndSaveProperties:", error);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: `API Error: ${error.response.status} - ${error.response.statusText}`,
        error: error.response.data || error.message,
      });
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        success: false,
        message: "Unable to connect to API endpoint",
        error: error.message,
      });
    }
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      return res.status(503).json({
        success: false,
        message: "Connection to API was lost. Partial sync may have completed.",
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to fetch and save properties",
      error: error.message,
    });
  }
};

// ─── Shared multi-filter builder ─────────────────────────────────────────────
const buildOffPlanFilter = (query) => {
  const filter = { active: true };

  // Developer – exact match (only if no prefix, handled below)
  if (query.developer && !query.prefix) {
    filter.developer = decodeURIComponent(query.developer).trim();
  }

  // Handover quarter – exact match
  if (query.handoverQuarter) {
    filter.handoverQuarter = query.handoverQuarter.trim();
  }

  // Price range
  if (query.minPrice || query.maxPrice) {
    filter.minPriceAed = { $ne: null, $exists: true, $gt: 0 };
    const exprs = [];
    if (query.minPrice) {
      exprs.push({
        $gte: [{ $floor: "$minPriceAed" }, parseInt(query.minPrice)],
      });
    }
    if (query.maxPrice) {
      exprs.push({
        $lte: [{ $floor: "$minPriceAed" }, parseInt(query.maxPrice)],
      });
    }
    filter.$expr = exprs.length === 1 ? exprs[0] : { $and: exprs };
  }

  // Location / name / area search via prefix
  if (query.prefix) {
    const escaped = query.prefix
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escaped, "i"); // partial match
    filter.$or = [
      { name: searchRegex },
      { area: searchRegex },
      // Only include developer in $or search if no explicit developer filter
      ...(query.developer ? [] : [{ developer: searchRegex }]),
    ];
    // If developer filter is also active alongside prefix, keep it as a separate condition
    if (query.developer) {
      filter.developer = decodeURIComponent(query.developer).trim();
    }
  }

  return filter;
};

// ─── Shared property formatter ────────────────────────────────────────────────
const formatProperty = (property) => ({
  ...property,
  formattedPrice: property.minPriceAed
    ? `AED ${Math.floor(property.minPriceAed).toLocaleString()}`
    : "Price on Request",
  formattedMaxPrice: property.maxPrice
    ? `AED ${Math.floor(property.maxPrice).toLocaleString()}`
    : null,
  priceRange: property.minPriceAed
    ? property.maxPrice && property.maxPrice !== property.minPriceAed
      ? `AED ${Math.floor(property.minPriceAed).toLocaleString()} - ${Math.floor(property.maxPrice).toLocaleString()}`
      : `AED ${Math.floor(property.minPriceAed).toLocaleString()}`
    : "Price on Request",
  mainImageUrl: property.coverImage?.url || null,
  id: property._id.toString(),
});

// ─── UNIFIED FILTER (Single source of truth) ─────────────────────────────────
// Postman Test URL Examples:
//
// Single filters:
// GET /filterOffPlanProperties?developer=Emaar
// GET /filterOffPlanProperties?minPrice=500000
// GET /filterOffPlanProperties?maxPrice=2000000
// GET /filterOffPlanProperties?handoverQuarter=Q1 2027
// GET /filterOffPlanProperties?prefix=Marina
//
// Multiple filters combined:
// GET /filterOffPlanProperties?developer=Emaar&minPrice=500000
// GET /filterOffPlanProperties?developer=Emaar&minPrice=500000&maxPrice=2000000
// GET /filterOffPlanProperties?developer=Emaar&handoverQuarter=Q1 2027
// GET /filterOffPlanProperties?minPrice=500000&handoverQuarter=Q1 2027
// GET /filterOffPlanProperties?developer=Emaar&minPrice=500000&handoverQuarter=Q1 2027&page=1&limit=10
// GET /filterOffPlanProperties?prefix=Marina&minPrice=500000&handoverQuarter=Q2 2026
// ─────────────────────────────────────────────────────────────────────────────
const filterOffPlanProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = buildOffPlanFilter(req.query);

    // Log applied filters for debugging
    console.log("🔍 Unified Filter - Applied Query Params:", req.query);
    console.log("🔍 Unified Filter - MongoDB Filter:", JSON.stringify(filter, null, 2));

    const totalCount = await OffPlanProperty.countDocuments(filter);
    const properties = await OffPlanProperty.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const processedProperties = properties.map(formatProperty);
    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message:
        totalCount > 0
          ? `Found ${totalCount} properties`
          : "No properties found matching the applied filters",
      // Shows which filters were applied — useful for Postman debugging
      appliedFilters: {
        developer: req.query.developer || null,
        minPrice: req.query.minPrice || null,
        maxPrice: req.query.maxPrice || null,
        handoverQuarter: req.query.handoverQuarter || null,
        prefix: req.query.prefix || null,
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        totalMatchingProperties: totalCount,
        perPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      count: processedProperties.length,
      data: processedProperties,
    });
  } catch (error) {
    console.error("❌ Unified filter error:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering properties",
      error: error.message,
    });
  }
};

// ─── Individual routes → pass-through to unified filter ──────────────────────
// Each route validates its own required param, then delegates to filterOffPlanProperties.
// This means ALL query params (developer + minPrice + handoverQuarter etc.)
// are automatically passed through to buildOffPlanFilter — multi-filter works!

const FilterDeveloperOffplanProperty = (req, res) => {
  if (!req.query.developer) {
    return res.status(400).json({
      success: false,
      message: "Developer parameter is required",
    });
  }
  // Pass-through: all other query params (minPrice, maxPrice, handoverQuarter etc.)
  // will also be picked up by buildOffPlanFilter inside filterOffPlanProperties
  return filterOffPlanProperties(req, res);
};

const filterByMinPrice = (req, res) => {
  if (!req.query.minPrice) {
    return res.status(400).json({
      success: false,
      message: "MinPrice parameter is required",
    });
  }
  return filterOffPlanProperties(req, res);
};

const filterByMaxPrice = (req, res) => {
  if (!req.query.maxPrice) {
    return res.status(400).json({
      success: false,
      message: "MaxPrice parameter is required",
    });
  }
  return filterOffPlanProperties(req, res);
};

const filterByHandoverQuarter = (req, res) => {
  if (!req.query.handoverQuarter) {
    return res.status(400).json({
      success: false,
      message: "handoverQuarter parameter is required",
    });
  }
  return filterOffPlanProperties(req, res);
};

const OffSearchProperty = (req, res) => {
  if (!req.query.prefix) {
    return res.status(400).json({
      success: false,
      message: "Please provide a prefix",
    });
  }
  if (req.query.prefix.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Prefix must be at least 2 characters long",
      data: [],
    });
  }
  return filterOffPlanProperties(req, res);
};

// ─── Get all new off-plan properties with pagination ─────────────────────────
const getNewOffPlanProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "12", 10);
    const skip = (page - 1) * limit;

    const filterQuery = {};

    if (req.query.area) filterQuery.area = new RegExp(req.query.area, "i");
    if (req.query.developer)
      filterQuery.developer = new RegExp(req.query.developer, "i");
    if (req.query.status) filterQuery.status = req.query.status;
    if (req.query.saleStatus) filterQuery.saleStatus = req.query.saleStatus;

    if (typeof req.query.isPartnerProject !== "undefined") {
      filterQuery.isPartnerProject = req.query.isPartnerProject === "true";
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filterQuery.minPriceAed = {};
      if (req.query.minPrice)
        filterQuery.minPriceAed.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice)
        filterQuery.minPriceAed.$lte = parseFloat(req.query.maxPrice);
    }

    if (req.query.search) {
      const re = new RegExp(req.query.search, "i");
      filterQuery.$or = [{ name: re }, { area: re }, { developer: re }];
    }

    if (req.query.active !== "false") {
      filterQuery.active = true;
    }

    const totalCount = await OffPlanProperty.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const offPlanProperties = await OffPlanProperty.find(filterQuery)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(offPlanProperties.length ? 200 : 404).json({
      success: !!offPlanProperties.length,
      message: offPlanProperties.length
        ? "Off-plan properties fetched successfully"
        : "No off-plan properties found",
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        totalMatchingProperties: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: offPlanProperties.length,
      data: offPlanProperties,
    });
  } catch (error) {
    console.error("Error fetching new off-plan properties:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch off-plan properties",
      error: error.message,
    });
  }
};

// ─── Single property from external API ───────────────────────────────────────
const getSIngleOffplanProperty = async (req, res) => {
  console.log("WORKING");
  const property_id = req.query.property_id;
  try {
    console.log("HELLO");
    const response = await axios.get(
      `${process.env.SingleOffPlanApi}/${property_id}`,
      {
        headers: {
          "X-API-Key": `${process.env.OffPlanApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    console.log(response.data);
    return res.status(200).json({
      msg: "Single Property Data Recieved",
      data: response.data,
    });
  } catch (err) {
    console.log(err);
  }
};

// ─── Address / name suggestions ───────────────────────────────────────────────
const getOffPlanAddressSuggestions = async (req, res) => {
  try {
    const prefix = req.query.prefix;
    const maxSuggestions = parseInt(req.query.limit) || 8;

    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: "Prefix parameter is required",
      });
    }

    if (prefix.length < 2) {
      return res.json({
        success: true,
        message: "Prefix too short for meaningful search",
        data: [],
        count: 0,
        debug: { prefix, minLength: 2 },
      });
    }

    const query = {
      active: true,
      name: { $regex: new RegExp(`\\b${prefix}`, "i") },
    };

    console.log("MongoDB query:", JSON.stringify(query, null, 2));

    const properties = await OffPlanProperty.find(query)
      .limit(maxSuggestions * 2)
      .select("name area developer")
      .lean();

    console.log(`Found ${properties.length} off-plan properties matching query`);

    const suggestions = new Set();

    properties.forEach((property) => {
      if (property.name && property.name.trim()) {
        const projectName = property.name.trim();
        if (projectName.toLowerCase().includes(prefix.toLowerCase())) {
          suggestions.add(projectName);
        }
        if (suggestions.size >= maxSuggestions) return;
      }
    });

    let suggestionsArray = Array.from(suggestions);

    suggestionsArray.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const prefixLower = prefix.toLowerCase();

      const aExact = aLower === prefixLower;
      const bExact = bLower === prefixLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aLower.startsWith(prefixLower);
      const bStarts = bLower.startsWith(prefixLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });

    suggestionsArray = suggestionsArray.slice(0, maxSuggestions);

    return res.status(200).json({
      success: true,
      message: `Found ${suggestionsArray.length} off-plan project suggestions for "${prefix}"`,
      count: suggestionsArray.length,
      data: suggestionsArray,
      debug: {
        prefix,
        totalPropertiesFound: properties.length,
        uniqueSuggestions: suggestionsArray.length,
      },
    });
  } catch (error) {
    console.error("Error in getOffPlanAddressSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get off-plan project suggestions",
      error: error.message,
      data: [],
    });
  }
};

// ─── Developer suggestions ────────────────────────────────────────────────────
const getOffPlanDeveloperSuggestions = async (req, res) => {
  try {
    const prefix = req.query.prefix;
    const limit = parseInt(req.query.limit) || 8;

    if (!prefix || prefix.length < 2) {
      return res.json({ success: true, data: [], count: 0 });
    }

    const regex = new RegExp(`^${prefix}`, "i");

    const developers = await OffPlanProperty.distinct("developer", {
      active: true,
      developer: { $regex: regex },
    });

    const suggestions = developers.slice(0, limit);

    return res.status(200).json({
      success: true,
      data: suggestions,
      count: suggestions.length,
    });
  } catch (error) {
    console.error("Developer suggestion error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch developer suggestions",
      error: error.message,
    });
  }
};

// ─── Sync status ──────────────────────────────────────────────────────────────
const getSyncStatus = async (req, res) => {
  try {
    const totalProperties = await OffPlanProperty.countDocuments();
    const recentProperties = await OffPlanProperty.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const lastUpdated = await OffPlanProperty.findOne()
      .sort({ updatedAt: -1 })
      .select("updatedAt");

    return res.status(200).json({
      success: true,
      message: "Sync status retrieved successfully",
      data: {
        totalProperties,
        recentProperties,
        lastUpdated: lastUpdated?.updatedAt || null,
        apiConfig: {
          baseUrl: process.env.AllOffPlanPropertyiesListUrl || "Not configured",
          hasApiKey: !!process.env.OffPlanApiKey,
          endpoint: "Off-plan properties endpoint",
        },
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get sync status",
      error: error.message,
    });
  }
};

// ─── Toggle active status (dashboard) ────────────────────────────────────────
const StatusUpdateOffPlanProperties = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await OffPlanProperty.findById(id).select("active");
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const updatedProperty = await OffPlanProperty.findByIdAndUpdate(
      id,
      { $set: { active: !property.active } },
      { new: true, lean: true },
    );

    return res.status(200).json({
      success: true,
      message: "Property status updated",
      data: {
        _id: updatedProperty._id,
        active: updatedProperty.active,
      },
    });
  } catch (error) {
    console.error("Toggle active error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Dashboard search/filter ──────────────────────────────────────────────────
const filterDashboardProperties = async (req, res) => {
  try {
    const { q } = req.query;

    const filter = {};
    if (q && q.trim()) {
      const regex = new RegExp(`^${q.trim()}`, "i");
      filter.$or = [
        { name: regex },
        { area: regex },
        { developer: regex },
        ...(q === "active"
          ? [{ active: true }]
          : q === "inactive"
            ? [{ active: false }]
            : []),
      ];
    }

    const data = await OffPlanProperty.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("Filter offplan properties error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Filter by community/area (similar properties) ───────────────────────────
const offPlanFilterByCommunity = async (req, res) => {
  try {
    let area = req.query.area || "";
    const apiId = req.query.apiId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!area) {
      return res.status(400).json({ success: false, message: "Area is required" });
    }

    area = area.split("(")[0].trim();
    const searchWords = area.split(/\s+/).filter((word) => word.length > 0);
    const wordRegexPatterns = searchWords.map((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedWord}\\b`, "i");
    });

    const queryConditions = [
      { area: { $all: wordRegexPatterns } },
      { status: { $ne: "Deleted" } },
      { active: true },
    ];

    if (apiId) {
      queryConditions.push({ apiId: { $ne: Number(apiId) } });
    }

    const query = { $and: queryConditions };
    const skip = (page - 1) * limit;

    const totalCount = await OffPlanProperty.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const properties = await OffPlanProperty.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      message: `Properties found in "${area}"`,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Error in filterByArea:", error);
    res.status(500).json({
      success: false,
      message: "Failed to filter properties by area",
      error: error.message,
    });
  }
};

module.exports = {
  fetchAndSaveProperties,
  getOffPlanAddressSuggestions,
  getNewOffPlanProperties,
  getSyncStatus,
  getSIngleOffplanProperty,
  FilterDeveloperOffplanProperty,
  filterByMinPrice,
  filterByMaxPrice,
  OffSearchProperty,
  filterOffPlanProperties,        
  StatusUpdateOffPlanProperties,
  filterDashboardProperties,
  offPlanFilterByCommunity,
  getOffPlanDeveloperSuggestions,
  filterByHandoverQuarter,
  scheduleNewOffPlanSync,
};