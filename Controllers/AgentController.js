// // const Agent = require("../Models/AgentModel");
// // const path = require("path");
// // const fs = require("fs");
// // const cloudinary = require("cloudinary").v2;

// // const isTruthy = (v) => v === true || v === "true";
// // const clampInt = (v, def = 0) => {
// //   const n = parseInt(v, 10);
// //   return Number.isFinite(n) ? n : def;
// // };

// // const createAgent = async (req, res) => {
// //   try {

// //     let imageUrl = null;
// //     if (req.file) {
// //       imageUrl = req.file.path; 
// //       req.body.imageUrl = imageUrl;
// //     }

// //     if (req.body.superAgent !== undefined) {
// //       req.body.superAgent = isTruthy(req.body.superAgent);
// //     }

// //     // ✅ NEW: Handle activeOnLeaderboard boolean
// //     if (req.body.activeOnLeaderboard !== undefined) {
// //       req.body.activeOnLeaderboard = isTruthy(req.body.activeOnLeaderboard);
// //     } else {
// //       // Default to true if not provided
// //       req.body.activeOnLeaderboard = true;
// //     }

// //     // Validate and enforce unique sequenceNumber if provided
// //     if (req.body.sequenceNumber) {
// //       const sequenceNumber = clampInt(req.body.sequenceNumber);
// //       if (sequenceNumber < 1) {
// //         return res.status(400).json({
// //           success: false,
// //           error: "Sequence number must be at least 1",
// //         });
// //       }
// //       const existingAgent = await Agent.findOne({ sequenceNumber });
// //       if (existingAgent) {
// //         return res.status(400).json({
// //           success: false,
// //           error: `Sequence number ${sequenceNumber} is already taken by agent: ${existingAgent.agentName}`,
// //         });
// //       }
// //       req.body.sequenceNumber = sequenceNumber;
// //     }

// //     const agent = await Agent.create(req.body);

// //     return res.status(201).json({
// //       success: true,
// //       data: agent,
// //       imageUrl: imageUrl, 
// //     });
// //   } catch (err) {
// //     console.error("Create agent error:", err);
// //     return res.status(400).json({ success: false, error: err.message });
// //   }
// // };

// // const getAgents = async (req, res) => {
// //   try {
// //     let { isActive } = req.query;
// //     const pipeline = [];

// //     if (isActive === "True") {
// //       pipeline.push({ $match: { isActive: true } });
// //       //It will show All agents
// //     } else if (isActive === "False") {
// //       null;
// //     }
// //     // If no query → do not push a $match (returns all)

// //     pipeline.push(
// //       { $sort: { sequenceNumber: 1, agentName: 1 } },
// //       {
// //         $project: {
// //           agentName: 1,
// //           agentLanguage: 1,
// //           designation: 1,
// //           superAgent: 1,
// //           email: 1,
// //           whatsapp: 1,
// //           instagram: 1,
// //           linkedin: 1,
// //           phone: 1,
// //           imageUrl: 1,
// //           activeSaleListings: 1,
// //           propertiesSoldLast15Days: 1,
// //           isActive: 1,
// //           agentId: 1,
// //           leaderboard: 1,
// //           sequenceNumber: 1,
// //           reraNumber: 1,
// //           activeOnLeaderboard: 1,
// //           propertiesCount: { $size: { $ifNull: ["$properties", []] } },
// //           blogsCount: { $size: { $ifNull: ["$blogs", []] } },
// //         },
// //       }
// //     );

// //     const agents = await Agent.aggregate(pipeline).allowDiskUse(true);

// //     return res.status(200).json({
// //       success: true,
// //       data: agents,
// //       total: agents.length,
// //     });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, error: err.message });
// //   }
// // };

// // const getAgentById = async (req, res) => {
// //   try {
// //     const agent = await Agent.findOne({ agentId: req.query.agentId });
// //     if (!agent)
// //       return res.status(404).json({ success: false, error: "Agent not found" });
// //     return res.status(200).json({ success: true, data: agent });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, error: err.message });
// //   }
// // };

// // const getAgentByEmail = async (req, res) => {
// //   try {
// //     const agent = await Agent.findOne(
// //       { email: req.query.email },
// //       {
// //         agentName: 1,
// //         designation: 1,
// //         reraNumber: 1,
// //         specialistAreas: 1,
// //         email: 1,
// //         phone: 1,
// //         whatsapp: 1,
// //         instagram: 1,
// //         linkedin: 1,
// //         activeSaleListings: 1,
// //         propertiesSoldLast15Days: 1,
// //         isActive: 1,
// //         agentId: 1,
// //         registeredDate: 1,
// //         lastUpdated: 1,
// //         blogs: 1,
// //         imageUrl: 1,
// //         agentLanguage: 1,
// //         leaderboard: 1,
// //         superAgent: 1,
// //       }
// //     );

