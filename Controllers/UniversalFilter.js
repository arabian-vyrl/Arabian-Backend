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
  "Garden": "private-garden",
  Elevator: "elevator",
  "Maid Room": "maids-room",
  "Study Room": "study",
  Storage: "storage",
  "Built-in Wardrobes": "built-in-wardrobes",
  "Kitchen Appliances": "kitchen-appliances",
  "Jacuzzi" : "private-jacuzzi"
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

    // Base query â€” previously used to filter Live only; now everything is Live in collections
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
    const listingType =
      req.query.listing_type ||
      req.query.listingType ||
      req.query.type ||
      "Sale";
    const prefix = req.query.prefix;
    const maxSuggestions = parseInt(req.query.limit) || 5;

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
    const generateAbbreviation = (text) => {
      if (!text) return "";
      const words = text.trim().split(/\s+/).filter(Boolean);
      return words.map(word => word.charAt(0).toUpperCase()).join("");
    };

    const matchesPrefixOrAbbreviation = (text, searchPrefix) => {
      if (!text) return false;

      const lowerText = text.toLowerCase();
      const lowerPrefix = searchPrefix.toLowerCase();

      // Check word boundary match
      if (lowerText.match(new RegExp(`\\b${lowerPrefix}`))) {
        return true;
      }

      // Check if abbreviation matches prefix
      const abbreviation = generateAbbreviation(text);
      if (abbreviation.toLowerCase().startsWith(lowerPrefix)) {
        return true;
      }

      return false;
    };

    console.log(
      `Getting address suggestions for prefix: "${prefix}" from ${listingType} properties`
    );

    // Check if prefix looks like an abbreviation (all uppercase or very short)
    const isLikelyAbbreviation = prefix.length <= 3 && /^[A-Z]+$/i.test(prefix);

    let properties;

    if (isLikelyAbbreviation) {
      // For abbreviation search, skip regex and fetch all properties
      console.log(`Detected likely abbreviation search: "${prefix}"`);
      const generalQuery = {
        listing_type: listingType,
      };

      properties = await Property.find(generalQuery)
        .limit(500)
        .select("custom_fields.propertyfinder_region listing_type")
        .lean();
    } else {
      // For regular text search, use regex for efficiency
      const regexQuery = {
        listing_type: listingType,
        "custom_fields.propertyfinder_region": {
          $regex: new RegExp(`\\b${prefix}`, "i"),
        },
      };

      properties = await Property.find(regexQuery)
        .limit(100)
        .select("custom_fields.propertyfinder_region listing_type")
        .lean();

      // If no results from regex, fallback to fetching all
      if (properties.length === 0) {
        console.log(`No regex matches found, fetching all for manual matching`);
        const generalQuery = {
          listing_type: listingType,
        };

        properties = await Property.find(generalQuery)
          .limit(500)
          .select("custom_fields.propertyfinder_region listing_type")
          .lean();
      }
    }

    console.log(
      `Found ${properties.length} ${listingType} properties in database`
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
          // Check if part matches prefix OR abbreviation
          if (matchesPrefixOrAbbreviation(part, prefix)) {
            suggestions.add(part);

            // Stop early if we reached the cap (collect extra for sorting)
            if (suggestions.size >= maxSuggestions * 3) return;
          }
        }
      }
    };

    properties.forEach((property) => {
      if (property.custom_fields?.propertyfinder_region) {
        processAddress(property.custom_fields.propertyfinder_region);
      }
    });

    let suggestionsArray = Array.from(suggestions);
    suggestionsArray.sort((a, b) => {
      const lowerPrefix = prefix.toLowerCase();

      const aStartsWithPrefix = a.toLowerCase().startsWith(lowerPrefix);
      const bStartsWithPrefix = b.toLowerCase().startsWith(lowerPrefix);

      const aAbbreviation = generateAbbreviation(a).toLowerCase();
      const bAbbreviation = generateAbbreviation(b).toLowerCase();

      const aAbbreviationMatch = aAbbreviation.startsWith(lowerPrefix);
      const bAbbreviationMatch = bAbbreviation.startsWith(lowerPrefix);

      // Prioritize exact start matches
      if (aStartsWithPrefix && !bStartsWithPrefix) return -1;
      if (!aStartsWithPrefix && bStartsWithPrefix) return 1;

      // Then prioritize abbreviation matches
      if (aAbbreviationMatch && !bAbbreviationMatch) return -1;
      if (!aAbbreviationMatch && bAbbreviationMatch) return 1;

      // Then by length (shorter first)
      if (a.length !== b.length) return a.length - b.length;

      // Finally alphabetically
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
        abbreviationMatching: true,
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

    const propertyPrice = req.query.propertyPrice;

    console.log("PROPERTY PRICE", propertyPrice)
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



const NewfilterByCommunity = async (req, res) => {
  try {
    const propertyPrice = req.query.propertyPrice || "";
    console.log("PROPERTY PRICE", propertyPrice);
    let community = req.query.community || "";
    const listingTypeParam = req.query.listingType || req.query.type || "";
    console.log("Community", community)

    console.log("Listing Type Param", listingTypeParam)

    //Normalize the Community Name to remove the (Tecom, (Dubai World Central) ) like this 
    if (community) {
       community = community.split('(')[0].trim();
    }

    const listingTypes = listingTypeParam.split(",").map((t) => t.trim());
    console.log("LT", listingTypes);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    // Normalize listing types: "sale" -> "Sale", "offplan" -> "Offplan"
    const normalizedListingTypes = listingTypes.map(
      (type) => type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    );

    // Community filter (optional)
    let communityQuery = {};
    let searchWords = [];
    
    if (community) {
      // Break community string into words for flexible matching
      searchWords = community
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0);

      // Create regex patterns for each word with word-boundaries
      const wordRegexPatterns = searchWords.map((word) => {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escapedWord}\\b`, "i");
      });
      
      communityQuery = {
        "custom_fields.community": {
          $all: wordRegexPatterns,
        },
      };
    }

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

    // Price range calculation (±20% of propertyPrice)
    let priceQuery = {};
    let minPrice = null;
    let maxPrice = null;
    
    if (propertyPrice) {
      const basePrice = parseFloat(propertyPrice);
      minPrice = basePrice - (basePrice * 0.25); // 25% decrease
      maxPrice = basePrice + (basePrice * 0.25); // 25% increase
      
      priceQuery = {
        "general_listing_information.listingprice": {
          $gte: minPrice.toString(),
          $lte: maxPrice.toString()
        }
      };

      console.log("Price Range:", {
        basePrice,
        minPrice,
        maxPrice
      });
    }

    // Combined query:
    // - community (if provided)
    // - listing type logic
    // - price range (if provided)
    // - Live properties only

    const queryConditions = [
      listingTypeQuery,
      {
        "general_listing_information.status": "Live",
      },
    ];
    
    // Add community filter only if provided
    if (community) {
      queryConditions.push(communityQuery);
    }

    // Add price filter only if provided
    if (propertyPrice) {
      queryConditions.push(priceQuery);
    }

    const combinedQuery = {
      $and: queryConditions,
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
          .toLowerCase()} properties found${community ? ` in "${community}" community` : ''}${propertyPrice ? ` within price range ${minPrice} - ${maxPrice}` : ''}`,
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          perPage: limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
        priceFilter: propertyPrice ? {
          basePrice: parseFloat(propertyPrice),
          minPrice,
          maxPrice,
          range: "±25%"
        } : null,
        communityStats: {
          totalMatches: 0,
          communitiesBreakdown: {}
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

    // Get all properties (without pagination) for community statistics
    const allProperties = await Property.find(combinedQuery)
      .select('custom_fields.community')
      .lean();

    // Calculate community statistics
    const communityBreakdown = {};
    allProperties.forEach(prop => {
      const communityName = prop.custom_fields?.community || 'Unknown';
      communityBreakdown[communityName] = (communityBreakdown[communityName] || 0) + 1;
    });

    console.log(
      `Found ${properties.length} ${normalizedListingTypes
        .join(" and ")
        .toLowerCase()} properties for page ${page}${community ? ` in "${community}" community` : ''}${propertyPrice ? ` within price range` : ''}`
    );

    res.status(200).json({
      success: true,
      message: `${normalizedListingTypes.join(
        " and "
      )} properties${community ? ` in "${community}" community` : ''} found successfully`,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      priceFilter: propertyPrice ? {
        basePrice: parseFloat(propertyPrice),
        minPrice,
        maxPrice,
        range: "±20%"
      } : null,
      communityStats: {
        totalMatches: totalCount,
        communitiesBreakdown: communityBreakdown
      },
      searchTerms: searchWords,
      searchField: community ? "custom_fields.community" : null,
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


/* -------------------------------------------------------------------------- */
/*                                Exports                                     */
/* -------------------------------------------------------------------------- */

module.exports = {
  SortProperties,
  getAddressSuggestions,
  filterByCommunity,
  // Main universal filter for property search
  UniversalSpecializedFilter,
  NewfilterByCommunity
};