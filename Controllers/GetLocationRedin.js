const LocationRedin = require("../Models/LocationRedinModel");
const ExtractRedinLocation = require("../Models/ExtractLocationRedin")
const axios = require("axios");
const Property = require("../Models/PropertyModel");

const getLocationFromRedin = async (req, res) => {

    console.log(process.env.REDIN_TOKEN)
    try {
        const headers = {
            "Authorization": process.env.REDIN_TOKEN,
            "Accept": "application/json",
        };

        let allLocations = [];
        let scrollId = null;
        let url = "https://api.reidin.com/api/v2/locations/AE/";
        let pageCount = 0;
        const perPageStats = [];

        do {
            pageCount++;
            const params = scrollId ? { scroll_id: scrollId } : {};
            console.log(`Fetching page ${pageCount}, scroll_id: ${scrollId || 'initial'}`);
            const response = await axios.get(url, { headers, params });
            const locations = response.data?.results || [];

            // store number of locations per page
            perPageStats.push(locations.length);

            const scrollIdArray = response.data?.scroll_id;
            scrollId = (scrollIdArray && Array.isArray(scrollIdArray) && scrollIdArray.length > 0)
                ? scrollIdArray[0]
                : null;

            allLocations = allLocations.concat(locations);
            console.log(`Page ${pageCount}: Fetched ${locations.length} locations, next scroll_id: ${scrollId || 'none (end)'}`);
        } while (scrollId);

        console.log(`\n=== Pagination Complete ===`);
        console.log(`Total pages fetched: ${pageCount}`);
        console.log(`Locations per page:`);
        perPageStats.forEach((count, index) => {
            console.log(`  Page ${index + 1}: ${count} locations`);
        });
        console.log(`Total locations fetched: ${allLocations.length}`);

        const dubaiLocations = allLocations.filter(loc => loc.city_name === "Dubai");
        console.log(`Dubai locations: ${dubaiLocations.length}`);

        let savedCount = 0;
        let updatedCount = 0;

        if (dubaiLocations.length > 0) {
            const bulkOps = dubaiLocations.map(location => ({
                updateOne: {
                    filter: { location_id: location.location_id },
                    update: { $set: location },
                    upsert: true
                }
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
                totalInDb: await LocationRedin.countDocuments()
            },
            message: "Data fetched and saved successfully"
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
            details: err.message
        });
    }
};


const extractLocationFromRedin = async (req, res) => {
    try {
        // Fetch all location IDs from MongoDB
        const allLocationIDsDocs = await LocationRedin.find({}, { location_id: 1, _id: 0 });
        const allLocationIDs = allLocationIDsDocs.map(doc => doc.location_id);
        console.log("All Location IDs: ", allLocationIDs);
        console.log("Total Locations to Process: ", allLocationIDs.length);

        const headers = {
            "Authorization": process.env.REDIN_TOKEN,
            "Accept": "application/json",
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
            outOfBoundsLocations: 0,        // NEW: Out of bounds count
            savedToDatabase: 0,
            failedToSave: 0,
            totalProperties: 0,
            successfulResponses: [],         // Data mila aur save ho gaya
            outOfBoundsResponses: [],        // Out of bounds locations
            failedErrors: [],                // API call hi fail hui
            duplicateLocationIDs: [],        // Duplicate location_ids
            duplicatePropertyIDs: []         // Duplicate property_ids
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
                        decompress: true
                    });

                    if (attempt > 1) {
                        stats.retriedAndSucceeded++;
                        console.log(`✓ Location ${id}: Retry #${attempt - 1} succeeded`);
                    }

                    return { success: true, data: response.data };
                } catch (err) {
                    const isRetryableError =
                        err.code === 'HPE_CR_EXPECTED' ||
                        err.code === 'HPE_INVALID_HEADER_TOKEN' ||
                        err.code === 'ECONNRESET' ||
                        err.code === 'ETIMEDOUT' ||
                        err.code === 'ECONNABORTED' ||
                        err.message.includes('Parse Error') ||
                        err.message.includes('socket hang up');

                    if (isRetryableError && attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`⚠ Location ${id}: ${err.code || err.message} - Retry #${attempt}/${maxRetries - 1} (waiting ${waitTime / 1000}s)`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }

                    return { success: false, error: err };
                }
            }
        };

        // Process in batches to avoid overwhelming the API
        const BATCH_SIZE = 10;
        const BATCH_DELAY = 2000;

        console.log(`\nProcessing in batches of ${BATCH_SIZE} with ${BATCH_DELAY / 1000}s delay...\n`);

        for (let i = 0; i < allLocationIDs.length; i += BATCH_SIZE) {
            const batch = allLocationIDs.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allLocationIDs.length / BATCH_SIZE);

            console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches} (Locations ${i + 1}-${Math.min(i + BATCH_SIZE, allLocationIDs.length)})`);

            const batchPromises = batch.map(async (id) => {
                stats.apiCallsAttempted++;

                const result = await fetchWithRetry(id, 5);
                if (!result.success) {
                    const err = result.error;
                    stats.failedErrors.push({
                        location_id: id,
                        error_message: err.message,
                        error_code: err.code || 'UNKNOWN',
                        error_response: err.response ? {
                            status: err.response.status,
                            statusText: err.response.statusText,
                            data: err.response.data
                        } : null
                    });

                    stats.apiCallsFailed++;
                    console.error(`✗ Location ${id}: API Call Failed after retries:`, {
                        message: err.message,
                        code: err.code
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
                        message: data.message || 'Given page number is out of bounds!'
                    });

                    console.log(`○ Location ${id}: Out of Bounds (${data.message || 'No data available'})`);
                    return;
                }

                stats.apiCallsSuccessful++;

                if (data.number_of_result && data.number_of_result > 0) {
                    stats.locationsWithData++;

                    const simplifiedResults = data.results.map(item => ({
                        property: item.property,
                        main_subtype_name: item.main_subtype_name,
                        main_type_name: item.main_type_name
                    }));

                    try {
                        const locationDoc = await LocationRedin.findOne(
                            { location_id: id },
                            { geo_point: 1 }
                        );

                        let geoPointData = null;
                        if (
                            locationDoc &&
                            locationDoc.geo_point &&
                            locationDoc.geo_point.lat != null &&
                            locationDoc.geo_point.lon != null
                        ) {
                            geoPointData = {
                                lat: locationDoc.geo_point.lat,
                                lon: locationDoc.geo_point.lon
                            };
                        }

                        console.log("This is the geoPiontData", geoPointData)
                        const newLocation = new ExtractRedinLocation({
                            location_id: id,
                            geo_point: geoPointData,
                            properties: simplifiedResults
                        });

                        await newLocation.save();

                        stats.savedToDatabase++;
                        stats.totalProperties += simplifiedResults.length;

                        // Store in successful responses (actual data saved)
                        stats.successfulResponses.push({
                            location_id: id,
                            status: 'Success',
                            status_code: 200,
                            properties_count: simplifiedResults.length,
                            saved_to_db: true
                        });

                        console.log(`✓ Location ${id}: Data Found (${simplifiedResults.length} properties) → Saved to DB`);
                        allResults[id] = simplifiedResults;
                    } catch (saveErr) {
                        stats.failedToSave++;

                        // Check if it's a duplicate key error
                        if (saveErr.code === 11000) {
                            const duplicateField = Object.keys(saveErr.keyPattern || {})[0];
                            const duplicateValue = saveErr.keyValue ? saveErr.keyValue[duplicateField] : null;

                            if (duplicateField === 'location_id') {
                                stats.duplicateLocationIDs.push({
                                    location_id: id,
                                    duplicate_value: duplicateValue,
                                    properties_count: simplifiedResults.length,
                                    error: 'Duplicate location_id - Already exists in database'
                                });
                                console.error(`✗ Location ${id}: Duplicate location_id (${duplicateValue}) - Already in DB`);
                            } else if (duplicateField === 'property_id') {
                                stats.duplicatePropertyIDs.push({
                                    location_id: id,
                                    property_id: duplicateValue,
                                    error: 'Duplicate property_id'
                                });
                                console.error(`✗ Location ${id}: Duplicate property_id detected: ${duplicateValue}`);
                            } else {
                                console.error(`✗ Location ${id}: Duplicate error on field '${duplicateField}': ${duplicateValue}`);
                            }
                        } else {
                            console.error(`✗ Location ${id}: Failed to Save DB:`, saveErr.message);
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
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        // Analyze duplicates after processing
        const duplicateLocationCount = stats.duplicateLocationIDs.length;
        const duplicatePropertyCount = stats.duplicatePropertyIDs.length;

        // Group duplicate property IDs by their count
        const propertyIdCounts = {};
        stats.duplicatePropertyIDs.forEach(item => {
            const propId = item.property_id;
            if (!propertyIdCounts[propId]) {
                propertyIdCounts[propId] = {
                    property_id: propId,
                    count: 0,
                    found_in_locations: []
                };
            }
            propertyIdCounts[propId].count++;
            propertyIdCounts[propId].found_in_locations.push(item.location_id);
        });

        // Final stats summary
        console.log("\n========== EXTRACTION COMPLETE ==========");
        console.log(`Total Location IDs: ${stats.totalLocationIDs}`);
        console.log(`\nAPI Calls:`);
        console.log(`  - Attempted: ${stats.apiCallsAttempted}`);
        console.log(`  - Successful: ${stats.apiCallsSuccessful} (${((stats.apiCallsSuccessful / stats.totalLocationIDs) * 100).toFixed(1)}%)`);
        console.log(`  - Failed: ${stats.apiCallsFailed} (${((stats.apiCallsFailed / stats.totalLocationIDs) * 100).toFixed(1)}%)`);
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
        console.log(`    • Other Errors: ${stats.failedToSave - duplicateLocationCount - duplicatePropertyCount}`);
        console.log(`  - Total Properties Saved: ${stats.totalProperties}`);
        console.log(`  - Average Properties per Location: ${stats.savedToDatabase > 0 ? (stats.totalProperties / stats.savedToDatabase).toFixed(2) : 0}`);

        // Successful responses
        if (stats.successfulResponses.length > 0) {
            console.log(`\n--- SUCCESSFULLY SAVED (First 5) ---`);
            stats.successfulResponses.slice(0, 5).forEach(resp => {
                console.log(`Location ${resp.location_id}: ${resp.properties_count} properties saved`);
            });
        }

        // Out of bounds
        if (stats.outOfBoundsResponses.length > 0) {
            console.log(`\n--- OUT OF BOUNDS LOCATIONS (First 10) ---`);
            stats.outOfBoundsResponses.slice(0, 10).forEach(resp => {
                console.log(`Location ${resp.location_id}: ${resp.message}`);
            });
        }

        // Duplicate analysis
        if (duplicateLocationCount > 0) {
            console.log(`\n--- DUPLICATE LOCATION IDs (First 10 of ${duplicateLocationCount}) ---`);
            stats.duplicateLocationIDs.slice(0, 10).forEach(dup => {
                console.log(`Location ${dup.location_id}: ${dup.error} (${dup.properties_count} properties)`);
            });
        }

        if (duplicatePropertyCount > 0) {
            console.log(`\n--- DUPLICATE PROPERTY IDs (First 5 of ${duplicatePropertyCount}) ---`);
            Object.values(propertyIdCounts).slice(0, 5).forEach(item => {
                console.log(`Property ID ${item.property_id}: Found ${item.count} times in locations [${item.found_in_locations.join(', ')}]`);
            });
        }

        // Failed API calls
        if (stats.failedErrors.length > 0) {
            console.log(`\n--- FAILED API CALLS (${stats.failedErrors.length} total) ---`);
            stats.failedErrors.slice(0, 10).forEach(err => {
                console.log(`Location ${err.location_id}: ${err.error_code} - ${err.error_message}`);
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
                successRate: ((stats.apiCallsSuccessful / stats.totalLocationIDs) * 100).toFixed(1) + '%',
                failureRate: ((stats.apiCallsFailed / stats.totalLocationIDs) * 100).toFixed(1) + '%',
                duplicateLocationCount,
                duplicatePropertyCount
            },
            successful: {
                count: stats.successfulResponses.length,
                sample: stats.successfulResponses.slice(0, 10),
                all: stats.successfulResponses
            },
            outOfBounds: {
                count: stats.outOfBoundsResponses.length,
                sample: stats.outOfBoundsResponses.slice(0, 10),
                all: stats.outOfBoundsResponses
            },
            duplicates: {
                location_ids: {
                    count: duplicateLocationCount,
                    sample: stats.duplicateLocationIDs.slice(0, 10),
                    all: stats.duplicateLocationIDs
                },
                property_ids: {
                    count: duplicatePropertyCount,
                    unique_count: Object.keys(propertyIdCounts).length,
                    sample: Object.values(propertyIdCounts).slice(0, 10),
                    all: Object.values(propertyIdCounts)
                }
            },
            failed: {
                count: stats.failedErrors.length,
                sample: stats.failedErrors.slice(0, 10),
                all: stats.failedErrors
            },
            data: allResults
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
                property_type: 1
            }
        );

        // Get all locations
        const allExtractRedinLocation = await ExtractRedinLocation.find({});
        const allPropertyLocationObjects = allExtractRedinLocation.flatMap(item =>
            item.properties.map(p => ({
                location_id: item.location_id,
                property_id: p.property.id,
                property_name: p.property.name,
                main_subtype_name: p.main_subtype_name,
                main_type_name: p.main_type_name
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
            updateFailed: 0
        };

        const matchedProperties = [];
        const regionNotFoundProperties = [];
        const typeMismatchProperties = [];
        const updatePromises = [];

        for (const property of allPropertyData) {
            // Check if propertyfinder_region exists
            if (!property.custom_fields || !property.custom_fields.propertyfinder_region) {
                stats.notMatched++;
                regionNotFoundProperties.push({
                    property_id: property.id,
                    original_region: 'N/A',
                    extracted_region: 'N/A',
                    property_type: property.property_type,
                    issue: 'propertyfinder_region field missing'
                });
                continue;
            }

            const region = property.custom_fields.propertyfinder_region;
            const extractedRegion = region.split(",")[0].trim().toLowerCase();

            console.log("Property Type from Model:", property.property_type);
            const propertyType = property.property_type.toLowerCase().trim();

            // Step 1: Find region matches
            const regionMatches = allPropertyLocationObjects.filter(
                locationObj => locationObj.property_name.toLowerCase().trim() === extractedRegion
            );

            if (regionMatches.length === 0) {
                stats.regionMatchNotFound++;
                stats.notMatched++;
                regionNotFoundProperties.push({
                    property_id: property.id,
                    original_region: region,
                    extracted_region: extractedRegion,
                    property_type: property.property_type,
                    issue: 'Region not found in Redin locations'
                });
                continue;
            }

            stats.regionMatchFound++;

            // Step 2: Find type matches
            const typeMatches = regionMatches.filter(match => {
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
                    available_types: [...new Set(regionMatches.map(m => m.main_subtype_name))],
                    issue: 'Property type not found in matched region'
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
                main_type_name: firstMatch.main_type_name
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
                            main_type_name: firstMatch.main_type_name
                        }
                    }
                },
                { new: true }
            ).then(updated => {
                if (updated) {
                    stats.updateSuccess++;
                    console.log(`✓ Property ${property.id}: Region & Type matched → Updated`);
                } else {
                    stats.updateFailed++;
                    console.error(`✗ Property ${property.id}: Update failed`);
                }
                return updated;
            }).catch(err => {
                stats.updateFailed++;
                console.error(`✗ Property ${property.id}: Update error:`, err.message);
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
        console.log(`  - Partially Matched (Type Mismatch): ${stats.partiallyMatched}`);
        console.log(`  - Not Matched (Region Not Found): ${stats.notMatched}`);
        console.log(`\nDatabase Updates:`);
        console.log(`  - Success: ${stats.updateSuccess}`);
        console.log(`  - Failed: ${stats.updateFailed}`);

        // Region Not Found - Print ALL with both property names
        if (regionNotFoundProperties.length > 0) {
            console.log(`\n========== REGION NOT FOUND (${regionNotFoundProperties.length} properties) ==========`);
            regionNotFoundProperties.forEach((item, index) => {
                console.log(`${index + 1}. Property ID: ${item.property_id}`);
                console.log(`   Original Region: "${item.original_region}"`);
                console.log(`   Extracted Region: "${item.extracted_region}"`);
                console.log(`   Property Type: ${item.property_type}`);
                console.log(`   Issue: ${item.issue}`);
                console.log('---');
            });
        }

        // Type Mismatch - Print ALL
        if (typeMismatchProperties.length > 0) {
            console.log(`\n========== TYPE MISMATCH (${typeMismatchProperties.length} properties) ==========`);
            typeMismatchProperties.forEach((item, index) => {
                console.log(`${index + 1}. Property ID: ${item.property_id}`);
                console.log(`   Original Region: "${item.original_region}"`);
                console.log(`   Extracted Region: "${item.extracted_region}"`);
                console.log(`   Expected Type: ${item.property_type}`);
                console.log(`   Available Types: ${item.available_types.join(', ')}`);
                console.log('---');
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
                updateFailed: stats.updateFailed
            },
            results: {
                matched: {
                    count: matchedProperties.length,
                    all: matchedProperties
                },
                partiallyMatched: {
                    count: typeMismatchProperties.length,
                    all: typeMismatchProperties
                },
                notMatched: {
                    count: regionNotFoundProperties.length,
                    all: regionNotFoundProperties
                }
            }
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
            data: data
        });

    } catch (error) {
        console.log("This is the error", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

module.exports = { getLocationFromRedin, extractLocationFromRedin, updatePropertyData, getAllRedinLocationFromDatabase };