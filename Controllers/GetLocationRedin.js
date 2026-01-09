const LocationRedin = require("../Models/LocationRedinModel");
const ExtractRedinLocation = require("../Models/ExtractLocationRedin");
const axios = require("axios");
const Property = require("../Models/PropertyModel");

const getLocationFromRedin = async (req, res) => {
  console.log(process.env.REDIN_TOKEN);
  try {
    const headers = {
      Authorization: process.env.REDIN_TOKEN,
      Accept: "application/json",
    };

    let allLocations = [];
    let scrollId = null;
    let url = "https://api.reidin.com/api/v2/locations/AE/";
    let pageCount = 0;
    const perPageStats = [];

    do {
      pageCount++;
      const params = scrollId ? { scroll_id: scrollId } : {};
      console.log(
        `Fetching page ${pageCount}, scroll_id: ${scrollId || "initial"}`
      );
      const response = await axios.get(url, { headers, params });
      const locations = response.data?.results || [];

      // store number of locations per page
      perPageStats.push(locations.length);

      const scrollIdArray = response.data?.scroll_id;
      scrollId =
        scrollIdArray &&
        Array.isArray(scrollIdArray) &&
        scrollIdArray.length > 0
          ? scrollIdArray[0]
          : null;

      allLocations = allLocations.concat(locations);
      console.log(
        `Page ${pageCount}: Fetched ${
          locations.length
        } locations, next scroll_id: ${scrollId || "none (end)"}`
      );
    } while (scrollId);

    console.log(`\n=== Pagination Complete ===`);
    console.log(`Total pages fetched: ${pageCount}`);
    console.log(`Locations per page:`);
    perPageStats.forEach((count, index) => {
      console.log(`  Page ${index + 1}: ${count} locations`);
    });
    console.log(`Total locations fetched: ${allLocations.length}`);

    const dubaiLocations = allLocations.filter(
      (loc) => loc.city_name === "Dubai"
    );
    console.log(`Dubai locations: ${dubaiLocations.length}`);

    let savedCount = 0;
    let updatedCount = 0;

    if (dubaiLocations.length > 0) {
      const bulkOps = dubaiLocations.map((location) => ({
        updateOne: {
          filter: { location_id: location.location_id },
          update: { $set: location },
          upsert: true,
        },
      }));

      const result = await LocationRedin.bulkWrite(bulkOps);
      savedCount = result.upsertedCount;
      updatedCount = result.modifiedCount;

      console.log(`\n=== Database Save Complete ===`);
      console.log(`New records inserted: ${savedCount}`);
      console.log(`Existing records updated: ${updatedCount}`);
    }

    return res.status(200).json({
      success: true,
      totalCount: allLocations.length,
      dubaiCount: dubaiLocations.length,
      pagesProcessed: pageCount,
      perPageCounts: perPageStats,
      data: allLocations,
      database: {
        newRecords: savedCount,
        updatedRecords: updatedCount,
        totalInDb: await LocationRedin.countDocuments(),
      },
      message: "Data fetched and saved successfully",
    });
  } catch (err) {
    console.error("REDIN API ERROR:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
      console.error("Response status:", err.response.status);
    }
    return res.status(500).json({
      success: false,
      error: "Failed to fetch location data from Reidin.",
      details: err.message,
    });
  }
};

// const extractLocationFromRedin = async (req, res) => {
//     try {
//         // Fetch all location IDs from MongoDB
//         const allLocationIDsDocs = await LocationRedin.find({}, { location_id: 1, _id: 0 });
//         const allLocationIDs = allLocationIDsDocs.map(doc => doc.location_id);
//         console.log("All Location IDs: ", allLocationIDs);
//         console.log("Total Locations to Process: ", allLocationIDs.length);

//         const headers = {
//             "Authorization": process.env.REDIN_TOKEN,
//             "Accept": "application/json",
//         };

//         const allResults = {};

//         // Stats tracking
//         const stats = {
//             totalLocationIDs: allLocationIDs.length,
//             apiCallsAttempted: 0,
//             apiCallsSuccessful: 0,
//             apiCallsFailed: 0,
//             retriedAndSucceeded: 0,
//             locationsWithData: 0,
//             locationsWithoutData: 0,
//             outOfBoundsLocations: 0,        // NEW: Out of bounds count
//             savedToDatabase: 0,
//             failedToSave: 0,
//             totalProperties: 0,
//             successfulResponses: [],         // Data mila aur save ho gaya
//             outOfBoundsResponses: [],        // Out of bounds locations
//             failedErrors: [],                // API call hi fail hui
//             duplicateLocationIDs: [],        // Duplicate location_ids
//             duplicatePropertyIDs: []         // Duplicate property_ids
//         };

//         const fetchWithRetry = async (id, maxRetries = 5) => {
//             const url = `https://api.reidin.com/api/v2/property/property_list/?country_code=AE&location_id=${id}&page_number=1`;

//             for (let attempt = 1; attempt <= maxRetries; attempt++) {
//                 try {
//                     const response = await axios.get(url, {
//                         headers,
//                         timeout: 20000,
//                         validateStatus: (status) => status < 500,
//                         maxRedirects: 5,
//                         decompress: true
//                     });

//                     if (attempt > 1) {
//                         stats.retriedAndSucceeded++;
//                         console.log(`✓ Location ${id}: Retry #${attempt - 1} succeeded`);
//                     }

//                     return { success: true, data: response.data };
//                 } catch (err) {
//                     const isRetryableError =
//                         err.code === 'HPE_CR_EXPECTED' ||
//                         err.code === 'HPE_INVALID_HEADER_TOKEN' ||
//                         err.code === 'ECONNRESET' ||
//                         err.code === 'ETIMEDOUT' ||
//                         err.code === 'ECONNABORTED' ||
//                         err.message.includes('Parse Error') ||
//                         err.message.includes('socket hang up');

//                     if (isRetryableError && attempt < maxRetries) {
//                         const waitTime = Math.pow(2, attempt) * 1000;
//                         console.log(`⚠ Location ${id}: ${err.code || err.message} - Retry #${attempt}/${maxRetries - 1} (waiting ${waitTime / 1000}s)`);
//                         await new Promise(resolve => setTimeout(resolve, waitTime));
//                         continue;
//                     }

//                     return { success: false, error: err };
//                 }
//             }
//         };

//         // Process in batches to avoid overwhelming the API
//         const BATCH_SIZE = 10;
//         const BATCH_DELAY = 2000;

//         console.log(`\nProcessing in batches of ${BATCH_SIZE} with ${BATCH_DELAY / 1000}s delay...\n`);

//         for (let i = 0; i < allLocationIDs.length; i += BATCH_SIZE) {
//             const batch = allLocationIDs.slice(i, i + BATCH_SIZE);
//             const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
//             const totalBatches = Math.ceil(allLocationIDs.length / BATCH_SIZE);

//             console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches} (Locations ${i + 1}-${Math.min(i + BATCH_SIZE, allLocationIDs.length)})`);

//             const batchPromises = batch.map(async (id) => {
//                 stats.apiCallsAttempted++;

//                 const result = await fetchWithRetry(id, 5);
//                 if (!result.success) {
//                     const err = result.error;
//                     stats.failedErrors.push({
//                         location_id: id,
//                         error_message: err.message,
//                         error_code: err.code || 'UNKNOWN',
//                         error_response: err.response ? {
//                             status: err.response.status,
//                             statusText: err.response.statusText,
//                             data: err.response.data
//                         } : null
//                     });

//                     stats.apiCallsFailed++;
//                     console.error(`✗ Location ${id}: API Call Failed after retries:`, {
//                         message: err.message,
//                         code: err.code
//                     });
//                     return;
//                 }

//                 const data = result.data;

//                 // Check if API returned "out of bounds" or failure status
//                 if (data.status === "Failed" || data.status_code === 400) {
//                     stats.apiCallsSuccessful++;
//                     stats.locationsWithoutData++;
//                     stats.outOfBoundsLocations++;

//                     stats.outOfBoundsResponses.push({
//                         location_id: id,
//                         status: data.status,
//                         status_code: data.status_code,
//                         message: data.message || 'Given page number is out of bounds!'
//                     });

//                     console.log(`○ Location ${id}: Out of Bounds (${data.message || 'No data available'})`);
//                     return;
//                 }

//                 stats.apiCallsSuccessful++;

//                 if (data.number_of_result && data.number_of_result > 0) {
//                     stats.locationsWithData++;

//                     const simplifiedResults = data.results.map(item => ({
//                         property: item.property,
//                         main_subtype_name: item.main_subtype_name,
//                         main_type_name: item.main_type_name
//                     }));

//                     try {
//                         const locationDoc = await LocationRedin.findOne(
//                             { location_id: id },
//                             { geo_point: 1 }
//                         );

//                         let geoPointData = null;
//                         if (
//                             locationDoc &&
//                             locationDoc.geo_point &&
//                             locationDoc.geo_point.lat != null &&
//                             locationDoc.geo_point.lon != null
//                         ) {
//                             geoPointData = {
//                                 lat: locationDoc.geo_point.lat,
//                                 lon: locationDoc.geo_point.lon
//                             };
//                         }

//                         console.log("This is the geoPiontData", geoPointData)
//                         const newLocation = new ExtractRedinLocation({
//                             location_id: id,
//                             geo_point: geoPointData,
//                             properties: simplifiedResults
//                         });

//                         await newLocation.save();

//                         stats.savedToDatabase++;
//                         stats.totalProperties += simplifiedResults.length;

//                         // Store in successful responses (actual data saved)
//                         stats.successfulResponses.push({
//                             location_id: id,
//                             status: 'Success',
//                             status_code: 200,
//                             properties_count: simplifiedResults.length,
//                             saved_to_db: true
//                         });

//                         console.log(`✓ Location ${id}: Data Found (${simplifiedResults.length} properties) → Saved to DB`);
//                         allResults[id] = simplifiedResults;
//                     } catch (saveErr) {
//                         stats.failedToSave++;

//                         // Check if it's a duplicate key error
//                         if (saveErr.code === 11000) {
//                             const duplicateField = Object.keys(saveErr.keyPattern || {})[0];
//                             const duplicateValue = saveErr.keyValue ? saveErr.keyValue[duplicateField] : null;

//                             if (duplicateField === 'location_id') {
//                                 stats.duplicateLocationIDs.push({
//                                     location_id: id,
//                                     duplicate_value: duplicateValue,
//                                     properties_count: simplifiedResults.length,
//                                     error: 'Duplicate location_id - Already exists in database'
//                                 });
//                                 console.error(`✗ Location ${id}: Duplicate location_id (${duplicateValue}) - Already in DB`);
//                             } else if (duplicateField === 'property_id') {
//                                 stats.duplicatePropertyIDs.push({
//                                     location_id: id,
//                                     property_id: duplicateValue,
//                                     error: 'Duplicate property_id'
//                                 });
//                                 console.error(`✗ Location ${id}: Duplicate property_id detected: ${duplicateValue}`);
//                             } else {
//                                 console.error(`✗ Location ${id}: Duplicate error on field '${duplicateField}': ${duplicateValue}`);
//                             }
//                         } else {
//                             console.error(`✗ Location ${id}: Failed to Save DB:`, saveErr.message);
//                         }
//                     }
//                 } else {
//                     stats.locationsWithoutData++;
//                     console.log(`○ Location ${id}: No Data Found (Empty Results)`);
//                 }
//             });

