// const axios = require("axios");
// const xml2js = require("xml2js");
// const Property = require("../Models/PropertyModel");
// const Agent = require("../Models/AgentModel");
// const cron = require("node-cron");

// /* ------------------------- Helpers & Utilities ------------------------- */

// // Extract QR code URL from many shapes
// const extractQRCodeUrl = (qrCode) => {
//   if (!qrCode) return "";

//   if (typeof qrCode === "string") return qrCode;

//   if (qrCode.url) {
//     if (typeof qrCode.url === "string") return qrCode.url;

//     if (typeof qrCode.url === "object") {
//       if (qrCode.url._) return qrCode.url._;
//       if (qrCode.url.$t) return qrCode.url.$t;
//     }

//     if (Array.isArray(qrCode.url) && qrCode.url.length > 0) {
//       const firstUrl = qrCode.url[0];
//       if (typeof firstUrl === "string") return firstUrl;
//       if (firstUrl && (firstUrl._ || firstUrl.$t))
//         return firstUrl._ || firstUrl.$t;
//     }
//   }

//   if (qrCode._ || qrCode.$t) return qrCode._ || qrCode.$t;

//   return "";
// };

// // Prefer Last_Website_Published_Date_Time, else fall back to root created_at attribute
// function getPublishedAtFromXml(property) {
//   const fromGLI =
//     property?.general_listing_information?.Last_Website_Published_Date_Time;
//   const fromAttr = property?.created_at; // xml2js attr (mergeAttrs: true)
//   return (
//     (fromGLI && String(fromGLI).trim()) ||
//     (fromAttr && String(fromAttr).trim()) ||
//     null
//   );
// }

// function parseXmlTsAsUTC(ts) {
//   if (!ts || typeof ts !== "string") return null;
//   const trimmed = ts.trim();
//   // "2025-08-07 17:12:38" -> "2025-08-07T17:12:38Z"
//   const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T") + "Z";
//   const d = new Date(iso);
//   return Number.isNaN(d.getTime()) ? null : d;
// }

// // Live checker
// const isPropertyLive = (propertyData) => {
//   const status = propertyData.general_listing_information?.status;
//   return status && status.toLowerCase() === "live";
// };

// // Classify listing type
// const determinePropertyType = (customFields) => {
//   const offeringType = customFields?.offering_type;
//   const completionStatus = customFields?.completion_status;

//   if (
//     completionStatus === "off_plan_primary" ||
//     completionStatus === "off_plan_secondary"
//   ) {
//     return {
//       type: "OffPlan",
//       listingType: "OffPlan",
//       reason: `completion_status is ${completionStatus}`,
//     };
//   }

//   if (offeringType === "RR") {
//     return {
//       type: "Rent",
//       listingType: "Rent",
//       reason: `offering_type is ${offeringType}`,
//     };
//   } else if (offeringType === "RS") {
//     return {
//       type: "Sale",
//       listingType: "Sale",
//       reason: `offering_type is ${offeringType}`,
//     };
//   } else if (offeringType === "CS" || offeringType === "CR") {
//     return {
//       type: "Commercial",
//       listingType: "Commercial",
//       reason: `offering_type is ${offeringType}`,
//     };
//   }

//   return {
//     type: "Sale",
//     listingType: "Sale",
//     reason: `Fallback - no clear classification found`,
//   };
// };

// const createPropertyDataForAgent = (propertyData) => {
//   const gi = propertyData.general_listing_information || {};
//   const ai = propertyData.address_information || {};
//   const cf = propertyData.custom_fields || {};

//   // Prefer GLI.Last_Website_Published_Date_Time → else fallback to propertyData.created_at (already mapped by you)
//   const publishedAtString =
//     (gi.Last_Website_Published_Date_Time &&
//       String(gi.Last_Website_Published_Date_Time).trim()) ||
//     propertyData.created_at ||
//     null;

//   const publishedAtDate = parseXmlTsAsUTC(publishedAtString);

//   let agentListingType = propertyData.listing_type || "Sale";
//   if (agentListingType === "OffPlan") agentListingType = "Off Plan";

//   return {
//     propertyId: propertyData.id,
//     listingTitle: gi.listing_title || "No Title",
//     listingType: agentListingType,
//     propertyType: propertyData.property_type || "Unknown",
//     price: gi.listingprice || "0",
//     currency: gi.currency_iso_code || "AED",
//     status: gi.status || "Active",
//     bedrooms: gi.bedrooms || "0",
//     bathrooms: gi.fullbathrooms || "0",
//     area: gi.totalarea || "0",
//     location: {
//       city: cf.city || ai.city || "",
//       address: cf.propertyfinder_region || ai.address || "",
//       community: cf.community || "",
//       building: cf.property_name || "",
//     },
//     images: propertyData.listing_media?.images?.image || [],
//     description: gi.description || "",

//     // These MUST mirror Last_Website_Published_Date_Time when present
//     addedDate: publishedAtDate || null, // Date
//     addedDateString: publishedAtString || "", // String

//     // keep lastUpdated as you had it (it’s fine)
//     lastUpdated:
//       parseXmlTsAsUTC(gi.Last_Website_Published_Date_Time) || new Date(),
//   };
// };
// const linkPropertyToAgent = async (propertyData) => {
//   try {
//     const listingAgent = propertyData.listing_agent;
//     if (!listingAgent?.listing_agent_email) {
//       return {
//         success: false,
//         operation: "skipped",
//         reason: "No agent email found in property data",
//       };
//     }

//     const agentEmail = listingAgent.listing_agent_email.toLowerCase().trim();
//     const existingAgent = await Agent.findByEmail(agentEmail);
//     if (!existingAgent) {
//       return {
//         success: false,
//         operation: "agent_not_found",
//         reason: `No active agent found with email: ${agentEmail}`,
//       };
//     }

//     const payload = createPropertyDataForAgent(propertyData);

//     // 1) Try update-in-place (positional operator) → force overwrite ALL fields incl. addedDate
//     const upd = await Agent.updateOne(
//       { _id: existingAgent._id, "properties.propertyId": propertyData.id },
//       { $set: { "properties.$": payload } }
//     );

//     if (upd.matchedCount > 0) {
//       return {
//         success: true,
//         operation: "property_updated",
//         agentEmail,
//         agentName: existingAgent.agentName,
//       };
//     }

//     // 2) Not present → push a fresh record
//     await Agent.updateOne(
//       { _id: existingAgent._id },
//       { $push: { properties: payload } }
//     );

//     return {
//       success: true,
//       operation: "property_added",
//       agentEmail,
//       agentName: existingAgent.agentName,
//     };
//   } catch (error) {
//     return { success: false, operation: "failed", error: error.message };
//   }
// };

// // Simple concurrency runner (no external deps)
// const runWithConcurrency = async (items, limit, worker) => {
//   const out = new Array(items.length);
//   let idx = 0;
//   const runners = Array(Math.min(limit, items.length))
//     .fill(0)
//     .map(async () => {
//       while (true) {
//         const i = idx++;
//         if (i >= items.length) break;
//         out[i] = await worker(items[i], i);
//       }
//     });
//   await Promise.all(runners);
//   return out;
// };

// /* ------------------------------- Controller ------------------------------- */

// const parseXmlFromUrl = async (req, res, next) => {
//   try {
//     const xmlUrl = process.env.XML_URL;
//     console.log(`Fetching XML from: ${xmlUrl}`);

//     const response = await axios.get(xmlUrl, {
//       headers: { Accept: "application/xml" },
//     });

//     const parser = new xml2js.Parser({
//       explicitArray: false,
//       mergeAttrs: true,
//       normalize: true,
//       normalizeTags: false,
//       trim: true,
//     });

//     console.log("Parsing XML data...");
//     const result = await parser.parseStringPromise(response.data);

//     let allProperties = [];

//     // Properties in result.list.property
//     if (result && result.list && result.list.property) {
//       allProperties = Array.isArray(result.list.property)
//         ? result.list.property
//         : [result.list.property];
//     } else {
//       // fallback: search anywhere
//       const findPropertiesArray = (obj) => {
//         for (const key in obj) {
//           if (
//             Array.isArray(obj[key]) &&
//             obj[key].length > 0 &&
//             obj[key][0] &&
//             (obj[key][0].general_listing_information || obj[key][0].Id)
//           ) {
//             return obj[key];
//           } else if (typeof obj[key] === "object" && obj[key] !== null) {
//             const found = findPropertiesArray(obj[key]);
//             if (found) return found;
//           }
//         }
//         return null;
//       };
//       const propertiesArray = findPropertiesArray(result);
//       if (propertiesArray) allProperties = propertiesArray;
//     }

//     console.log(`Found ${allProperties.length} properties in XML`);

//     // Transformer (maps created_at from Last_Website_Published_Date_Time)
//     const transformPropertyData = (property) => {
//       const classification = determinePropertyType(property.custom_fields);

//       const transformedProperty = {
//         id: property.Id || property.id,
//         mode: "CREATE",
//         created_at: getPublishedAtFromXml(property), // <- critical mapping
//         timestamp: property.timestamp,

//         // Base fields
//         offering_type: property.custom_fields?.offering_type || "RS",
//         property_type:
//           property.general_listing_information?.property_type || "apartment",
//         listing_type: classification.listingType,

//         address_information: property.address_information || {},

//         general_listing_information: {
//           listing_title:
//             property.general_listing_information?.listing_title || "",
//           updated: property.general_listing_information?.updated || "No",
//           listingprice:
//             property.general_listing_information?.listingprice || "0",
//           listingtype: classification.listingType,
//           currency_iso_code:
//             property.general_listing_information?.currency_iso_code || "AED",
//           property_type:
//             property.general_listing_information?.property_type || "apartment",
//           status: property.general_listing_information?.status || "Live",
//           totalarea: property.general_listing_information?.totalarea || "0",
//           description: property.general_listing_information?.description || "",
//           bedrooms: property.general_listing_information?.bedrooms || "0",
//           fullbathrooms:
//             property.general_listing_information?.fullbathrooms || "0",
//           propertytype:
//             property.general_listing_information?.property_type || "apartment",
//           property:
//             property.general_listing_information?.property_type || "apartment",
//         },

