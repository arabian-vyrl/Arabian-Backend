const getWellingtonConnection = require("../../Database/WellingtonDB");
const OffplanPIXXIModel = require("../../Models/OffplanPIXXIModel");
const mongoose = require("mongoose");
const cron = require("node-cron");

// ============================================================
// SLUG HELPERS
// ============================================================

const slugify = (text) => {
    return String(text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

const generateUniqueSlug = async (title, usedSlugs) => {
    const baseSlug = slugify(title);

    if (!baseSlug) {
        return null;
    }

    let candidate = baseSlug;
    let counter = 1;

    while (
        usedSlugs.has(candidate) ||
        (await OffplanPIXXIModel.exists({ slug: candidate }))
    ) {
        candidate = `${baseSlug}-${counter}`;
        counter += 1;
    }

    usedSlugs.add(candidate);
    return candidate;
};

// ============================================================
// SAVE ONE BATCH INTO OUR DATABASE
// ============================================================

const processBatch = async (properties) => {
    if (!properties || properties.length === 0) {
        return {
            inserted: 0,
            matched: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
    }

    const operations = [];
    const preparationErrors = [];
    const usedSlugs = new Set();

    // Only brand-new properties need a slug; skip the lookup for existing ones.
    const existingIds = new Set(
        (
            await OffplanPIXXIModel.find({
                _id: { $in: properties.map((p) => p._id).filter(Boolean) },
            })
                .select("_id")
                .lean()
        ).map((doc) => String(doc._id))
    );

    for (const property of properties) {
        try {
            // --------------------------------------------------------
            // Basic validation
            // --------------------------------------------------------

            if (!property._id) {
                preparationErrors.push({
                    propertyId: property.propertyId || null,
                    message: "Wellington _id is missing",
                });

                continue;
            }

            if (!property.propertyId) {
                preparationErrors.push({
                    _id: property._id?.toString(),
                    message: "propertyId is missing",
                });

                continue;
            }

            // --------------------------------------------------------
            // Keep Wellington _id exactly the same
            // --------------------------------------------------------

            const wellingtonId = property._id;

            // Don't put _id inside $set because MongoDB _id
            // is immutable.
            //
            // Also don't copy Wellington __v.
            const {
                _id,
                __v,
                ...propertyData
            } = property;

            // --------------------------------------------------------
            // Generate a unique slug for the project name (title).
            // Only assigned on insert so existing slugs never change.
            // --------------------------------------------------------

            const slug = existingIds.has(String(wellingtonId))
                ? null
                : await generateUniqueSlug(propertyData.title, usedSlugs);

            // --------------------------------------------------------
            // Prepare bulk upsert
            // --------------------------------------------------------

            operations.push({
                updateOne: {
                    filter: {
                        _id: wellingtonId,
                    },

                    update: {
                        // This only runs when MongoDB INSERTS the document.
                        // Therefore destination gets the SAME Wellington _id.
                        $setOnInsert: {
                            _id: wellingtonId,
                            ...(slug ? { slug } : {}),
                        },

                        // Existing properties will receive latest Wellington data.
                        $set: {
                            ...propertyData,

                            // We are only importing NEW projects.
                            listingType: "NEW",

                            // Wellington NEW records may contain "ready",
                            // but these are off-plan projects in our system.
                            listing_subtype: "offplan",
                        },
                    },

                    // Insert if _id doesn't exist.
                    // Update if _id already exists.
                    upsert: true,

                    // Don't bump updatedAt, otherwise unchanged properties
                    // would look modified. Mongo skips the write when the
                    // $set values are identical to what is stored.
                    timestamps: false,
                },
            });
        } catch (error) {
            preparationErrors.push({
                _id: property?._id?.toString() || null,
                propertyId: property?.propertyId || null,
                message: error.message,
            });
        }
    }

    // ----------------------------------------------------------
    // Nothing valid to insert
    // ----------------------------------------------------------

    if (operations.length === 0) {
        return {
            inserted: 0,
            matched: 0,
            updated: 0,
            failed: preparationErrors.length,
            errors: preparationErrors,
        };
    }

    try {
        // ========================================================
        // ACTUAL WRITE INTO OUR DATABASE
        // ========================================================

        const result = await OffplanPIXXIModel.bulkWrite(
            operations,
            {
                // Continue processing other properties if one fails
                ordered: false,
            }
        );

        return {
            // Newly created properties
            inserted: result.upsertedCount || 0,

            // Existing properties found
            matched: result.matchedCount || 0,

            // Existing properties where data actually changed
            updated: result.modifiedCount || 0,

            failed: preparationErrors.length,

            errors: preparationErrors,
        };
    } catch (error) {
        console.error("====================================");
        console.error("WELLINGTON BATCH WRITE ERROR");
        console.error("====================================");
        console.error(error);

        return {
            inserted: 0,
            matched: 0,
            updated: 0,
            failed: properties.length,

            errors: [
                ...preparationErrors,
                {
                    message: error.message,
                },
            ],
        };
    }
};

// ============================================================
// SYNC WELLINGTON PIXXI NEW PROJECTS
// ============================================================

let syncInProgress = false;

const getWellingtonProperty = async () => {
    const wellingtonDb = await getWellingtonConnection();

    return (
        wellingtonDb.models.Property ||
        wellingtonDb.model(
            "Property",
            new mongoose.Schema(
                {},
                {
                    strict: false,

                    // Exact Wellington collection name
                    collection: "properties",
                }
            )
        )
    );
};

// ------------------------------------------------------------
// Remove properties that no longer exist in Wellington.
// `seenIds` = every Wellington _id read during this run.
// ------------------------------------------------------------

const cleanupStaleProperties = async (seenIds) => {
    const MAX_DELETE_RATIO = 0.5;

    const ourDocs = await OffplanPIXXIModel.find({ listingType: "NEW" })
        .select("_id")
        .lean();

    const staleIds = ourDocs
        .map((doc) => doc._id)
        .filter((id) => !seenIds.has(String(id)));

    if (staleIds.length === 0) {
        return { deleted: 0, skipped: false, stale: 0 };
    }

    // Safety net: if Wellington returned far fewer records than we hold,
    // something is probably wrong on their side. Don't wipe our data.
    if (staleIds.length > ourDocs.length * MAX_DELETE_RATIO) {
        console.warn(
            `Stale cleanup skipped: ${staleIds.length}/${ourDocs.length} ` +
            `properties would be deleted (limit ${MAX_DELETE_RATIO * 100}%)`
        );
        return { deleted: 0, skipped: true, stale: staleIds.length };
    }

    const result = await OffplanPIXXIModel.deleteMany({
        _id: { $in: staleIds },
    });

    return {
        deleted: result.deletedCount || 0,
        skipped: false,
        stale: staleIds.length,
    };
};

// ------------------------------------------------------------
// Core sync (used by both the API route and the scheduler)
// ------------------------------------------------------------

const runWellingtonSync = async ({ batchSize = 50, cleanup = true } = {}) => {
    const BATCH_SIZE =
        Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 500
            ? batchSize
            : 50;

    console.log("====================================");
    console.log("WELLINGTON NEW PROPERTIES SYNC");
    console.log(`Batch Size: ${BATCH_SIZE}`);
    console.log("====================================");

    const WellingtonProperty = await getWellingtonProperty();
    const query = { listingType: "NEW" };

    const totalProperties = await WellingtonProperty.countDocuments(query);

    console.log(`Found ${totalProperties} NEW Wellington properties`);

    const stats = {
        total: totalProperties,
        processed: 0,
        inserted: 0,
        matched: 0,
        updated: 0,
        failed: 0,
        batchSize: BATCH_SIZE,
        cleanup: null,
    };
    const errors = [];

    // Never clean up on an empty Wellington response.
    if (totalProperties === 0) {
        return { stats, errors };
    }

    const seenIds = new Set();
    let batch = [];

    const flush = async () => {
        const size = batch.length;
        const result = await processBatch(batch);

        stats.inserted += result.inserted;
        stats.matched += result.matched;
        stats.updated += result.updated;
        stats.failed += result.failed;
        stats.processed += size;
        errors.push(...result.errors);

        console.log(
            `Progress: ${stats.processed}/${totalProperties} | ` +
            `Inserted: ${result.inserted} | Updated: ${result.updated} | ` +
            `Failed: ${result.failed}`
        );

        batch = [];
    };

    const cursor = WellingtonProperty.find(query)
        .lean()
        .cursor({ batchSize: BATCH_SIZE });

    for await (const property of cursor) {
        seenIds.add(String(property._id));
        batch.push(property);

        if (batch.length >= BATCH_SIZE) {
            await flush();
        }
    }

    if (batch.length > 0) {
        await flush();
    }

    // ---- Stale cleanup ----
    // Only when we actually read everything we expected to read.
    if (cleanup) {
        if (seenIds.size >= totalProperties) {
            stats.cleanup = await cleanupStaleProperties(seenIds);
        } else {
            stats.cleanup = { deleted: 0, skipped: true, stale: 0 };
            console.warn(
                `Stale cleanup skipped: read ${seenIds.size} of ${totalProperties}`
            );
        }
    }

    console.log("====================================");
    console.log("WELLINGTON SYNC COMPLETED");
    console.log(JSON.stringify(stats));
    console.log("====================================");

    return { stats, errors };
};

const runWellingtonSyncSafely = async (options) => {
    if (syncInProgress) {
        return { alreadyRunning: true };
    }

    syncInProgress = true;
    try {
        return await runWellingtonSync(options);
    } finally {
        syncInProgress = false;
    }
};

const syncWellingtonPIXXIProjects = async (req, res) => {
    try {
        const outcome = await runWellingtonSyncSafely({
            batchSize: Number(req.query.batchSize),
            cleanup: req.query.cleanup !== "false",
        });

        if (outcome.alreadyRunning) {
            return res.status(409).json({
                success: false,
                message: "A Wellington sync is already running",
            });
        }

        const { stats, errors } = outcome;

        return res.status(200).json({
            success: true,

            message:
                stats.total === 0
                    ? "No NEW Wellington properties found"
                    : "Wellington NEW properties synced successfully",

            data: stats,
            errors: errors.slice(0, 20),
        });
    } catch (error) {
        console.error("WELLINGTON PROPERTY SYNC ERROR", error);

        return res.status(500).json({
            success: false,
            message: "Failed to sync Wellington properties",
            error: error.message,
        });
    }
};

// ------------------------------------------------------------
// Scheduler: daily sync (insert / update / delete stale)
// ------------------------------------------------------------

const scheduleWellingtonPIXXISync = () => {
    const TZ = "Etc/UTC";
    const EXPRESSION = "0 2 * * 0,3";

    cron.schedule(
        EXPRESSION,
        async () => {
            console.log(
                `[${new Date().toISOString()}] Wellington scheduled sync started`
            );
            try {
                const outcome = await runWellingtonSyncSafely();

                if (outcome.alreadyRunning) {
                    console.log("Wellington sync skipped: already running");
                }
            } catch (error) {
                console.error("Wellington scheduled sync failed:", error);
            }
        },
        { timezone: TZ }
    );

    console.log(`Wellington sync scheduled: "${EXPRESSION}" (${TZ})`);
};


const getOffplanPIXXIProperties = async (req, res) => {
    try {
        /* ------------------------------- Pagination ------------------------------ */
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        /* ------------------------------- Sorting --------------------------------- */
        const sortBy = (req.query.sortBy || "newest").toLowerCase();

        /* ------------------------------- Price Range ----------------------------- */
        const minPrice = req.query.minPrice ? parseInt(req.query.minPrice, 10) : null;
        const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : null;

        /* ---------------------------- Base Filters ------------------------------- */
        // Wellington DB only contains off-plan projects; lock both filters permanently.
        const baseMatch = { status: "ACTIVE", listingType: "NEW" };

        // Project name filter
        if (req.query.projectName) {
            baseMatch.title = new RegExp(req.query.projectName, "i");
        }

        // Developer filter
        if (req.query.developer) {
            baseMatch.developer = new RegExp(req.query.developer, "i");
        }

        // Handover Quarter filter (e.g., "Q2 2026", "Q3 2027")
        if (req.query.handoverQuarter) {
            baseMatch.handoverQuarter = new RegExp(req.query.handoverQuarter, "i");
        }

        // Location filter (cascading search through comma-separated parts)
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let locationSearchParts = [];
        if (req.query.locationPrefix && req.query.locationPrefix !== "") {
            const locationPrefix = req.query.locationPrefix.trim();
            const parts = locationPrefix
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean);
            locationSearchParts = [...new Set([locationPrefix, ...parts])];
        }

        if (minPrice !== null || maxPrice !== null) {
            baseMatch.price = {};
            if (minPrice !== null) baseMatch.price.$gte = minPrice;
            if (maxPrice !== null) baseMatch.price.$lte = maxPrice;
        }

        /* --------------------------------- Sorting ------------------------------ */
        let sortStage = { createTime: -1 }; // Default: newest first

        switch (sortBy) {
            case "highest_price":
            case "price-high":
                sortStage = { price: -1 };
                break;

            case "lowest_price":
            case "price-low":
                sortStage = { price: 1 };
                break;

            case "newest":
            case "most_recent":
            default:
                sortStage = { createTime: -1 };
        }

        /* -------------------------- Execute Query --------------------------- */
        let docs = [];
        let totalCount = 0;
        let matchedLocation = null;

        if (locationSearchParts.length > 0) {
            for (const locationPart of locationSearchParts) {
                const locationMatch = {
                    ...baseMatch,
                    location: new RegExp(escapeRegex(locationPart), "i"),
                };

                const resultCount = await OffplanPIXXIModel.countDocuments(locationMatch);

                if (resultCount > 0) {
                    docs = await OffplanPIXXIModel.find(locationMatch)
                        .sort(sortStage)
                        .skip(skip)
                        .limit(limit)
                        .lean();
                    totalCount = resultCount;
                    matchedLocation = locationPart;
                    break;
                }
            }
        } else {
            [docs, totalCount] = await Promise.all([
                OffplanPIXXIModel.find(baseMatch)
                    .sort(sortStage)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                OffplanPIXXIModel.countDocuments(baseMatch),
            ]);
        }

        const totalPages = Math.max(1, Math.ceil(totalCount / limit));

        /* ------------------------------- Response -------------------------------- */
        res.status(200).json({
            success: true,
            message: `Found ${docs.length} properties`,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
            filters: {
                projectName: req.query.projectName || null,
                developer: req.query.developer || null,
                handoverQuarter: req.query.handoverQuarter || null,
                locationPrefix: req.query.locationPrefix || null,
                matchedLocation,
                priceRange: { min: minPrice, max: maxPrice },
                sortBy,
            },
            count: docs.length,
            data: docs,
        });
    } catch (error) {
        console.error("Error in getOffplanPIXXIProperties:", error);
        res.status(500).json({
            success: false,
            message: "Failed to filter offplan PIXXI properties",
            error: error.message,
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

// ============================================================
// LOCATION / PROJECT NAME SUGGESTIONS
// ============================================================

const getOffplanPIXXILocationSuggestions = async (req, res) => {
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
            });
        }

        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapeRegex(prefix), "i");

        const properties = await OffplanPIXXIModel.find({
            status: "ACTIVE",
            listingType: "NEW",
            $or: [{ title: regex }, { location: regex }],
        })
            .limit(maxSuggestions * 4)
            .select("title location")
            .lean();

        const suggestions = new Set();

        properties.forEach((property) => {
            [property.title, property.location].forEach((value) => {
                if (value && value.trim() && value.toLowerCase().includes(prefix.toLowerCase())) {
                    suggestions.add(value.trim());
                }
            });
        });

        let suggestionsArray = Array.from(suggestions);

        const prefixLower = prefix.toLowerCase();
        suggestionsArray.sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();

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
            message: `Found ${suggestionsArray.length} suggestions for "${prefix}"`,
            count: suggestionsArray.length,
            data: suggestionsArray,
        });
    } catch (error) {
        console.error("Error in getOffplanPIXXILocationSuggestions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get offplan PIXXI location suggestions",
            error: error.message,
            data: [],
        });
    }
};

