// ====================================
// testController2.js - OPTIMIZED Non-Blocking GeoPoint Matching
// ====================================

const Property = require("../Models/PropertyModel");
const ExtractRedinLocation = require("../Models/ExtractLocationRedin");

const {
  extractRegionParts,
  countAvailableCoordinates,
  extractAndTrimCoordinates,
} = require("./HelperFunctions/matchingUtilities");

const {
  executeStep1_CombinedRegionMatch,
  executeStep2_FirstRegionMatch,
  executeStep3_Region1Or2Match,
  executeStep4_SecondRegionMatch,
  executeStep5_PartialWordMatch,
  executeStep6_Starting2WordsMatch,
  executeStep7_CoordinateMatch,
} = require("./HelperFunctions/matchingStrategies");

// ========== CONFIGURATION ==========
const BATCH_SIZE = 50; // Process 50 properties per batch
const YIELD_INTERVAL = 10; // Yield to event loop every 10 iterations

// ========== HELPER: Yield to Event Loop ==========
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

// ========== OPTIMIZED: Build Flattened Redin Array ==========
const buildFlattenedRedinArray = async (redinLocationData) => {
  const redinPropertiesFlattened = [];

  for (let i = 0; i < redinLocationData.length; i++) {
    const location = redinLocationData[i];

    if (location.properties && Array.isArray(location.properties)) {
      location.properties.forEach((p) => {
        redinPropertiesFlattened.push({
          location_id: location.location_id,
          coordinates: location.geo_point
            ? { lat: location.geo_point.lat, lon: location.geo_point.lon }
            : null,
          property_id: p.property?.id,
          property_name: p.property?.name,
          main_subtype_name:
            p.property?.main_subtype_name || p.main_subtype_name,
          main_type_name: p.property?.main_type_name || p.main_type_name,
        });
      });
    }

    // Yield every YIELD_INTERVAL iterations
    if (i % YIELD_INTERVAL === 0) {
      await yieldToEventLoop();
    }
  }

  return redinPropertiesFlattened;
};

// ========== OPTIMIZED: Non-Blocking Matching Step ==========
const executeMatchingStepNonBlocking = async (
  stepNumber,
  stepName,
  unmatchedProperties,
  matchingFunction,
  redinPropertiesFlattened,
  stats,
  results,
  bulkOperations,
  subtypeMismatchTrackedIds,
  successfullyMatchedIds,
) => {
  console.log(`\n--- STEP ${stepNumber}: ${stepName} ---`);

  const matched = [];
  const subtypeMismatches = [];
  const stillUnmatched = [];

  for (let i = 0; i < unmatchedProperties.length; i++) {
    const property = unmatchedProperties[i];
    const result = matchingFunction(property, redinPropertiesFlattened);
    const { matchResult, nameMatches, typeMismatchInfo, matchDetails } = result;

    if (matchResult) {
      // ✅ FULL MATCH FOUND
      matched.push(
        createMatchedObject(property, matchResult, stepNumber, matchDetails),
      );

      // Remove from mismatch tracking if it was there
      if (subtypeMismatchTrackedIds.has(property.id)) {
        subtypeMismatchTrackedIds.delete(property.id);
      }

      successfullyMatchedIds.add(property.id);

      // Update stats
      updateStatsForMatch(stats, stepNumber, matchDetails);
      stats.totalMatchedProperties++;

      // Add to bulk operations instead of individual update
      bulkOperations.push({
        updateOne: {
          filter: { id: property.id },
          update: {
            $set: {
              redin_location: {
                location_id: matchResult.match.location_id,
                property_location_id: matchResult.match.property_id,
                property_name: matchResult.match.property_name,
                main_subtype_name: matchResult.match.main_subtype_name,
                main_type_name: matchResult.match.main_type_name,
                matched_by: stepName,
                matched_region_level: stepNumber,
                matched_region_part: matchResult.matchedRegionPart,
              },
            },
          },
        },
      });
    } else if ((nameMatches && nameMatches.length > 0) || typeMismatchInfo) {
      // ❌ NAME MATCHED BUT SUBTYPE MISMATCH
      if (!subtypeMismatchTrackedIds.has(property.id)) {
        const mismatchData = typeMismatchInfo
          ? typeMismatchInfo.availableTypes
          : nameMatches;

        subtypeMismatches.push(
          createSubtypeMismatchObject(property, mismatchData, stepNumber),
        );
        stats[`totalPropertiesMatchStep${stepNumber}_ButSubTypeMisMatch`]++;
        subtypeMismatchTrackedIds.add(property.id);
      }
      stillUnmatched.push(property);
    } else {
      // ❌ NO MATCH AT ALL
      stillUnmatched.push(property);
    }

    // Yield to event loop periodically to prevent blocking
    if (i % YIELD_INTERVAL === 0) {
      await yieldToEventLoop();
    }
  }

  stats[`afterStep${stepNumber}AvailableCoordinates`] =
    countAvailableCoordinates(stillUnmatched);

  results[`step${stepNumber}_matched`] = matched;
  results[`step${stepNumber}_subtypeMismatches`] = subtypeMismatches;

  console.log(
    `Step ${stepNumber} Complete: ${matched.length} matched, ${stillUnmatched.length} remaining`,
  );

  return stillUnmatched;
};