// //     if (!agent) {
// //       return res.status(404).json({ success: false, error: "Agent not found" });
// //     }

// //     return res.status(200).json({ success: true, data: agent });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, error: err.message });
// //   }
// // };

// // const updateAgent = async (req, res) => {
// //   try {
// //     const { agentId, ...requestFields } = req.body || {};

// //     if (!agentId) {
// //       return res
// //         .status(400)
// //         .json({ success: false, error: "Agent ID is required" });
// //     }

// //     const existingAgent = await Agent.findOne({ agentId });
// //     if (!existingAgent) {
// //       return res.status(404).json({ success: false, error: "Agent not found" });
// //     }

// //     // Handle sequenceNumber swap if changed
// //     if (requestFields.sequenceNumber !== undefined) {
// //       const newSequenceNumber = clampInt(requestFields.sequenceNumber, NaN);
// //       if (!Number.isFinite(newSequenceNumber) || newSequenceNumber < 1) {
// //         return res.status(400).json({
// //           success: false,
// //           error: "Sequence number must be a positive integer",
// //         });
// //       }

// //       if (existingAgent.sequenceNumber !== newSequenceNumber) {
// //         if (typeof Agent.swapSequenceNumbers !== "function") {
// //           return res.status(500).json({
// //             success: false,
// //             error:
// //               "Sequence swap not available: Agent.swapSequenceNumbers is undefined.",
// //           });
// //         }
// //         try {
// //           await Agent.swapSequenceNumbers(agentId, newSequenceNumber);
// //           const updatedAgent = await Agent.findOne({ agentId });
// //           return res.status(200).json({
// //             success: true,
// //             message: `Agent sequence number updated successfully to ${newSequenceNumber}`,
// //             data: updatedAgent,
// //           });
// //         } catch (swapError) {
// //           return res.status(400).json({
// //             success: false,
// //             error: `Failed to update sequence number: ${swapError.message}`,
// //           });
// //         }
// //       } else {
// //         delete requestFields.sequenceNumber;
// //       }
// //     }

// //     // Build update object
// //     const buildUpdateObject = (fields, file, currentAgent) => {
// //       const updateObj = {};
// //       const allowedFields = [
// //         "agentName",
// //         "designation",
// //         "reraNumber",
// //         "specialistAreas",
// //         "description",
// //         "email",
// //         "phone",
// //         "whatsapp",
// //         "instagram",
// //          "linkedin",
// //         "activeSaleListings",
// //         "propertiesSoldLast15Days",
// //         "agentLanguage",
// //         "isActive",
// //         "superAgent",
// //         "activeOnLeaderboard",
// //       ];

// //       for (const field of allowedFields) {
// //         const value = fields[field];
// //         if (value === undefined || value === "") continue;

// //         if (field === "email") {
// //           if (value !== currentAgent.email) updateObj[field] = value;
// //           continue;
// //         }

// //         switch (field) {
// //           case "specialistAreas":
// //             if (typeof value === "string") {
// //               try {
// //                 updateObj[field] = JSON.parse(value);
// //               } catch {
// //                 updateObj[field] = value;
// //               }
// //             } else {
// //               updateObj[field] = value;
// //             }
// //             break;

// //           case "activeSaleListings":
// //           case "propertiesSoldLast15Days":
// //             updateObj[field] = clampInt(value, 0);
// //             break;

// //           case "isActive":
// //           case "superAgent":
// //           case "activeOnLeaderboard": // ✅ NEW: Handle activeOnLeaderboard boolean
// //             updateObj[field] = isTruthy(value);
// //             break;

// //           default:
// //             updateObj[field] = value;
// //         }
// //       }

// //       // ✅ CLOUDINARY: Handle file upload with full URL
// //       if (file) {
// //         updateObj.imageUrl = file.path; // Cloudinary full URL
// //       }

// //       updateObj.lastUpdated = new Date();
// //       return updateObj;
// //     };

// //     const updateFields = buildUpdateObject(
// //       requestFields,
// //       req.file,
// //       existingAgent
// //     );

// //     // If no actual changes besides lastUpdated, return existing
// //     const effectiveKeys = Object.keys(updateFields).filter(
// //       (k) => k !== "lastUpdated"
// //     );
// //     if (effectiveKeys.length === 0) {
// //       return res.status(200).json({
// //         success: true,
// //         message: "No changes detected",
// //         data: existingAgent,
// //       });
// //     }

// //     // Email uniqueness check
// //     if (updateFields.email) {
// //       const emailExists = await Agent.findOne({
// //         email: updateFields.email,
// //         agentId: { $ne: agentId },
// //       });
// //       if (emailExists) {
// //         return res.status(400).json({
// //           success: false,
// //           error: `Email "${updateFields.email}" is already in use by another agent`,
// //         });
// //       }
// //     }