// ============================================================
// DEVELOPER SUGGESTIONS (prefix search)
// ============================================================

const getOffplanPIXXIDeveloperSuggestions = async (req, res) => {
    try {
        const prefix = req.query.prefix;
        const limit = parseInt(req.query.limit) || 8;

        if (!prefix || prefix.length < 2) {
            return res.json({ success: true, data: [], count: 0 });
        }

        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`^${escapeRegex(prefix)}`, "i");

        const developers = await OffplanPIXXIModel.distinct("developer", {
            status: "ACTIVE",
            listingType: "NEW",
            developer: { $regex: regex },
        });

        const suggestions = developers.filter(Boolean).slice(0, limit);
        return res.status(200).json({
            success: true,
            data: suggestions,
            count: suggestions.length,
        });
    } catch (error) {
        console.error("Error in getOffplanPIXXIDeveloperSuggestions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch offplan PIXXI developer suggestions",
            error: error.message,
        });
    }
};

// ============================================================
// GET SINGLE PROPERTY BY SLUG
// ============================================================

const getOffplanPIXXIPropertyBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Slug parameter is required",
            });
        }

        const property = await OffplanPIXXIModel.findOne({ slug }).lean();

        if (!property) {
            return res.status(404).json({
                success: false,
                message: `No property found with slug "${slug}"`,
            });
        }

        return res.status(200).json({
            success: true,
            data: property,
        });
    } catch (error) {
        console.error("Error in getOffplanPIXXIPropertyBySlug:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch offplan PIXXI property by slug",
            error: error.message,
        });
    }
};