//             await Promise.all(batchPromises);

//             if (i + BATCH_SIZE < allLocationIDs.length) {
//                 console.log(`⏳ Waiting ${BATCH_DELAY / 1000}s before next batch...`);
//                 await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
//             }
//         }

//         // Analyze duplicates after processing
//         const duplicateLocationCount = stats.duplicateLocationIDs.length;
//         const duplicatePropertyCount = stats.duplicatePropertyIDs.length;

//         // Group duplicate property IDs by their count
//         const propertyIdCounts = {};
//         stats.duplicatePropertyIDs.forEach(item => {
//             const propId = item.property_id;
//             if (!propertyIdCounts[propId]) {
//                 propertyIdCounts[propId] = {
//                     property_id: propId,
//                     count: 0,
//                     found_in_locations: []
//                 };
//             }
//             propertyIdCounts[propId].count++;
//             propertyIdCounts[propId].found_in_locations.push(item.location_id);
//         });

//         // Final stats summary
//         console.log("\n========== EXTRACTION COMPLETE ==========");
//         console.log(`Total Location IDs: ${stats.totalLocationIDs}`);
//         console.log(`\nAPI Calls:`);
//         console.log(`  - Attempted: ${stats.apiCallsAttempted}`);
//         console.log(`  - Successful: ${stats.apiCallsSuccessful} (${((stats.apiCallsSuccessful / stats.totalLocationIDs) * 100).toFixed(1)}%)`);
//         console.log(`  - Failed: ${stats.apiCallsFailed} (${((stats.apiCallsFailed / stats.totalLocationIDs) * 100).toFixed(1)}%)`);
//         console.log(`  - Retried and Succeeded: ${stats.retriedAndSucceeded}`);
//         console.log(`\nData Results:`);
//         console.log(`  - Locations with Data: ${stats.locationsWithData}`);
//         console.log(`  - Locations without Data: ${stats.locationsWithoutData}`);
//         console.log(`  - Out of Bounds Locations: ${stats.outOfBoundsLocations}`);
//         console.log(`\nDatabase Operations:`);
//         console.log(`  - Successfully Saved: ${stats.savedToDatabase}`);
//         console.log(`  - Failed to Save: ${stats.failedToSave}`);
//         console.log(`    • Duplicate Locations: ${duplicateLocationCount}`);
//         console.log(`    • Duplicate Properties: ${duplicatePropertyCount}`);
//         console.log(`    • Other Errors: ${stats.failedToSave - duplicateLocationCount - duplicatePropertyCount}`);
//         console.log(`  - Total Properties Saved: ${stats.totalProperties}`);
//         console.log(`  - Average Properties per Location: ${stats.savedToDatabase > 0 ? (stats.totalProperties / stats.savedToDatabase).toFixed(2) : 0}`);

//         // Successful responses
//         if (stats.successfulResponses.length > 0) {
//             console.log(`\n--- SUCCESSFULLY SAVED (First 5) ---`);
//             stats.successfulResponses.slice(0, 5).forEach(resp => {
//                 console.log(`Location ${resp.location_id}: ${resp.properties_count} properties saved`);
//             });
//         }

//         // Out of bounds
//         if (stats.outOfBoundsResponses.length > 0) {
//             console.log(`\n--- OUT OF BOUNDS LOCATIONS (First 10) ---`);
//             stats.outOfBoundsResponses.slice(0, 10).forEach(resp => {
//                 console.log(`Location ${resp.location_id}: ${resp.message}`);
//             });
//         }

//         // Duplicate analysis
//         if (duplicateLocationCount > 0) {
//             console.log(`\n--- DUPLICATE LOCATION IDs (First 10 of ${duplicateLocationCount}) ---`);
//             stats.duplicateLocationIDs.slice(0, 10).forEach(dup => {
//                 console.log(`Location ${dup.location_id}: ${dup.error} (${dup.properties_count} properties)`);
//             });
//         }

//         if (duplicatePropertyCount > 0) {
//             console.log(`\n--- DUPLICATE PROPERTY IDs (First 5 of ${duplicatePropertyCount}) ---`);
//             Object.values(propertyIdCounts).slice(0, 5).forEach(item => {
//                 console.log(`Property ID ${item.property_id}: Found ${item.count} times in locations [${item.found_in_locations.join(', ')}]`);
//             });
//         }

//         // Failed API calls
//         if (stats.failedErrors.length > 0) {
//             console.log(`\n--- FAILED API CALLS (${stats.failedErrors.length} total) ---`);
//             stats.failedErrors.slice(0, 10).forEach(err => {
//                 console.log(`Location ${err.location_id}: ${err.error_code} - ${err.error_message}`);
//             });
//         }

//         console.log("=========================================\n");

//         res.json({
//             message: true,
//             stats: {
//                 totalLocationIDs: stats.totalLocationIDs,
//                 apiCallsAttempted: stats.apiCallsAttempted,
//                 apiCallsSuccessful: stats.apiCallsSuccessful,
//                 apiCallsFailed: stats.apiCallsFailed,
//                 retriedAndSucceeded: stats.retriedAndSucceeded,
//                 locationsWithData: stats.locationsWithData,
//                 locationsWithoutData: stats.locationsWithoutData,
//                 outOfBoundsLocations: stats.outOfBoundsLocations,
//                 savedToDatabase: stats.savedToDatabase,
//                 failedToSave: stats.failedToSave,
//                 totalProperties: stats.totalProperties,
//                 successRate: ((stats.apiCallsSuccessful / stats.totalLocationIDs) * 100).toFixed(1) + '%',
//                 failureRate: ((stats.apiCallsFailed / stats.totalLocationIDs) * 100).toFixed(1) + '%',
//                 duplicateLocationCount,
//                 duplicatePropertyCount
//             },
//             successful: {
//                 count: stats.successfulResponses.length,
//                 sample: stats.successfulResponses.slice(0, 10),
//                 all: stats.successfulResponses
//             },
//             outOfBounds: {
//                 count: stats.outOfBoundsResponses.length,
//                 sample: stats.outOfBoundsResponses.slice(0, 10),
//                 all: stats.outOfBoundsResponses
//             },
//             duplicates: {
//                 location_ids: {
//                     count: duplicateLocationCount,
//                     sample: stats.duplicateLocationIDs.slice(0, 10),
//                     all: stats.duplicateLocationIDs
//                 },
//                 property_ids: {
//                     count: duplicatePropertyCount,
//                     unique_count: Object.keys(propertyIdCounts).length,
//                     sample: Object.values(propertyIdCounts).slice(0, 10),
//                     all: Object.values(propertyIdCounts)
//                 }
//             },
//             failed: {
//                 count: stats.failedErrors.length,
//                 sample: stats.failedErrors.slice(0, 10),
//                 all: stats.failedErrors
//             },
//             data: allResults
//         });

//     } catch (error) {
//         console.error("❌ Fatal Error:", error);
//         res.json({ message: false, error: error.message });
//     }
// };