// //     // ✅ CLOUDINARY: Delete old image if new one is uploaded
// //     if (req.file && existingAgent.imageUrl) {
// //       try {
// //         // Extract public_id from Cloudinary URL
// //         // Example URL: https://res.cloudinary.com/dxxxxxxxx/image/upload/v123456/agent-images/agent-123456789.jpg
// //         const urlParts = existingAgent.imageUrl.split("/");
// //         const publicIdWithExt = urlParts[urlParts.length - 1]; // agent-123456789.jpg
// //         const publicIdWithoutExt = publicIdWithExt.split(".")[0]; // agent-123456789
// //         const fullPublicId = `agent-images/${publicIdWithoutExt}`; // agent-images/agent-123456789

// //         await cloudinary.uploader.destroy(fullPublicId);
// //         console.log(`✅ Deleted old Cloudinary image: ${fullPublicId}`);
// //       } catch (deleteError) {
// //         console.error(
// //           "⚠️ Error deleting old Cloudinary image:",
// //           deleteError.message
// //         );
// //         // Continue with update even if deletion fails
// //       }
// //     }

// //     const updatedAgent = await Agent.findOneAndUpdate(
// //       { agentId },
// //       { $set: updateFields },
// //       { new: true, runValidators: true }
// //     );

// //     return res.status(200).json({
// //       success: true,
// //       message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(
// //         ", "
// //       )}`,
// //       data: updatedAgent,
// //       imageUrl: updatedAgent.imageUrl, // ✅ Return Cloudinary URL
// //     });
// //   } catch (err) {
// //     console.error("Update agent error:", err);

// //     if (err?.code === 11000) {
// //       const field = Object.keys(err.keyPattern || {})[0];
// //       const value = err.keyValue?.[field];
// //       return res.status(400).json({
// //         success: false,
// //         error: `${field?.[0]?.toUpperCase()}${field?.slice(
// //           1
// //         )} "${value}" already exists`,
// //       });
// //     }

// //     return res.status(400).json({
// //       success: false,
// //       error: err.message || "Failed to update agent",
// //     });
// //   }
// // };



// // const getAgentsBySequence = async (req, res) => {
// //   try {
// //     const { activeOnly = "true" } = req.query;
// //     const query = isTruthy(activeOnly) ? { isActive: true } : {};
// //     const agents = await Agent.find(query).sort({
// //       sequenceNumber: 1,
// //       agentName: 1,
// //     });
// //     return res.status(200).json({ success: true, data: agents });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, error: err.message });
// //   }
// // };

// // const deleteAgent = async (req, res) => {
// //   try {
// //     const agent = await Agent.findOneAndDelete({ agentId: req.query.agentId });
// //     if (!agent) {
// //       return res.status(404).json({ success: false, error: "Agent not found" });
// //     }

// //     if (agent.imageUrl) {
// //       // Fix path joining with leading slash
// //       const filePath = path.join(
// //         __dirname,
// //         "../public",
// //         stripLeadingSlash(agent.imageUrl)
// //       );
// //       fs.promises.unlink(filePath).catch((e) => {
// //         if (e?.code !== "ENOENT")
// //           console.warn("⚠️  Failed to delete image:", e.message);
// //       });
// //     }

// //     // Optionally: await Agent.reorderSequences();
// //     return res.status(200).json({ success: true, msg: "Agent Removed" });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, error: err.message });
// //   }
// // };

// // module.exports = {
// //   createAgent,
// //   getAgents,
// //   getAgentById,
// //   getAgentByEmail,
// //   updateAgent,
// //   getAgentsBySequence,
// //   deleteAgent,
// // };


// // Agent mongoose model (MongoDB collection for agents)
// const Agent = require("../Models/AgentModel");

// // Node core modules (used for file deletion in deleteAgent)
// const path = require("path");
// const fs = require("fs");

// // Cloudinary SDK (v2 API)
// const cloudinary = require("cloudinary").v2;

// /* -------------------------------------------------------------------------- */
// /*                               Helper Utilities                             */
// /* -------------------------------------------------------------------------- */

// /**
//  * isTruthy
//  * Normalize various "truthy" representations into boolean true.
//  * Accepts:
//  *  - true  (boolean)
//  *  - "true" (string)
//  * Everything else is treated as false.
//  */
// const isTruthy = (v) => v === true || v === "true";

// /**
//  * clampInt
//  * Safely parse an integer from any input.
//  * If parse fails, it returns a default value (def).
//  */
// const clampInt = (v, def = 0) => {
//   const n = parseInt(v, 10);            // parse with base 10
//   return Number.isFinite(n) ? n : def;  // only accept real finite numbers
// };

// /* -------------------------------------------------------------------------- */
// /*                                Create Agent                                */
// /* -------------------------------------------------------------------------- */

// const createAgent = async (req, res) => {
//   try {
//     let imageUrl = null;