// ============================================================
// GET SIMILAR PROPERTIES (by community or location)
// ============================================================

const getSimilarOffplanPIXXIProperties = async (req, res) => {
    try {
        const { slug } = req.params;
        const limit = parseInt(req.query.limit) || 6;

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Slug parameter is required",
            });
        }

        const property = await OffplanPIXXIModel.findOne({ slug }).lean();

        if (!property) {
            return res.status(404).json({
                success: false,
                message: `No property found with slug "${slug}"`,
            });
        }

        const orConditions = [];

        if (property.community) {
            orConditions.push({ community: property.community });
        }

        if (property.location) {
            orConditions.push({ location: property.location });
        }

        if (orConditions.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No community or location available for matching",
                count: 0,
                data: [],
            });
        }

        const similarProperties = await OffplanPIXXIModel.find({
            _id: { $ne: property._id },
            status: "ACTIVE",
            listingType: "NEW",
            $or: orConditions,
        })
            .sort({ createTime: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            message: `Found ${similarProperties.length} similar properties`,
            count: similarProperties.length,
            data: similarProperties,
        });
    } catch (error) {
        console.error("Error in getSimilarOffplanPIXXIProperties:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch similar offplan PIXXI properties",
            error: error.message,
            data: [],
        });
    }
};

// ============================================================
// ALL DEVELOPER NAMES
// ============================================================