// ========== HELPER: Update Stats ==========
const updateStatsForMatch = (stats, stepNumber, matchDetails) => {
  if (stepNumber === 1) stats.step1CombinedMatchedTotal++;
  else if (stepNumber === 2) stats.step2FirstRegionMatchedTotal++;
  else if (stepNumber === 3) stats.step3_1or2_regionMatchedTotal++;
  else if (stepNumber === 4) stats.step4SecondRegionMatchedTotal++;
  else if (stepNumber === 5) stats.step5_partialWordMatchedTotal++;
  else if (stepNumber === 6) stats.step6_starting2WordMatchedTotal++;
  else if (stepNumber === 7) {
    stats.step7_matchedWithCoordinates++;
    if (matchDetails) {
      if (matchDetails.coordType === "exact") stats.step7_coordExactMatches++;
      else if (matchDetails.coordType === "increment")
        stats.step7_coordIncrementMatches++;
      else if (matchDetails.coordType === "decrement")
        stats.step7_coordDecrementMatches++;
      else if (matchDetails.coordType === "increment_lon")
        stats.step7_coordIncrementLonMatches++;
      else if (matchDetails.coordType === "decrement_lon")
        stats.step7_coordDecrementLonMatches++;
    }
  }
};

// ========== HELPER: Create Matched Object ==========
const createMatchedObject = (
  property,
  matchResult,
  stepNumber,
  matchDetails = null,
) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region,
  );

  const baseObject = {
    property_id: property.id,
    full_region: property.custom_fields?.propertyfinder_region,
    region1,
    region2,
    property_type: property.property_type,
    matched_region_part: matchResult.matchedRegionPart,
    matched_redin: {
      location_id: matchResult.match.location_id,
      property_name: matchResult.match.property_name,
      main_subtype_name: matchResult.match.main_subtype_name,
    },
  };

  if (stepNumber === 7 && matchDetails) {
    const propertyCoords = extractAndTrimCoordinates(
      property.address_information,
    );
    baseObject.coordinate_match_details = {
      property_coordinates: {
        original: propertyCoords?.original || null,
        trimmed: {
          lat: propertyCoords?.lat || null,
          lon: propertyCoords?.lon || null,
        },
      },
      redin_coordinates: matchResult.match.coordinates || null,
      match_type: matchDetails.coordType,
      matched_at_coords: matchResult.matchedCoords || null,
    };
  }

  return baseObject;
};

