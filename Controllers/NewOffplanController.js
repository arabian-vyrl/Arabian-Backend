const OffPlanProperty = require("../Models/NewOffplanModel");
const axios = require("axios");
const cron = require("node-cron");

const scheduleNewOffPlanSync = () => {
  const TZ = process.env.CRON_TZ || "Etc/UTC";

  cron.schedule(
   "0 2 * * *", 
    async () => {
      // console.log(`🔄 [${new Date().toISOString()}] OffPlan sync started`);
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
    `NewOffPlan scheduler initialized - Running daily at 02:00 (${TZ})`,
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
      console.log(
        `  Change in ${field}: "${existing[field]}" -> "${newDoc[field]}"`,
      );
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
      console.log(
        `  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`,
      );
      return true;
    }
  }

  const booleanFields = ["isPartnerProject", "hasEscrow", "postHandover"];
  for (const field of booleanFields) {
    if (!!existing[field] !== !!newDoc[field]) {
      console.log(
        `  Change in ${field}: ${existing[field]} -> ${newDoc[field]}`,
      );
      return true;
    }
  }

  if (!compareDates(existing.completionDate, newDoc.completionDate)) {
    console.log(
      `  Change in completionDate: ${existing.completionDate} -> ${newDoc.completionDate}`,
    );
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
//           timeout: 30000,
//         });
//         data = response.data;
//         status = response.status;
//       } catch (axiosError) {
//         console.error(`API Error on page ${page}:`, axiosError.message);
//         if (
//           axiosError.code === "ECONNRESET" ||
//           axiosError.code === "ETIMEDOUT"
//         ) {
//           console.log(
//             "Connection lost. Ending sync with data processed so far.",
//           );
//           break;
//         }
//         throw axiosError;
//       }

//       console.log("API status:", status);

//       const apiItems = data?.items || [];
//       const pagination = data?.pagination || {};
//       totalFromAPI += apiItems.length;

//       if (!Array.isArray(apiItems) || apiItems.length === 0) {
//         console.log("No items on this page; stopping.");
//         break;
//       }

//       for (const item of apiItems) {
//         try {
//           let lat = null,
//             lng = null;
//           if (item.coordinates) {
//             const [a, b] = String(item.coordinates)
//               .split(",")
//               .map((v) => v.trim());
//             lat = a ? parseFloat(a) : null;
//             lng = b ? parseFloat(b) : null;
//           }

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

//           const existingProperty = await OffPlanProperty.findOne({
//             apiId: item.id,
//           }).lean();

//           if (!existingProperty) {
//             await OffPlanProperty.create(doc);
//             newInserts++;
//             totalProcessed++;
//             console.log(
//               `✓ Inserted new property: ${item.name} (ID: ${item.id})`,
//             );
//           } else if (force) {
//             await OffPlanProperty.updateOne({ apiId: item.id }, { $set: doc });
//             updated++;
//             totalProcessed++;
//             console.log(`✓ Force updated: ${item.name} (ID: ${item.id})`);
//           } else {
//             const hasChanges = checkForChanges(existingProperty, doc);
//             if (hasChanges) {
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

    // Statistics tracking
    let totalFromAPI = 0;
    let newInserts = 0;
    let skipped = 0;
    let deleted = 0;
    const errors = [];
    const apiIdsFromAPI = new Set(); // Track all API IDs from the API

    console.log("Starting smart sync: Insert new, skip existing, delete orphaned");

    // Step 1: Fetch all pages from API and process
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
          console.log(
            "Connection lost. Ending sync with data processed so far.",
          );
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

      // Process each item from API
      for (const item of apiItems) {
        try {
          // Track this API ID
          apiIdsFromAPI.add(item.id);

          // Parse coordinates
          let lat = null,
            lng = null;
          if (item.coordinates) {
            const [a, b] = String(item.coordinates)
              .split(",")
              .map((v) => v.trim());
            lat = a ? parseFloat(a) : null;
            lng = b ? parseFloat(b) : null;
          }

          // Parse cover image
          let coverImage = {};
          try {
            if (item.cover_image_url) {
              // If it's already an object, use it directly
              coverImage =
                typeof item.cover_image_url === "object"
                  ? item.cover_image_url
                  : JSON.parse(item.cover_image_url);
            }
          } catch (e) {
            console.warn(
              `cover_image_url parse failed for ${item.name} (ID ${item.id}): ${e.message}`,
            );
          }

          // Format handover quarter
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

          // Add this helper function at the top of your controller
          const normalizeStatus = (status) => {
            if (!status) return null;
            const statusMap = {
              'under construction': 'Under construction',
              'completed': 'Completed',
              'presale': 'Presale'
            };
            return statusMap[status.toLowerCase()] || status;
          };

          const normalizeSaleStatus = (saleStatus) => {
            if (!saleStatus) return null;
            const statusMap = {
              'on sale': 'On sale',
              'start of sales': 'Start of sales',
              'out of stock': 'Out of stock',
              'presale(eoi)': 'Presale(EOI)'
            };
            return statusMap[saleStatus.toLowerCase()] || saleStatus;
          };

          // Then in your document building:
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
            status: normalizeStatus(item.status), 
            saleStatus: normalizeSaleStatus(item.sale_status), 
            handoverQuarter: handoverQuarter,
            completionDate,
            isPartnerProject: !!item.is_partner_project,
            hasEscrow: !!item.has_escrow,
            postHandover: !!item.post_handover,
            coverImage,
            active: true,
          };

          // Check if property exists in database
          const existingProperty = await OffPlanProperty.findOne({
            apiId: item.id,
          }).lean();

          if (!existingProperty) {
            // Property doesn't exist - INSERT
            await OffPlanProperty.create(doc);
            newInserts++;
            console.log(
              `✓ Inserted new property: ${item.name} (API ID: ${item.id})`,
            );
          } else {
            // Property exists - SKIP (no updates needed)
            skipped++;
            console.log(
              `- Skipped (already exists): ${item.name} (API ID: ${item.id})`,
            );
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

      // Check if there are more pages
      if (!pagination?.has_next) {
        console.log("No more pages.");
        break;
      }
      page += 1;
    }

    // Step 2: Delete properties that exist in DB but not in API
    console.log("\n--- Cleaning up orphaned properties ---");

    // Get all apiIds from database
    const allDbProperties = await OffPlanProperty.find({}, { apiId: 1 }).lean();
    const dbApiIds = allDbProperties.map((prop) => prop.apiId);

    // Find apiIds that are in DB but not in API
    const orphanedApiIds = dbApiIds.filter((dbId) => !apiIdsFromAPI.has(dbId));

    if (orphanedApiIds.length > 0) {
      console.log(`Found ${orphanedApiIds.length} orphaned properties to delete`);

      // Delete orphaned properties
      const deleteResult = await OffPlanProperty.deleteMany({
        apiId: { $in: orphanedApiIds },
      });

      deleted = deleteResult.deletedCount || 0;
      console.log(`✓ Deleted ${deleted} orphaned properties`);

      // Log details of deleted properties
      orphanedApiIds.forEach((apiId) => {
        console.log(`  - Deleted property with API ID: ${apiId}`);
      });
    } else {
      console.log("No orphaned properties found");
    }

    // Final count
    const totalInDB = await OffPlanProperty.countDocuments();
    const totalProcessed = newInserts + skipped;

    console.log("\n=== Sync Summary ===");
    console.log(`Total from API: ${totalFromAPI}`);
    console.log(`New inserts: ${newInserts}`);
    console.log(`Skipped (existing): ${skipped}`);
    console.log(`Deleted (orphaned): ${deleted}`);
    console.log(`Total in database: ${totalInDB}`);
    console.log(`Errors: ${errors.length}`);

    return res.status(200).json({
      success: true,
      message: "Smart sync complete",
      mode: "Smart Sync (Insert new, Skip existing, Delete orphaned)",
      summary: {
        totalFromAPI,
        newInserts,
        skipped,
        deleted,
        totalProcessed,
        totalErrors: errors.length,
        totalInDatabase: totalInDB,
      },
      breakdown: {
        inserted: `${newInserts} new properties added`,
        skipped: `${skipped} existing properties unchanged`,
        deleted: `${deleted} orphaned properties removed`,
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
  // if (query.handoverQuarter) {
  //   filter.handoverQuarter = query.handoverQuarter.trim();
  // }

  if (query.handoverQuarter) {
    const handover = query.handoverQuarter.trim();

    // Special case: "2030 +"
    if (/^2030\s*\+$/.test(handover)) {
      // Show everything from 2030 onwards (up to 2050 and beyond)
      filter.completionDate = { $gte: new Date("2031-01-01T00:00:00.000Z") };
      // IMPORTANT: don't set filter.handoverQuarter = "2030 +"
    } else {
      // Keep existing behavior for normal values like "Q4 2024"
      filter.handoverQuarter = handover;
    }
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
    const escaped = query.prefix.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    console.log(
      "🔍 Unified Filter - MongoDB Filter:",
      JSON.stringify(filter, null, 2),
    );

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
// const getNewOffPlanProperties = async (req, res) => {
//   try {
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


const getNewOffPlanProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "12", 10);
    const skip = (page - 1) * limit;

    const filterQuery = {};

    if (req.query.area)
      filterQuery.area = new RegExp(req.query.area, "i");

    if (req.query.developer)
      filterQuery.developer = new RegExp(req.query.developer, "i");

    if (req.query.status)
      filterQuery.status = req.query.status;

    if (req.query.saleStatus)
      filterQuery.saleStatus = req.query.saleStatus;

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

    // ✅ Only the fields OffplanCard.jsx actually renders
    const SELECT_FIELDS =
      "_id id apiId name area developer handoverQuarter saleStatus status active " +
      "minPrice minPriceAed maxPrice " +
      "mainImageUrl coverImage.url coverImage.meta";

    const [totalCount, offPlanProperties] = await Promise.all([
      OffPlanProperty.countDocuments(filterQuery),
      OffPlanProperty.find(filterQuery)
        .select(SELECT_FIELDS)
        .skip(skip)
        .limit(limit)
        .sort({ apiId: 1 })
        .lean(), // plain JS objects — faster serialization, no Mongoose overhead
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;
    const found = offPlanProperties.length > 0;

    return res.status(found ? 200 : 404).json({
      success: found,
      message: found
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

    console.log(
      `Found ${properties.length} off-plan properties matching query`,
    );

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
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
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
      return res
        .status(400)
        .json({ success: false, message: "Area is required" });
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