const extractLocationFromRedin = async (req, res) => {
  try {
    // Fetch all location IDs from MongoDB
    const allLocationIDsDocs = await LocationRedin.find(
      {},
      { location_id: 1, _id: 0 }
    );
    const allLocationIDs = allLocationIDsDocs.map((doc) => doc.location_id);
    console.log("All Location IDs: ", allLocationIDs);
    console.log("Total Locations to Process: ", allLocationIDs.length);

    const headers = {
      Authorization: process.env.REDIN_TOKEN,
      Accept: "application/json",
    };

    const allResults = {};

    // Stats tracking
    const stats = {
      totalLocationIDs: allLocationIDs.length,
      apiCallsAttempted: 0,
      apiCallsSuccessful: 0,
      apiCallsFailed: 0,
      retriedAndSucceeded: 0,
      locationsWithData: 0,
      locationsWithoutData: 0,
      outOfBoundsLocations: 0,
      savedToDatabase: 0,
      failedToSave: 0,
      totalProperties: 0,
      successfulResponses: [],
      outOfBoundsResponses: [],
      failedErrors: [],
      duplicateLocationIDs: [],
      duplicatePropertyIDs: [],
      saveErrors: [],
      failedSaveDB: [], // NEW: Detailed failed save tracking
    };

    const fetchWithRetry = async (id, maxRetries = 5) => {
      const url = `https://api.reidin.com/api/v2/property/property_list/?country_code=AE&location_id=${id}&page_number=1`;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.get(url, {
            headers,
            timeout: 20000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5,
            decompress: true,
          });

          if (attempt > 1) {
            stats.retriedAndSucceeded++;
            console.log(`✓ Location ${id}: Retry #${attempt - 1} succeeded`);
          }

          return { success: true, data: response.data };
        } catch (err) {
          const isRetryableError =
            err.code === "HPE_CR_EXPECTED" ||
            err.code === "HPE_INVALID_HEADER_TOKEN" ||
            err.code === "ECONNRESET" ||
            err.code === "ETIMEDOUT" ||
            err.code === "ECONNABORTED" ||
            err.message.includes("Parse Error") ||
            err.message.includes("socket hang up");

          if (isRetryableError && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(
              `⚠ Location ${id}: ${
                err.code || err.message
              } - Retry #${attempt}/${maxRetries - 1} (waiting ${
                waitTime / 1000
              }s)`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          return { success: false, error: err };
        }
      }
    };

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 2000;

    console.log(
      `\nProcessing in batches of ${BATCH_SIZE} with ${
        BATCH_DELAY / 1000
      }s delay...\n`
    );

    for (let i = 0; i < allLocationIDs.length; i += BATCH_SIZE) {
      const batch = allLocationIDs.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allLocationIDs.length / BATCH_SIZE);

      console.log(
        `\n📦 Processing Batch ${batchNumber}/${totalBatches} (Locations ${
          i + 1
        }-${Math.min(i + BATCH_SIZE, allLocationIDs.length)})`
      );

      const batchPromises = batch.map(async (id) => {
        stats.apiCallsAttempted++;

        const result = await fetchWithRetry(id, 5);
        if (!result.success) {
          const err = result.error;
          stats.failedErrors.push({
            location_id: id,
            error_message: err.message,
            error_code: err.code || "UNKNOWN",
            error_response: err.response
              ? {
                  status: err.response.status,
                  statusText: err.response.statusText,
                  data: err.response.data,
                }
              : null,
          });

          stats.apiCallsFailed++;
          console.error(`✗ Location ${id}: API Call Failed after retries:`, {
            message: err.message,
            code: err.code,
          });
          return;
        }

        const data = result.data;

        // Check if API returned "out of bounds" or failure status
        if (data.status === "Failed" || data.status_code === 400) {
          stats.apiCallsSuccessful++;
          stats.locationsWithoutData++;
          stats.outOfBoundsLocations++;

          stats.outOfBoundsResponses.push({
            location_id: id,
            status: data.status,
            status_code: data.status_code,
            message: data.message || "Given page number is out of bounds!",
          });

          console.log(
            `○ Location ${id}: Out of Bounds (${
              data.message || "No data available"
            })`
          );
          return;
        }

        stats.apiCallsSuccessful++;

        if (data.number_of_result && data.number_of_result > 0) {
          stats.locationsWithData++;

          const simplifiedResults = data.results.map((item) => ({
            property: item.property,
            main_subtype_name: item.main_subtype_name,
            main_type_name: item.main_type_name,
          }));

          let geoPointData = null;
          try {
            const locationDoc = await LocationRedin.findOne(
              { location_id: id },
              { geo_point: 1 }
            );

            if (
              locationDoc &&
              locationDoc.geo_point &&
              locationDoc.geo_point.lat != null &&
              locationDoc.geo_point.lon != null
            ) {
              geoPointData = {
                lat: locationDoc.geo_point.lat,
                lon: locationDoc.geo_point.lon,
              };
            }

            // const newLocation = new ExtractRedinLocation({
            //   location_id: id,
            //   geo_point: geoPointData,
            //   properties: simplifiedResults,
            // });

            // await newLocation.save();

            const newLocation = new ExtractRedinLocation({
              location_id: id,
              geo_point: geoPointData,
              properties: simplifiedResults,
            });

            await newLocation.save();

            stats.savedToDatabase++;
            stats.totalProperties += simplifiedResults.length;

            stats.successfulResponses.push({
              location_id: id,
              status: "Success",
              status_code: 200,
              properties_count: simplifiedResults.length,
              saved_to_db: true,
              geo_point: geoPointData,
            });

            console.log(
              `✓ Location ${id}: Data Found (${simplifiedResults.length} properties) → Saved to DB`
            );
            allResults[id] = simplifiedResults;
          } catch (saveErr) {
            stats.failedToSave++;

            // Base error object
            const baseErrorInfo = {
              location_id: id,
              properties_count: simplifiedResults.length,
              geo_point: geoPointData,
              timestamp: new Date().toISOString(),
            };

            // Check if it's a duplicate key error
            if (saveErr.code === 11000) {
              const duplicateField = Object.keys(saveErr.keyPattern || {})[0];
              const duplicateValue = saveErr.keyValue
                ? saveErr.keyValue[duplicateField]
                : null;

              if (duplicateField === "location_id") {
                const errorDetail = {
                  ...baseErrorInfo,
                  duplicate_field: "location_id",
                  duplicate_value: duplicateValue,
                  error: "Duplicate location_id - Already exists in database",
                  error_code: saveErr.code,
                  error_type: "DUPLICATE_LOCATION_ID",
                  reason: `Location ID ${duplicateValue} already exists in ExtractRedinLocation collection`,
                };
                stats.duplicateLocationIDs.push(errorDetail);
                stats.saveErrors.push(errorDetail);
                stats.failedSaveDB.push(errorDetail);
                console.error(
                  `✗ Location ${id}: Duplicate location_id (${duplicateValue}) - Already in DB`
                );
              } else if (duplicateField === "property_id") {
                const errorDetail = {
                  ...baseErrorInfo,
                  duplicate_field: "property_id",
                  property_id: duplicateValue,
                  error: "Duplicate property_id",
                  error_code: saveErr.code,
                  error_type: "DUPLICATE_PROPERTY_ID",
                  reason: `Property ID ${duplicateValue} already exists in database`,
                };
                stats.duplicatePropertyIDs.push(errorDetail);
                stats.saveErrors.push(errorDetail);
                stats.failedSaveDB.push(errorDetail);
                console.error(
                  `✗ Location ${id}: Duplicate property_id detected: ${duplicateValue}`
                );
              } else {
                const errorDetail = {
                  ...baseErrorInfo,
                  duplicate_field: duplicateField,
                  duplicate_value: duplicateValue,
                  error: `Duplicate error on field '${duplicateField}'`,
                  error_code: saveErr.code,
                  error_type: "DUPLICATE_KEY",
                  reason: `Duplicate key error on field '${duplicateField}' with value '${duplicateValue}'`,
                };
                stats.saveErrors.push(errorDetail);
                stats.failedSaveDB.push(errorDetail);
                console.error(
                  `✗ Location ${id}: Duplicate error on field '${duplicateField}': ${duplicateValue}`
                );
              }
            } else {
              // Other save errors (validation, schema issues, etc.)
              const errorDetail = {
                ...baseErrorInfo,
                error: saveErr.message,
                error_code: saveErr.code || "UNKNOWN",
                error_name: saveErr.name,
                error_type: "DATABASE_ERROR",
                reason: saveErr.message,
                // Include validation errors if available
                validation_errors: saveErr.errors
                  ? Object.keys(saveErr.errors).map((key) => ({
                      field: key,
                      message: saveErr.errors[key].message,
                      kind: saveErr.errors[key].kind,
                      value: saveErr.errors[key].value,
                    }))
                  : undefined,
                // Include stack trace for debugging (optional)
                stack: saveErr.stack,
              };
              stats.saveErrors.push(errorDetail);
              stats.failedSaveDB.push(errorDetail);
              console.error(
                `✗ Location ${id}: Failed to Save DB:`,
                saveErr.message
              );
            }
          }
        } else {
          stats.locationsWithoutData++;
          console.log(`○ Location ${id}: No Data Found (Empty Results)`);
        }
      });

      await Promise.all(batchPromises);

      if (i + BATCH_SIZE < allLocationIDs.length) {
        console.log(`⏳ Waiting ${BATCH_DELAY / 1000}s before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Analyze duplicates after processing
    const duplicateLocationCount = stats.duplicateLocationIDs.length;
    const duplicatePropertyCount = stats.duplicatePropertyIDs.length;

    // Group duplicate property IDs by their count
    const propertyIdCounts = {};
    stats.duplicatePropertyIDs.forEach((item) => {
      const propId = item.property_id;
      if (!propertyIdCounts[propId]) {
        propertyIdCounts[propId] = {
          property_id: propId,
          count: 0,
          found_in_locations: [],
        };
      }
      propertyIdCounts[propId].count++;
      propertyIdCounts[propId].found_in_locations.push(item.location_id);
    });

    // Categorize save errors by type
    const saveErrorsByType = stats.saveErrors.reduce((acc, err) => {
      const type = err.error_type || "UNKNOWN";
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(err);
      return acc;
    }, {});

    // Final stats summary
    console.log("\n========== EXTRACTION COMPLETE ==========");
    console.log(`Total Location IDs: ${stats.totalLocationIDs}`);
    console.log(`\nAPI Calls:`);
    console.log(`  - Attempted: ${stats.apiCallsAttempted}`);
    console.log(
      `  - Successful: ${stats.apiCallsSuccessful} (${(
        (stats.apiCallsSuccessful / stats.totalLocationIDs) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  - Failed: ${stats.apiCallsFailed} (${(
        (stats.apiCallsFailed / stats.totalLocationIDs) *
        100
      ).toFixed(1)}%)`
    );
    console.log(`  - Retried and Succeeded: ${stats.retriedAndSucceeded}`);
    console.log(`\nData Results:`);
    console.log(`  - Locations with Data: ${stats.locationsWithData}`);
    console.log(`  - Locations without Data: ${stats.locationsWithoutData}`);
    console.log(`  - Out of Bounds Locations: ${stats.outOfBoundsLocations}`);
    console.log(`\nDatabase Operations:`);
    console.log(`  - Successfully Saved: ${stats.savedToDatabase}`);
    console.log(`  - Failed to Save: ${stats.failedToSave}`);
    console.log(`    • Duplicate Locations: ${duplicateLocationCount}`);
    console.log(`    • Duplicate Properties: ${duplicatePropertyCount}`);
    console.log(
      `    • Other Errors: ${
        stats.failedToSave - duplicateLocationCount - duplicatePropertyCount
      }`
    );
    console.log(`  - Total Properties Saved: ${stats.totalProperties}`);
    console.log(
      `  - Average Properties per Location: ${
        stats.savedToDatabase > 0
          ? (stats.totalProperties / stats.savedToDatabase).toFixed(2)
          : 0
      }`
    );

    // Display save errors summary
    if (stats.saveErrors.length > 0) {
      console.log(
        `\n--- SAVE ERRORS SUMMARY (${stats.saveErrors.length} total) ---`
      );
      Object.entries(saveErrorsByType).forEach(([type, errors]) => {
        console.log(`  ${type}: ${errors.length} errors`);
      });
    }

    // Display detailed failed saves
    if (stats.failedSaveDB.length > 0) {
      console.log(`\n--- FAILED DATABASE SAVES (First 10) ---`);
      stats.failedSaveDB.slice(0, 10).forEach((err) => {
        console.log(`Location ${err.location_id}:`);
        console.log(`  Type: ${err.error_type}`);
        console.log(`  Reason: ${err.reason}`);
        console.log(`  Properties Count: ${err.properties_count}`);
        if (err.validation_errors) {
          console.log(`  Validation Issues:`);
          err.validation_errors.forEach((ve) => {
            console.log(`    - ${ve.field}: ${ve.message}`);
          });
        }
      });
    }

    console.log("=========================================\n");

    res.json({
      message: true,
      stats: {
        totalLocationIDs: stats.totalLocationIDs,
        apiCallsAttempted: stats.apiCallsAttempted,
        apiCallsSuccessful: stats.apiCallsSuccessful,
        apiCallsFailed: stats.apiCallsFailed,
        retriedAndSucceeded: stats.retriedAndSucceeded,
        locationsWithData: stats.locationsWithData,
        locationsWithoutData: stats.locationsWithoutData,
        outOfBoundsLocations: stats.outOfBoundsLocations,
        savedToDatabase: stats.savedToDatabase,
        failedToSave: stats.failedToSave,
        totalProperties: stats.totalProperties,
        successRate:
          ((stats.apiCallsSuccessful / stats.totalLocationIDs) * 100).toFixed(
            1
          ) + "%",
        failureRate:
          ((stats.apiCallsFailed / stats.totalLocationIDs) * 100).toFixed(1) +
          "%",
        duplicateLocationCount,
        duplicatePropertyCount,
      },
      successful: {
        count: stats.successfulResponses.length,
        sample: stats.successfulResponses.slice(0, 10),
        all: stats.successfulResponses,
      },
      outOfBounds: {
        count: stats.outOfBoundsResponses.length,
        sample: stats.outOfBoundsResponses.slice(0, 10),
        all: stats.outOfBoundsResponses,
      },
      failedSaveDB: {
        count: stats.failedSaveDB.length,
        byType: saveErrorsByType,
        sample: stats.failedSaveDB.slice(0, 20),
        all: stats.failedSaveDB,
      },
      saveErrors: {
        count: stats.saveErrors.length,
        byType: saveErrorsByType,
        sample: stats.saveErrors.slice(0, 10),
        all: stats.saveErrors,
      },
      duplicates: {
        location_ids: {
          count: duplicateLocationCount,
          sample: stats.duplicateLocationIDs.slice(0, 10),
          all: stats.duplicateLocationIDs,
        },
        property_ids: {
          count: duplicatePropertyCount,
          unique_count: Object.keys(propertyIdCounts).length,
          sample: Object.values(propertyIdCounts).slice(0, 10),
          all: Object.values(propertyIdCounts),
        },
      },
      failed: {
        count: stats.failedErrors.length,
        sample: stats.failedErrors.slice(0, 10),
        all: stats.failedErrors,
      },
      data: allResults,
    });
  } catch (error) {
    console.error("❌ Fatal Error:", error);
    res.json({ message: false, error: error.message });
  }
};

const updatePropertyData = async (req, res) => {
  try {
    const allPropertyData = await Property.find(
      {},
      {
        id: 1,
        "custom_fields.propertyfinder_region": 1,
        property_type: 1,
      }
    );

    // Get all locations
    const allExtractRedinLocation = await ExtractRedinLocation.find({});
    const allPropertyLocationObjects = allExtractRedinLocation.flatMap((item) =>
      item.properties.map((p) => ({
        location_id: item.location_id,
        property_id: p.property.id,
        property_name: p.property.name,
        main_subtype_name: p.main_subtype_name,
        main_type_name: p.main_type_name,
      }))
    );

    // Stats tracking
    const stats = {
      totalProperties: allPropertyData.length,
      totalRedinLocations: allPropertyLocationObjects.length,

      regionMatchFound: 0,
      regionMatchNotFound: 0,

      typeMatchSuccess: 0,
      typeMatchFailed: 0,

      fullyMatched: 0,
      partiallyMatched: 0,
      notMatched: 0,

      updateSuccess: 0,
      updateFailed: 0,
    };

    const matchedProperties = [];
    const regionNotFoundProperties = [];
    const typeMismatchProperties = [];
    const updatePromises = [];

    for (const property of allPropertyData) {
      // Check if propertyfinder_region exists
      if (
        !property.custom_fields ||
        !property.custom_fields.propertyfinder_region
      ) {
        stats.notMatched++;
        regionNotFoundProperties.push({
          property_id: property.id,
          original_region: "N/A",
          extracted_region: "N/A",
          property_type: property.property_type,
          issue: "propertyfinder_region field missing",
        });
        continue;
      }

      const region = property.custom_fields.propertyfinder_region;
      const extractedRegion = region.split(",")[0].trim().toLowerCase();

      console.log("Property Type from Model:", property.property_type);
      const propertyType = property.property_type.toLowerCase().trim();

      // Step 1: Find region matches
      const regionMatches = allPropertyLocationObjects.filter(
        (locationObj) =>
          locationObj.property_name.toLowerCase().trim() === extractedRegion
      );

      if (regionMatches.length === 0) {
        stats.regionMatchNotFound++;
        stats.notMatched++;
        regionNotFoundProperties.push({
          property_id: property.id,
          original_region: region,
          extracted_region: extractedRegion,
          property_type: property.property_type,
          issue: "Region not found in Redin locations",
        });
        continue;
      }

      stats.regionMatchFound++;

      // Step 2: Find type matches
      const typeMatches = regionMatches.filter((match) => {
        const redinType = match.main_subtype_name.toLowerCase().trim();
        return redinType === propertyType;
      });

      if (typeMatches.length === 0) {
        stats.typeMatchFailed++;
        stats.partiallyMatched++;

        typeMismatchProperties.push({
          property_id: property.id,
          original_region: region,
          extracted_region: extractedRegion,
          property_type: property.property_type,
          available_types: [
            ...new Set(regionMatches.map((m) => m.main_subtype_name)),
          ],
          issue: "Property type not found in matched region",
        });
        continue;
      }

      stats.typeMatchSuccess++;
      stats.fullyMatched++;

      // Take only the first match to avoid duplicates
      const firstMatch = typeMatches[0];

      matchedProperties.push({
        property_id: property.id,
        original_region: region,
        extracted_region: extractedRegion,
        property_type: property.property_type,
        location_property_id: firstMatch.property_id,
        location_id: firstMatch.location_id,
        property_name: firstMatch.property_name,
        main_subtype_name: firstMatch.main_subtype_name,
        main_type_name: firstMatch.main_type_name,
      });

      // Update with schema-compliant data
      const updatePromise = Property.findOneAndUpdate(
        { id: property.id },
        {
          $set: {
            redin_location: {
              location_id: firstMatch.location_id,
              property_location_id: firstMatch.property_id,
              property_name: firstMatch.property_name,
              main_subtype_name: firstMatch.main_subtype_name,
              main_type_name: firstMatch.main_type_name,
            },
          },
        },
        { new: true }
      )
        .then((updated) => {
          if (updated) {
            stats.updateSuccess++;
            console.log(
              `✓ Property ${property.id}: Region & Type matched → Updated`
            );
          } else {
            stats.updateFailed++;
            console.error(`✗ Property ${property.id}: Update failed`);
          }
          return updated;
        })
        .catch((err) => {
          stats.updateFailed++;
          console.error(
            `✗ Property ${property.id}: Update error:`,
            err.message
          );
          return null;
        });

      updatePromises.push(updatePromise);
    }

    await Promise.all(updatePromises);

    // Console summary
    console.log("\n========== PROPERTY MATCHING COMPLETE ==========");
    console.log(`Total Properties: ${stats.totalProperties}`);
    console.log(`Total Redin Locations: ${stats.totalRedinLocations}`);
    console.log(`\nMatching Summary:`);
    console.log(`  - Fully Matched: ${stats.fullyMatched}`);
    console.log(
      `  - Partially Matched (Type Mismatch): ${stats.partiallyMatched}`
    );
    console.log(`  - Not Matched (Region Not Found): ${stats.notMatched}`);
    console.log(`\nDatabase Updates:`);
    console.log(`  - Success: ${stats.updateSuccess}`);
    console.log(`  - Failed: ${stats.updateFailed}`);

    // Region Not Found - Print ALL with both property names
    if (regionNotFoundProperties.length > 0) {
      console.log(
        `\n========== REGION NOT FOUND (${regionNotFoundProperties.length} properties) ==========`
      );
      regionNotFoundProperties.forEach((item, index) => {
        console.log(`${index + 1}. Property ID: ${item.property_id}`);
        console.log(`   Original Region: "${item.original_region}"`);
        console.log(`   Extracted Region: "${item.extracted_region}"`);
        console.log(`   Property Type: ${item.property_type}`);
        console.log(`   Issue: ${item.issue}`);
        console.log("---");
      });
    }

    // Type Mismatch - Print ALL
    if (typeMismatchProperties.length > 0) {
      console.log(
        `\n========== TYPE MISMATCH (${typeMismatchProperties.length} properties) ==========`
      );
      typeMismatchProperties.forEach((item, index) => {
        console.log(`${index + 1}. Property ID: ${item.property_id}`);
        console.log(`   Original Region: "${item.original_region}"`);
        console.log(`   Extracted Region: "${item.extracted_region}"`);
        console.log(`   Expected Type: ${item.property_type}`);
        console.log(`   Available Types: ${item.available_types.join(", ")}`);
        console.log("---");
      });
    }

    console.log("===============================================\n");

    return res.json({
      message: true,
      stats: {
        totalProperties: stats.totalProperties,
        totalRedinLocations: stats.totalRedinLocations,
        regionMatchFound: stats.regionMatchFound,
        regionMatchNotFound: stats.regionMatchNotFound,
        typeMatchSuccess: stats.typeMatchSuccess,
        typeMatchFailed: stats.typeMatchFailed,
        fullyMatched: stats.fullyMatched,
        partiallyMatched: stats.partiallyMatched,
        notMatched: stats.notMatched,
        updateSuccess: stats.updateSuccess,
        updateFailed: stats.updateFailed,
      },
      results: {
        matched: {
          count: matchedProperties.length,
          all: matchedProperties,
        },
        partiallyMatched: {
          count: typeMismatchProperties.length,
          all: typeMismatchProperties,
        },
        notMatched: {
          count: regionNotFoundProperties.length,
          all: regionNotFoundProperties,
        },
      },
    });
  } catch (error) {
    console.log("Error:", error);
    return res.json({ message: false, error: error.message });
  }
};

const getAllRedinLocationFromDatabase = async (req, res) => {
  try {
    const data = await ExtractRedinLocation.find({});

    res.status(200).json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error) {
    console.log("This is the error", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const MatchgeoPiontNew = async (req, res) => {
  try {
    // Fetch all Dubai properties
    const allDubaiProperties = await Property.find(
      {
        "custom_fields.city": "Dubai",
        "general_listing_information.status": "Live",
      },
      {
        id: 1,
        "custom_fields.propertyfinder_region": 1,
        "custom_fields.city": 1,
        "general_listing_information.status": 1,
        property_type: 1,
        address_information: 1,
      }
    );

    // Fetch all Redin location data
    const allExtractRedinLocation = await ExtractRedinLocation.find({});

    console.log(
      "This is all Properties Object:",
      allDubaiProperties.length,
      "This is all Redin locations:",
      allExtractRedinLocation.length
    );

    // NEW: Helper to convert tower letters to numbers and vice versa
    const normalizeTowerIdentifier = (str) => {
      if (!str) return str;

      // Map of letter to number conversions (A=1, B=2, C=3, etc.)
      const letterToNumber = {
        a: "1",
        b: "2",
        c: "3",
        d: "4",
        e: "5",
        f: "6",
        g: "7",
        h: "8",
        i: "9",
        j: "10",
        k: "11",
        l: "12",
        m: "13",
        n: "14",
        o: "15",
        p: "16",
        q: "17",
        r: "18",
        s: "19",
        t: "20",
        u: "21",
        v: "22",
        w: "23",
        x: "24",
        y: "25",
        z: "26",
      };

      let normalized = str.toLowerCase();

      // Replace "tower X" or "building X" patterns where X is a letter
      normalized = normalized.replace(
        /\b(tower|building|block|phase)\s+([a-z])\b/gi,
        (match, prefix, letter) => {
          const number = letterToNumber[letter.toLowerCase()];
          return number
            ? `${prefix.toLowerCase()} ${number}`
            : match.toLowerCase();
        }
      );

      // Replace standalone letters at the end (e.g., "Sparkle B" -> "Sparkle 2")
      normalized = normalized.replace(/\s+([a-z])\s*$/i, (match, letter) => {
        const number = letterToNumber[letter.toLowerCase()];
        return number ? ` ${number}` : match;
      });

      return normalized;
    };

    // Check the coordinate are available or not
    const hasValidCoordinates = (property) => {
      if (!property.address_information) return false;

      const addressInfo = property.address_information.toObject
        ? property.address_information.toObject()
        : property.address_information;

      if (!addressInfo.Longitude_Latitude) return false;

      const coordString = addressInfo.Longitude_Latitude.toString().trim();
      if (!coordString || coordString === "") return false;

      const coords = coordString.split(",");
      if (coords.length !== 2) return false;

      const lon = parseFloat(coords[0].trim());
      const lat = parseFloat(coords[1].trim());

      return !isNaN(lon) && !isNaN(lat);
    };

    // NEW: Helper to create alternate versions with letter/number swaps
    const createAlternateVersions = (str) => {
      if (!str) return [str];

      const versions = [str];
      const normalized = normalizeTowerIdentifier(str);

      if (normalized !== str) {
        versions.push(normalized);
      }

      return versions;
    };

    // Helper: Aggressive normalization for flexible matching
    const normalizeForMatching = (str) => {
      if (!str) return "";

      let result = str.toLowerCase().trim();

      // Convert Roman numerals I-X to numbers (I â†’ 1, II â†’ 2, III â†’ 3, etc.)
      const romanMap = {
        i: "1",
        ii: "2",
        iii: "3",
        iv: "4",
        v: "5",
        vi: "6",
        vii: "7",
        viii: "8",
        ix: "9",
        x: "10",
      };
      result = result.replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/gi, (match) => {
        return romanMap[match.toLowerCase()] || match;
      });

      // ===== Special Case for Six Senses Residences The Palm  handling =====
      if (/six\s+senses/i.test(result)) {
        // If "Six Senses" exists, convert "Palm Jumeirah" to "The Palm"
        result = result.replace(/\bpalm\s+jumeirah\b/gi, "the palm");
      }

      // ===== Special Attessa handling =====
      if (result.includes("Attessa")) {
        result = result.replace(/\b(tower)\b/g, "");
      }

      // ===== Special Shoreline handling =====
      if (result.includes("shoreline")) {
        // Remove 'al' and 'apartments'
        result = result.replace(/\b(al|apartments?)\b/g, "");
      }

      // Tower is equal to the T1, T2, T3
      result = result.replace(/\bt\s*(\d+)\b/gi, "tower $1");

      // The palm is equal to the palm jumeirah
      result = result.replace(/\bthe\s+palm\b/gi, "palm jumeirah");

      // Remove hypen
      result = result.replace(/\s*-\s*/g, " ");

      // Replace & with "and"
      result = result.replace(/&/g, "and");

      // Remove anything inside parentheses including parentheses
      result = result.replace(/\(.*?\)/g, "");

      // Special case: Alaya Beach â†’ remove 'Beach'
      result = result.replace(/\balaya\s+beach\b/gi, "alaya");

      // Replace numbers like 01, 04, 002 with 1, 4, 2
      result = result.replace(/\b0+(\d+)\b/g, "$1");

      // If string contains "Madinat Jumeirah Living - XYZ", extract only XYZ
      const mjlMatch = result.match(/madinat jumeirah living\s*-\s*(.+)/i);
      if (mjlMatch && mjlMatch[1]) {
        result = mjlMatch[1].trim();
      }

      // Convert shorthand like T2 â†’ Tower 2
      result = result.replace(/\bT(\d+)\b/g, "tower $1");

      // Singularize tower / towers
      result = result.replace(/\b(towers?)\b/g, "tower");

      // Singularize residence / residences
      result = result.replace(/\b(residences?)\b/g, "residence");

      // Remove other unwanted words
      result = result.replace(
        /\b(the|a|an|it|its|by|at|estate|residences|premium|building)\b/g,
        ""
      );

      // ===== REMOVE "TOWER" COMPLETELY AT THE VERY LAST STEP =====
      // result = result.replace(/\btower\b/g, "");

      // Clean extra spaces
      result = result.replace(/\s+/g, " ").trim();

      return result;
    };

    // Helper: Extract only alphanumeric characters for strict comparison
    const extractAlphanumeric = (str) => {
      if (!str) return "";
      return str.toLowerCase().replace(/[^a-z0-9]/g, "");
    };

    // Helper: Check if two location names match EXACTLY (100% match - no extra words)
    const isExactLocationMatch = (propertyRegion, redinName) => {
      if (!propertyRegion || !redinName) return false;

      // NEW: Create alternate versions with tower letter/number conversions
      const propertyVersions = createAlternateVersions(propertyRegion);
      const redinVersions = createAlternateVersions(redinName);

      // Try matching with all version combinations
      for (const propVersion of propertyVersions) {
        for (const redinVersion of redinVersions) {
          if (attemptExactMatch(propVersion, redinVersion)) {
            return true;
          }
        }
      }

      return false;
    };

    // NEW: Separated matching logic
    const attemptExactMatch = (propertyRegion, redinName) => {
      const normalizedRegion = normalizeForMatching(propertyRegion);
      const normalizedRedin = normalizeForMatching(redinName);

      // Extract numbers from both strings
      const regionNumbers = normalizedRegion.match(/\d+/g) || [];
      const redinNumbers = normalizedRedin.match(/\d+/g) || [];

      // CRITICAL: If property region has numbers, redin name MUST have those exact numbers
      if (regionNumbers.length > 0) {
        if (redinNumbers.length === 0) return false;
        const allNumbersMatch = regionNumbers.every((num) =>
          redinNumbers.includes(num)
        );
        if (!allNumbersMatch) return false;
      }

      // If redin has numbers but property doesn't, reject
      if (redinNumbers.length > 0 && regionNumbers.length === 0) {
        return false;
      }

      // EXACT match after normalization (no extra words allowed)
      if (normalizedRegion === normalizedRedin) return true;

      // Remove all non-alphanumeric characters for strict comparison
      const regionClean = extractAlphanumeric(normalizedRegion);
      const redinClean = extractAlphanumeric(normalizedRedin);

      // Must be EXACTLY the same (100% match)
      if (regionClean === redinClean) return true;

      // If lengths differ significantly, reject
      const lengthDiff = Math.abs(regionClean.length - redinClean.length);
      if (lengthDiff > 2) return false;

      // Check if the words match exactly (order doesn't matter but must have same words)
      const regionWords = normalizedRegion
        .split(/\s+/)
        .filter((w) => w && w.length > 1)
        .sort();
      const redinWords = normalizedRedin
        .split(/\s+/)
        .filter((w) => w && w.length > 1)
        .sort();

      // Must have same number of meaningful words
      if (regionWords.length !== redinWords.length) return false;

      // Check if numbers match when words are same
      if (regionNumbers.length > 0 || redinNumbers.length > 0) {
        // Sort numbers for comparison
        const sortedRegionNumbers = regionNumbers.sort();
        const sortedRedinNumbers = redinNumbers.sort();

        // Numbers must be identical
        if (sortedRegionNumbers.length !== sortedRedinNumbers.length)
          return false;
        const numbersMatch = sortedRegionNumbers.every(
          (num, idx) => num === sortedRedinNumbers[idx]
        );
        if (!numbersMatch) return false;
      }

      // All words must match (case: "binghatti flare" vs "flare binghatti")
      const allWordsMatch = regionWords.every((word, idx) => {
        const redinWord = redinWords[idx];
        // Allow slight variation for very similar words
        const wordClean1 = extractAlphanumeric(word);
        const wordClean2 = extractAlphanumeric(redinWord);
        return wordClean1 === wordClean2;
      });

      return allWordsMatch;
    };

    // Helper: Partial word-by-word matching (at least 2-3 words must match)
    const isPartialWordMatch = (propertyRegion, redinName) => {
      if (!propertyRegion || !redinName) return false;

      const normalizedRegion = normalizeForMatching(propertyRegion);
      const normalizedRedin = normalizeForMatching(redinName);

      // Get words from both strings (filter out single char words and numbers-only words)
      const regionWords = normalizedRegion
        .split(/\s+/)
        .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
        .map((w) => extractAlphanumeric(w));

      const redinWords = normalizedRedin
        .split(/\s+/)
        .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
        .map((w) => extractAlphanumeric(w));

      if (regionWords.length === 0 || redinWords.length === 0) return false;

      // Count matching words
      let matchingWordsCount = 0;

      regionWords.forEach((regionWord) => {
        if (redinWords.includes(regionWord)) {
          matchingWordsCount++;
        }
      });

      // Calculate total unique words
      const totalWords = Math.max(regionWords.length, redinWords.length);

      // Logic:
      // - If one has more info (3+ words), require at least 3 matching words
      // - Otherwise, require at least 2 matching words
      if (totalWords >= 3) {
        return matchingWordsCount >= 3;
      } else {
        return matchingWordsCount >= 2;
      }
    };

    // Helper: Match starting words (at least 2-3 starting words must match)
    const isStartingWordsMatch = (propertyRegion, redinName) => {
      if (!propertyRegion || !redinName) return false;

      const normalizedRegion = normalizeForMatching(propertyRegion);
      const normalizedRedin = normalizeForMatching(redinName);

      // Split by "at" and take the first part from region
      const regionMainPart = normalizedRegion.split(/\s+at\s+/i)[0].trim();

      // Get words from both strings (filter out single char words and numbers-only words)
      const regionWords = regionMainPart
        .split(/\s+/)
        .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
        .map((w) => extractAlphanumeric(w));

      const redinWords = normalizedRedin
        .split(/\s+/)
        .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
        .map((w) => extractAlphanumeric(w));

      if (regionWords.length === 0 || redinWords.length === 0) return false;

      // Count matching STARTING words (in order)
      let matchingStartingWords = 0;
      const minLength = Math.min(regionWords.length, redinWords.length);

      for (let i = 0; i < minLength; i++) {
        if (regionWords[i] === redinWords[i]) {
          matchingStartingWords++;
        } else {
          break; // Stop at first mismatch
        }
      }

      // Logic:
      // - If region has 3+ words, require at least 3 starting words match
      // - Otherwise, require at least 2 starting words match
      if (regionWords.length >= 3) {
        return matchingStartingWords >= 3;
      } else {
        return matchingStartingWords >= 2;
      }
    };

    // Helper: Match combined regions with word swapping
    const isCombinedRegionMatch = (propertyRegion, redinName) => {
      if (!propertyRegion || !redinName) return false;

      const normalizedRegion = normalizeForMatching(propertyRegion);
      const normalizedRedin = normalizeForMatching(redinName);

      // Split into words
      const regionWords = normalizedRegion
        .split(/\s+/)
        .filter((w) => w && w.length > 1);
      const redinWords = normalizedRedin
        .split(/\s+/)
        .filter((w) => w && w.length > 1);

      if (regionWords.length === 0 || redinWords.length === 0) return false;

      // Check if all region words exist in redin (order doesn't matter)
      const allRegionWordsInRedin = regionWords.every((word) =>
        redinWords.includes(word)
      );

      // Check if all redin words exist in region (order doesn't matter)
      const allRedinWordsInRegion = redinWords.every((word) =>
        regionWords.includes(word)
      );

      // Must have same words, just different order
      return (
        allRegionWordsInRedin &&
        allRedinWordsInRegion &&
        regionWords.length === redinWords.length
      );
    };

    // Helper to check if property name matches (ignoring subtype)
    const checkPropertyNameMatch = (propertyRegion, redinName) => {
      if (!propertyRegion || !redinName) return false;
      return isExactLocationMatch(propertyRegion, redinName);
    };

    // ==================== COORDINATE MATCHING HELPERS ====================

    // Extract and trim coordinates from Property database
    const extractAndTrimCoordinates = (addressInfo) => {
      try {
        if (!addressInfo) return null;

        const plainAddressInfo = addressInfo.toObject
          ? addressInfo.toObject()
          : addressInfo;

        if (!plainAddressInfo.Longitude_Latitude) return null;

        const coordString =
          plainAddressInfo.Longitude_Latitude.toString().trim();
        if (!coordString) return null;

        const coords = coordString.split(",");
        if (coords.length !== 2) return null;

        const lon = parseFloat(coords[0].trim());
        const lat = parseFloat(coords[1].trim());

        if (isNaN(lon) || isNaN(lat)) return null;

        const lonTrimmed = Math.trunc(lon * 100) / 100;
        const latTrimmed = Math.trunc(lat * 100) / 100;

        return {
          lon: lonTrimmed,
          lat: latTrimmed,
          original: { lon, lat },
        };
      } catch (error) {
        return null;
      }
    };

    // Extract and trim coordinates from Redin geo_point
    const extractAndTrimRedinCoordinates = (geoPoint) => {
      try {
        if (!geoPoint || !geoPoint.lon || !geoPoint.lat) return null;

        const lon = parseFloat(geoPoint.lon);
        const lat = parseFloat(geoPoint.lat);

        if (isNaN(lon) || isNaN(lat)) return null;

        const lonTrimmed = Math.trunc(lon * 100) / 100;
        const latTrimmed = Math.trunc(lat * 100) / 100;

        return {
          lon: lonTrimmed,
          lat: latTrimmed,
          original: { lon, lat },
        };
      } catch (error) {
        return null;
      }
    };

    // Helper: Find coordinate match with property type validation
    // First tries exact match, then decrement (-0.01, -0.02), then increment (+0.01, +0.02)
    // const findCoordMatchWithTypeValidation = (property, redinArray) => {
    //   const propertyCoords = extractAndTrimCoordinates(
    //     property.address_information
    //   );
    //   if (!propertyCoords) return null;

    //   const propertyType = property.property_type;
    //   if (!propertyType) return null;

    //   const propertyTypeClean = propertyType.toLowerCase().trim();

    //   // Function to check match at specific coordinates with type validation
    //   const checkCoordAtLevel = (lat, lon, coordType) => {
    //     const coordMatches = redinArray.filter((redin) => {
    //       return (
    //         redin.coordinates &&
    //         redin.coordinates.lat === lat &&
    //         redin.coordinates.lon === lon
    //       );
    //     });

    //     if (coordMatches.length === 0) return null;

    //     // Find match with property type validation
    //     const match = coordMatches.find((redin) => {
    //       if (!redin.main_subtype_name) return false;
    //       const redinSubtype = redin.main_subtype_name.toLowerCase().trim();
    //       return redinSubtype === propertyTypeClean;
    //     });

    //     if (match) {
    //       return {
    //         match,
    //         matchedRegionPart: null,
    //         matchedRegionLevel: 0,
    //         coordType,
    //         matchedCoords: { lat, lon },
    //       };
    //     }

    //     return null;
    //   };

    //   // Try exact coordinates first
    //   let result = checkCoordAtLevel(
    //     propertyCoords.lat,
    //     propertyCoords.lon,
    //     "exact"
    //   );
    //   if (result) return result;

    //   // Try decrement (lat - 0.01, lat - 0.02)
    //   for (let offset of [-1, -2]) {
    //     const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
    //     result = checkCoordAtLevel(lat, propertyCoords.lon, "decrement");
    //     if (result) return result;
    //   }

    //   // Try increment (lat + 0.01, lat + 0.02)
    //   for (let offset of [1, 2]) {
    //     const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
    //     result = checkCoordAtLevel(lat, propertyCoords.lon, "increment");
    //     if (result) return result;
    //   }

    //   return null;
    // };

    const findCoordMatchWithTypeValidation = (property, redinArray) => {
      const propertyCoords = extractAndTrimCoordinates(
        property.address_information
      );
      if (!propertyCoords) return { matchResult: null, typeMismatchInfo: null };

      const propertyType = property.property_type;
      if (!propertyType) return { matchResult: null, typeMismatchInfo: null };

      const propertyTypeClean = propertyType.toLowerCase().trim();

      // Track type mismatches
      let typeMismatchInfo = null;

      // Function to check match at specific coordinates with type validation
      const checkCoordAtLevel = (lat, lon, coordType) => {
        const coordMatches = redinArray.filter((redin) => {
          return (
            redin.coordinates &&
            redin.coordinates.lat === lat &&
            redin.coordinates.lon === lon
          );
        });

        if (coordMatches.length === 0) return null;

        // Find match with property type validation
        const match = coordMatches.find((redin) => {
          if (!redin.main_subtype_name) return false;
          const redinSubtype = redin.main_subtype_name.toLowerCase().trim();
          return redinSubtype === propertyTypeClean;
        });

        if (match) {
          return {
            match,
            matchedRegionPart: null,
            matchedRegionLevel: 0,
            coordType,
            matchedCoords: { lat, lon },
          };
        } else if (coordMatches.length > 0 && !typeMismatchInfo) {
          // Coordinates matched but type didn't - store this info
          typeMismatchInfo = {
            coordType,
            matchedCoords: { lat, lon },
            propertyType: propertyTypeClean,
            availableTypes: coordMatches.map((m) => ({
              property_name: m.property_name,
              main_subtype_name: m.main_subtype_name,
              location_id: m.location_id,
            })),
          };
        }

        return null;
      };

      // Try exact coordinates first
      let result = checkCoordAtLevel(
        propertyCoords.lat,
        propertyCoords.lon,
        "exact"
      );
      if (result) return { matchResult: result, typeMismatchInfo: null };

      // Try decrement (lat - 0.01, lat - 0.02)
      for (let offset of [-1, -2]) {
        const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
        result = checkCoordAtLevel(lat, propertyCoords.lon, "decrement");
        if (result) return { matchResult: result, typeMismatchInfo: null };
      }

      // Try increment (lat + 0.01, lat + 0.02)
      for (let offset of [1, 2]) {
        const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
        result = checkCoordAtLevel(lat, propertyCoords.lon, "increment");
        if (result) return { matchResult: result, typeMismatchInfo: null };
      }

      return { matchResult: null, typeMismatchInfo };
    };

    // ==================== END COORDINATE MATCHING HELPERS ====================

    // Build flattened Redin array for efficient matching (with coordinates)
    const redinFlattenedArray = [];
    allExtractRedinLocation.forEach((location) => {
      const redinCoords = extractAndTrimRedinCoordinates(location.geo_point);

      if (location.properties && Array.isArray(location.properties)) {
        location.properties.forEach((p) => {
          redinFlattenedArray.push({
            location_id: location.location_id,
            geo_point: location.geo_point,
            coordinates: redinCoords,
            property_id: p.property?.id,
            property_name: p.property?.name,
            main_subtype_name:
              p.property?.main_subtype_name || p.main_subtype_name,
            main_type_name: p.property?.main_type_name || p.main_type_name,
          });
        });
      }
    });

    // Stats object
    const stats = {
      totalDubaiProperties: allDubaiProperties.length,
      totalRedinLocations: allExtractRedinLocation.length,
      totalRedinProperties: redinFlattenedArray.length,
      totalPropertiesWithCoordinates: allDubaiProperties.filter((p) =>
        hasValidCoordinates(p)
      ).length,

      // Step 1.5: Combined region matching with word swap  â† ADD THIS
      step1_5_combinedRegionMatched: 0,
      step1_5_coordinatesAvailableInRemaining: 0,

      // Step 1: Region 1 exact matching
      step1_region1Matched: 0,
      step1_coordinatesAvailableInRemaining: 0,

      // Step 2: Region 2 exact matching
      step2_region2Matched: 0,
      step2_coordinatesAvailableInRemaining: 0,

      // Step 3: Partial word-by-word matching (2-3 words)
      step3_partialWordMatched: 0,
      step3_coordinatesAvailableInRemaining: 0,

      // Step 4: Starting words matching (2-3 starting words)
      step4_startingWordsMatched: 0,
      step4_coordinatesAvailableInRemaining: 0,

      // Step 5: Coordinate matching
      step5_coordMatched: 0,
      step5_exactCoordMatch: 0,
      step5_decrementCoordMatch: 0,
      step5_incrementCoordMatch: 0,

      step5_coordinatesAvailableBeforeMatching: 0,

      step5_coordinatesAvailableInRemaining: 0,

      step5_coordMatchedButTypeMismatch: 0,
      step5_coordMatchedExactButTypeMismatch: 0,
      step5_coordMatchedDecrementButTypeMismatch: 0,
      step5_coordMatchedIncrementButTypeMismatch: 0,

      // Final stats
      totalMatched: 0,
      totalUnmatched: 0,
      updateSuccess: 0,
      updateFailed: 0,

      // Unmatched analysis
      unmatchedAnalysis: {
        propertyNameMatched_SubtypeMismatch: 0,
        propertyNameNotMatched: 0,
      },
    };

    // Result arrays
    const step1_region1Matched = [];
    const step1_5_combinedRegionMatched = [];
    const step2_region2Matched = [];
    const step3_partialWordMatched = [];
    const step4_startingWordsMatched = [];
    const step5_coordMatched = [];
    const step5_coordMatchedButTypeMismatch = [];
    const unmatchedProperties = [];
    const updatePromises = [];

    // ARRAYS for tracking remaining coordinates at each step:
    const step1_5_remainingWithCoordinates = [];
    const step1_remainingWithCoordinates = [];
    const step2_remainingWithCoordinates = [];
    const step3_remainingWithCoordinates = [];
    const step4_remainingWithCoordinates = [];
    const step5_remainingWithCoordinates = [];

    // Detailed unmatched arrays
    const unmatchedBySubtype = [];
    const unmatchedByPropertyName = [];

    // Extract region parts
    const extractRegionParts = (regionString) => {
      if (!regionString) return { region1: null, region2: null };
      const parts = regionString
        .split(",")
        .map((part) => part.trim())
        .filter((p) => p);
      return {
        region1: parts.length > 0 ? parts[0] : null,
        region2: parts.length > 1 ? parts[1] : null,
      };
    };

    // Combine Region
    const combineRegions = (region1, region2) => {
      return [region1, region2].filter(Boolean).join(" ");
    };

    // Helper: Find match by specific region and type (EXACT match required)
    const findRegionMatch = (property, redinArray, regionValue) => {
      const propertyType = property.property_type;

      if (!regionValue || !propertyType) return null;

      const propertyTypeClean = propertyType.toLowerCase().trim();

      const match = redinArray.find((redin) => {
        if (!redin.property_name || !redin.main_subtype_name) return false;

        const redinSubtype = redin.main_subtype_name.toLowerCase().trim();

        // STRICT: Exact location match + exact type match
        return (
          isExactLocationMatch(regionValue, redin.property_name) &&
          redinSubtype === propertyTypeClean
        );
      });

      if (match) {
        return {
          match,
          matchedRegionPart: regionValue,
        };
      }

      return null;
    };

    // Helper: Find combined region match with word swapping
    const findCombinedRegionMatch = (
      property,
      redinArray,
      region1,
      region2
    ) => {
      const propertyType = property.property_type;

      if (!region1 || !propertyType) return null;

      const propertyTypeClean = propertyType.toLowerCase().trim();

      // Combine regions: "Tower A" + "Damac Bay" = "Tower A Damac Bay"
      const combinedRegion = combineRegions(region1, region2);

      if (!combinedRegion) return null;

      const match = redinArray.find((redin) => {
        if (!redin.property_name || !redin.main_subtype_name) return false;

        const redinSubtype = redin.main_subtype_name.toLowerCase().trim();

        // Combined region matching with word swapping + exact type match
        return (
          isCombinedRegionMatch(combinedRegion, redin.property_name) &&
          redinSubtype === propertyTypeClean
        );
      });

      if (match) {
        return {
          match,
          matchedRegionPart: combinedRegion,
        };
      }

      return null;
    };

    // Helper: Find partial word match by region 1
    const findPartialWordMatch = (property, redinArray, regionValue) => {
      const propertyType = property.property_type;

      if (!regionValue || !propertyType) return null;

      const propertyTypeClean = propertyType.toLowerCase().trim();

      const match = redinArray.find((redin) => {
        if (!redin.property_name || !redin.main_subtype_name) return false;

        const redinSubtype = redin.main_subtype_name.toLowerCase().trim();

        // Partial word matching + exact type match
        return (
          isPartialWordMatch(regionValue, redin.property_name) &&
          redinSubtype === propertyTypeClean
        );
      });

      if (match) {
        return {
          match,
          matchedRegionPart: regionValue,
        };
      }

      return null;
    };

    // Helper: Find starting words match
    const findStartingWordsMatch = (property, redinArray, regionValue) => {
      const propertyType = property.property_type;

      if (!regionValue || !propertyType) return null;

      const propertyTypeClean = propertyType.toLowerCase().trim();

      const match = redinArray.find((redin) => {
        if (!redin.property_name || !redin.main_subtype_name) return false;

        const redinSubtype = redin.main_subtype_name.toLowerCase().trim();

        // Starting words matching + exact type match
        return (
          isStartingWordsMatch(regionValue, redin.property_name) &&
          redinSubtype === propertyTypeClean
        );
      });

      if (match) {
        return {
          match,
          matchedRegionPart: regionValue,
        };
      }

      return null;
    };

    // Helper to analyze why property didn't match
    const analyzeUnmatchedProperty = (property, redinArray, regionValue) => {
      if (!regionValue) {
        return {
          reason: "no_region1_available",
          propertyNameMatches: [],
        };
      }

      // Find all Redin properties where property name matches (ignoring subtype)
      const propertyNameMatches = redinArray.filter((redin) => {
        if (!redin.property_name) return false;
        return checkPropertyNameMatch(regionValue, redin.property_name);
      });

      if (propertyNameMatches.length > 0) {
        // Property name matched but subtype didn't match
        return {
          reason: "property_name_matched_subtype_mismatch",
          propertyNameMatches: propertyNameMatches.map((r) => ({
            property_name: r.property_name,
            main_subtype_name: r.main_subtype_name,
            location_id: r.location_id,
          })),
        };
      } else {
        // Property name itself didn't match
        return {
          reason: "property_name_not_matched",
          propertyNameMatches: [],
        };
      }
    };

    // Helper: Update database
    const updatePropertyInDB = (
      property,
      matchData,
      matchType,
      regionLevel
    ) => {
      const updatePromise = Property.findOneAndUpdate(
        { id: property.id },
        {
          $set: {
            redin_location: {
              location_id: matchData.match.location_id,
              property_location_id: matchData.match.property_id,
              property_name: matchData.match.property_name,
              main_subtype_name: matchData.match.main_subtype_name,
              main_type_name: matchData.match.main_type_name,
              matched_by: matchType,
              matched_region_level: regionLevel,
              matched_region_part: matchData.matchedRegionPart,
            },
          },
        },
        { new: true }
      )
        .then((updated) => {
          if (updated) {
            stats.updateSuccess++;
            console.log(
              `âœ“ Property ${property.id}: ${matchType} (Level ${regionLevel}) â†’ Updated`
            );
          } else {
            stats.updateFailed++;
            console.log(
              `âœ— Property ${property.id}: Update failed - not found`
            );
          }
          return updated;
        })
        .catch((err) => {
          stats.updateFailed++;
          console.error(
            `âœ— Property ${property.id}: Update error:`,
            err.message
          );
          return null;
        });

      updatePromises.push(updatePromise);
    };

    console.log("\n========== STARTING MATCHING PROCESS ==========\n");

    // STEP 1: Match by Region 1 + Type (EXACT)

    // STEP 1.5: Match by Combined Region (Region1 + Region2) with Word Swapping
    console.log(
      "\n--- STEP 1.5: Matching by Combined Region (Region1 + Region2) with Word Swapping ---"
    );

    const unmatchedAfterStep1_5 = [];

    for (const property of allDubaiProperties) {
      const { region1, region2 } = extractRegionParts(
        property.custom_fields?.propertyfinder_region
      );

      // Only try if both region1 exists (region2 is optional but helpful)
      if (region1) {
        const combinedRegionMatchResult = findCombinedRegionMatch(
          property,
          redinFlattenedArray,
          region1,
          region2
        );

        if (combinedRegionMatchResult) {
          stats.step1_5_combinedRegionMatched++;
          stats.totalMatched++;

          step1_5_combinedRegionMatched.push({
            property_id: property.id,
            full_region: property.custom_fields?.propertyfinder_region,
            region1,
            region2,
            combined_region: combineRegions(region1, region2),
            property_type: property.property_type,
            matched_region_part: combinedRegionMatchResult.matchedRegionPart,
            matched_redin: {
              location_id: combinedRegionMatchResult.match.location_id,
              property_name: combinedRegionMatchResult.match.property_name,
              main_subtype_name:
                combinedRegionMatchResult.match.main_subtype_name,
            },
          });

          updatePropertyInDB(
            property,
            combinedRegionMatchResult,
            "combined_region_match",
            1.5
          );
        } else {
          unmatchedAfterStep1_5.push(property);
        }
      } else {
        unmatchedAfterStep1_5.push(property);
      }
    }

    console.log(
      `Step 1.5 Complete: ${stats.step1_5_combinedRegionMatched} matched (Combined Region with Word Swap), ${unmatchedAfterStep1_5.length} remaining unmatched`
    );

    // ADD THIS BLOCK:
    stats.step1_5_coordinatesAvailableInRemaining =
      unmatchedAfterStep1_5.filter((p) => hasValidCoordinates(p)).length;
    console.log(
      `  â””â”€ Properties with coordinates in remaining: ${stats.step1_5_coordinatesAvailableInRemaining}`
    );

    unmatchedAfterStep1_5
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step1_5_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    const unmatchedAfterStep1 = [];

    for (const property of unmatchedAfterStep1_5) {
      const { region1, region2 } = extractRegionParts(
        property.custom_fields?.propertyfinder_region
      );

      const region1MatchResult = findRegionMatch(
        property,
        redinFlattenedArray,
        region1
      );

      if (region1MatchResult) {
        stats.step1_region1Matched++;
        stats.totalMatched++;

        step1_region1Matched.push({
          property_id: property.id,
          full_region: property.custom_fields?.propertyfinder_region,
          address_information: region1,
          region2,
          property_type: property.property_type,
          matched_region_part: region1MatchResult.matchedRegionPart,
          matched_redin: {
            location_id: region1MatchResult.match.location_id,
            property_name: region1MatchResult.match.property_name,
            main_subtype_name: region1MatchResult.match.main_subtype_name,
          },
        });

        updatePropertyInDB(
          property,
          region1MatchResult,
          "exact_region1_match",
          1
        );
      } else {
        unmatchedAfterStep1.push(property);
      }
    }

    console.log(
      `Step 1 Complete: ${stats.step1_region1Matched} matched (Region 1), ${unmatchedAfterStep1.length} remaining unmatched`
    );

    // ADD THIS BLOCK:
    stats.step1_coordinatesAvailableInRemaining = unmatchedAfterStep1.filter(
      (p) => hasValidCoordinates(p)
    ).length;
    console.log(
      `  â””â”€ Properties with coordinates in remaining: ${stats.step1_coordinatesAvailableInRemaining}`
    );

    unmatchedAfterStep1
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step1_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    // STEP 2: Match by Region 2 + Type (EXACT)
    const unmatchedAfterStep2 = [];

    for (const property of unmatchedAfterStep1) {
      const { region1, region2 } = extractRegionParts(
        property.custom_fields?.propertyfinder_region
      );

      // Only try Region 2 if it exists
      if (region2) {
        const region2MatchResult = findRegionMatch(
          property,
          redinFlattenedArray,
          region2
        );

        if (region2MatchResult) {
          stats.step2_region2Matched++;
          stats.totalMatched++;

          step2_region2Matched.push({
            property_id: property.id,
            full_region: property.custom_fields?.propertyfinder_region,
            region1,
            region2,
            property_type: property.property_type,
            matched_region_part: region2MatchResult.matchedRegionPart,
            matched_redin: {
              location_id: region2MatchResult.match.location_id,
              property_name: region2MatchResult.match.property_name,
              main_subtype_name: region2MatchResult.match.main_subtype_name,
            },
          });

          updatePropertyInDB(
            property,
            region2MatchResult,
            "exact_region2_match",
            2
          );
        } else {
          unmatchedAfterStep2.push(property);
        }
      } else {
        unmatchedAfterStep2.push(property);
      }
    }

    console.log(
      `Step 2 Complete: ${stats.step2_region2Matched} matched (Region 2), ${unmatchedAfterStep2.length} remaining unmatched`
    );

    // ADD THIS BLOCK:
    stats.step2_coordinatesAvailableInRemaining = unmatchedAfterStep2.filter(
      (p) => hasValidCoordinates(p)
    ).length;
    console.log(
      `  â””â”€ Properties with coordinates in remaining: ${stats.step2_coordinatesAvailableInRemaining}`
    );

    unmatchedAfterStep2
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step2_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    // STEP 3: Partial Word-by-Word Matching (2-3 words must match)
    const unmatchedAfterStep3 = [];

    for (const property of unmatchedAfterStep2) {
      const { region1, region2 } = extractRegionParts(
        property.custom_fields?.propertyfinder_region
      );

      if (region1) {
        const partialWordMatchResult = findPartialWordMatch(
          property,
          redinFlattenedArray,
          region1
        );

        if (partialWordMatchResult) {
          stats.step3_partialWordMatched++;
          stats.totalMatched++;

          step3_partialWordMatched.push({
            property_id: property.id,
            full_region: property.custom_fields?.propertyfinder_region,
            region1,
            region2,
            property_type: property.property_type,
            matched_region_part: partialWordMatchResult.matchedRegionPart,
            matched_redin: {
              location_id: partialWordMatchResult.match.location_id,
              property_name: partialWordMatchResult.match.property_name,
              main_subtype_name: partialWordMatchResult.match.main_subtype_name,
            },
          });

          updatePropertyInDB(
            property,
            partialWordMatchResult,
            "partial_word_match",
            1
          );
        } else {
          unmatchedAfterStep3.push(property);
        }
      } else {
        unmatchedAfterStep3.push(property);
      }
    }

    console.log(
      `Step 3 Complete: ${stats.step3_partialWordMatched} matched (Partial Words), ${unmatchedAfterStep3.length} remaining unmatched`
    );

    // ADD THIS BLOCK:
    stats.step3_coordinatesAvailableInRemaining = unmatchedAfterStep3.filter(
      (p) => hasValidCoordinates(p)
    ).length;
    console.log(
      `  â””â”€ Properties with coordinates in remaining: ${stats.step3_coordinatesAvailableInRemaining}`
    );

    unmatchedAfterStep3
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step3_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    // STEP 4: Starting Words Matching (2-3 starting words must match)
    const unmatchedAfterStep4 = [];

    for (const property of unmatchedAfterStep3) {
      const { region1, region2 } = extractRegionParts(
        property.custom_fields?.propertyfinder_region
      );

      if (region1) {
        const startingWordsMatchResult = findStartingWordsMatch(
          property,
          redinFlattenedArray,
          region1
        );

        if (startingWordsMatchResult) {
          stats.step4_startingWordsMatched++;
          stats.totalMatched++;

          step4_startingWordsMatched.push({
            property_id: property.id,
            full_region: property.custom_fields?.propertyfinder_region,
            region1,
            region2,
            property_type: property.property_type,
            matched_region_part: startingWordsMatchResult.matchedRegionPart,
            matched_redin: {
              location_id: startingWordsMatchResult.match.location_id,
              property_name: startingWordsMatchResult.match.property_name,
              main_subtype_name:
                startingWordsMatchResult.match.main_subtype_name,
            },
          });

          updatePropertyInDB(
            property,
            startingWordsMatchResult,
            "starting_words_match",
            1
          );
        } else {
          unmatchedAfterStep4.push(property);
        }
      } else {
        unmatchedAfterStep4.push(property);
      }
    }

    console.log(
      `Step 4 Complete: ${stats.step4_startingWordsMatched} matched (Starting Words), ${unmatchedAfterStep4.length} remaining unmatched`
    );

    // ADD THIS BLOCK:
    stats.step4_coordinatesAvailableInRemaining = unmatchedAfterStep4.filter(
      (p) => hasValidCoordinates(p)
    ).length;
    console.log(
      `  â””â”€ Properties with coordinates in remaining: ${stats.step4_coordinatesAvailableInRemaining}`
    );

    unmatchedAfterStep4
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step4_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    // STEP 5: Coordinate Matching (Exact, Decrement, Increment with Type Validation)
    console.log(
      "\n--- STEP 5: Matching by Coordinates (Exact, Decrement, Increment) with Type Validation ---"
    );

    // ADD THESE LINES:
    stats.step5_coordinatesAvailableBeforeMatching = unmatchedAfterStep4.filter(
      (p) => hasValidCoordinates(p)
    ).length;
    console.log(
      `Properties with coordinates available for coordinate matching: ${stats.step5_coordinatesAvailableBeforeMatching}`
    );

    const unmatchedAfterStep5 = [];

    for (const property of unmatchedAfterStep4) {
      const { matchResult: coordResult, typeMismatchInfo } =
        findCoordMatchWithTypeValidation(property, redinFlattenedArray);

      if (coordResult) {
        // MATCHED - Coordinates + Type matched
        stats.step5_coordMatched++;
        stats.totalMatched++;

        const coordType = coordResult.coordType;
        if (coordType === "exact") {
          stats.step5_exactCoordMatch++;
        } else if (coordType === "decrement") {
          stats.step5_decrementCoordMatch++;
        } else if (coordType === "increment") {
          stats.step5_incrementCoordMatch++;
        }

        const propertyCoords = extractAndTrimCoordinates(
          property.address_information
        );
        const { region1, region2 } = extractRegionParts(
          property.custom_fields?.propertyfinder_region
        );

        step5_coordMatched.push({
          property_id: property.id,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          property_coords: propertyCoords,
          matched_coords: coordResult.matchedCoords,
          coord_match_type: coordType,
          matched_redin: {
            location_id: coordResult.match.location_id,
            property_name: coordResult.match.property_name,
            main_subtype_name: coordResult.match.main_subtype_name,
          },
        });

        updatePropertyInDB(
          property,
          coordResult,
          `coord_match_${coordType}`,
          0
        );
      } else if (typeMismatchInfo) {
        // COORDINATE MATCHED BUT TYPE DIDN'T MATCH
        stats.step5_coordMatchedButTypeMismatch++;

        const coordType = typeMismatchInfo.coordType;
        if (coordType === "exact") {
          stats.step5_coordMatchedExactButTypeMismatch++;
        } else if (coordType === "decrement") {
          stats.step5_coordMatchedDecrementButTypeMismatch++;
        } else if (coordType === "increment") {
          stats.step5_coordMatchedIncrementButTypeMismatch++;
        }

        const propertyCoords = extractAndTrimCoordinates(
          property.address_information
        );
        const { region1, region2 } = extractRegionParts(
          property.custom_fields?.propertyfinder_region
        );

        step5_coordMatchedButTypeMismatch.push({
          property_id: property.id,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          property_coords: propertyCoords,
          matched_coords: typeMismatchInfo.matchedCoords,
          coord_match_type: coordType,
          available_types: typeMismatchInfo.availableTypes,
        });

        // Analyze for unmatched categorization
        const analysis = analyzeUnmatchedProperty(
          property,
          redinFlattenedArray,
          region1
        );

        const unmatchedData = {
          property_id: property.id,
          address_information: property.address_information || null,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          reason: "coordinate_matched_type_mismatch",
          coordinate_match_info: typeMismatchInfo,
          available_redin_matches: analysis.propertyNameMatches,
        };

        unmatchedProperties.push(unmatchedData);
        unmatchedAfterStep5.push(property);
      } else {
        // NO COORDINATE MATCH AT ALL
        const { region1, region2 } = extractRegionParts(
          property.custom_fields?.propertyfinder_region
        );
        const analysis = analyzeUnmatchedProperty(
          property,
          redinFlattenedArray,
          region1
        );

        const unmatchedData = {
          property_id: property.id,
          address_information: property.address_information || null,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          reason: analysis.reason,
          available_redin_matches: analysis.propertyNameMatches,
        };

        unmatchedProperties.push(unmatchedData);
        unmatchedAfterStep5.push(property);

        // Categorize the unmatched property
        if (analysis.reason === "property_name_matched_subtype_mismatch") {
          stats.unmatchedAnalysis.propertyNameMatched_SubtypeMismatch++;
          unmatchedBySubtype.push(unmatchedData);
        } else if (analysis.reason === "property_name_not_matched") {
          stats.unmatchedAnalysis.propertyNameNotMatched++;
          unmatchedByPropertyName.push(unmatchedData);
        }
      }
    }

    unmatchedAfterStep5
      .filter((p) => hasValidCoordinates(p))
      .forEach((p) => {
        step5_remainingWithCoordinates.push({
          property_id: p.id,
          full_region: p.custom_fields?.propertyfinder_region,
          property_type: p.property_type,
          address_information: p.address_information,
        });
      });

    stats.totalUnmatched = unmatchedProperties.length;
    console.log(
      `Step 5 Complete: ${stats.step5_coordMatched} matched (Coordinates - Exact: ${stats.step5_exactCoordMatch}, Decrement: ${stats.step5_decrementCoordMatch}, Increment: ${stats.step5_incrementCoordMatch}), ${stats.totalUnmatched} remaining unmatched`
    );

    stats.step5_coordinatesAvailableInRemaining = unmatchedAfterStep5.filter(
      (p) => hasValidCoordinates(p)
    ).length;

    console.log(
      `Properties with coordinates remaining: ${stats.step5_coordinatesAvailableInRemaining}`
    );

    // Wait for all updates to complete
    console.log("\n--- Updating Database ---");
    await Promise.all(updatePromises);
    console.log(
      `Database Updates Complete: ${stats.updateSuccess} success, ${stats.updateFailed} failed`
    );

    // Final Console Output
    console.log("\n========== FINAL STATS ==========");
    console.log(`Total Dubai Properties: ${stats.totalDubaiProperties}`);
    console.log(`Total Redin Locations: ${stats.totalRedinLocations}`);
    console.log(`Total Redin Properties: ${stats.totalRedinProperties}`);
    console.log(`\n--- STEP 1: Region 1 Exact Matching ---`);
    console.log(
      `Total Matched (Region 1 Exact): ${stats.step1_region1Matched}`
    );
    console.log(`\n--- STEP 2: Region 2 Exact Matching ---`);
    console.log(
      `Total Matched (Region 2 Exact): ${stats.step2_region2Matched}`
    );
    console.log(`\n--- STEP 3: Partial Word Matching (2-3 Words) ---`);
    console.log(
      `Total Matched (Partial Words): ${stats.step3_partialWordMatched}`
    );
    console.log(
      `\n--- STEP 4: Starting Words Matching (2-3 Starting Words) ---`
    );
    console.log(
      `Total Matched (Starting Words): ${stats.step4_startingWordsMatched}`
    );
    console.log(`\n--- STEP 5: Coordinate Matching (with Type Validation) ---`);
    console.log(`Total Matched (Coordinates): ${stats.step5_coordMatched}`);
    console.log(`  Exact Coordinates: ${stats.step5_exactCoordMatch}`);
    console.log(`  Decrement Coordinates: ${stats.step5_decrementCoordMatch}`);
    console.log(`  Increment Coordinates: ${stats.step5_incrementCoordMatch}`);
    console.log(`\n--- FINAL RESULTS ---`);
    console.log(`Total Matched: ${stats.totalMatched}`);
    console.log(`Total Unmatched: ${stats.totalUnmatched}`);
    console.log(`Database Updates Success: ${stats.updateSuccess}`);
    console.log(`Database Updates Failed: ${stats.updateFailed}`);
    console.log(`\n--- UNMATCHED ANALYSIS ---`);
    console.log(
      `Property Name Matched BUT Subtype Mismatched: ${stats.unmatchedAnalysis.propertyNameMatched_SubtypeMismatch}`
    );
    console.log(
      `Property Name NOT Matched: ${stats.unmatchedAnalysis.propertyNameNotMatched}`
    );
    console.log("=================================\n");

    console.log(
      "==============================This is the total match data=========================="
    );

    const unmatchedAddresses = unmatchedProperties
      .filter(
        (p) =>
          p.address_information &&
          Object.keys(p.address_information).length > 0 &&
          Object.values(p.address_information).some(
            (v) => v && String(v).trim() !== ""
          )
      )
      .map((p) => ({
        property_id: p.property_id,
        address_information: p.address_information,
      }));

    console.log(
      "==============================This is the total match data==========================",
      unmatchedAddresses.length
    );

    return res.json({
      success: true,
      stats,
      data: {
        step1_5_combinedRegionMatched: {
          count: step1_5_combinedRegionMatched.length,
          data: step1_5_combinedRegionMatched,
          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step1_5_remainingWithCoordinates.length,
            data: step1_5_remainingWithCoordinates,
          },
        },
        step1_region1Matched: {
          count: step1_region1Matched.length,
          data: step1_region1Matched,
          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step1_remainingWithCoordinates.length,
            data: step1_remainingWithCoordinates,
          },
        },
        step2_region2Matched: {
          count: step2_region2Matched.length,
          data: step2_region2Matched,
          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step2_remainingWithCoordinates.length,
            data: step2_remainingWithCoordinates,
          },
        },
        step3_partialWordMatched: {
          count: step3_partialWordMatched.length,
          data: step3_partialWordMatched,
          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step3_remainingWithCoordinates.length,
            data: step3_remainingWithCoordinates,
          },
        },
        step4_startingWordsMatched: {
          count: step4_startingWordsMatched.length,
          data: step4_startingWordsMatched,
          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step4_remainingWithCoordinates.length,
            data: step4_remainingWithCoordinates,
          },
        },
        step5_coordMatched: {
          count: step5_coordMatched.length,
          data: step5_coordMatched,
          exactMatches: step5_coordMatched.filter(
            (m) => m.coord_match_type === "exact"
          ).length,
          decrementMatches: step5_coordMatched.filter(
            (m) => m.coord_match_type === "decrement"
          ).length,
          incrementMatches: step5_coordMatched.filter(
            (m) => m.coord_match_type === "increment"
          ).length,
        },
        remainingWithCoordinates: {
          count: step5_remainingWithCoordinates.length,
          data: step5_remainingWithCoordinates,
        },

        // After coordinates
        unmatched: {
          count: unmatchedProperties.length,
          data: unmatchedProperties,

          // NEW: Add remaining coordinates after this step
          remainingWithCoordinates: {
            count: step5_remainingWithCoordinates.length,
            data: step5_remainingWithCoordinates,
          },
        },
        unmatchedAddresses,
        unmatchedDetailed: {
          bySubtypeMismatch: {
            count: unmatchedBySubtype.length,
            data: unmatchedBySubtype,
          },
          byPropertyNameNotMatched: {
            count: unmatchedByPropertyName.length,
            data: unmatchedByPropertyName,
          },
        },
      },
    });
  } catch (error) {
    console.log("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getAllRedinData = async (req, res) => {
  try {
    // Fetch all Redin documents from MongoDB
    const redinData = await ExtractRedinLocation.find();
    res.status(200).json({
      success: true,
      data: redinData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Redin data",
    });
  }
};

module.exports = {
  getLocationFromRedin,
  extractLocationFromRedin,
  updatePropertyData,
  getAllRedinLocationFromDatabase,
  MatchgeoPiontNew,
  getAllRedinData,
};