//         listing_agent: {
//           listing_agent_email:
//             property.listing_agent?.listing_agent_email || "",
//           listing_agent_firstname:
//             property.listing_agent?.listing_agent_firstname || "",
//           listing_agent_lastname:
//             property.listing_agent?.listing_agent_lastname || "",
//           listing_agent_mobil_phone:
//             property.listing_agent?.listing_agent_mobil_phone || "",
//           listing_agent_phone:
//             property.listing_agent?.listing_agent_phone ||
//             property.listing_agent?.listing_agent_mobil_phone ||
//             "",
//         },

//         custom_fields: {
//           property_record_id: property.custom_fields?.property_record_id || "",
//           permit_number: property.custom_fields?.permit_number || "",
//           offering_type: property.custom_fields?.offering_type || "",
//           price_on_application:
//             property.custom_fields?.price_on_application || "No",
//           payment_method: property.custom_fields?.payment_method || "",
//           city: property.custom_fields?.city || "",
//           community: property.custom_fields?.community || "",
//           sub_community: property.custom_fields?.sub_community || "",
//           property_name: property.custom_fields?.property_name || "",
//           propertyfinder_region:
//             property.custom_fields?.propertyfinder_region || "",
//           autonumber: property.custom_fields?.autonumber || "",
//           unitnumber: property.custom_fields?.unitnumber || "",
//           private_amenities: property.custom_fields?.private_amenities || "",
//           plot_size: property.custom_fields?.plot_size || "0",
//           developer: property.custom_fields?.developer || "",
//           completion_status:
//             property.custom_fields?.completion_status || "completed",
//           parking: property.custom_fields?.parking || "0",
//           furnished: property.custom_fields?.furnished || "No",
//           project_name: property.custom_fields?.project_name || "",
//           title_deed: property.custom_fields?.title_deed || "",
//           availability_date: property.custom_fields?.availability_date || "",
//           qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

//           community_name: property.custom_fields?.community || "",
//           tower_text: property.custom_fields?.property_name || "",
//           pba__addresstext_pb:
//             property.custom_fields?.propertyfinder_region || "",

//           pba_uaefields__completion_status:
//             property.custom_fields?.completion_status === "off_plan_primary" ||
//             property.custom_fields?.completion_status === "off_plan_secondary"
//               ? "Off Plan"
//               : "Completed",

//           sub_community_name: property.custom_fields?.sub_community || "",
//           building_name: property.custom_fields?.property_name || "",
//           rera_permit_number: property.custom_fields?.permit_number || "",
//           plot_area: property.custom_fields?.plot_size || "0",
//           completion_date: property.custom_fields?.availability_date || "",

//           ...Object.keys(property.custom_fields || {}).reduce((acc, key) => {
//             if (
//               !acc[key] &&
//               key !== "qr_code" &&
//               property.custom_fields[key] !== undefined
//             ) {
//               acc[key] = property.custom_fields[key];
//             }
//             return acc;
//           }, {}),
//         },

//         listing_media: {
//           images: {
//             image: (() => {
//               const images = property.listing_media?.images?.image;
//               if (!images) return [];
//               if (Array.isArray(images)) {
//                 return images
//                   .map((img) => {
//                     if (typeof img === "string") return { title: "", url: img };
//                     if (img.url) {
//                       if (typeof img.url === "string")
//                         return { title: img.title || "", url: img.url };
//                       if (Array.isArray(img.url)) {
//                         return img.url.map((urlItem) => ({
//                           title: urlItem.title || "",
//                           url: urlItem._ || urlItem.$t || urlItem,
//                         }));
//                       }
//                       if (img.url._ || img.url.$t) {
//                         return {
//                           title: img.url.title || "",
//                           url: img.url._ || img.url.$t,
//                         };
//                       }
//                     }
//                     return img;
//                   })
//                   .flat();
//               }
//               if (images.url) {
//                 if (Array.isArray(images.url)) {
//                   return images.url.map((urlItem) => ({
//                     title: urlItem.title || "",
//                     url: urlItem._ || urlItem.$t || urlItem,
//                   }));
//                 } else if (typeof images.url === "string") {
//                   return [{ title: images.title || "", url: images.url }];
//                 } else if (images.url._ || images.url.$t) {
//                   return [
//                     {
//                       title: images.url.title || "",
//                       url: images.url._ || images.url.$t,
//                     },
//                   ];
//                 }
//               }
//               return [];
//             })(),
//           },
//         },

//         qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

//         _classification: classification,
//       };

//       return transformedProperty;
//     };

//     const transformedProperties = allProperties.map(transformPropertyData);

//     // Validity by mode (kept same)
//     const validProperties = transformedProperties.filter((property) => {
//       const mode = property.mode;
//       if (mode === "CREATE" || mode === "CHANGE" || mode === "NEW") return true;
//       console.log(`Skipping property ${property.id} with mode: ${mode}`);
//       return false;
//     });

//     console.log(`Processing ${validProperties.length} properties`);

//     // Separate by status (keep non-Live but mark as NonActive)
//     const liveProperties = [];
//     const nonLiveProperties = [];

//     validProperties.forEach((property) => {
//       if (isPropertyLive(property)) {
//         liveProperties.push(property);
//       } else {
//         property._classification = {
//           type: "NonActive",
//           listingType: "NonActive",
//           reason: `Status is not Live: ${property.general_listing_information?.status}`,
//         };
//         property.listing_type = "NonActive";
//         property.general_listing_information.listingtype = "NonActive";
//         nonLiveProperties.push(property);
//       }
//     });

//     console.log(`Live properties: ${liveProperties.length}`);
//     console.log(`Non-Live properties: ${nonLiveProperties.length}`);

//     // Results tracker (same shape as before)
//     const missingAgentsSet = new Set();
//     const processResults = {
//       totalAttempted: validProperties.length,
//       livePropertiesAttempted: liveProperties.length,
//       nonLivePropertiesAttempted: nonLiveProperties.length,
//       successful: 0,
//       failed: 0,
//       skipped: allProperties.length - validProperties.length,
//       failures: [],
//       operations: {
//         created: 0,
//         updated: 0,
//         skipped_no_update: 0,
//         agentPropertiesAdded: 0,
//         agentPropertiesUpdated: 0,
//         agentNotFound: 0,
//         agentSkipped: 0,
//         agentSkippedNonActive: 0,
//         agentFailed: 0,
//       },
//       byType: {
//         Sale: { created: 0, updated: 0 },
//         Rent: { created: 0, updated: 0 },
//         OffPlan: { created: 0, updated: 0 },
//         Commercial: { created: 0, updated: 0 },
//         NonActive: { created: 0, updated: 0 },
//       },
//       classificationStats: {
//         byCompletionStatus: {},
//         byOfferingType: {},
//         fallbacks: 0,
//       },
//     };

//     // Aggregate stats by completion/offering/fallbacks
//     const allPropertiesToProcess = [...liveProperties, ...nonLiveProperties];
//     for (const property of allPropertiesToProcess) {
//       const completionStatus = property.custom_fields?.completion_status;
//       const offeringType = property.custom_fields?.offering_type;
//       const classification = property._classification;

//       if (completionStatus) {
//         processResults.classificationStats.byCompletionStatus[
//           completionStatus
//         ] =
//           (processResults.classificationStats.byCompletionStatus[
//             completionStatus
//           ] || 0) + 1;
//       }
//       if (offeringType) {
//         processResults.classificationStats.byOfferingType[offeringType] =
//           (processResults.classificationStats.byOfferingType[offeringType] ||
//             0) + 1;
//       }
//       if (classification && classification.reason.includes("Fallback")) {
//         processResults.classificationStats.fallbacks++;
//       }
//     }

//     /* ----------------------------- BULK UPSERT ----------------------------- */

//     // preload existence
//        const ids = allPropertiesToProcess.map(p => p.id);

//     // Find data form database through the SalesForce ids
//     const existingProps = await Property.find(
//       { id: { $in: ids } },
//       { id: 1, created_at: 1, address_information: 1 }
//     ).lean();

//     const existsMap = new Map(existingProps.map(p => [p.id, p]));

//     const propertyOps = [];
//     const mainOpById = new Map();

//     for (const propertyData of allPropertiesToProcess) {
//       const id = propertyData.id;
//       const existing = existsMap.get(id);
//       const existed = !!existing;
//       const updateFlag = propertyData.general_listing_information?.updated;

//       if (existed && updateFlag === 'No') {
//         const updates = {};
//         let shouldUpdate = false;
//         if (
//           propertyData.created_at &&
//           propertyData.created_at !== existing.created_at
//         ) {
//           updates.created_at = propertyData.created_at;
//           shouldUpdate = true;
//           console.log(`[${id}] 📅 Updating created_at:`, propertyData.created_at);
//         }
//         if (propertyData.address_information && Object.keys(propertyData.address_information).length > 0) {
//           updates.address_information = propertyData.address_information;
//           shouldUpdate = true;
//           console.log(`[${id}] 📍 Adding/Updating address_information:`, propertyData.address_information);
//         }
//         if (shouldUpdate) {
//           propertyOps.push({
//             updateOne: {
//               filter: { id },
//               update: { $set: updates },
//               upsert: false,
//             }
//           });
//           const updateFields = Object.keys(updates).join(' & ');
//           mainOpById.set(id, 'updated_partial');
//           console.log(`[${id}] ✏️  Queueing partial update: ${updateFields}`);
//         } else {
//           mainOpById.set(id, 'skipped_no_update');
//           console.log(`[${id}] ⏭️  Skipped - no changes needed`);
//         }
//         continue;
//       }