const getAllOffplanPIXXIDevelopers = async (req, res) => {
    try {
        const developers = await OffplanPIXXIModel.distinct("developer", {
            status: "ACTIVE",
            listingType: "NEW",
            developer: { $nin: [null, ""] },
        });

        developers.sort((a, b) => a.localeCompare(b));

        return res.status(200).json({
            success: true,
            count: developers.length,
            data: developers,
        });
    } catch (error) {
        console.error("Error in getAllOffplanPIXXIDevelopers:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch offplan PIXXI developers",
            error: error.message,
            data: [],
        });
    }
};

// ============================================================
// BACKFILL SLUGS (fix docs whose slug predates the accent-stripping fix)
// ============================================================

// const backfillOffplanPIXXISlugs = async (req, res) => {
//     try {
//         const properties = await OffplanPIXXIModel.find({}).select("_id title slug").lean();

//         const usedSlugs = new Set(properties.map((p) => p.slug).filter(Boolean));
//         const updates = [];

//         for (const property of properties) {
//             const expectedBaseSlug = slugify(property.title);
//             if (!expectedBaseSlug) continue;

//             // Only touch documents whose slug doesn't match a fresh slugify
//             // of their title (this is what accent-stripped slugs look like).
//             const alreadyCorrect =
//                 property.slug === expectedBaseSlug ||
//                 (property.slug || "").startsWith(`${expectedBaseSlug}-`);