//     // If a file was uploaded (e.g. via multer + Cloudinary), store its URL
//     if (req.file) {
//       imageUrl = req.file.path; // Typically the Cloudinary URL
//       req.body.imageUrl = imageUrl; // Attach to body so Agent.create picks it up
//     }

//     // Normalize superAgent to boolean if present in body
//     if (req.body.superAgent !== undefined) {
//       req.body.superAgent = isTruthy(req.body.superAgent);
//     }

//     // Normalize activeOnLeaderboard to boolean, default true if not passed
//     if (req.body.activeOnLeaderboard !== undefined) {
//       req.body.activeOnLeaderboard = isTruthy(
//         req.body.activeOnLeaderboard
//       );
//     } else {
//       req.body.activeOnLeaderboard = true;
//     }

//     // Validate and enforce UNIQUE sequenceNumber if provided
//     if (req.body.sequenceNumber) {
//       const sequenceNumber = clampInt(req.body.sequenceNumber);

//       // Enforce minimum of 1 (no zero or negative)
//       if (sequenceNumber < 1) {
//         return res.status(400).json({
//           success: false,
//           error: "Sequence number must be at least 1",
//         });
//       }

//       // Check if another agent already uses this sequenceNumber
//       const existingAgent = await Agent.findOne({ sequenceNumber });
//       if (existingAgent) {
//         return res.status(400).json({
//           success: false,
//           error: `Sequence number ${sequenceNumber} is already taken by agent: ${existingAgent.agentName}`,
//         });
//       }

//       // Assign sanitized value back to body
//       req.body.sequenceNumber = sequenceNumber;
//     }

//     // Finally, create the agent document in MongoDB
//     const agent = await Agent.create(req.body);

//     return res.status(201).json({
//       success: true,
//       data: agent,
//       imageUrl: imageUrl, // echo back uploaded image URL (if any)
//     });
//   } catch (err) {
//     console.error("Create agent error:", err);
//     return res.status(400).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                                Get Agents                                  */
// /* -------------------------------------------------------------------------- */

// const getAgents = async (req, res) => {
//   try {
//     let { isActive } = req.query;

//     // Start building an aggregation pipeline
//     const pipeline = [];

//     // Optional filter: only active agents if isActive === "True"
//     if (isActive === "True") {
//       pipeline.push({ $match: { isActive: true } });
//       // If isActive === "False", nothing is pushed (returns all agents)
//     }

//     // Default pipeline stages: sort + projection
//     pipeline.push(
//       // Sort by sequenceNumber first (for leaderboard ordering),
//       // then by agentName alphabetically as a secondary sort
//       { $sort: { sequenceNumber: 1, agentName: 1 } },

//       // Project only the fields you actually need (avoid sending entire doc)
//       {
//         $project: {
//           agentName: 1,
//           agentLanguage: 1,
//           designation: 1,
//           superAgent: 1,
//           email: 1,
//           whatsapp: 1,
//           instagram: 1,
//           linkedin: 1,
//           phone: 1,
//           imageUrl: 1,
//           activeSaleListings: 1,
//           propertiesSoldLast15Days: 1,
//           isActive: 1,
//           agentId: 1,
//           leaderboard: 1,
//           sequenceNumber: 1,
//           reraNumber: 1,
//           activeOnLeaderboard: 1,

//           // Derived counts: number of properties linked to agent
//           propertiesCount: {
//             $size: { $ifNull: ["$properties", []] },
//           },

//           // Derived counts: number of blogs linked to agent
//           blogsCount: {
//             $size: { $ifNull: ["$blogs", []] },
//           },
//         },
//       }
//     );

//     // Run aggregation on Agent collection
//     const agents = await Agent.aggregate(pipeline).allowDiskUse(true);

//     return res.status(200).json({
//       success: true,
//       data: agents,
//       total: agents.length,
//     });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                               Get Agent By ID                              */
// /* -------------------------------------------------------------------------- */

// const getAgentById = async (req, res) => {
//   try {
//     // Search based on agentId (a custom identifier, not _id)
//     const agent = await Agent.findOne({ agentId: req.query.agentId });

//     if (!agent) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Agent not found" });
//     }

//     return res.status(200).json({ success: true, data: agent });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                             Get Agent By Email                             */
// /* -------------------------------------------------------------------------- */

// const getAgentByEmail = async (req, res) => {
//   try {
//     // Find a single agent with this email, and project only relevant fields
//     const agent = await Agent.findOne(
//       { email: req.query.email },
//       {
//         agentName: 1,
//         designation: 1,
//         reraNumber: 1,
//         specialistAreas: 1,
//         email: 1,
//         phone: 1,
//         whatsapp: 1,
//         instagram: 1,
//         linkedin: 1,
//         activeSaleListings: 1,
//         propertiesSoldLast15Days: 1,
//         isActive: 1,
//         agentId: 1,
//         registeredDate: 1,
//         lastUpdated: 1,
//         blogs: 1,
//         imageUrl: 1,
//         agentLanguage: 1,
//         leaderboard: 1,
//         superAgent: 1,
//       }
//     );