//       const $set = {
//         created_at: propertyData.created_at,
//         timestamp: propertyData.timestamp,
//         address_information: propertyData.address_information,
//         general_listing_information: propertyData.general_listing_information,
//         listing_agent: propertyData.listing_agent,
//         listing_media: propertyData.listing_media,
//         custom_fields: propertyData.custom_fields,
//         qr_code: propertyData.qr_code,
//         offering_type: propertyData.offering_type,
//         property_type: propertyData.property_type,
//         listing_type: propertyData.listing_type,
//         _classification: propertyData._classification,
//       };

//       propertyOps.push({
//         updateOne: {
//           filter: { id },
//           update: { $set, $setOnInsert: { id } },
//           upsert: true,
//         }
//       });
//       const opType = existed ? 'updated' : 'created';
//       mainOpById.set(id, opType);
//       console.log(`[${id}] ${existed ? '🔄' : '✨'} Queueing full ${opType}`);
//     }

//     if (propertyOps.length) {
//       console.log(`\n🚀 Executing bulk write with ${propertyOps.length} operations...`);
//       await Property.bulkWrite(propertyOps, { ordered: false });
//       console.log('✅ Bulk write completed successfully!\n');
//     } else {
//       console.log('⏭️  No operations to execute - all properties skipped\n');
//     }

//     // Stats tracking
//     for (const propertyData of allPropertiesToProcess) {
//       const id = propertyData.id;
//       const op = mainOpById.get(id);

//       if (!op) {
//         processResults.failed++;
//         processResults.failures.push({
//           id,
//           status: propertyData.general_listing_information?.status || 'Unknown',
//           classification: propertyData._classification,
//           error: 'No main operation recorded'
//         });
//         console.log(`❌ [${id}] FAILED - no operation recorded`);
//         continue;
//       }

//       if (op === 'created') {
//         processResults.successful++;
//         processResults.operations.created++;
//         const lt = propertyData._classification?.listingType;
//         if (lt && processResults.byType[lt]) processResults.byType[lt].created++;
//         console.log(`✅ [${id}] Created`);
//       } else if (op === 'updated' || op === 'updated_partial') {
//         processResults.successful++;
//         processResults.operations.updated++;
//         const lt = propertyData._classification?.listingType;
//         if (lt && processResults.byType[lt]) processResults.byType[lt].updated++;
//         console.log(`✅ [${id}] Updated`);
//       } else if (op === 'skipped_no_update') {
//         processResults.successful++;
//         processResults.operations.skipped_no_update++;
//         console.log(`⏭️  [${id}] Skipped`);
//       }
//     }


//     /* ----------------------- PARALLEL AGENT LINKING ----------------------- */

//     const liveForLinking = allPropertiesToProcess.filter(
//       (p) =>
//         (p.general_listing_information?.status || "").toLowerCase() === "live"
//     );

//     const agentResults = await runWithConcurrency(
//       liveForLinking,
//       10,
//       async (propertyData) => {
//         const agentEmail =
//           propertyData.listing_agent?.listing_agent_email?.toLowerCase();

//         if (!agentEmail) {
//           return { id: propertyData.id, outcome: "skipped_no_agent" };
//         }

//         try {
//           const res = await linkPropertyToAgent(propertyData);
//           if (res.success) {
//             return { id: propertyData.id, outcome: res.operation };
//           } else {
//             // collect "agent_not_found" details in missingAgentsSet
//             if (res.operation === "agent_not_found") {
//               missingAgentsSet.add(
//                 JSON.stringify({
//                   email: agentEmail,
//                   propertyId: propertyData.id,
//                   agentName: `${
//                     propertyData.listing_agent?.listing_agent_firstname || ""
//                   } ${
//                     propertyData.listing_agent?.listing_agent_lastname || ""
//                   }`.trim(),
//                   phone:
//                     propertyData.listing_agent?.listing_agent_mobil_phone ||
//                     propertyData.listing_agent?.listing_agent_phone ||
//                     "N/A",
//                   propertyStatus:
//                     propertyData.general_listing_information?.status,
//                   propertyWasSkipped:
//                     mainOpById.get(propertyData.id) === "skipped_no_update",
//                 })
//               );
//             }
//             return { id: propertyData.id, outcome: res.operation || "failed" };
//           }
//         } catch (e) {
//           return { id: propertyData.id, outcome: "failed", error: e.message };
//         }
//       }
//     );

//     // fold agent results into counters/logs
//     for (const r of agentResults) {
//       if (r.outcome === "property_added")
//         processResults.operations.agentPropertiesAdded++;
//       else if (r.outcome === "property_updated")
//         processResults.operations.agentPropertiesUpdated++;
//       else if (r.outcome === "agent_not_found")
//         processResults.operations.agentNotFound++;
//       else if (r.outcome === "skipped")
//         processResults.operations.agentSkipped++;
//       else if (r.outcome === "skipped_no_agent")
//         processResults.operations.agentSkipped++;
//       else if (r.outcome === "skipped_not_live")
//         processResults.operations.agentSkippedNonActive++;
//       else if (r.outcome === "failed") processResults.operations.agentFailed++;
//     }

//     /* ----------------------------- Missing Agents ----------------------------- */

//     const missingAgentsList = Array.from(missingAgentsSet).map((item) =>
//       JSON.parse(item)
//     );

//     const missingAgentsSummary = missingAgentsList.reduce((acc, agent) => {
//       if (!acc[agent.email]) {
//         acc[agent.email] = {
//           email: agent.email,
//           agentName: agent.agentName,
//           phone: agent.phone,
//           propertyCount: 0,
//           properties: [],
//         };
//       }
//       acc[agent.email].propertyCount++;
//       acc[agent.email].properties.push({
//         propertyId: agent.propertyId,
//         status: agent.propertyStatus,
//       });
//       return acc;
//     }, {});

//     const missingAgentsArray = Object.values(missingAgentsSummary);

//     /* --------------------------------- Finish -------------------------------- */

//     console.log("=== DATABASE PROCESSING COMPLETED ===");
//     console.log(
//       `Successfully processed: ${processResults.successful} properties`
//     );
//     console.log(`Failed: ${processResults.failed} properties`);
//     console.log(`Skipped: ${processResults.skipped} properties (invalid data)`);
//     console.log(`Live properties: ${processResults.livePropertiesAttempted}`);
//     console.log(
//       `Non-Live properties: ${processResults.nonLivePropertiesAttempted}`
//     );
//     console.log(
//       `Operations: Created ${processResults.operations.created}, Updated ${processResults.operations.updated}`
//     );
//     console.log(
//       `Agent Operations: Added ${processResults.operations.agentPropertiesAdded}, ` +
//         `Updated ${processResults.operations.agentPropertiesUpdated}, ` +
//         `Not Found ${processResults.operations.agentNotFound}, ` +
//         `Skipped ${processResults.operations.agentSkippedNonActive}`
//     );
//     console.log(`By Type:`, processResults.byType);

//     console.log(
//       `\n⚠️  Missing Agents: ${missingAgentsArray.length} unique agents not found`
//     );
//     if (missingAgentsArray.length > 0) {
//       console.log("\n🔍 Top Missing Agents:");
//       missingAgentsArray.slice(0, 10).forEach((agent, index) => {
//         console.log(`   ${index + 1}. ${agent.email}`);
//         console.log(`      Name: ${agent.agentName || "N/A"}`);
//         console.log(`      Phone: ${agent.phone}`);
//         console.log(`      Properties: ${agent.propertyCount}`);
//       });
//       if (missingAgentsArray.length > 10) {
//         console.log(`   ... and ${missingAgentsArray.length - 10} more agents`);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message:
//         "✅ XML data processed successfully - All properties saved with bulkWrite and agent linking",
//       totalPropertiesInXml: allProperties.length,
//       processedProperties: validProperties.length,
//       liveProperties: liveProperties.length,
//       nonLiveProperties: nonLiveProperties.length,
//       skippedProperties: processResults.skipped,
//       databaseResults: {
//         propertiesProcessed: processResults.successful,
//         propertiesFailed: processResults.failed,
//         operations: processResults.operations,
//         byType: processResults.byType,
//         classificationStats: processResults.classificationStats,
//         failures: processResults.failures.slice(0, 5),
//       },
//       missingAgents: {
//         total: missingAgentsArray.length,
//         totalPropertiesAffected: missingAgentsList.length,
//         agents: missingAgentsArray,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error parsing XML:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to parse XML",
//       error: error.message,
//     });
//   }
// };

// /* ------------------------------- Scheduler ------------------------------- */

// // Cron job for every 2 hours — call controller directly (no HTTP call)
// const schedulePropertySync = () => {
//   const TZ = process.env.CRON_TZ || "Etc/UTC";
//   cron.schedule(
//     "*/150 * * * *",
//     async () => {
//       const startedAt = new Date().toISOString();
//       console.log(`🔄 [${startedAt}] Starting scheduled property sync...`);

//       const fakeReq = {};
//       const fakeRes = {
//         _status: 200,
//         status(code) {
//           this._status = code;
//           return this;
//         },
//         json(payload) {
//           try {
//             const summary = {
//               success: payload?.success,
//               totalPropertiesInXml: payload?.totalPropertiesInXml,
//               processedProperties: payload?.processedProperties,
//               liveProperties: payload?.liveProperties,
//               nonLiveProperties: payload?.nonLiveProperties,
//               skippedProperties: payload?.skippedProperties,
//             };
//             console.log(
//               `✅ [${new Date().toISOString()}] Property sync completed:`,
//               summary
//             );
//           } catch (e) {
//             console.log(
//               `✅ [${new Date().toISOString()}] Property sync completed.`
//             );
//           }
//           return payload;
//         },
//       };