//             if (alreadyCorrect) continue;

//             usedSlugs.delete(property.slug);

//             let candidate = expectedBaseSlug;
//             let counter = 1;
//             while (usedSlugs.has(candidate)) {
//                 candidate = `${expectedBaseSlug}-${counter}`;
//                 counter += 1;
//             }
//             usedSlugs.add(candidate);

//             updates.push({
//                 updateOne: {
//                     filter: { _id: property._id },
//                     update: { $set: { slug: candidate } },
//                 },
//             });
//         }

//         if (updates.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: "No slugs needed fixing",
//                 updated: 0,
//             });
//         }

//         const result = await OffplanPIXXIModel.bulkWrite(updates, { ordered: false });

//         return res.status(200).json({
//             success: true,
//             message: `Fixed ${result.modifiedCount} slug(s)`,
//             updated: result.modifiedCount,
//         });
//     } catch (error) {
//         console.error("Error in backfillOffplanPIXXISlugs:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to backfill offplan PIXXI slugs",
//             error: error.message,
//         });
//     }
// };

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    syncWellingtonPIXXIProjects,
    scheduleWellingtonPIXXISync,
    getOffplanPIXXIProperties,
    getOffplanPIXXIPropertyBySlug,
    getSimilarOffplanPIXXIProperties,
    getOffplanPIXXILocationSuggestions,
    getOffplanPIXXIDeveloperSuggestions,
    getAllOffplanPIXXIDevelopers,
    // backfillOffplanPIXXISlugs,
};