//     if (!agent) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Agent not found" });
//     }

//     return res.status(200).json({ success: true, data: agent });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                                Update Agent                                */
// /* -------------------------------------------------------------------------- */

// const updateAgent = async (req, res) => {
//   try {
//     // Destructure agentId and leave the rest as requestFields
//     const { agentId, ...requestFields } = req.body || {};

//     if (!agentId) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Agent ID is required" });
//     }

//     // Load existing agent by agentId
//     const existingAgent = await Agent.findOne({ agentId });
//     if (!existingAgent) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Agent not found" });
//     }

//     /* ------------------- Handle sequenceNumber change/swap ------------------ */

//     if (requestFields.sequenceNumber !== undefined) {
//       // Convert to int, but if invalid keep NaN
//       const newSequenceNumber = clampInt(requestFields.sequenceNumber, NaN);

//       // Validate: must be positive integer
//       if (!Number.isFinite(newSequenceNumber) || newSequenceNumber < 1) {
//         return res.status(400).json({
//           success: false,
//           error: "Sequence number must be a positive integer",
//         });
//       }

//       // If new sequence number is different from the current one
//       if (existingAgent.sequenceNumber !== newSequenceNumber) {
//         // Ensure static method swapSequenceNumbers exists
//         if (typeof Agent.swapSequenceNumbers !== "function") {
//           return res.status(500).json({
//             success: false,
//             error:
//               "Sequence swap not available: Agent.swapSequenceNumbers is undefined.",
//           });
//         }

//         try {
//           // Use custom static method to swap sequence numbers between agents
//           await Agent.swapSequenceNumbers(agentId, newSequenceNumber);

//           // Fetch the updated record and return
//           const updatedAgent = await Agent.findOne({ agentId });

//           return res.status(200).json({
//             success: true,
//             message: `Agent sequence number updated successfully to ${newSequenceNumber}`,
//             data: updatedAgent,
//           });
//         } catch (swapError) {
//           return res.status(400).json({
//             success: false,
//             error: `Failed to update sequence number: ${swapError.message}`,
//           });
//         }
//       } else {
//         // No change; drop sequenceNumber from remaining updates
//         delete requestFields.sequenceNumber;
//       }
//     }

//     /* -------------------------- Build Update Object ------------------------- */

//     /**
//      * Internal helper: buildUpdateObject
//      * - Whitelists allowed fields
//      * - Normalizes data types
//      * - Handles file upload for imageUrl
//      */
//     const buildUpdateObject = (fields, file, currentAgent) => {
//       const updateObj = {};

//       // Only these fields are allowed to be updated
//       const allowedFields = [
//         "agentName",
//         "designation",
//         "reraNumber",
//         "specialistAreas",
//         "description",
//         "email",
//         "phone",
//         "whatsapp",
//         "instagram",
//         "linkedin",
//         "activeSaleListings",
//         "propertiesSoldLast15Days",
//         "agentLanguage",
//         "isActive",
//         "superAgent",
//         "activeOnLeaderboard",
//       ];

//       for (const field of allowedFields) {
//         const value = fields[field];

//         // Skip undefined or empty string (no update)
//         if (value === undefined || value === "") continue;

//         // Special handling for email: only update if it actually changed
//         if (field === "email") {
//           if (value !== currentAgent.email) {
//             updateObj[field] = value;
//           }
//           continue;
//         }

//         switch (field) {
//           case "specialistAreas":
//             // Accept either JSON string or array
//             if (typeof value === "string") {
//               try {
//                 updateObj[field] = JSON.parse(value);
//               } catch {
//                 updateObj[field] = value;
//               }
//             } else {
//               updateObj[field] = value;
//             }
//             break;

//           case "activeSaleListings":
//           case "propertiesSoldLast15Days":
//             // Normalize numeric stats
//             updateObj[field] = clampInt(value, 0);
//             break;

//           case "isActive":
//           case "superAgent":
//           case "activeOnLeaderboard":
//             // Normalize booleans from form
//             updateObj[field] = isTruthy(value);
//             break;

//           default:
//             // Direct assignment for simple fields (name, designation, etc.)
//             updateObj[field] = value;
//         }
//       }

//       // Handle new Cloudinary image if a file was uploaded
//       if (file) {
//         updateObj.imageUrl = file.path; // Cloudinary full URL
//       }

//       // Always update lastUpdated timestamp
//       updateObj.lastUpdated = new Date();

//       return updateObj;
//     };

//     // Build a normalized update object from request fields + file + existing doc
//     const updateFields = buildUpdateObject(
//       requestFields,
//       req.file,
//       existingAgent
//     );