//       try {
//         await parseXmlFromUrl(fakeReq, fakeRes);
//       } catch (error) {
//         console.error(
//           `❌ [${new Date().toISOString()}] Property sync failed:`,
//           error.message
//         );
//       }
//     },
//     { timezone: TZ }
//   );

//   console.log("⏰ Property sync scheduler initialized - Running every 2 hours");
// };

// // Deleting function for properties not in the XML file
// async function fetchAllXmlPropertyIds() {
//   console.log("🔎 Searching ids in XML...");
//   const xmlUrl = process.env.XML_URL;
//   if (!xmlUrl) throw new Error("XML_URL is not configured");

//   const response = await axios.get(xmlUrl, {
//     headers: { Accept: "application/xml" },
//     timeout: 120000, // 120s
//     maxBodyLength: Infinity,
//     maxContentLength: Infinity,
//   });

//   const parser = new xml2js.Parser({
//     explicitArray: false,
//     mergeAttrs: true,
//     normalize: true,
//     normalizeTags: false,
//     trim: true,
//   });

//   const result = await parser.parseStringPromise(response.data);

//   let xmlProps = [];
//   if (result?.list?.property) {
//     xmlProps = Array.isArray(result.list.property)
//       ? result.list.property
//       : [result.list.property];
//   } else {
//     const findPropertiesArray = (obj) => {
//       for (const key in obj) {
//         if (
//           Array.isArray(obj[key]) &&
//           obj[key].length > 0 &&
//           obj[key][0] &&
//           (obj[key][0].Id || obj[key][0].general_listing_information)
//         )
//           return obj[key];
//         else if (typeof obj[key] === "object" && obj[key] !== null) {
//           const found = findPropertiesArray(obj[key]);
//           if (found) return found;
//         }
//       }
//       return null;
//     };
//     const arr = findPropertiesArray(result);
//     if (arr) xmlProps = arr;
//   }

//   const xmlIdSet = new Set();
//   for (const p of xmlProps) {
//     const raw = p?.Id || p?.id;
//     if (typeof raw === "string") {
//       const norm = raw.trim();
//       if (norm) xmlIdSet.add(norm);
//     }
//   }
//   console.log(`📦 XML has ${xmlIdSet.size} ids.`);
//   return xmlIdSet;
// }

// const cleanupMissingProperties = async (req, res) => {
//   try {
//     console.log("🧹 Deleter function running!");
//     const dryRun = String(req.query?.dryRun ?? "0") === "1";
//     const returnIds = String(req.query?.returnIds ?? "0") === "1"; // include sample ids in HTTP response
//     const progressEvery = Number(req.query?.progressEvery ?? 5000); // log frequency
//     const sampleCap = Number(req.query?.sampleCap ?? 100); // how many ids to echo in response
//     const deleteChunkSize = Number(req.query?.deleteChunkSize ?? 5000); // delete in chunks
//     const agentChunkSize = Number(req.query?.agentChunkSize ?? 5000); // $pull in chunks

//     // 1) XML ids as a Set
//     const xmlIds = await fetchAllXmlPropertyIds();

//     // 2) Stream DB ids via cursor (fast & low memory)
//     const cursor = Property.find({}, { id: 1 })
//       .lean()
//       .cursor({ batchSize: 5000 });

//     const missing = [];
//     let scanned = 0;
//     let printedCount = 0;

//     console.time("⏱️ missing-diff");
//     for await (const doc of cursor) {
//       scanned++;
//       const id = typeof doc?.id === "string" ? doc.id.trim() : null;
//       if (!id) continue;

//       if (!xmlIds.has(id)) {
//         missing.push(id);
//         // Log first few missing immediately so you can SEE progress
//         if (printedCount < 10) {
//           console.log(`❗ Missing found: ${id}`);
//           printedCount++;
//         }
//       }

//       if (scanned % progressEvery === 0) {
//         console.log(
//           `...scanned ${scanned} DB docs; missing so far: ${missing.length}`
//         );
//       }
//     }
//     console.timeEnd("⏱️ missing-diff");

//     // 3) Nothing to do?
//     if (missing.length === 0) {
//       console.log(
//         `✅ DB is in sync. Scanned ${scanned} docs, XML=${xmlIds.size}`
//       );
//       return res.status(200).json({
//         success: true,
//         message: "No missing properties. DB is in sync with XML.",
//         dryRun,
//         counts: { xmlCount: xmlIds.size, dbScanned: scanned, toDelete: 0 },
//       });
//     }

//     // If DRY RUN: preview + return a small sample
//     if (dryRun) {
//       console.log(
//         `🟡 DRY-RUN: would delete ${missing.length} properties. Example:`,
//         missing.slice(0, 10)
//       );
//       return res.status(200).json({
//         success: true,
//         message:
//           "Dry-run: the following properties would be deleted and unlinked from agents.",
//         dryRun: true,
//         counts: {
//           xmlCount: xmlIds.size,
//           dbScanned: scanned,
//           toDelete: missing.length,
//         },
//         sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
//       });
//     }

//     // 4) EXECUTE: delete in CHUNKS (avoid giant single op stalls)
//     let deletedTotal = 0;
//     console.time("⏱️ delete-properties");
//     for (let i = 0; i < missing.length; i += deleteChunkSize) {
//       const chunk = missing.slice(i, i + deleteChunkSize);
//       const delRes = await Property.deleteMany({ id: { $in: chunk } });
//       deletedTotal += delRes?.deletedCount ?? 0;
//       console.log(
//         `🗑️ Deleted chunk ${i}-${i + chunk.length - 1} (size=${
//           chunk.length
//         }) → removed ${delRes?.deletedCount ?? 0}`
//       );
//     }
//     console.timeEnd("⏱️ delete-properties");

//     // 5) Unlink from agents in CHUNKS
//     let agentsUpdatedTotal = 0;
//     console.time("⏱️ unlink-agents");
//     for (let i = 0; i < missing.length; i += agentChunkSize) {
//       const chunk = missing.slice(i, i + agentChunkSize);
//       const pullRes = await Agent.updateMany(
//         {},
//         { $pull: { properties: { propertyId: { $in: chunk } } } }
//       );
//       agentsUpdatedTotal += pullRes?.modifiedCount ?? 0;
//       console.log(
//         `🔗 Unlinked chunk ${i}-${i + chunk.length - 1} (size=${
//           chunk.length
//         }) → agents modified ${pullRes?.modifiedCount ?? 0}`
//       );
//     }
//     console.timeEnd("⏱️ unlink-agents");

//     // 6) Done
//     console.log(
//       `✅ Cleanup complete. Deleted ${deletedTotal}, agent docs updated ${agentsUpdatedTotal}.`
//     );
//     return res.status(200).json({
//       success: true,
//       message:
//         "Cleanup complete: removed properties not present in XML and unlinked from agents.",
//       dryRun: false,
//       counts: {
//         xmlCount: xmlIds.size,
//         dbScanned: scanned,
//         deletedProperties: deletedTotal,
//         agentsUpdated: agentsUpdatedTotal,
//         affectedPropertyIds: missing.length,
//       },
//       sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
//     });
//   } catch (err) {
//     console.error("❌ cleanupMissingProperties error:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Cleanup failed",
//       error: err.message,
//     });
//   }
// };

// module.exports = {
//   parseXmlFromUrl,
//   schedulePropertySync,
//   cleanupMissingProperties, 

// };
// Dependencies
const axios = require("axios");
const xml2js = require("xml2js");
const Property = require("../Models/PropertyModel");
const Agent = require("../Models/AgentModel");
const cron = require("node-cron");

/* -------------------------------------------------------------------------- */
/*                              Helpers & Utilities                           */
/* -------------------------------------------------------------------------- */

/**
 * Check if MongoDB is ready for queries for a given Mongoose model.
 * Avoids running logic while the DB is still connecting (which can cause buffering timeouts).
 */
const isMongoConnected = (model) => {
  try {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    return model?.db?.readyState === 1;
  } catch {
    // If anything goes wrong reading readyState, treat as "not connected".
    return false;
  }
};

/**
 * Extract a QR code URL from various possible XML shapes.
 * The XML might place the URL as:
 *  - a simple string
 *  - qrCode.url as a string
 *  - qrCode.url as an object with `_` or `$t`
 *  - qrCode.url as an array of such items
 */
const extractQRCodeUrl = (qrCode) => {
  if (!qrCode) return "";

  // If it's just a string, assume that's the URL.
  if (typeof qrCode === "string") return qrCode;

  // If it's an object with a `url` field.
  if (qrCode.url) {
    if (typeof qrCode.url === "string") return qrCode.url;

    // Sometimes xml2js maps text content to `_` or `$t`.
    if (typeof qrCode.url === "object") {
      if (qrCode.url._) return qrCode.url._;
      if (qrCode.url.$t) return qrCode.url.$t;
    }

    // If `url` is an array, try the first element.
    if (Array.isArray(qrCode.url) && qrCode.url.length > 0) {
      const firstUrl = qrCode.url[0];
      if (typeof firstUrl === "string") return firstUrl;
      if (firstUrl && (firstUrl._ || firstUrl.$t))
        return firstUrl._ || firstUrl.$t;
    }
  }

  // Or directly on the object.
  if (qrCode._ || qrCode.$t) return qrCode._ || qrCode.$t;

  return "";
};

/**
 * Prefer Last_Website_Published_Date_Time from general_listing_information,
 * else fall back to the root-level `created_at` attribute (mapped by xml2js).
 */
const getPublishedAtFromXml = (property) => {
  const fromGLI =
    property?.general_listing_information?.Last_Website_Published_Date_Time;
  const fromAttr = property?.created_at; // xml2js attr (because of mergeAttrs: true)

  return (
    (fromGLI && String(fromGLI).trim()) ||
    (fromAttr && String(fromAttr).trim()) ||
    null
  );
};