// ========== HELPER: Create Subtype Mismatch Object ==========
const createSubtypeMismatchObject = (property, nameMatches, stepNumber) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region,
  );

  return {
    property_id: property.id,
    full_region: property.custom_fields?.propertyfinder_region,
    region1,
    region2,
    property_type: property.property_type,
    matched_in_step: stepNumber,
    available_redin_matches: nameMatches.map((m) => ({
      property_name: m.property_name,
      main_subtype_name: m.main_subtype_name,
      location_id: m.location_id,
    })),
  };
};

// ========== MAIN OPTIMIZED CONTROLLER ==========
const MatchGeoPointOptimized = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log(
      "\n========== STARTING OPTIMIZED GEO POINT MATCHING ==========",
    );

    const forceRematch = req.query.forceRematch === "true";

    // Build query
    const propertyQuery = {
      "custom_fields.city": "Dubai",
      "general_listing_information.status": "Live",
    };

    if (!forceRematch) {
      propertyQuery.$or = [
        { "redin_location.location_id": { $exists: false } },
        { "redin_location.location_id": null },
        { redin_location: { $exists: false } },
      ];
    }

    // ========== PARALLEL DATA FETCHING ==========
    console.log("Fetching data in parallel...");

    const [
      dubaiLiveProperties,
      redinLocationData,
      totalDubaiLivePropertiesCount,
      alreadyMatchedCount,
    ] = await Promise.all([
      Property.find(propertyQuery, {
        id: 1,
        "custom_fields.propertyfinder_region": 1,
        "custom_fields.city": 1,
        "general_listing_information.status": 1,
        address_information: 1,
        property_type: 1,
        redin_location: 1,
      }).lean(), // Use lean() for better performance - plain JS objects

      ExtractRedinLocation.find({}).lean(), // Use lean() here too

      Property.countDocuments({
        "custom_fields.city": "Dubai",
        "general_listing_information.status": "Live",
      }),

      Property.countDocuments({
        "custom_fields.city": "Dubai",
        "general_listing_information.status": "Live",
        "redin_location.location_id": { $exists: true, $ne: null },
      }),
    ]);

    console.log(`\n========== QUERY SUMMARY ==========`);
    console.log(`Force Rematch: ${forceRematch ? "YES" : "NO"}`);
    console.log(
      `Total Dubai Live Properties: ${totalDubaiLivePropertiesCount}`,
    );
    console.log(`Already Matched (Skipped): ${alreadyMatchedCount}`);
    console.log(`Properties to Process: ${dubaiLiveProperties.length}`);
    console.log(`Redin Locations: ${redinLocationData.length}`);
    console.log(`===================================\n`);

    // ========== BUILD FLATTENED REDIN ARRAY (Non-Blocking) ==========
    console.log("Building flattened Redin array...");
    const redinPropertiesFlattened =
      await buildFlattenedRedinArray(redinLocationData);
    console.log(
      `Built ${redinPropertiesFlattened.length} flattened Redin properties`,
    );

    // ========== INITIALIZE STATS & RESULTS ==========
    const stats = {
      totalDubaiLiveProperties: totalDubaiLivePropertiesCount,
      alreadyMatchedProperties: alreadyMatchedCount,
      propertiesToProcess: dubaiLiveProperties.length,
      totalAvailableCoordinates: countAvailableCoordinates(dubaiLiveProperties),
      totalRedinLocations: redinLocationData.length,
      totalRedinProperties: redinPropertiesFlattened.length,
      step1CombinedMatchedTotal: 0,
      afterStep1AvailableCoordinates: 0,
      totalPropertiesMatchStep1_ButSubTypeMisMatch: 0,
      step2FirstRegionMatchedTotal: 0,
      afterStep2AvailableCoordinates: 0,
      totalPropertiesMatchStep2_ButSubTypeMisMatch: 0,
      step3_1or2_regionMatchedTotal: 0,
      afterStep3AvailableCoordinates: 0,
      totalPropertiesMatchStep3_ButSubTypeMisMatch: 0,
      step4SecondRegionMatchedTotal: 0,
      afterStep4AvailableCoordinates: 0,
      totalPropertiesMatchStep4_ButSubTypeMisMatch: 0,
      step5_partialWordMatchedTotal: 0,
      afterStep5AvailableCoordinates: 0,
      totalPropertiesMatchStep5_ButSubTypeMisMatch: 0,
      step6_starting2WordMatchedTotal: 0,
      afterStep6AvailableCoordinates: 0,
      totalPropertiesMatchStep6_ButSubTypeMisMatch: 0,
      step7_matchedWithCoordinates: 0,
      step7_coordExactMatches: 0,
      step7_coordIncrementMatches: 0,
      step7_coordDecrementMatches: 0,
      step7_coordIncrementLonMatches: 0,
      step7_coordDecrementLonMatches: 0,
      afterStep7AvailableCoordinates: 0,
      totalPropertiesMatchStep7_ButSubTypeMisMatch: 0,
      totalMatchedProperties: 0,
      totalUnmatchedProperties: 0,
      dbUpdateSuccess: 0,
      dbUpdateFailed: 0,
    };

    const results = {
      step1_matched: [],
      step1_subtypeMismatches: [],
      step2_matched: [],
      step2_subtypeMismatches: [],
      step3_matched: [],
      step3_subtypeMismatches: [],
      step4_matched: [],
      step4_subtypeMismatches: [],
      step5_matched: [],
      step5_subtypeMismatches: [],
      step6_matched: [],
      step6_subtypeMismatches: [],
      step7_matched: [],
      step7_subtypeMismatches: [],
      unmatched: [],
    };

    const bulkOperations = []; // Collect all updates for bulk write
    const subtypeMismatchTrackedIds = new Set();
    const successfullyMatchedIds = new Set();

    // ========== EXECUTE ALL STEPS (Non-Blocking) ==========
    let unmatchedProperties = dubaiLiveProperties;

    const matchingSteps = [
      {
        num: 1,
        name: "combined_region_match",
        fn: executeStep1_CombinedRegionMatch,
      },
      { num: 2, name: "first_region_match", fn: executeStep2_FirstRegionMatch },
      { num: 3, name: "region_1_or_2_match", fn: executeStep3_Region1Or2Match },
      {
        num: 4,
        name: "second_region_match",
        fn: executeStep4_SecondRegionMatch,
      },
      { num: 5, name: "partial_word_match", fn: executeStep5_PartialWordMatch },
      {
        num: 6,
        name: "starting_2_words_match",
        fn: executeStep6_Starting2WordsMatch,
      },
      { num: 7, name: "coordinate_match", fn: executeStep7_CoordinateMatch },
    ];

    for (const step of matchingSteps) {
      unmatchedProperties = await executeMatchingStepNonBlocking(
        step.num,
        step.name,
        unmatchedProperties,
        step.fn,
        redinPropertiesFlattened,
        stats,
        results,
        bulkOperations,
        subtypeMismatchTrackedIds,
        successfullyMatchedIds,
      );
    }

    // ========== BULK DATABASE UPDATE ==========
    console.log("\n--- Performing Bulk Database Update ---");

    if (bulkOperations.length > 0) {
      // Split into chunks of 1000 for MongoDB bulk write limit
      const BULK_CHUNK_SIZE = 1000;

      for (let i = 0; i < bulkOperations.length; i += BULK_CHUNK_SIZE) {
        const chunk = bulkOperations.slice(i, i + BULK_CHUNK_SIZE);

        try {
          const result = await Property.bulkWrite(chunk, { ordered: false });
          stats.dbUpdateSuccess += result.modifiedCount || chunk.length;
          console.log(
            `Bulk update chunk ${Math.floor(i / BULK_CHUNK_SIZE) + 1}: ${result.modifiedCount || chunk.length} updated`,
          );
        } catch (bulkError) {
          console.error(`Bulk update error:`, bulkError.message);
          stats.dbUpdateFailed += chunk.length;
        }

        // Yield between bulk writes
        await yieldToEventLoop();
      }
    }

    console.log(
      `Database Updates Complete: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
    );

    // ========== RECORD UNMATCHED PROPERTIES ==========
    const nameMatchedButSubtypeNotMatch = [];
    const nameNotMatchedAtAll = [];

    for (const property of unmatchedProperties) {
      if (successfullyMatchedIds.has(property.id)) continue;

      if (subtypeMismatchTrackedIds.has(property.id)) {
        let mismatchInfo = null;
        for (let i = 1; i <= 7; i++) {
          const found = results[`step${i}_subtypeMismatches`]?.find(
            (m) => m.property_id === property.id,
          );
          if (found) {
            mismatchInfo = {
              ...found,
              address_information: property.address_information,
            };
            break;
          }
        }
        if (mismatchInfo) nameMatchedButSubtypeNotMatch.push(mismatchInfo);
      } else {
        const { region1, region2 } = extractRegionParts(
          property.custom_fields?.propertyfinder_region,
        );
        nameNotMatchedAtAll.push({
          property_id: property.id,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          address_information: property.address_information,
          reason: "no_name_match_found",
        });
      }
    }

    results.unmatched = [
      ...nameMatchedButSubtypeNotMatch,
      ...nameNotMatchedAtAll,
    ];
    stats.totalUnmatchedProperties = results.unmatched.length;

    // ========== FINAL STATS ==========
    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n========== FINAL STATISTICS ==========");
    console.log(`Execution Time: ${executionTime} seconds`);
    console.log(`Total Matched: ${stats.totalMatchedProperties}`);
    console.log(`Total Unmatched: ${stats.totalUnmatchedProperties}`);
    console.log(
      `DB Updates: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
    );

    return res.status(200).json({
      success: true,
      executionTime: `${executionTime} seconds`,
      statistics: stats,

      // Counts for each step
      step1_matched_count: results.step1_matched.length,
      step2_matched_count: results.step2_matched.length,
      step3_matched_count: results.step3_matched.length,
      step4_matched_count: results.step4_matched.length,
      step5_matched_count: results.step5_matched.length,
      step6_matched_count: results.step6_matched.length,
      step7_matched_count: results.step7_matched.length,

      // Matched data per step
      data: {
        step1_matched: results.step1_matched,
        step1_subtypeMismatches: results.step1_subtypeMismatches,
        step2_matched: results.step2_matched,
        step2_subtypeMismatches: results.step2_subtypeMismatches,
        step3_matched: results.step3_matched,
        step3_subtypeMismatches: results.step3_subtypeMismatches,
        step4_matched: results.step4_matched,
        step4_subtypeMismatches: results.step4_subtypeMismatches,
        step5_matched: results.step5_matched,
        step5_subtypeMismatches: results.step5_subtypeMismatches,
        step6_matched: results.step6_matched,
        step6_subtypeMismatches: results.step6_subtypeMismatches,
        step7_matched: results.step7_matched,
        step7_subtypeMismatches: results.step7_subtypeMismatches,
      },

      // Unmatched properties separated
      unmatched: {
        nameMatchedButSubtypeNotMatch: nameMatchedButSubtypeNotMatch,
        nameNotMatchedAtAll: nameNotMatchedAtAll,
      },
    });
  } catch (error) {
    console.error("MatchGeoPointOptimized Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ========== BACKGROUND PROCESSING VERSION ==========
// This runs completely in the background and doesn't block the response

let backgroundJobStatus = {
  isRunning: false,
  progress: 0,
  totalProperties: 0,
  matchedCount: 0,
  startTime: null,
  lastUpdate: null,
  error: null,
};

const MatchGeoPointBackground = async (req, res) => {
  // Check if already running
  if (backgroundJobStatus.isRunning) {
    return res.status(409).json({
      success: false,
      message: "Background matching job is already running",
      status: backgroundJobStatus,
    });
  }

  const forceRematch = req.query.forceRematch === "true";

  // Reset status
  backgroundJobStatus = {
    isRunning: true,
    progress: 0,
    totalProperties: 0,
    matchedCount: 0,
    startTime: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    error: null,
  };

  // Return immediately
  res.status(202).json({
    success: true,
    message: "Background matching job started",
    statusEndpoint: "/match-geo-point/status",
  });

  // Run the actual processing in the background
  setImmediate(async () => {
    try {
      await runBackgroundMatching(forceRematch);
    } catch (error) {
      backgroundJobStatus.error = error.message;
      backgroundJobStatus.isRunning = false;
      console.error("Background matching error:", error);
    }
  });
};

const runBackgroundMatching = async (forceRematch) => {
  try {
    const propertyQuery = {
      "custom_fields.city": "Dubai",
      "general_listing_information.status": "Live",
    };

    if (!forceRematch) {
      propertyQuery.$or = [
        { "redin_location.location_id": { $exists: false } },
        { "redin_location.location_id": null },
        { redin_location: { $exists: false } },
      ];
    }

    // Use cursor for memory-efficient streaming
    const propertyCursor = Property.find(propertyQuery, {
      id: 1,
      "custom_fields.propertyfinder_region": 1,
      "custom_fields.city": 1,
      "general_listing_information.status": 1,
      address_information: 1,
      property_type: 1,
      redin_location: 1,
    })
      .lean()
      .cursor();

    const redinLocationData = await ExtractRedinLocation.find({}).lean();
    const redinPropertiesFlattened =
      await buildFlattenedRedinArray(redinLocationData);

    backgroundJobStatus.totalProperties =
      await Property.countDocuments(propertyQuery);

    const bulkOperations = [];
    let processedCount = 0;

    const matchingFunctions = [
      executeStep1_CombinedRegionMatch,
      executeStep2_FirstRegionMatch,
      executeStep3_Region1Or2Match,
      executeStep4_SecondRegionMatch,
      executeStep5_PartialWordMatch,
      executeStep6_Starting2WordsMatch,
      executeStep7_CoordinateMatch,
    ];

    // Process properties in streaming fashion
    for await (const property of propertyCursor) {
      // Try each matching step
      for (const stepFn of matchingFunctions) {
        const result = stepFn(property, redinPropertiesFlattened);
        if (result.matchResult) {
          bulkOperations.push({
            updateOne: {
              filter: { id: property.id },
              update: {
                $set: {
                  redin_location: {
                    location_id: result.matchResult.match.location_id,
                    property_location_id: result.matchResult.match.property_id,
                    property_name: result.matchResult.match.property_name,
                    main_subtype_name:
                      result.matchResult.match.main_subtype_name,
                    main_type_name: result.matchResult.match.main_type_name,
                    matched_by: stepFn.name,
                    matched_region_part: result.matchResult.matchedRegionPart,
                  },
                },
              },
            },
          });
          backgroundJobStatus.matchedCount++;
          break; // Stop after first match
        }
      }

      processedCount++;
      backgroundJobStatus.progress = Math.round(
        (processedCount / backgroundJobStatus.totalProperties) * 100,
      );
      backgroundJobStatus.lastUpdate = new Date().toISOString();

      // Bulk write every 500 operations
      if (bulkOperations.length >= 500) {
        await Property.bulkWrite(bulkOperations, { ordered: false });
        bulkOperations.length = 0;
        await yieldToEventLoop();
      }

      // Yield periodically
      if (processedCount % YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Final bulk write
    if (bulkOperations.length > 0) {
      await Property.bulkWrite(bulkOperations, { ordered: false });
    }

    backgroundJobStatus.isRunning = false;
    backgroundJobStatus.progress = 100;
    console.log("Background matching completed successfully");
  } catch (error) {
    backgroundJobStatus.error = error.message;
    backgroundJobStatus.isRunning = false;
    throw error;
  }
};

const GetBackgroundJobStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    status: backgroundJobStatus,
  });
};

// ========== ORIGINAL AGGREGATION PIPELINE ==========
const getPropertiesWithCoordinates = async (req, res) => {
  console.log("This is working");
  try {
    const pipeline = [
      {
        $match: {
          "custom_fields.city": "Dubai",
          "general_listing_information.status": "Live",
          "address_information.Longitude_Latitude": {
            $exists: true,
            $ne: null,
            $ne: "",
          },
        },
      },
      {
        $addFields: {
          coordinates_array: {
            $split: ["$address_information.Longitude_Latitude", ","],
          },
        },
      },
      {
        $addFields: {
          coord1: {
            $trim: {
              input: { $arrayElemAt: ["$coordinates_array", 0] },
            },
          },
          coord2: {
            $trim: {
              input: { $arrayElemAt: ["$coordinates_array", 1] },
            },
          },
        },
      },
      {
        $addFields: {
          coord1_num: {
            $convert: {
              input: "$coord1",
              to: "double",
              onError: null,
            },
          },
          coord2_num: {
            $convert: {
              input: "$coord2",
              to: "double",
              onError: null,
            },
          },
        },
      },
      {
        $addFields: {
          longitude: {
            $cond: [
              {
                $and: [
                  { $gte: ["$coord1_num", 55] },
                  { $lt: ["$coord1_num", 56] },
                ],
              },
              "$coord1_num",
              "$coord2_num",
            ],
          },
          latitude: {
            $cond: [
              {
                $and: [
                  { $gte: ["$coord1_num", 25] },
                  { $lt: ["$coord1_num", 26] },
                ],
              },
              "$coord1_num",
              "$coord2_num",
            ],
          },
        },
      },
      {
        $addFields: {
          is_accurate: {
            $and: [
              { $ne: ["$longitude", null] },
              { $ne: ["$latitude", null] },
              { $gte: ["$longitude", 55] },
              { $lt: ["$longitude", 56] },
              { $gte: ["$latitude", 25] },
              { $lt: ["$latitude", 26] },
            ],
          },
        },
      },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                accurate: {
                  $sum: { $cond: ["$is_accurate", 1, 0] },
                },
                inaccurate: {
                  $sum: { $cond: ["$is_accurate", 0, 1] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total_properties: "$total",
                accurate_coordinates: "$accurate",
                inaccurate_coordinates: "$inaccurate",
                accuracy_percentage: {
                  $round: [
                    {
                      $multiply: [{ $divide: ["$accurate", "$total"] }, 100],
                    },
                    2,
                  ],
                },
              },
            },
          ],
          properties: [
            {
              $project: {
                _id: 0,
                propertyID: "$id",
                finderRegion: "$custom_fields.propertyfinder_region",
                longitude_latitude: "$address_information.Longitude_Latitude",
                longitude: "$longitude",
                latitude: "$latitude",
                is_accurate: "$is_accurate",
                address_information: "$address_information",
                city: "$custom_fields.city",
                status: "$general_listing_information.status",
                listingTitle: "$general_listing_information.listing_title",
                price: "$general_listing_information.listingprice",
                bedrooms: "$general_listing_information.bedrooms",
                propertyType: "$property_type",
              },
            },
          ],
        },
      },
    ];

    const result = await Property.aggregate(pipeline);

    const stats = result[0].stats[0] || {
      total_properties: 0,
      accurate_coordinates: 0,
      inaccurate_coordinates: 0,
      accuracy_percentage: 0,
    };

    const properties = result[0].properties || [];

    return res.status(200).json({
      success: true,
      stats: stats,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties",
      error: error.message,
    });
  }
};

module.exports = {
  getPropertiesWithCoordinates,
  MatchGeoPointOptimized,
  MatchGeoPointBackground,
  GetBackgroundJobStatus,
};