//     // Determine if any effective updates besides lastUpdated are present
//     const effectiveKeys = Object.keys(updateFields).filter(
//       (k) => k !== "lastUpdated"
//     );

//     if (effectiveKeys.length === 0) {
//       // No actual changes to apply
//       return res.status(200).json({
//         success: true,
//         message: "No changes detected",
//         data: existingAgent,
//       });
//     }

//     /* ------------------------ Email Uniqueness Check ------------------------ */

//     if (updateFields.email) {
//       const emailExists = await Agent.findOne({
//         email: updateFields.email,
//         agentId: { $ne: agentId }, // exclude current agent
//       });

//       if (emailExists) {
//         return res.status(400).json({
//           success: false,
//           error: `Email "${updateFields.email}" is already in use by another agent`,
//         });
//       }
//     }

//     /* ---------------------- Cloudinary Old Image Cleanup -------------------- */

//     if (req.file && existingAgent.imageUrl) {
//       try {
//         // Extract Cloudinary public_id from existing URL
//         const urlParts = existingAgent.imageUrl.split("/");
//         const publicIdWithExt = urlParts[urlParts.length - 1]; // e.g. "agent-123456789.jpg"
//         const publicIdWithoutExt = publicIdWithExt.split(".")[0]; // "agent-123456789"
//         const fullPublicId = `agent-images/${publicIdWithoutExt}`; // folder + file base name

//         await cloudinary.uploader.destroy(fullPublicId);
//         console.log(`✅ Deleted old Cloudinary image: ${fullPublicId}`);
//       } catch (deleteError) {
//         console.error(
//           "⚠️ Error deleting old Cloudinary image:",
//           deleteError.message
//         );
//         // We don't fail update if image deletion fails
//       }
//     }

//     /* ---------------------------- Final DB Update --------------------------- */