/**
 * Parse a timestamp string from the XML into a JS Date (UTC).
 * Expected format examples:
 *   "2025-08-07 17:12:38"
 *   "2025-08-07T17:12:38"
 * We normalize it to "YYYY-MM-DDTHH:mm:ssZ".
 */
const parseXmlTsAsUTC = (ts) => {
  if (!ts || typeof ts !== "string") return null;

  const trimmed = ts.trim();

  // If it already has 'T', we assume ISO-like. Otherwise, inject 'T' and 'Z'.
  const iso = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T") + "Z";

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Determine whether a property is currently "Live".
 */
const isPropertyLive = (propertyData) => {
  const status = propertyData.general_listing_information?.status;
  return status && status.toLowerCase() === "live";
};

/**
 * Classify the listing based on custom_fields:
 * - OffPlan (for off_plan_primary / off_plan_secondary)
 * - Rent (offering_type === "RR")
 * - Sale (offering_type === "RS")
 * - Commercial (offering_type === "CS" or "CR")
 * - Fallback to Sale (if nothing matches)
 */
const determinePropertyType = (customFields) => {
  const offeringType = customFields?.offering_type;
  const completionStatus = customFields?.completion_status;

  if (
    completionStatus === "off_plan_primary" ||
    completionStatus === "off_plan_secondary"
  ) {
    return {
      type: "OffPlan",
      listingType: "OffPlan",
      reason: `completion_status is ${completionStatus}`,
    };
  }

  if (offeringType === "RR") {
    return {
      type: "Rent",
      listingType: "Rent",
      reason: `offering_type is ${offeringType}`,
    };
  } else if (offeringType === "RS") {
    return {
      type: "Sale",
      listingType: "Sale",
      reason: `offering_type is ${offeringType}`,
    };
  } else if (offeringType === "CS" || offeringType === "CR") {
    return {
      type: "Commercial",
      listingType: "Commercial",
      reason: `offering_type is ${offeringType}`,
    };
  }

  // Default when we don’t have clear classification
  return {
    type: "Sale",
    listingType: "Sale",
    reason: "Fallback - no clear classification found",
  };
};

/**
 * Create an "agent-friendly" property entry to be stored inside Agent.properties[].
 * This compresses the full property into a summary for agents + sets addedDate & lastUpdated.
 */
const createPropertyDataForAgent = (propertyData) => {
  const gi = propertyData.general_listing_information || {};
  const ai = propertyData.address_information || {};
  const cf = propertyData.custom_fields || {};

  // Prefer GLI.Last_Website_Published_Date_Time → else fallback to propertyData.created_at
  const publishedAtString =
    (gi.Last_Website_Published_Date_Time &&
      String(gi.Last_Website_Published_Date_Time).trim()) ||
    propertyData.created_at ||
    null;

  const publishedAtDate = parseXmlTsAsUTC(publishedAtString);

  let agentListingType = propertyData.listing_type || "Sale";
  // Human-friendly spacing for "Off Plan"
  if (agentListingType === "OffPlan") agentListingType = "Off Plan";

  return {
    propertyId: propertyData.id,
    listingTitle: gi.listing_title || "No Title",
    listingType: agentListingType,
    propertyType: propertyData.property_type || "Unknown",
    price: gi.listingprice || "0",
    currency: gi.currency_iso_code || "AED",
    status: gi.status || "Active",
    bedrooms: gi.bedrooms || "0",
    bathrooms: gi.fullbathrooms || "0",
    area: gi.totalarea || "0",

    // Location info resolved from both custom_fields and address_information
    location: {
      city: cf.city || ai.city || "",
      address: cf.propertyfinder_region || ai.address || "",
      community: cf.community || "",
      building: cf.property_name || "",
    },

    images: propertyData.listing_media?.images?.image || [],
    description: gi.description || "",

    // These mirror Last_Website_Published_Date_Time / created_at
    addedDate: publishedAtDate || null, // JS Date
    addedDateString: publishedAtString || "", // human-readable string

    // lastUpdated still tracks when the property was last published/updated
    lastUpdated:
      parseXmlTsAsUTC(gi.Last_Website_Published_Date_Time) || new Date(),
  };
};

/**
 * Link a single property to its listing agent.
 * - Find the Agent by email.
 * - Either update an existing property inside Agent.properties[]
 *   or push a new property entry.
 */
const linkPropertyToAgent = async (propertyData) => {
  try {
    const listingAgent = propertyData.listing_agent;

    // If there is no agent email, we cannot link anything.
    if (!listingAgent?.listing_agent_email) {
      return {
        success: false,
        operation: "skipped",
        reason: "No agent email found in property data",
      };
    }

    const agentEmail = listingAgent.listing_agent_email.toLowerCase().trim();

    // Custom static method on Agent model to find an active agent by email.
    const existingAgent = await Agent.findByEmail(agentEmail);

    if (!existingAgent) {
      return {
        success: false,
        operation: "agent_not_found",
        reason: `No active agent found with email: ${agentEmail}`,
      };
    }

    // Build the compact property payload for the agent.
    const payload = createPropertyDataForAgent(propertyData);

    // 1) Try to update an existing property entry (matched by propertyId)
    const upd = await Agent.updateOne(
      { _id: existingAgent._id, "properties.propertyId": propertyData.id },
      { $set: { "properties.$": payload } }
    );

    if (upd.matchedCount > 0) {
      return {
        success: true,
        operation: "property_updated",
        agentEmail,
        agentName: existingAgent.agentName,
      };
    }

    // 2) If property not found in Agent, push a new one
    await Agent.updateOne(
      { _id: existingAgent._id },
      { $push: { properties: payload } }
    );

    return {
      success: true,
      operation: "property_added",
      agentEmail,
      agentName: existingAgent.agentName,
    };
  } catch (error) {
    return { success: false, operation: "failed", error: error.message };
  }
};

/**
 * Simple concurrency runner without external deps.
 * Runs at most `limit` workers in parallel over an array of items.
 */
const runWithConcurrency = async (items, limit, worker) => {
  const out = new Array(items.length); // output array
  let idx = 0; // shared index for workers

  const runners = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) break;
        out[i] = await worker(items[i], i);
      }
    });

  await Promise.all(runners);
  return out;
};

/* -------------------------------------------------------------------------- */
/*                                  Controller                                */
/* -------------------------------------------------------------------------- */

/**
 * Main controller:
 * - Fetch XML feed from XML_URL.
 * - Parse and normalize properties.
 * - Bulk upsert into Property collection.
 * - Link Live properties to agents.
 * - Collect and return statistics.
 */