//     const updatedAgent = await Agent.findOneAndUpdate(
//       { agentId },             // filter
//       { $set: updateFields },  // fields to set
//       { new: true, runValidators: true } // return updated doc + run schema validators
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(
//         ", "
//       )}`,
//       data: updatedAgent,
//       imageUrl: updatedAgent.imageUrl, // echo final Cloudinary URL
//     });
//   } catch (err) {
//     console.error("Update agent error:", err);

//     // Handle Mongo duplicate key errors nicely
//     if (err?.code === 11000) {
//       const field = Object.keys(err.keyPattern || {})[0];
//       const value = err.keyValue?.[field];
//       return res.status(400).json({
//         success: false,
//         error: `${field?.[0]?.toUpperCase()}${field?.slice(
//           1
//         )} "${value}" already exists`,
//       });
//     }

//     return res.status(400).json({
//       success: false,
//       error: err.message || "Failed to update agent",
//     });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                        Get Agents Ordered by Sequence                      */
// /* -------------------------------------------------------------------------- */

// const getAgentsBySequence = async (req, res) => {
//   try {
//     const { activeOnly = "true" } = req.query;

//     // If activeOnly is truthy → filter by isActive: true; else no filter
//     const query = isTruthy(activeOnly) ? { isActive: true } : {};

//     const agents = await Agent.find(query).sort({
//       sequenceNumber: 1, // main ordering
//       agentName: 1,      // tie-breaker by name
//     });

//     return res.status(200).json({ success: true, data: agents });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                                Delete Agent                                */
// /* -------------------------------------------------------------------------- */

// const deleteAgent = async (req, res) => {
//   try {
//     // Delete a single agent by agentId
//     const agent = await Agent.findOneAndDelete({ agentId: req.query.agentId });

//     if (!agent) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Agent not found" });
//     }

//     // If the agent had a local image path (NOT Cloudinary) remove it from disk
//     if (agent.imageUrl) {
//       // NOTE: stripLeadingSlash is assumed to be defined somewhere else in your project.
//       // It should remove any leading "/" so path.join behaves correctly.
//       const filePath = path.join(
//         __dirname,
//         "../public",
//         stripLeadingSlash(agent.imageUrl)
//       );

//       fs.promises.unlink(filePath).catch((e) => {
//         if (e?.code !== "ENOENT") {
//           console.warn("⚠️  Failed to delete image:", e.message);
//         }
//       });
//     }

//     // Optional: you might reorder sequence numbers here if needed
//     // await Agent.reorderSequences();

//     return res.status(200).json({ success: true, msg: "Agent Removed" });
//   } catch (err) {
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                                  Exports                                   */
// /* -------------------------------------------------------------------------- */

// module.exports = {
//   createAgent,
//   getAgents,
//   getAgentById,
//   getAgentByEmail,
//   updateAgent,
//   getAgentsBySequence,
//   deleteAgent,
// };



const Agent = require("../Models/AgentModel");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const isTruthy = (v) => v === true || v === "true";
const clampInt = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

const createAgent = async (req, res) => {
  try {

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path; 
      req.body.imageUrl = imageUrl;
    }

    if (req.body.superAgent !== undefined) {
      req.body.superAgent = isTruthy(req.body.superAgent);
    }

    // ✅ NEW: Handle activeOnLeaderboard boolean
    if (req.body.activeOnLeaderboard !== undefined) {
      req.body.activeOnLeaderboard = isTruthy(req.body.activeOnLeaderboard);
    } else {
      // Default to true if not provided
      req.body.activeOnLeaderboard = true;
    }

    // Validate and enforce unique sequenceNumber if provided
    if (req.body.sequenceNumber) {
      const sequenceNumber = clampInt(req.body.sequenceNumber);
      if (sequenceNumber < 1) {
        return res.status(400).json({
          success: false,
          error: "Sequence number must be at least 1",
        });
      }
      const existingAgent = await Agent.findOne({ sequenceNumber });
      if (existingAgent) {
        return res.status(400).json({
          success: false,
          error: `Sequence number ${sequenceNumber} is already taken by agent: ${existingAgent.agentName}`,
        });
      }
      req.body.sequenceNumber = sequenceNumber;
    }

    const agent = await Agent.create(req.body);

    return res.status(201).json({
      success: true,
      data: agent,
      imageUrl: imageUrl, 
    });
  } catch (err) {
    console.error("Create agent error:", err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

const getAgents = async (req, res) => {
  try {
    let { isActive } = req.query;
    const pipeline = [];

    if (isActive === "True") {
      pipeline.push({ $match: { isActive: true } });
      //It will show All agents
    } else if (isActive === "False") {
      null;
    }
    // If no query → do not push a $match (returns all)

    pipeline.push(
      { $sort: { sequenceNumber: 1, agentName: 1 } },
      {
        $project: {
          agentName: 1,
          agentLanguage: 1,
          designation: 1,
          superAgent: 1,
          email: 1,
          whatsapp: 1,
          instagram: 1,
          linkedin: 1,
          phone: 1,
          imageUrl: 1,
          activeSaleListings: 1,
          propertiesSoldLast15Days: 1,
          isActive: 1,
          agentId: 1,
          leaderboard: 1,
          sequenceNumber: 1,
          reraNumber: 1,
          activeOnLeaderboard: 1,
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },
          blogsCount: { $size: { $ifNull: ["$blogs", []] } },
        },
      }
    );

    const agents = await Agent.aggregate(pipeline).allowDiskUse(true);

    return res.status(200).json({
      success: true,
      data: agents,
      total: agents.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findOne({ agentId: req.query.agentId });
    if (!agent)
      return res.status(404).json({ success: false, error: "Agent not found" });
    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const getAgentByEmail = async (req, res) => {
  try {
    const agent = await Agent.findOne(
      { email: req.query.email },
      {
        agentName: 1,
        designation: 1,
        reraNumber: 1,
        specialistAreas: 1,
        email: 1,
        phone: 1,
        whatsapp: 1,
        instagram: 1,
        linkedin: 1,
        activeSaleListings: 1,
        propertiesSoldLast15Days: 1,
        isActive: 1,
        agentId: 1,
        registeredDate: 1,
        lastUpdated: 1,
        blogs: 1,
        imageUrl: 1,
        agentLanguage: 1,
        leaderboard: 1,
        superAgent: 1,
      }
    );

    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const updateAgent = async (req, res) => {
  try {
    const { agentId, ...requestFields } = req.body || {};

    if (!agentId) {
      return res
        .status(400)
        .json({ success: false, error: "Agent ID is required" });
    }

    const existingAgent = await Agent.findOne({ agentId });
    if (!existingAgent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    // Handle sequenceNumber swap if changed
    if (requestFields.sequenceNumber !== undefined) {
      const newSequenceNumber = clampInt(requestFields.sequenceNumber, NaN);
      if (!Number.isFinite(newSequenceNumber) || newSequenceNumber < 1) {
        return res.status(400).json({
          success: false,
          error: "Sequence number must be a positive integer",
        });
      }

      if (existingAgent.sequenceNumber !== newSequenceNumber) {
        if (typeof Agent.swapSequenceNumbers !== "function") {
          return res.status(500).json({
            success: false,
            error:
              "Sequence swap not available: Agent.swapSequenceNumbers is undefined.",
          });
        }
        try {
          await Agent.swapSequenceNumbers(agentId, newSequenceNumber);
          const updatedAgent = await Agent.findOne({ agentId });
          return res.status(200).json({
            success: true,
            message: `Agent sequence number updated successfully to ${newSequenceNumber}`,
            data: updatedAgent,
          });
        } catch (swapError) {
          return res.status(400).json({
            success: false,
            error: `Failed to update sequence number: ${swapError.message}`,
          });
        }
      } else {
        delete requestFields.sequenceNumber;
      }
    }

    // Build update object
    const buildUpdateObject = (fields, file, currentAgent) => {
      const updateObj = {};
      const allowedFields = [
        "agentName",
        "designation",
        "reraNumber",
        "specialistAreas",
        "description",
        "email",
        "phone",
        "whatsapp",
        "instagram",
         "linkedin",
        "activeSaleListings",
        "propertiesSoldLast15Days",
        "agentLanguage",
        "isActive",
        "superAgent",
        "activeOnLeaderboard",
      ];

      for (const field of allowedFields) {
        const value = fields[field];
        if (value === undefined || value === "") continue;

        if (field === "email") {
          if (value !== currentAgent.email) updateObj[field] = value;
          continue;
        }

        switch (field) {
          case "specialistAreas":
            if (typeof value === "string") {
              try {
                updateObj[field] = JSON.parse(value);
              } catch {
                updateObj[field] = value;
              }
            } else {
              updateObj[field] = value;
            }
            break;

          case "activeSaleListings":
          case "propertiesSoldLast15Days":
            updateObj[field] = clampInt(value, 0);
            break;

          case "isActive":
          case "superAgent":
          case "activeOnLeaderboard": // ✅ NEW: Handle activeOnLeaderboard boolean
            updateObj[field] = isTruthy(value);
            break;

          default:
            updateObj[field] = value;
        }
      }

      // ✅ CLOUDINARY: Handle file upload with full URL
      if (file) {
        updateObj.imageUrl = file.path; // Cloudinary full URL
      }

      updateObj.lastUpdated = new Date();
      return updateObj;
    };

    const updateFields = buildUpdateObject(
      requestFields,
      req.file,
      existingAgent
    );

    // If no actual changes besides lastUpdated, return existing
    const effectiveKeys = Object.keys(updateFields).filter(
      (k) => k !== "lastUpdated"
    );
    if (effectiveKeys.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        data: existingAgent,
      });
    }

    // Email uniqueness check
    if (updateFields.email) {
      const emailExists = await Agent.findOne({
        email: updateFields.email,
        agentId: { $ne: agentId },
      });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: `Email "${updateFields.email}" is already in use by another agent`,
        });
      }
    }

    // ✅ CLOUDINARY: Delete old image if new one is uploaded
    if (req.file && existingAgent.imageUrl) {
      try {
        // Extract public_id from Cloudinary URL
        // Example URL: https://res.cloudinary.com/dxxxxxxxx/image/upload/v123456/agent-images/agent-123456789.jpg
        const urlParts = existingAgent.imageUrl.split("/");
        const publicIdWithExt = urlParts[urlParts.length - 1]; // agent-123456789.jpg
        const publicIdWithoutExt = publicIdWithExt.split(".")[0]; // agent-123456789
        const fullPublicId = `agent-images/${publicIdWithoutExt}`; // agent-images/agent-123456789

        await cloudinary.uploader.destroy(fullPublicId);
        console.log(`✅ Deleted old Cloudinary image: ${fullPublicId}`);
      } catch (deleteError) {
        console.error(
          "⚠️ Error deleting old Cloudinary image:",
          deleteError.message
        );
        // Continue with update even if deletion fails
      }
    }

    const updatedAgent = await Agent.findOneAndUpdate(
      { agentId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: `Agent updated successfully. Updated fields: ${effectiveKeys.join(
        ", "
      )}`,
      data: updatedAgent,
      imageUrl: updatedAgent.imageUrl, // ✅ Return Cloudinary URL
    });
  } catch (err) {
    console.error("Update agent error:", err);

    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const value = err.keyValue?.[field];
      return res.status(400).json({
        success: false,
        error: `${field?.[0]?.toUpperCase()}${field?.slice(
          1
        )} "${value}" already exists`,
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message || "Failed to update agent",
    });
  }
};



const getAgentsBySequence = async (req, res) => {
  try {
    const { activeOnly = "true" } = req.query;
    const query = isTruthy(activeOnly) ? { isActive: true } : {};
    const agents = await Agent.find(query).sort({
      sequenceNumber: 1,
      agentName: 1,
    });
    return res.status(200).json({ success: true, data: agents });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findOneAndDelete({ agentId: req.query.agentId });
    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    if (agent.imageUrl) {
      // Fix path joining with leading slash
      const filePath = path.join(
        __dirname,
        "../public",
        stripLeadingSlash(agent.imageUrl)
      );
      fs.promises.unlink(filePath).catch((e) => {
        if (e?.code !== "ENOENT")
          console.warn("⚠️  Failed to delete image:", e.message);
      });
    }

    // Optionally: await Agent.reorderSequences();
    return res.status(200).json({ success: true, msg: "Agent Removed" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createAgent,
  getAgents,
  getAgentById,
  getAgentByEmail,
  updateAgent,
  getAgentsBySequence,
  deleteAgent,
};