const parseXmlFromUrl = async (req, res, next) => {
  try {
    // Guard: avoid Mongoose buffering timeout if DB isn't ready
    if (!isMongoConnected(Property)) {
      console.error(
        "❌ parseXmlFromUrl aborted: MongoDB is not connected (properties collection)."
      );
      return res.status(503).json({
        success: false,
        message:
          "Database connection is not ready yet. Please retry the property sync in a moment.",
      });
    }

    const xmlUrl = process.env.XML_URL;
    console.log(`Fetching XML from: ${xmlUrl}`);

    // Fetch raw XML from remote URL
    const response = await axios.get(xmlUrl, {
      headers: { Accept: "application/xml" },
    });

    // Configure xml2js parser
    const parser = new xml2js.Parser({
      explicitArray: false, // don't wrap single elements in arrays
      mergeAttrs: true, // merge attributes into the element object
      normalize: true,
      normalizeTags: false,
      trim: true,
    });

    console.log("Parsing XML data...");
    const result = await parser.parseStringPromise(response.data);

    let allProperties = [];

    // Most common structure: result.list.property
    if (result && result.list && result.list.property) {
      allProperties = Array.isArray(result.list.property)
        ? result.list.property
        : [result.list.property];
    } else {
      // Fallback: recursively search for an array that looks like properties
      const findPropertiesArray = (obj) => {
        for (const key in obj) {
          if (
            Array.isArray(obj[key]) &&
            obj[key].length > 0 &&
            obj[key][0] &&
            (obj[key][0].general_listing_information || obj[key][0].Id)
          ) {
            return obj[key];
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            const found = findPropertiesArray(obj[key]);
            if (found) return found;
          }
        }
        return null;
      };

      const propertiesArray = findPropertiesArray(result);
      if (propertiesArray) allProperties = propertiesArray;
    }

    console.log(`Found ${allProperties.length} properties in XML`);

    /**
     * Transform raw XML property object into a normalized structure
     * that fits the Property model and internal structure.
     */
    const transformPropertyData = (property) => {
      const classification = determinePropertyType(property.custom_fields);

      const transformedProperty = {
        id: property.Id || property.id, // property ID from XML
        mode: "CREATE", // default mode; can be extended if needed
        created_at: getPublishedAtFromXml(property), // timestamp mapping (critical)
        timestamp: property.timestamp,

        // High-level classification fields
        offering_type: property.custom_fields?.offering_type || "RS",
        property_type:
          property.general_listing_information?.property_type || "apartment",
        listing_type: classification.listingType,

        // Address information from XML
        address_information: property.address_information || {},

        // General listing details
        general_listing_information: {
          listing_title:
            property.general_listing_information?.listing_title || "",
          updated: property.general_listing_information?.updated || "No",
          listingprice:
            property.general_listing_information?.listingprice || "0",
          listingtype: classification.listingType,
          currency_iso_code:
            property.general_listing_information?.currency_iso_code || "AED",
          property_type:
            property.general_listing_information?.property_type || "apartment",
          status: property.general_listing_information?.status || "Live",
          totalarea: property.general_listing_information?.totalarea || "0",
          description: property.general_listing_information?.description || "",
          bedrooms: property.general_listing_information?.bedrooms || "0",
          fullbathrooms:
            property.general_listing_information?.fullbathrooms || "0",
          // Some feeds repeat property type under different fields
          propertytype:
            property.general_listing_information?.property_type || "apartment",
          property:
            property.general_listing_information?.property_type || "apartment",
        },

        // Listing agent info
        listing_agent: {
          listing_agent_email:
            property.listing_agent?.listing_agent_email || "",
          listing_agent_firstname:
            property.listing_agent?.listing_agent_firstname || "",
          listing_agent_lastname:
            property.listing_agent?.listing_agent_lastname || "",
          listing_agent_mobil_phone:
            property.listing_agent?.listing_agent_mobil_phone || "",
          listing_agent_phone:
            property.listing_agent?.listing_agent_phone ||
            property.listing_agent?.listing_agent_mobil_phone ||
            "",
        },

        // Custom fields, plus some remapped ones for easier querying
        custom_fields: {
          property_record_id: property.custom_fields?.property_record_id || "",
          permit_number: property.custom_fields?.permit_number || "",
          offering_type: property.custom_fields?.offering_type || "",
          price_on_application:
            property.custom_fields?.price_on_application || "No",
          payment_method: property.custom_fields?.payment_method || "",
          city: property.custom_fields?.city || "",
          community: property.custom_fields?.community || "",
          sub_community: property.custom_fields?.sub_community || "",
          property_name: property.custom_fields?.property_name || "",
          propertyfinder_region:
            property.custom_fields?.propertyfinder_region || "",
          autonumber: property.custom_fields?.autonumber || "",
          unitnumber: property.custom_fields?.unitnumber || "",
          private_amenities: property.custom_fields?.private_amenities || "",
          plot_size: property.custom_fields?.plot_size || "0",
          developer: property.custom_fields?.developer || "",
          completion_status:
            property.custom_fields?.completion_status || "completed",
          parking: property.custom_fields?.parking || "0",
          furnished: property.custom_fields?.furnished || "No",
          project_name: property.custom_fields?.project_name || "",
          title_deed: property.custom_fields?.title_deed || "",
          availability_date: property.custom_fields?.availability_date || "",
          qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

          // Extra aliases mapped for your app / front-end
          community_name: property.custom_fields?.community || "",
          tower_text: property.custom_fields?.property_name || "",
          pba__addresstext_pb:
            property.custom_fields?.propertyfinder_region || "",

          // Derived completion status in human-readable words
          pba_uaefields__completion_status:
            property.custom_fields?.completion_status === "off_plan_primary" ||
            property.custom_fields?.completion_status === "off_plan_secondary"
              ? "Off Plan"
              : "Completed",

          sub_community_name: property.custom_fields?.sub_community || "",
          building_name: property.custom_fields?.property_name || "",
          rera_permit_number: property.custom_fields?.permit_number || "",
          plot_area: property.custom_fields?.plot_size || "0",
          completion_date: property.custom_fields?.availability_date || "",

          // Merge all remaining custom fields WITHOUT overwriting the above
          ...Object.keys(property.custom_fields || {}).reduce((acc, key) => {
            if (
              !acc[key] &&
              key !== "qr_code" && // we’ve already handled qr_code above
              property.custom_fields[key] !== undefined
            ) {
              acc[key] = property.custom_fields[key];
            }
            return acc;
          }, {}),
        },

        // Images / media normalization
        listing_media: {
          images: {
            image: (() => {
              const images = property.listing_media?.images?.image;
              if (!images) return [];

              // If it's already an array, normalize each element.
              if (Array.isArray(images)) {
                return images
                  .map((img) => {
                    // Plain string = URL
                    if (typeof img === "string") {
                      return { title: "", url: img };
                    }

                    // Object with img.url in various shapes
                    if (img.url) {
                      // url as string
                      if (typeof img.url === "string") {
                        return { title: img.title || "", url: img.url };
                      }

                      // url as array
                      if (Array.isArray(img.url)) {
                        return img.url.map((urlItem) => ({
                          title: urlItem.title || "",
                          url: urlItem._ || urlItem.$t || urlItem,
                        }));
                      }

                      // url as object with `_` or `$t`
                      if (img.url._ || img.url.$t) {
                        return {
                          title: img.url.title || "",
                          url: img.url._ || img.url.$t,
                        };
                      }
                    }

                    // Fallback: return the object as-is
                    return img;
                  })
                  .flat();
              }

              // If images is a single object, normalize similarly.
              if (images.url) {
                if (Array.isArray(images.url)) {
                  return images.url.map((urlItem) => ({
                    title: urlItem.title || "",
                    url: urlItem._ || urlItem.$t || urlItem,
                  }));
                } else if (typeof images.url === "string") {
                  return [{ title: images.title || "", url: images.url }];
                } else if (images.url._ || images.url.$t) {
                  return [
                    {
                      title: images.url.title || "",
                      url: images.url._ || images.url.$t,
                    },
                  ];
                }
              }

              return [];
            })(),
          },
        },

        // Also keep qr_code at top-level for quick access
        qr_code: extractQRCodeUrl(property.custom_fields?.qr_code),

        // Keep classification metadata around for debugging & stats
        _classification: classification,
      };

      return transformedProperty;
    };

    // Map all raw XML properties to normalized objects.
    const transformedProperties = allProperties.map(transformPropertyData);

    // Filter by mode (you currently accept CREATE/CHANGE/NEW and skip others)
    const validProperties = transformedProperties.filter((property) => {
      const mode = property.mode;
      if (mode === "CREATE" || mode === "CHANGE" || mode === "NEW") return true;
      console.log(`Skipping property ${property.id} with mode: ${mode}`);
      return false;
    });

    console.log(`Processing ${validProperties.length} properties`);

    // Separate into live and non-live, but you still process both (non-live flagged as NonActive)
    const liveProperties = [];
    const nonLiveProperties = [];

    validProperties.forEach((property) => {
      if (isPropertyLive(property)) {
        liveProperties.push(property);
      } else {
        // For non-live properties, mark classification as NonActive.
        property._classification = {
          type: "NonActive",
          listingType: "NonActive",
          reason: `Status is not Live: ${property.general_listing_information?.status}`,
        };
        property.listing_type = "NonActive";
        property.general_listing_information.listingtype = "NonActive";
        nonLiveProperties.push(property);
      }
    });

    console.log(`Live properties: ${liveProperties.length}`);
    console.log(`Non-Live properties: ${nonLiveProperties.length}`);

    // Stats tracker to return back to client and logs
    const missingAgentsSet = new Set();

    const processResults = {
      totalAttempted: validProperties.length,
      livePropertiesAttempted: liveProperties.length,
      nonLivePropertiesAttempted: nonLiveProperties.length,
      successful: 0,
      failed: 0,
      skipped: allProperties.length - validProperties.length,
      failures: [],
      operations: {
        created: 0,
        updated: 0,
        skipped_no_update: 0,
        agentPropertiesAdded: 0,
        agentPropertiesUpdated: 0,
        agentNotFound: 0,
        agentSkipped: 0,
        agentSkippedNonActive: 0,
        agentFailed: 0,
      },
      byType: {
        Sale: { created: 0, updated: 0 },
        Rent: { created: 0, updated: 0 },
        OffPlan: { created: 0, updated: 0 },
        Commercial: { created: 0, updated: 0 },
        NonActive: { created: 0, updated: 0 },
      },
      classificationStats: {
        byCompletionStatus: {},
        byOfferingType: {},
        fallbacks: 0,
      },
    };

    // Aggregate classification stats (completion_status, offering_type, fallback reasons)
    const allPropertiesToProcess = [...liveProperties, ...nonLiveProperties];

    for (const property of allPropertiesToProcess) {
      const completionStatus = property.custom_fields?.completion_status;
      const offeringType = property.custom_fields?.offering_type;
      const classification = property._classification;

      if (completionStatus) {
        processResults.classificationStats.byCompletionStatus[completionStatus] =
          (processResults.classificationStats.byCompletionStatus[
            completionStatus
          ] || 0) + 1;
      }

      if (offeringType) {
        processResults.classificationStats.byOfferingType[offeringType] =
          (processResults.classificationStats.byOfferingType[offeringType] ||
            0) + 1;
      }

      if (classification && classification.reason.includes("Fallback")) {
        processResults.classificationStats.fallbacks++;
      }
    }

    /* ----------------------------- BULK UPSERT ----------------------------- */

    // Preload existing properties from DB by their Salesforce ids
    const ids = allPropertiesToProcess.map((p) => p.id);

    const existingProps = await Property.find(
      { id: { $in: ids } },
      { id: 1, created_at: 1, address_information: 1 }
    ).lean();

    // Map for quick existence lookup.
    const existsMap = new Map(existingProps.map((p) => [p.id, p]));

    const propertyOps = []; // bulk operations array
    const mainOpById = new Map(); // "created"/"updated"/"skipped_no_update"/"updated_partial"

    for (const propertyData of allPropertiesToProcess) {
      const id = propertyData.id;
      const existing = existsMap.get(id);
      const existed = !!existing;
      const updateFlag = propertyData.general_listing_information?.updated;

      // If property existed and XML says "updated = No", only update specific fields if necessary.
      if (existed && updateFlag === "No") {
        const updates = {};
        let shouldUpdate = false;

        // If created_at changed, update it.
        if (
          propertyData.created_at &&
          propertyData.created_at !== existing.created_at
        ) {
          updates.created_at = propertyData.created_at;
          shouldUpdate = true;
          console.log(
            `[${id}] 📅 Updating created_at:`,
            propertyData.created_at
          );
        }

        // If address_information has content, update that too.
        if (
          propertyData.address_information &&
          Object.keys(propertyData.address_information).length > 0
        ) {
          updates.address_information = propertyData.address_information;
          shouldUpdate = true;
          console.log(
            `[${id}] 📍 Adding/Updating address_information:`,
            propertyData.address_information
          );
        }

        if (shouldUpdate) {
          propertyOps.push({
            updateOne: {
              filter: { id },
              update: { $set: updates },
              upsert: false,
            },
          });

          const updateFields = Object.keys(updates).join(" & ");
          mainOpById.set(id, "updated_partial");

          console.log(
            `[${id}] ✏️  Queueing partial update: ${updateFields}`
          );
        } else {
          mainOpById.set(id, "skipped_no_update");
          console.log(`[${id}] ⏭️  Skipped - no changes needed`);
        }

        // Skip full update since we've handled the partial logic.
        continue;
      }

      // Full upsert (create or update)
      const $set = {
        created_at: propertyData.created_at,
        timestamp: propertyData.timestamp,
        address_information: propertyData.address_information,
        general_listing_information: propertyData.general_listing_information,
        listing_agent: propertyData.listing_agent,
        listing_media: propertyData.listing_media,
        custom_fields: propertyData.custom_fields,
        qr_code: propertyData.qr_code,
        offering_type: propertyData.offering_type,
        property_type: propertyData.property_type,
        listing_type: propertyData.listing_type,
        _classification: propertyData._classification,
      };

      propertyOps.push({
        updateOne: {
          filter: { id },
          update: { $set, $setOnInsert: { id } },
          upsert: true,
        },
      });

      const opType = existed ? "updated" : "created";
      mainOpById.set(id, opType);

      console.log(`[${id}] ${existed ? "🔄" : "✨"} Queueing full ${opType}`);
    }

    // Execute bulkWrite if there is any operation
    if (propertyOps.length) {
      console.log(
        `\n🚀 Executing bulk write with ${propertyOps.length} operations...`
      );
      await Property.bulkWrite(propertyOps, { ordered: false });
      console.log("✅ Bulk write completed successfully!\n");
    } else {
      console.log("⏭️  No operations to execute - all properties skipped\n");
    }

    // Update stats based on mainOpById map
    for (const propertyData of allPropertiesToProcess) {
      const id = propertyData.id;
      const op = mainOpById.get(id);

      if (!op) {
        processResults.failed++;
        processResults.failures.push({
          id,
          status: propertyData.general_listing_information?.status || "Unknown",
          classification: propertyData._classification,
          error: "No main operation recorded",
        });
        console.log(`❌ [${id}] FAILED - no operation recorded`);
        continue;
      }

      if (op === "created") {
        processResults.successful++;
        processResults.operations.created++;

        const lt = propertyData._classification?.listingType;
        if (lt && processResults.byType[lt]) {
          processResults.byType[lt].created++;
        }

        console.log(`✅ [${id}] Created`);
      } else if (op === "updated" || op === "updated_partial") {
        processResults.successful++;
        processResults.operations.updated++;

        const lt = propertyData._classification?.listingType;
        if (lt && processResults.byType[lt]) {
          processResults.byType[lt].updated++;
        }

        console.log(`✅ [${id}] Updated`);
      } else if (op === "skipped_no_update") {
        processResults.successful++;
        processResults.operations.skipped_no_update++;

        console.log(`⏭️  [${id}] Skipped`);
      }
    }

    /* ----------------------- PARALLEL AGENT LINKING ----------------------- */

    // Only Live properties are linked to agents.
    const liveForLinking = allPropertiesToProcess.filter(
      (p) =>
        (p.general_listing_information?.status || "").toLowerCase() === "live"
    );

    // Link properties to agents with concurrency of 10
    const agentResults = await runWithConcurrency(
      liveForLinking,
      10,
      async (propertyData) => {
        const agentEmail =
          propertyData.listing_agent?.listing_agent_email?.toLowerCase();

        if (!agentEmail) {
          return { id: propertyData.id, outcome: "skipped_no_agent" };
        }

        try {
          const res = await linkPropertyToAgent(propertyData);

          if (res.success) {
            return { id: propertyData.id, outcome: res.operation };
          } else {
            // If agent not found, track it in missingAgentsSet for reporting.
            if (res.operation === "agent_not_found") {
              missingAgentsSet.add(
                JSON.stringify({
                  email: agentEmail,
                  propertyId: propertyData.id,
                  agentName: `${
                    propertyData.listing_agent?.listing_agent_firstname || ""
                  } ${
                    propertyData.listing_agent?.listing_agent_lastname || ""
                  }`.trim(),
                  phone:
                    propertyData.listing_agent?.listing_agent_mobil_phone ||
                    propertyData.listing_agent?.listing_agent_phone ||
                    "N/A",
                  propertyStatus:
                    propertyData.general_listing_information?.status,
                  propertyWasSkipped:
                    mainOpById.get(propertyData.id) === "skipped_no_update",
                })
              );
            }

            return {
              id: propertyData.id,
              outcome: res.operation || "failed",
            };
          }
        } catch (e) {
          return { id: propertyData.id, outcome: "failed", error: e.message };
        }
      }
    );

    // Aggregate agent linking results into counters.
    for (const r of agentResults) {
      if (r.outcome === "property_added")
        processResults.operations.agentPropertiesAdded++;
      else if (r.outcome === "property_updated")
        processResults.operations.agentPropertiesUpdated++;
      else if (r.outcome === "agent_not_found")
        processResults.operations.agentNotFound++;
      else if (r.outcome === "skipped")
        processResults.operations.agentSkipped++;
      else if (r.outcome === "skipped_no_agent")
        processResults.operations.agentSkipped++;
      else if (r.outcome === "skipped_not_live")
        processResults.operations.agentSkippedNonActive++;
      else if (r.outcome === "failed")
        processResults.operations.agentFailed++;
    }

    /* ----------------------------- Missing Agents ----------------------------- */

    // De-duplicate missing agents and group by email
    const missingAgentsList = Array.from(missingAgentsSet).map((item) =>
      JSON.parse(item)
    );

    const missingAgentsSummary = missingAgentsList.reduce((acc, agent) => {
      if (!acc[agent.email]) {
        acc[agent.email] = {
          email: agent.email,
          agentName: agent.agentName,
          phone: agent.phone,
          propertyCount: 0,
          properties: [],
        };
      }

      acc[agent.email].propertyCount++;
      acc[agent.email].properties.push({
        propertyId: agent.propertyId,
        status: agent.propertyStatus,
      });

      return acc;
    }, {});

    const missingAgentsArray = Object.values(missingAgentsSummary);

    /* --------------------------------- Finish -------------------------------- */

    console.log("=== DATABASE PROCESSING COMPLETED ===");
    console.log(
      `Successfully processed: ${processResults.successful} properties`
    );
    console.log(`Failed: ${processResults.failed} properties`);
    console.log(`Skipped: ${processResults.skipped} properties (invalid data)`);
    console.log(`Live properties: ${processResults.livePropertiesAttempted}`);
    console.log(
      `Non-Live properties: ${processResults.nonLivePropertiesAttempted}`
    );
    console.log(
      `Operations: Created ${processResults.operations.created}, Updated ${processResults.operations.updated}`
    );
    console.log(
      `Agent Operations: Added ${processResults.operations.agentPropertiesAdded}, ` +
        `Updated ${processResults.operations.agentPropertiesUpdated}, ` +
        `Not Found ${processResults.operations.agentNotFound}, ` +
        `Skipped ${processResults.operations.agentSkippedNonActive}`
    );
    console.log(`By Type:`, processResults.byType);

    console.log(
      `\n⚠️  Missing Agents: ${missingAgentsArray.length} unique agents not found`
    );
    if (missingAgentsArray.length > 0) {
      console.log("\n🔍 Top Missing Agents:");
      missingAgentsArray.slice(0, 10).forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.email}`);
        console.log(`      Name: ${agent.agentName || "N/A"}`);
        console.log(`      Phone: ${agent.phone}`);
        console.log(`      Properties: ${agent.propertyCount}`);
      });
      if (missingAgentsArray.length > 10) {
        console.log(`   ... and ${missingAgentsArray.length - 10} more agents`);
      }
    }

    // Final HTTP response
    return res.status(200).json({
      success: true,
      message:
        "✅ XML data processed successfully - All properties saved with bulkWrite and agent linking",
      totalPropertiesInXml: allProperties.length,
      processedProperties: validProperties.length,
      liveProperties: liveProperties.length,
      nonLiveProperties: nonLiveProperties.length,
      skippedProperties: processResults.skipped,
      databaseResults: {
        propertiesProcessed: processResults.successful,
        propertiesFailed: processResults.failed,
        operations: processResults.operations,
        byType: processResults.byType,
        classificationStats: processResults.classificationStats,
        failures: processResults.failures.slice(0, 5),
      },
      missingAgents: {
        total: missingAgentsArray.length,
        totalPropertiesAffected: missingAgentsList.length,
        agents: missingAgentsArray,
      },
    });
  } catch (error) {
    console.error("❌ Error parsing XML:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to parse XML",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                 Scheduler                                  */
/* -------------------------------------------------------------------------- */

/**
 * Schedule the property sync + cleanup to run at:
 *  - 00:00
 *  - 12:00
 *  - 15:00
 * in the configured timezone.
 *
 * It first runs parseXmlFromUrl, then cleanupMissingProperties.
 */
const schedulePropertySync = () => {
  const TZ = process.env.CRON_TZ || "Etc/UTC";

  cron.schedule(
    "0 0,12,15 * * *", // cron expression
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`🔄 [${startedAt}] Starting scheduled property sync...`);

      // Fake Express req/res for parseXmlFromUrl
      const fakeReq = {};
      const fakeRes = {
        _status: 200,
        status(code) {
          this._status = code;
          return this;
        },
        json(payload) {
          try {
            const summary = {
              success: payload?.success,
              totalPropertiesInXml: payload?.totalPropertiesInXml,
              processedProperties: payload?.processedProperties,
              liveProperties: payload?.liveProperties,
              nonLiveProperties: payload?.nonLiveProperties,
              skippedProperties: payload?.skippedProperties,
            };
            console.log(
              `✅ [${new Date().toISOString()}] Property sync completed (parseXmlFromUrl):`,
              summary
            );
          } catch (e) {
            console.log(
              `✅ [${new Date().toISOString()}] Property sync completed (parseXmlFromUrl).`
            );
          }
          return payload;
        },
      };

      try {
        // 1️⃣ MAIN SYNC: Parse XML + upsert properties + link agents
        await parseXmlFromUrl(fakeReq, fakeRes);

        console.log(
          `🧹 [${new Date().toISOString()}] Starting cleanupMissingProperties AFTER successful parse...`
        );

        // 2️⃣ CLEANUP: Delete properties not present in XML & unlink from agents
        const cleanupReq = {
          query: {
            dryRun: "0", // real deletions; set "1" to test
            returnIds: "0",
          },
        };

        const cleanupRes = {
          _status: 200,
          status(code) {
            this._status = code;
            return this;
          },
          json(payload) {
            try {
              const summary = {
                success: payload?.success,
                message: payload?.message,
                counts: payload?.counts,
              };
              console.log(
                `✅ [${new Date().toISOString()}] cleanupMissingProperties completed:`,
                summary
              );
            } catch (e) {
              console.log(
                `✅ [${new Date().toISOString()}] cleanupMissingProperties completed.`
              );
            }
            return payload;
          },
        };

        await cleanupMissingProperties(cleanupReq, cleanupRes);
      } catch (error) {
        console.error(
          `❌ [${new Date().toISOString()}] Property sync or cleanup failed:`,
          error.message
        );
      }
    },
    { timezone: TZ }
  );

  console.log(
    `⏰ Property sync scheduler initialized - Running daily at 00:00, 12:00, and 15:00 (${TZ}), with cleanup AFTER each sync`
  );
};

/* -------------------------------------------------------------------------- */
/*            Cleanup: delete properties missing from latest XML              */
/* -------------------------------------------------------------------------- */

/**
 * Helper: fetch ALL property IDs from the XML and return as a Set<string>.
 * Used by cleanupMissingProperties to know which DB properties are "orphaned".
 */
async function fetchAllXmlPropertyIds() {
  console.log("🔎 Searching ids in XML...");

  const xmlUrl = process.env.XML_URL;
  if (!xmlUrl) throw new Error("XML_URL is not configured");

  const response = await axios.get(xmlUrl, {
    headers: { Accept: "application/xml" },
    timeout: 120000, // 120s
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    normalizeTags: false,
    trim: true,
  });

  const result = await parser.parseStringPromise(response.data);

  let xmlProps = [];
  if (result?.list?.property) {
    xmlProps = Array.isArray(result.list.property)
      ? result.list.property
      : [result.list.property];
  } else {
    // Fallback: search recursively for property-like arrays
    const findPropertiesArray = (obj) => {
      for (const key in obj) {
        if (
          Array.isArray(obj[key]) &&
          obj[key].length > 0 &&
          obj[key][0] &&
          (obj[key][0].Id || obj[key][0].general_listing_information)
        ) {
          return obj[key];
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          const found = findPropertiesArray(obj[key]);
          if (found) return found;
        }
      }
      return null;
    };
    const arr = findPropertiesArray(result);
    if (arr) xmlProps = arr;
  }

  const xmlIdSet = new Set();
  for (const p of xmlProps) {
    const raw = p?.Id || p?.id;
    if (typeof raw === "string") {
      const norm = raw.trim();
      if (norm) xmlIdSet.add(norm);
    }
  }

  console.log(`📦 XML has ${xmlIdSet.size} ids.`);
  return xmlIdSet;
}

/**
 * Delete DB properties that are no longer present in the XML
 * and unlink them from Agent.properties.
 *
 * Query params:
 *  - dryRun=1 → only report how many would be deleted, but don't delete.
 *  - returnIds=1 → include sample IDs in response.
 *  - progressEvery → how often to log progress while scanning.
 *  - sampleCap → how many IDs to show in response sample.
 *  - deleteChunkSize → how many IDs per deleteMany chunk.
 *  - agentChunkSize → how many IDs per Agent.updateMany chunk.
 */
const cleanupMissingProperties = async (req, res) => {
  try {
    // Guard: ensure both Property and Agent collections are connected
    if (!isMongoConnected(Property) || !isMongoConnected(Agent)) {
      console.error(
        "❌ cleanupMissingProperties aborted: MongoDB is not connected."
      );
      return res.status(503).json({
        success: false,
        message:
          "Database connection is not ready yet. Please retry cleanup in a moment.",
      });
    }

    console.log("🧹 Deleter function running!");

    // Parse query params with defaults
    const dryRun = String(req.query?.dryRun ?? "0") === "1";
    const returnIds = String(req.query?.returnIds ?? "0") === "1";
    const progressEvery = Number(req.query?.progressEvery ?? 5000);
    const sampleCap = Number(req.query?.sampleCap ?? 100);
    const deleteChunkSize = Number(req.query?.deleteChunkSize ?? 5000);
    const agentChunkSize = Number(req.query?.agentChunkSize ?? 5000);

    // 1) Get all property IDs from XML (as a Set)
    const xmlIds = await fetchAllXmlPropertyIds();

    // 2) Stream DB property IDs via a cursor to avoid loading everything into memory
    const cursor = Property.find({}, { id: 1 })
      .lean()
      .cursor({ batchSize: 5000 });

    const missing = []; // IDs present in DB but not in XML
    let scanned = 0; // total scanned from DB
    let printedCount = 0; // limit how many "missing" logs we spam

    console.time("⏱️ missing-diff");
    for await (const doc of cursor) {
      scanned++;
      const id = typeof doc?.id === "string" ? doc.id.trim() : null;
      if (!id) continue;

      // If the ID is not in the XML set, it is a candidate for deletion.
      if (!xmlIds.has(id)) {
        missing.push(id);

        // Log the first few missing IDs for visibility.
        if (printedCount < 10) {
          console.log(`❗ Missing found: ${id}`);
          printedCount++;
        }
      }

      if (scanned % progressEvery === 0) {
        console.log(
          `...scanned ${scanned} DB docs; missing so far: ${missing.length}`
        );
      }
    }
    console.timeEnd("⏱️ missing-diff");

    // 3) If there are no missing IDs, DB and XML are in sync.
    if (missing.length === 0) {
      console.log(
        `✅ DB is in sync. Scanned ${scanned} docs, XML=${xmlIds.size}`
      );
      return res.status(200).json({
        success: true,
        message: "No missing properties. DB is in sync with XML.",
        dryRun,
        counts: { xmlCount: xmlIds.size, dbScanned: scanned, toDelete: 0 },
      });
    }

    // 4) If this is a dry run, just report counts and a sample of IDs.
    if (dryRun) {
      console.log(
        `🟡 DRY-RUN: would delete ${missing.length} properties. Example:`,
        missing.slice(0, 10)
      );
      return res.status(200).json({
        success: true,
        message:
          "Dry-run: the following properties would be deleted and unlinked from agents.",
        dryRun: true,
        counts: {
          xmlCount: xmlIds.size,
          dbScanned: scanned,
          toDelete: missing.length,
        },
        sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
      });
    }

    // 5) Actually delete from Property collection in chunks.
    let deletedTotal = 0;
    console.time("⏱️ delete-properties");

    for (let i = 0; i < missing.length; i += deleteChunkSize) {
      const chunk = missing.slice(i, i + deleteChunkSize);
      const delRes = await Property.deleteMany({ id: { $in: chunk } });

      deletedTotal += delRes?.deletedCount ?? 0;

      console.log(
        `🗑️ Deleted chunk ${i}-${i + chunk.length - 1} (size=${
          chunk.length
        }) → removed ${delRes?.deletedCount ?? 0}`
      );
    }

    console.timeEnd("⏱️ delete-properties");

    // 6) Unlink those IDs from Agent documents (properties propertyId)
    let agentsUpdatedTotal = 0;
    console.time("⏱️ unlink-agents");

    for (let i = 0; i < missing.length; i += agentChunkSize) {
      const chunk = missing.slice(i, i + agentChunkSize);

      const pullRes = await Agent.updateMany(
        {},
        { $pull: { properties: { propertyId: { $in: chunk } } } }
      );

      agentsUpdatedTotal += pullRes?.modifiedCount ?? 0;

      console.log(
        `🔗 Unlinked chunk ${i}-${i + chunk.length - 1} (size=${
          chunk.length
        }) → agents modified ${pullRes?.modifiedCount ?? 0}`
      );
    }

    console.timeEnd("⏱️ unlink-agents");

    // 7) Respond with deletion summary.
    console.log(
      `✅ Cleanup complete. Deleted ${deletedTotal}, agent docs updated ${agentsUpdatedTotal}.`
    );

    return res.status(200).json({
      success: true,
      message:
        "Cleanup complete: removed properties not present in XML and unlinked from agents.",
      dryRun: false,
      counts: {
        xmlCount: xmlIds.size,
        dbScanned: scanned,
        deletedProperties: deletedTotal,
        agentsUpdated: agentsUpdatedTotal,
        affectedPropertyIds: missing.length,
      },
      sampleIds: returnIds ? missing.slice(0, sampleCap) : undefined,
    });
  } catch (err) {
    console.error("❌ cleanupMissingProperties error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Cleanup failed",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   Exports                                  */
/* -------------------------------------------------------------------------- */

module.exports = {
  parseXmlFromUrl,
  schedulePropertySync,
  cleanupMissingProperties,
};
