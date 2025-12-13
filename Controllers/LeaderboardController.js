// const axios = require("axios");
// const Agent = require("../Models/AgentModel");
// const cron = require("node-cron");

// // This will check if another cron is running , if so it will block this local cron job
// let masterSyncRunning = false;
// async function runAllSyncsLocked(fnName, fn) {
//   if (masterSyncRunning) {
//     console.log(`⏳ [SYNC LOCK] ${fnName} skipped; another sync is running.`);
//     return { skipped: true };
//   }
//   masterSyncRunning = true;
//   try {
//     return await fn();
//   } finally {
//     masterSyncRunning = false;
//   }
// }

// // Cache last stable leaderboard response so UI sees consistent data during cron
// let lastLeaderboardCache = null;
// let lastLeaderboardCacheAt = null;

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Name normalization
//  *  ─────────────────────────────────────────────────────────────────────────── */
// function normalizeAgentName(name) {
//   if (!name) return "";
//   return String(name)
//     .normalize("NFKD") // strip diacritics where possible
//     .replace(/[\u0300-\u036f]/g, "")
//     .toLowerCase()
//     .trim()
//     .replace(/\s+/g, " ")
//     .replace(/[^\w\s]/g, "");
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Salesforce / HTTP
//  *  ─────────────────────────────────────────────────────────────────────────── */
// const SALESFORCE = {
//   tokenUrl: process.env.SALESFORCE_TOKEN_URL,
//   baseUrl: "https://arabianestates.my.salesforce.com",
//   clientId: process.env.SALESFORCE_CLIENT_ID,
//   clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
//   username: process.env.SALESFORCE_USERNAME,
//   password: process.env.SALESFORCE_PASSWORD,
// };

// const axiosSF = axios.create({
//   baseURL: SALESFORCE.baseUrl,
//   timeout: 30_000,
//   headers: { Accept: "application/json", "Content-Type": "application/json" },
// });

// // Simple retry helper for transient errors
// async function withRetry(fn, { retries = 2, delayMs = 600 } = {}) {
//   let lastErr;
//   for (let i = 0; i <= retries; i++) {
//     try {
//       return await fn();
//     } catch (err) {
//       lastErr = err;
//       const status = err?.response?.status;
//       const code = err?.code;
//       const retryable =
//         status === 429 ||
//         (status >= 500 && status < 600) ||
//         ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
//       if (!retryable || i === retries) break;
//       await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
//     }
//   }
//   throw lastErr;
// }

// // OAuth2 token
// async function getSalesforceToken() {
//   try {
//     const resp = await axios.post(SALESFORCE.tokenUrl, null, {
//       params: {
//         grant_type: "client_credentials",
//         client_id: SALESFORCE.clientId,
//         client_secret: SALESFORCE.clientSecret,
//         username: SALESFORCE.username,
//         password: SALESFORCE.password,
//       },
//     });
//     return resp.data.access_token;
//   } catch (error) {
//     console.error("❌ Failed to generate Salesforce token:", error.message);
//     throw new Error("Salesforce token generation failed");
//   }
// }

// // Apex REST GET with token + retry
// async function sfGet(pathname, params = {}) {
//   const token = await getSalesforceToken();
//   return withRetry(() =>
//     axiosSF.get(pathname, {
//       params,
//       headers: { Authorization: `Bearer ${token}` },
//     })
//   );
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  UTC date helpers (critical for month/year boundaries)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// function toUtcDate(input) {
//   if (!input) return null;
//   if (input instanceof Date) return input;
//   const s = String(input);
//   // If lacks TZ info, assume UTC (append 'Z')
//   const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);
//   const d = new Date(hasTZ ? s : `${s}Z`);
//   return Number.isNaN(d.getTime()) ? null : d;
// }

// function isSameUtcMonth(dateLike, targetY, targetM) {
//   const d = toUtcDate(dateLike);
//   if (!d) return false;
//   return d.getUTCFullYear() === targetY && d.getUTCMonth() === targetM; // 0..11
// }

// function utcTodayStart() {
//   const d = new Date();
//   d.setUTCHours(0, 0, 0, 0);
//   return d;
// }
// function allowZeroingNow() {
//   const now = new Date();
//   const minsFromMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
//   return minsFromMidnight > 45; // skip zeroing in first 45 minutes of UTC day
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Month resolver (for manual deals endpoint)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// function resolveMonthUTC(monthParam = "this_month") {
//   const now = new Date();
//   let y = now.getUTCFullYear();
//   let m = now.getUTCMonth();

//   if (monthParam === "last_month") {
//     if (m === 0) {
//       y -= 1;
//       m = 11;
//     } else {
//       m -= 1;
//     }
//   } else if (/^\d{4}-\d{2}$/.test(monthParam)) {
//     const [yy, mm] = monthParam.split("-").map(Number);
//     y = yy;
//     m = mm - 1;
//   }
//   return { targetY: y, targetM: m };
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Target month/year meta helper (1-based month + ISO)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// function buildTargetUTCMeta(targetY, targetM) {
//   return {
//     year: targetY,
//     monthIndex0: targetM, // keep 0-based for debugging/backwards compatibility
//     month: targetM + 1, // 1-based for UI (1–12)
//     isoMonth: `${targetY}-${String(targetM + 1).padStart(2, "0")}`,
//   };
// }

// // --- helpers ---
// function parseUtcDate(s) {
//   if (!s) return null;
//   const d = new Date(s);
//   return isNaN(d.getTime()) ? null : d;
// }

// function amountNumber(raw) {
//   return typeof raw === "string" ? Number(raw.replace(/[, ]/g, "")) : Number(raw) || 0;
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Commission effective date helper (shared)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// const COMMISSION_CONTRACT_DATE_TYPES = new Set([
//   "Landlord Commission",
//   "Landlord Referral Commission",
//   "Tenant Commission",
//   "Tenant Referral",
// ]);

// function getEffectiveDateForCommission(c) {
//   const recordType = c?.record_type;

//   // For these types: use offer_contract_date
//   if (COMMISSION_CONTRACT_DATE_TYPES.has(recordType)) {
//     return c.offer_contract_date || null;
//   }

//   // For all other record types: use from_f_startdate
//   return c.from_f_startdate;
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Leaderboard snapshot builder (current UTC month)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// async function buildLeaderboardSnapshotCurrentMonth() {
//   const nowUTC = new Date();
//   const targetY = nowUTC.getUTCFullYear();
//   const targetM = nowUTC.getUTCMonth(); // 0..11

//   console.log(
//     `🔄 [LEADERBOARD SNAPSHOT] Building for UTC ${targetY}-${String(
//       targetM + 1
//     ).padStart(2, "0")}`
//   );

//   // 1) Pull all required Salesforce datasets in parallel  ⭐ ADDED listingsAPI
//   const [
//     dealsMonthlyResp,
//     dealsYtdResp,
//     commissionsResp,
//     viewingsResp,
//     listingsResp,
//   ] = await Promise.all([
//     sfGet("/services/apexrest/deals", { month: "this_month" }),
//     sfGet("/services/apexrest/deals", { month: "ytd" }),
//     sfGet("/services/apexrest/commissions"),
//     sfGet("/services/apexrest/viewings"),
//     sfGet("/services/apexrest/listingsAPI"),
//   ]);

//   const monthlyDealsRaw = dealsMonthlyResp?.data?.deals || [];
//   let ytdDealsRaw = dealsYtdResp?.data?.deals || [];
//   const commissionsRaw = commissionsResp?.data?.commissions || [];
//   const viewingsRaw = viewingsResp?.data?.viewings || [];
//   const listingsRaw = listingsResp?.data?.listings || []; // based on sample payload

//   // 2) Load all active agents once
//   const agents = await Agent.find({ activeOnLeaderboard: true });

//   const agentMap = new Map(
//     agents.map((a) => [normalizeAgentName(a.agentName), a])
//   );

//   // NEW: map by email for listings lookup (adjust field if your schema uses a different name)
//   const agentEmailMap = new Map(
//     agents
//       .filter((a) => a.email) // 🔴 if your schema uses agentEmail, change this line
//       .map((a) => [a.email.trim().toLowerCase(), a])
//   );

//   // 3) Snapshot metrics per agent (keyed by normalized name)
//   const metricsByKey = new Map();

//   const ensureMetrics = (key) => {
//     let m = metricsByKey.get(key);
//     if (!m) {
//       m = {
//         propertiesSold: 0,
//         totalCommission: 0,
//         viewings: 0,
//         lastDealDate: null,
//         // ⭐ NEW
//         activePropertiesThisMonth: 0,
//       };
//       metricsByKey.set(key, m);
//     }
//     return m;
//   };

//   /* ───────────── DEALS: propertiesSold + lastDealDate ───────────── */

//   const monthlyDeals = monthlyDealsRaw.filter((d) =>
//     isSameUtcMonth(d?.createddate, targetY, targetM)
//   );

//   const unmatchedMonthly = [];
//   const unmatchedYtd = [];

//   // ✅ MIRRORED LOGIC: use deal_agent, deal_agent_1, deal_agent_2 + dedupe
//   const namesFromDeal = (deal) => {
//     const nameCandidates = [];
//     if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
//     if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
//     if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

//     return [
//       ...new Set(
//         nameCandidates
//           .map((n) => (typeof n === "string" ? n.trim() : "").trim())
//           .filter(Boolean)
//       ),
//     ];
//   };

//   // Monthly deal counts
//   for (const deal of monthlyDeals) {
//     const names = namesFromDeal(deal);
//     if (!names.length) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key || !agentMap.has(key)) {
//         if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//         continue;
//       }
//       const m = ensureMetrics(key);
//       m.propertiesSold += 1;
//     }
//   }

//   // YTD lastDealDate
//   for (const deal of ytdDealsRaw) {
//     const names = namesFromDeal(deal);
//     if (!names.length) continue;

//     const created = deal.createddate;
//     const dealDate = created ? new Date(created) : null;
//     if (!dealDate || Number.isNaN(dealDate.getTime())) continue;

//     for (const nm of names) {
//       const key = normalizeAgentName(nm);
//       if (!key) continue;
//       if (!agentMap.has(key)) {
//         if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//         continue;
//       }
//       const m = ensureMetrics(key);
//       if (!m.lastDealDate || dealDate > m.lastDealDate) {
//         m.lastDealDate = dealDate;
//       }
//     }
//   }

//   /* ───────────── COMMISSIONS: totalCommission ───────────── */

//   const unmatchedCommissionAgents = [];
//   let filteredCommissionsCount = 0;

//   for (const c of commissionsRaw) {
//     const effectiveDate = getEffectiveDateForCommission(c);
//     const keep =
//       effectiveDate && isSameUtcMonth(effectiveDate, targetY, targetM);

//     if (!keep) continue;
//     filteredCommissionsCount++;

//     const agentName = c.agent_name || c.commission_agents;
//     if (!agentName) continue;

//     const key = normalizeAgentName(agentName);
//     if (!agentMap.has(key)) {
//       if (!unmatchedCommissionAgents.includes(agentName)) {
//         unmatchedCommissionAgents.push(agentName);
//       }
//       continue;
//     }

//     const rawAmount = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
//     const amt = amountNumber(rawAmount);

//     const m = ensureMetrics(key);
//     m.totalCommission += amt;
//   }

//   /* ───────────── VIEWINGS: viewings count ───────────── */

//   const unmatchedViewingOwners = new Set();

//   const currentMonthViewings = viewingsRaw.filter((v) =>
//     isSameUtcMonth(v?.start, targetY, targetM)
//   );

//   for (const v of currentMonthViewings) {
//     const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
//     const key = normalizeAgentName(owner);
//     if (!key) continue;

//     if (agentMap.has(key)) {
//       const m = ensureMetrics(key);
//       m.viewings += 1;
//     } else if (owner) {
//       unmatchedViewingOwners.add(owner);
//     }
//   }

//   /* ───────────── LISTINGS: activePropertiesThisMonth (new endpoint) ───────────── */

//   // Relisted IDs example:
//   //   Original: "PB-S-15856"   -> 2 hyphens, 3 segments
//   //   Relisted: "PB-S-15857-2" -> 3 hyphens, 4 segments, last purely numeric
//   const isRelistedId = (id) => {
//     if (!id) return false;

//     const segments = id.split("-"); // "PB-S-15856" -> 3, "PB-S-15857-2" -> 4

//     // Original IDs: 2 hyphens → 3 segments (PB-S-15856)
//     // Relisted IDs: 3 hyphens → 4 segments (PB-S-15857-2) with numeric last segment
//     if (segments.length <= 3) {
//       return false;
//     }

//     const lastSegment = segments[segments.length - 1];
//     return /^\d+$/.test(lastSegment); // relisted only if last part is purely numeric
//   };

//   // Base id helper: "PB-S-15857-2" → "PB-S-15857"
//   const getBaseId = (id) => {
//     if (!id) return null;
//     const segments = id.split("-");
//     if (segments.length < 3) return id.trim();
//     return segments.slice(0, 3).join("-");
//   };

//   let totalListingsConsidered = 0;
//   let totalListingsMatched = 0;
//   let totalActivePropsThisMonth = 0;
//   const unmatchedListingEmails = new Set();

//   // Track which base property IDs we've already counted per agent
//   // key = normalized agent name, value = Set of baseIds
//   const listingsPerAgentBaseIds = new Map();

//   console.log("📊 Processing listingsAPI for activePropertiesThisMonth...");

//   for (const listing of listingsRaw) {
//     totalListingsConsidered++;

//     const status = listing.status;
//     const id = listing.id;
//     const email = listing.listing_agent_email;
//     const pfDateRaw = listing.PF_Published_Date;

//     if (!pfDateRaw) continue;

//     // "2025-11-20 14:29:17" → Date
//     const pfDate = new Date(pfDateRaw.replace(" ", "T") + "Z");
//     if (!pfDate || Number.isNaN(pfDate.getTime())) continue;

//     // 1) PF_Published_Date in current month (UTC)
//     if (!isSameUtcMonth(pfDate, targetY, targetM)) continue;

//     // 2) status Live only
//     if (status !== "Live") continue;

//     // 3) skip relisted IDs (we only want the original base property)
//     if (isRelistedId(id)) continue;

//     // 4) match agent by email
//     if (!email) {
//       unmatchedListingEmails.add("(missing email)");
//       continue;
//     }

//     const normalizedEmail = email.trim().toLowerCase();
//     const agent = agentEmailMap.get(normalizedEmail);

//     if (!agent) {
//       unmatchedListingEmails.add(normalizedEmail);
//       continue;
//     }

//     const key = normalizeAgentName(agent.agentName);
//     if (!key) continue;

//     // 5) get base ID and de-dupe per agent
//     const baseId = getBaseId(id);
//     if (!baseId) continue;

//     let baseIdSet = listingsPerAgentBaseIds.get(key);
//     if (!baseIdSet) {
//       baseIdSet = new Set();
//       listingsPerAgentBaseIds.set(key, baseIdSet);
//     }

//     // If we've already counted this property for this agent, skip
//     if (baseIdSet.has(baseId)) {
//       continue;
//     }
//     baseIdSet.add(baseId);

//     // 6) increment leaderboard metric via name key
//     const m = ensureMetrics(key);
//     m.activePropertiesThisMonth = (m.activePropertiesThisMonth || 0) + 1;

//     totalListingsMatched++;
//     totalActivePropsThisMonth++;
//   }

//   console.log(
//     `✅ Listings processed → considered: ${totalListingsConsidered}, ` +
//       `matched: ${totalListingsMatched}, activePropertiesThisMonth total: ${totalActivePropsThisMonth}`
//   );

//   if (unmatchedListingEmails.size > 0) {
//     console.log(
//       "⚠️ Unmatched listing_agent_email values:",
//       Array.from(unmatchedListingEmails)
//     );
//   }

//   return {
//     targetY,
//     targetM,
//     targetUTC: buildTargetUTCMeta(targetY, targetM),
//     agents,
//     agentMap,
//     metricsByKey,
//     meta: {
//       deals: {
//         monthlyDeals: monthlyDeals.length,
//         totalDealsResp: monthlyDealsRaw.length,
//         unmatchedMonthly,
//         unmatchedYtd,
//       },
//       commissions: {
//         filteredCommissionsCount,
//         totalCommissionsResp: commissionsRaw.length,
//         unmatchedCommissionAgents,
//       },
//       viewings: {
//         totalViewingsResp: viewingsRaw.length,
//         viewingsThisMonth: currentMonthViewings.length,
//         unmatchedViewingOwners: Array.from(unmatchedViewingOwners),
//       },
//       listings: {
//         totalListingsConsidered,
//         totalListingsMatched,
//         totalActivePropsThisMonth,
//         unmatchedListingEmails: Array.from(unmatchedListingEmails),
//       },
//     },
//   };
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Apply snapshot via bulkWrite
//  *  ─────────────────────────────────────────────────────────────────────────── */
// async function applyLeaderboardSnapshot(snapshot) {
//   const {
//     targetY,
//     targetM,
//     agentMap,
//     metricsByKey,
//     meta,
//   } = snapshot;

//   const todayUTC = utcTodayStart();
//   const canZero = allowZeroingNow();
//   const now = new Date();

//   const ops = [];
//   let agentsTouched = 0;

//   for (const [key, agent] of agentMap.entries()) {
//     const m = metricsByKey.get(key) || {
//       propertiesSold: 0,
//       totalCommission: 0,
//       viewings: 0,
//       lastDealDate: null,
//       activePropertiesThisMonth: 0,
//     };

//     const propertiesSold = m.propertiesSold || 0;
//     const totalCommission =
//       Math.round((m.totalCommission || 0) * 100) / 100;
//     const viewings = m.viewings || 0;
//     const activeProps =
//       typeof m.activePropertiesThisMonth === "number"
//         ? m.activePropertiesThisMonth
//         : 0;

//     let lastDealDays = null;
//     if (m.lastDealDate) {
//       const d0 = new Date(m.lastDealDate);
//       d0.setUTCHours(0, 0, 0, 0);
//       lastDealDays = Math.max(
//         0,
//         Math.floor((todayUTC - d0) / 86400000)
//       );
//     }

//     const $set = {
//       "leaderboard.lastUpdated": now,
//       lastUpdated: now,
//     };

//     if (propertiesSold !== 0 || canZero) {
//       $set["leaderboard.propertiesSold"] = propertiesSold;
//     }
//     if (totalCommission !== 0 || canZero) {
//       $set["leaderboard.totalCommission"] = totalCommission;
//     }
//     if (viewings !== 0 || canZero) {
//       $set["leaderboard.viewings"] = viewings;
//     }

//     // ⭐ IMPORTANT: always overwrite activePropertiesThisMonth from snapshot
//     // This ensures ONLY the cron snapshot controls this field, no stale values.
//     $set["leaderboard.activePropertiesThisMonth"] = activeProps;

//     if (m.lastDealDate) {
//       $set["leaderboard.lastDealDate"] = m.lastDealDate;
//       $set["leaderboard.lastDealDays"] = lastDealDays;
//     } else if (canZero) {
//       $set["leaderboard.lastDealDate"] = null;
//       $set["leaderboard.lastDealDays"] = null;
//     }

//     ops.push({
//       updateOne: {
//         filter: { _id: agent._id },
//         update: { $set },
//       },
//     });

//     if (
//       propertiesSold !== 0 ||
//       totalCommission !== 0 ||
//       viewings !== 0 ||
//       activeProps !== 0 ||
//       m.lastDealDate
//     ) {
//       agentsTouched++;
//     }
//   }

//   if (!ops.length) {
//     console.log(
//       `ℹ️ [LEADERBOARD SNAPSHOT] No leaderboard updates needed for UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );
//     return {
//       targetY,
//       targetM,
//       targetUTC: buildTargetUTCMeta(targetY, targetM),
//       agentsTouched: 0,
//       meta,
//     };
//   }

//   await Agent.bulkWrite(ops, { ordered: false });

//   console.log(
//     `✅ [LEADERBOARD SNAPSHOT] Applied in single bulkWrite for UTC ${targetY}-${String(
//       targetM + 1
//     ).padStart(2, "0")} → Agents touched: ${agentsTouched}`
//   );

//   if (meta?.listings) {
//     console.log(
//       `📊 [LEADERBOARD SNAPSHOT] Listings summary → ` +
//         `considered: ${meta.listings.totalListingsConsidered}, ` +
//         `matched: ${meta.listings.totalListingsMatched}, ` +
//         `activePropertiesThisMonth total: ${meta.listings.totalActivePropsThisMonth}`
//     );
//   }

//   return {
//     targetY,
//     targetM,
//     targetUTC: buildTargetUTCMeta(targetY, targetM),
//     agentsTouched,
//     meta,
//   };
// }

// async function syncLeaderboardCoreCurrentMonth() {
//   const snapshot = await buildLeaderboardSnapshotCurrentMonth();
//   const result = await applyLeaderboardSnapshot(snapshot);
  
//   // 🔥 CRITICAL: Update cache ONLY after successful DB write
//   // This ensures the cache is always populated with the latest committed data
//   try {
//     await updateLeaderboardCache();
//     console.log("✅ [CACHE] Leaderboard cache updated successfully");
//   } catch (cacheError) {
//     console.error("⚠️ [CACHE] Failed to update cache:", cacheError.message);
//     // Don't throw - cache update failure shouldn't stop the sync
//   }
  
//   return result;
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Update leaderboard cache from DB (called after successful bulkWrite)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// async function updateLeaderboardCache() {
//   const pipeline = [
//     {
//       $match: {
//         activeOnLeaderboard: true
//       }
//     },
//     {
//       $project: {
//         agentName: 1,
//         agentLanguage: 1,
//         designation: 1,
//         email: 1,
//         whatsapp: 1,
//         phone: 1,
//         imageUrl: 1,
//         isActive: 1,
//         agentId: 1,
//         leaderboard: 1,
//         sequenceNumber: 1,
//         reraNumber: 1,
//         propertiesCount: { $size: { $ifNull: ["$properties", []] } },
//       },
//     },
//     {
//       $addFields: {
//         _commission: { $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] } },
//         _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
//       },
//     },
//     { $sort: { _commission: -1, _tieSeq: 1 } },
//   ];

//   const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

//   const globalTotalCommission = allAgents.reduce(
//     (sum, a) => sum + (a.leaderboard?.totalCommission ?? 0),
//     0
//   );

//   const agentsWithPositions = allAgents.map((agent, index) => ({
//     position: index + 1,
//     name: agent.agentName,
//     imageUrl: agent.imageUrl,
//     leaderboard: {
//       activePropertiesThisMonth: agent.leaderboard?.activePropertiesThisMonth ?? 0,
//       propertiesSold: agent.leaderboard?.propertiesSold ?? 0,
//       totalCommission: agent.leaderboard?.totalCommission ?? 0,
//       lastDealDate: agent.leaderboard?.lastDealDate ?? null,
//       viewings: agent.leaderboard?.viewings ?? 0,
//       lastDealDays: agent.leaderboard?.lastDealDays ?? 0,
//       offers: agent.leaderboard?.offers ?? 0,
//     },
//     propertiesCount: agent.propertiesCount ?? 0,
//     agentId: agent.agentId,
//   }));

//   // Store complete leaderboard data in cache
//   lastLeaderboardCache = {
//     success: true,
//     allAgents: agentsWithPositions, // Store all agents for pagination
//     globalTotalCommission,
//     cachedAt: new Date(),
//   };
  
//   lastLeaderboardCacheAt = new Date();
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Cron orchestration (now using parser-style leaderboard snapshot)
//  *  ─────────────────────────────────────────────────────────────────────────── */
// async function runAllSyncs() {
//   return runAllSyncsLocked("master-sync", async () => {
//     console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
//     const t0 = Date.now();
//     try {
//       // 1) Build & apply leaderboard snapshot in one shot (cache updated inside)
//       const leaderboardResult = await syncLeaderboardCoreCurrentMonth();

//       const sec = ((Date.now() - t0) / 1000).toFixed(2);
//       console.log(
//         `✅ [CRON] All syncs completed successfully in ${sec}s`
//       );
//       console.log(
//         `   → Leaderboard: agentsTouched=${leaderboardResult.agentsTouched}, month=${leaderboardResult.targetM + 1}/${leaderboardResult.targetY}`
//       );
//     } catch (error) {
//       console.error("❌ [CRON] Error in scheduled sync job:", error.message);
//     }
//   });
// }

// let cronScheduled = false;
// function setupCronJobs() {
//   if (cronScheduled) {
//     console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
//     return;
//   }

//   // Every 12 minutes, pinned to UTC
//   cron.schedule(
//     "*/12 * * * *",
//     async () => {
//       const now = new Date().toISOString();
//       console.log(`🔔 [CRON TICK] Triggered at ${now} (UTC)`);
//       await runAllSyncs(); // mutex-protected, snapshot-style
//     },
//     { timezone: "UTC" }
//   );

//   cronScheduled = true;
//   console.log("✅ Cron job scheduled: Salesforce sync will run every 12 minutes (UTC)");

//   // Optional immediate run (also mutex-protected)
//   console.log("🚀 Running initial sync on startup...");
//   runAllSyncs();
// }

// /** ───────────────────────────────────────────────────────────────────────────
//  *  API Handlers Manual FUncitons
//  *  ─────────────────────────────────────────────────────────────────────────── */

// // Manual: OAuth token (useful for diagnostics; don't expose publicly)
// const GetSalesForceToken = async (req, res) => {
//   try {
//     console.log("WORKING");
//     const resp = await axios.post(SALESFORCE.tokenUrl, null, {
//       params: {
//         grant_type: "client_credentials",
//         client_id: SALESFORCE.clientId,
//         client_secret: SALESFORCE.clientSecret,
//         username: SALESFORCE.username,
//         password: SALESFORCE.password,
//       },
//     });
//     console.log(resp.data.access_token);
//     return res.status(200).json({ access_token: resp.data.access_token });
//   } catch (error) {
//     console.error("❌ Failed to generate Salesforce token:", error.message);
//     return res.status(500).json({ success: false, error: "Salesforce token generation failed" });
//   }
// };

// // Leaderboard (sorts by totalCommission desc, with seq tiebreaker)
// const getLeaderboardAgents = async (req, res) => {
//   try {
//     const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
//     const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
//     const skip = (page - 1) * limit;

//     // 🔥 CRITICAL: Serve from cache while sync is running
//     if (masterSyncRunning && lastLeaderboardCache) {
//       console.log(
//         "📊 [LEADERBOARD] Serving cached leaderboard while master sync is running."
//       );
      
//       const allAgents = lastLeaderboardCache.allAgents;
//       const total = allAgents.length;
//       const totalPages = Math.ceil(total / limit);
//       const paginatedAgents = allAgents.slice(skip, skip + limit);

//       return res.status(200).json({
//         success: true,
//         data: paginatedAgents,
//         pagination: {
//           page,
//           limit,
//           totalItems: total,
//           totalPages,
//           hasPrev: page > 1,
//           hasNext: page < totalPages,
//         },
//         globalTotalCommission: lastLeaderboardCache.globalTotalCommission,
//         cached: true,
//         cachedAt: lastLeaderboardCache.cachedAt,
//       });
//     }

//     // Normal flow: query database directly
//     const pipeline = [
//       {
//         $match: {
//           activeOnLeaderboard: true
//         }
//       },
//       {
//         $project: {
//           agentName: 1,
//           agentLanguage: 1,
//           designation: 1,
//           email: 1,
//           whatsapp: 1,
//           phone: 1,
//           imageUrl: 1,
//           isActive: 1,
//           agentId: 1,
//           leaderboard: 1,
//           sequenceNumber: 1,
//           reraNumber: 1,
//           propertiesCount: { $size: { $ifNull: ["$properties", []] } },
//         },
//       },
//       {
//         $addFields: {
//           _commission: { $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] } },
//           _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
//         },
//       },
//       { $sort: { _commission: -1, _tieSeq: 1 } },
//     ];

//     const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

//     const globalTotalCommission = allAgents.reduce(
//       (sum, a) => sum + (a.leaderboard?.totalCommission ?? 0),
//       0
//     );

//     const agentsWithPositions = allAgents.map((agent, index) => ({
//       ...agent,
//       position: index + 1,
//     }));

//     const paginatedAgents = agentsWithPositions.slice(skip, skip + limit);
//     const total = agentsWithPositions.length;
//     const totalPages = Math.ceil(total / limit);

//     const mapped = paginatedAgents.map((a) => ({
//       position: a.position,
//       name: a.agentName,
//       imageUrl: a.imageUrl,
//       leaderboard: {
//         activePropertiesThisMonth: a.leaderboard?.activePropertiesThisMonth ?? 0,
//         propertiesSold: a.leaderboard?.propertiesSold ?? 0,
//         totalCommission: a.leaderboard?.totalCommission ?? 0,
//         lastDealDate: a.leaderboard?.lastDealDate ?? null,
//         viewings: a.leaderboard?.viewings ?? 0,
//         lastDealDays: a.leaderboard?.lastDealDays ?? 0,
//         offers: a.leaderboard?.offers ?? 0,
//       },
//       propertiesCount: a.propertiesCount ?? 0,
//       agentId: a.agentId,
//     }));

//     return res.status(200).json({
//       success: true,
//       data: mapped,
//       pagination: {
//         page,
//         limit,
//         totalItems: total,
//         totalPages,
//         hasPrev: page > 1,
//         hasNext: page < totalPages,
//       },
//       globalTotalCommission,
//       cached: false,
//     });
//   } catch (err) {
//     // 🔥 Fallback to cache if DB query fails and cache exists
//     if (lastLeaderboardCache) {
//       console.log("⚠️ [LEADERBOARD] DB error, falling back to cached data");
      
//       const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
//       const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
//       const skip = (page - 1) * limit;
      
//       const allAgents = lastLeaderboardCache.allAgents;
//       const total = allAgents.length;
//       const totalPages = Math.ceil(total / limit);
//       const paginatedAgents = allAgents.slice(skip, skip + limit);

//       return res.status(200).json({
//         success: true,
//         data: paginatedAgents,
//         pagination: {
//           page,
//           limit,
//           totalItems: total,
//           totalPages,
//           hasPrev: page > 1,
//           hasNext: page < totalPages,
//         },
//         globalTotalCommission: lastLeaderboardCache.globalTotalCommission,
//         cached: true,
//         cachedAt: lastLeaderboardCache.cachedAt,
//         fallback: true,
//       });
//     }
    
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// /** ───────────────────────────────────────────────────────────────────────────
//  *  Manual sync endpoints (kept for debugging / analytics)
//  *  ─────────────────────────────────────────────────────────────────────────── */

// const syncAgentDealsFromSalesforce = async (req, res) => {
//   try {
//     const { month = "this_month" } = req.query;

//     // Reuse the same helpers you used for commissions sync
//     const { targetY, targetM } = resolveMonthUTC(month);

//     console.log(
//       `🔄 Starting Salesforce DEALS-ONLY sync for: ${month} -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     // Fetch deals:
//     // - monthly: for counting deals in the selected month
//     // - ytd (or this_year): for lastDealDate (latest in the calendar year)
//     const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
//       sfGet("/services/apexrest/deals", { month }),
//       sfGet("/services/apexrest/deals", { month: "ytd" }),
//     ]);

//     const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
//     const ytdDealsRaw = ytdDealsResp?.data?.deals || [];

//     // Strict month filter (createddate ONLY), same rule as commissions
//     const monthlyDeals = monthlyDealsRaw.filter((d) =>
//       isSameUtcMonth(d.createddate, targetY, targetM)
//     );

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     // ===== MONTHLY DEAL COUNTS =====
//     const dealCountsByAgent = new Map();
//     const unmatchedMonthly = [];

//     for (const deal of monthlyDeals) {
//       // ✅ UPDATED LOGIC: Use deal_agent, deal_agent_1, deal_agent_2
//       const nameCandidates = [];
//       if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
//       if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
//       if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

//       // Clean + dedupe per deal to avoid double-counting same agent
//       const names = [
//         ...new Set(
//           nameCandidates
//             .map((n) => (typeof n === "string" ? n.trim() : "").trim())
//             .filter(Boolean)
//         ),
//       ];

//       // If no agent fields, skip this deal
//       if (names.length === 0) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key || !agentMap.has(key)) {
//           if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
//           continue;
//         }
//         dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
//       }
//     }

//     // ===== YTD LAST DEAL DATE =====
//     const ytdDeals = ytdDealsRaw;
//     const agentLastDealDateYTD = new Map();
//     const unmatchedYtd = [];

//     for (const deal of ytdDeals) {
//       // ✅ UPDATED LOGIC: Use deal_agent, deal_agent_1, deal_agent_2
//       const nameCandidates = [];
//       if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
//       if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
//       if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

//       const names = [
//         ...new Set(
//           nameCandidates
//             .map((n) => (typeof n === "string" ? n.trim() : "").trim())
//             .filter(Boolean)
//         ),
//       ];

//       // If no agent fields, skip this deal
//       if (names.length === 0) continue;

//       const created = deal.createddate;
//       const dealDate = created ? new Date(created) : null;
//       if (!dealDate || isNaN(dealDate.getTime())) continue;

//       for (const nm of names) {
//         const key = normalizeAgentName(nm);
//         if (!key) continue;
//         if (!agentMap.has(key)) {
//           if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
//           continue;
//         }

//         const prev = agentLastDealDateYTD.get(key);
//         if (!prev || dealDate > prev) {
//           agentLastDealDateYTD.set(key, dealDate);
//         }
//       }
//     }

//     // ===== UPDATE AGENTS (DEAL METRICS ONLY) =====
//     // Calculate days using UTC midnight for consistency
//     const todayUTC = new Date();
//     todayUTC.setUTCHours(0, 0, 0, 0);

//     const ops = [];
//     let agentsUpdated = 0;
//     const agentDeals = [];

//     for (const [key, agent] of agentMap.entries()) {
//       const dealCount = dealCountsByAgent.get(key) || 0;
//       const lastDealDate = agentLastDealDateYTD.get(key) || null;

//       // Calculate days properly using UTC dates
//       let lastDealDays = null;
//       if (lastDealDate) {
//         const dealDateUTC = new Date(lastDealDate);
//         dealDateUTC.setUTCHours(0, 0, 0, 0);

//         // Calculate difference in days
//         const diffMs = todayUTC.getTime() - dealDateUTC.getTime();
//         lastDealDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

//         // Ensure it's never negative
//         lastDealDays = Math.max(0, lastDealDays);
//       }

//       // Prepare bulk update operation
//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: {
//             $set: {
//               "leaderboard.propertiesSold": dealCount,
//               "leaderboard.lastDealDate": lastDealDate,
//               "leaderboard.lastDealDays": lastDealDays,
//               "leaderboard.lastUpdated": new Date(),
//               lastUpdated: new Date(),
//             },
//           },
//         },
//       });

//       agentDeals.push({
//         agentName: agent.agentName,
//         agentId: agent.agentId,
//         dealCount,
//         lastDealDate,
//         daysSinceLastDeal: lastDealDays,
//       });

//       if (dealCount > 0) agentsUpdated++;
//     }

//     // Execute bulk update (safe & fast)
//     if (ops.length) {
//       await Agent.bulkWrite(ops, { ordered: false });
//     }

//     console.log(
//       `✅ DEALS-ONLY sync completed for ${targetY}-${String(targetM + 1).padStart(
//         2,
//         "0"
//       )} (UTC).`
//     );
//     console.log(
//       `- Monthly deals (after strict UTC filter): ${monthlyDeals.length}`
//     );
//     console.log(`- YTD deals scanned: ${ytdDeals.length}`);
//     console.log(`- Agents updated: ${agentsUpdated}`);

//     return res.status(200).json({
//       success: true,
//       message: `Successfully synced ${monthlyDeals.length} monthly deals (strict UTC month). Updated ${agentsUpdated} agents with deal counts only.`,
//       note: "Deals assigned using deal_agent, deal_agent_1 and deal_agent_2 (referrers excluded). Month inclusion = createddate in target UTC month.",
//       data: {
//         period: month,
//         targetUTC: buildTargetUTCMeta(targetY, targetM),
//         totalDealsReturnedByAPI: monthlyDealsRaw.length,
//         totalDealsCountedAfterStrictFilter: monthlyDeals.length,
//         agentsUpdated,
//         agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
//         unmatchedOwners: {
//           monthly: unmatchedMonthly,
//           ytd: unmatchedYtd,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing deals:", error.message);
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };

// const syncAgentCommissionsFromSalesforce = async (req, res) => {
//   try {
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth();

//     console.log(
//       `🔄 Starting Salesforce COMMISSIONS sync (single dataset) -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     const commissionsResp = await sfGet("/services/apexrest/commissions");
//     const commissions = commissionsResp?.data?.commissions || [];

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     // 🔹 Record types that should use offer_contract_date for month mapping
//     const CONTRACT_DATE_TYPES = new Set([
//       "Landlord Commission",
//       "Landlord Referral Commission",
//       "Tenant Commission",
//       "Tenant Referral",
//     ]);

//     // Funcion to check record type and get appropriate date to map monthly commission for agent
//     const getEffectiveDateForCommission = (c) => {
//       const recordType = c?.record_type;

//       // For these types: use offer_contract_date
//       if (CONTRACT_DATE_TYPES.has(recordType)) {
//         return c.offer_contract_date || null;
//       }

//       // For all other record types: use from_f_startdate
//       return c.from_f_startdate;
//     };

//     const commissionsByAgent = new Map();
//     const unmatchedCommissionAgents = [];
//     let filteredCount = 0;

//     const traceIncluded = [];
//     const traceSkipped = [];

//     for (const c of commissions) {
//       const effectiveDate = getEffectiveDateForCommission(c);
//       const keep =
//         effectiveDate && isSameUtcMonth(effectiveDate, targetY, targetM);

//       if (!keep) {
//         if (traceSkipped.length < 20)
//           traceSkipped.push({
//             ref: c.commission_ref_no,
//             agent: c.agent_name || c.commission_agents,
//             record_type: c.record_type,
//             effectiveDate,
//             created: c.createddate,
//           });
//         continue;
//       }

//       filteredCount++;
//       if (traceIncluded.length < 20)
//         traceIncluded.push({
//           ref: c.commission_ref_no,
//           agent: c.agent_name || c.commission_agents,
//           record_type: c.record_type,
//           effectiveDate,
//           created: c.createddate,
//         });

//       const agentName = c.agent_name || c.commission_agents;
//       if (!agentName) continue;

//       const key = normalizeAgentName(agentName);
//       if (!agentMap.has(key)) {
//         if (!unmatchedCommissionAgents.includes(agentName))
//           unmatchedCommissionAgents.push(agentName);
//         continue;
//       }

//       const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
//       const amount = amountNumber(raw);

//       commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
//     }

//     const canZero = allowZeroingNow();
//     const ops = [];
//     let agentsUpdated = 0;
//     const agentCommissions = [];

//     for (const [key, agent] of agentMap.entries()) {
//       const totalCommission =
//         Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

//       const now = new Date();
//       const $set = {
//         "leaderboard.lastUpdated": now,
//         lastUpdated: now,
//       };

//       if (totalCommission !== 0 || canZero) {
//         $set["leaderboard.totalCommission"] = totalCommission;
//       }

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: { $set },
//         },
//       });

//       if (totalCommission > 0) agentsUpdated++;
//       agentCommissions.push({
//         agentName: agent.agentName,
//         agentId: agent.agentId,
//         totalCommission,
//         currentDeals: agent.leaderboard?.propertiesSold || 0,
//       });
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ COMMISSIONS sync completed for UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );
//     console.log(`   - Current month records (by effective date): ${filteredCount}`);
//     console.log(`   - Agents updated: ${agentsUpdated}`);

//     return res.status(200).json({
//       success: true,
//       message: `Synced ${filteredCount} commission records for current month (UTC) based on business logic dates.`,
//       data: {
//         targetUTC: buildTargetUTCMeta(targetY, targetM),
//         totalCommissionRecordsReturned: commissions.length,
//         currentMonthRecords: filteredCount,
//         agentsWithCommission: agentsUpdated,
//         agentsResetToZero: agents.length - agentsUpdated,
//         agentCommissions: agentCommissions
//           .filter((a) => a.totalCommission > 0)
//           .sort((a, b) => b.totalCommission - a.totalCommission),
//         unmatchedAgents: unmatchedCommissionAgents,
//         debugSample: {
//           includedFirst20: traceIncluded,
//           skippedFirst20: traceSkipped,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing commissions:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// const syncAgentViewingsFromSalesforce = async (req, res) => {
//   try {
//     const nowUTC = new Date();
//     const targetY = nowUTC.getUTCFullYear();
//     const targetM = nowUTC.getUTCMonth();

//     console.log(
//       `🔄 Starting Salesforce VIEWINGS sync (single dataset) -> UTC ${targetY}-${String(
//         targetM + 1
//       ).padStart(2, "0")}`
//     );

//     const resp = await sfGet("/services/apexrest/viewings");
//     const raw = resp?.data?.viewings || [];

//     const viewings = raw.filter((v) => {
//       const start = v?.start;
//       return start && isSameUtcMonth(start, targetY, targetM);
//     });

//     const agents = await Agent.find({ isActive: true });
//     const agentMap = new Map(
//       agents.map((a) => [normalizeAgentName(a.agentName), a])
//     );

//     const counts = new Map();
//     const unmatchedOwners = new Set();

//     for (const v of viewings) {
//       const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
//       const key = normalizeAgentName(owner);
//       if (!key) continue;

//       if (agentMap.has(key)) {
//         counts.set(key, (counts.get(key) || 0) + 1);
//       } else if (owner) {
//         unmatchedOwners.add(owner);
//       }
//     }

//     const canZero = allowZeroingNow();
//     const ops = [];
//     let agentsUpdated = 0;

//     for (const [key, agent] of agentMap.entries()) {
//       const viewingsCount = counts.get(key) || 0;

//       const $set = {
//         "leaderboard.lastUpdated": new Date(),
//         lastUpdated: new Date(),
//       };
//       if (viewingsCount !== 0 || canZero) {
//         $set["leaderboard.viewings"] = viewingsCount;
//       }

//       ops.push({
//         updateOne: {
//           filter: { _id: agent._id },
//           update: { $set },
//         },
//       });

//       if (viewingsCount > 0) agentsUpdated++;
//     }

//     if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

//     console.log(
//       `✅ Viewings sync completed for UTC ${targetY}-${String(targetM + 1).padStart(
//         2,
//         "0"
//       )}.`
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Synced ${viewings.length} viewings for current UTC month.`,
//       note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set with safe-zero guard.",
//       data: {
//         targetUTC: buildTargetUTCMeta(targetY, targetM),
//         totalViewings: viewings.length,
//         agentsUpdated,
//         agentViewings: Array.from(counts.entries())
//           .map(([k, c]) => ({
//             agentName: agentMap.get(k)?.agentName,
//             agentId: agentMap.get(k)?.agentId,
//             viewingCount: c,
//           }))
//           .sort((a, b) => b.viewingCount - a.viewingCount),
//         unmatchedOwners: unmatchedOwners.size ? Array.from(unmatchedOwners) : undefined,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing Salesforce viewings:", error);
//     const status = error?.response?.status || 500;
//     const msg =
//       status === 401
//         ? "Salesforce authentication failed. Invalid or expired Bearer token"
//         : "Failed to fetch viewings from Salesforce";
//     return res.status(status === 401 ? 401 : 503).json({
//       success: false,
//       error: msg,
//       details: error.message,
//     });
//   }
// };

// // This is working differently from model method; it triggers a full recalculation , but on cron it is working differently no model method is being triggerd
// const updateMonthlyPropertiesForAllAgents = async (req, res) => {
//   try {
//     console.log("📊 Starting monthly properties update...");
//     const result = await Agent.updateAllAgentsMonthlyProperties();

//     return res.status(200).json({
//       success: true,
//       message: "Successfully updated monthly properties for all agents",
//       data: {
//         ...result,
//         note: "Relisted properties (IDs ending with -1, -2, -3, etc.) are excluded from counts",
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error updating monthly properties:", error.message);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to update monthly properties",
//       details: error.message,
//     });
//   }
// };

// module.exports = {
//   // Leaderboard
//   getLeaderboardAgents,

//   // Manual sync endpoints
//   syncAgentDealsFromSalesforce,
//   syncAgentViewingsFromSalesforce,
//   syncAgentCommissionsFromSalesforce,

//   // Monthly properties manual
//   updateMonthlyPropertiesForAllAgents,

//   // Token diagnostic
//   getSalesforceToken: getSalesforceToken, // not an express handler
//   GetSalesForceToken, // express handler for tests

//   // Cron
//   setupCronJobs,
// };




// Monthly and yearly changes / leaderboard + cron syncing

const axios = require("axios");
const Agent = require("../Models/AgentModel");
const cron = require("node-cron");

// ─────────────────────────────────────────────────────────────────────────────
// Global lock to prevent overlapping cron runs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * masterSyncRunning:
 *  - true  → some sync job is already running
 *  - false → safe to start a new sync
 *
 * You use this to avoid concurrent runs of the same heavy sync logic.
 */
let masterSyncRunning = false;

/**
 * runAllSyncsLocked(fnName, fn)
 * - Wraps a sync function `fn` in a simple mutex.
 * - If something else is already running, it logs and returns { skipped: true }.
 * - Otherwise, sets the lock, runs the function, and always releases the lock.
 */
async function runAllSyncsLocked(fnName, fn) {
  if (masterSyncRunning) {
    console.log(`⏳ [SYNC LOCK] ${fnName} skipped; another sync is running.`);
    return { skipped: true };
  }
  masterSyncRunning = true;
  try {
    return await fn();
  } finally {
    masterSyncRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard cache (for stability while cron runs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * lastLeaderboardCache:
 *  - Keeps a ready-to-serve snapshot of leaderboard data.
 *  - Used when:
 *      - cron is running (so UI doesn’t see a half-updated state)
 *      - or DB fails temporarily (fallback).
 */
let lastLeaderboardCache = null;
let lastLeaderboardCacheAt = null;

/** ───────────────────────────────────────────────────────────────────────────
 *  Name normalization helper (for matching Salesforce names to Agents)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * normalizeAgentName(name)
 * - Converts a name into a canonical form:
 *   1) converts to string
 *   2) normalizes unicode (NFKD) and strips diacritics
 *   3) lowercases everything
 *   4) collapses multiple spaces into single space
 *   5) removes non-word characters (punctuation)
 */
function normalizeAgentName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritic marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")              // collapse whitespace
    .replace(/[^\w\s]/g, "");          // remove punctuation/symbols
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Salesforce / HTTP setup
 *  ─────────────────────────────────────────────────────────────────────────── */

const SALESFORCE = {
  tokenUrl: process.env.SALESFORCE_TOKEN_URL,
  baseUrl: "https://arabianestates.my.salesforce.com",
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  username: process.env.SALESFORCE_USERNAME,
  password: process.env.SALESFORCE_PASSWORD,
};

// Preconfigured axios instance for Salesforce REST calls
const axiosSF = axios.create({
  baseURL: SALESFORCE.baseUrl,
  timeout: 30_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

/**
 * withRetry(fn, { retries, delayMs })
 * - Simple generic retry wrapper for transient errors.
 * - Retries on:
 *   - HTTP 429
 *   - HTTP 5xx
 *   - common network error codes
 */
async function withRetry(fn, { retries = 2, delayMs = 600 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const code = err?.code;

      const retryable =
        status === 429 ||
        (status >= 500 && status < 600) ||
        ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);

      if (!retryable || i === retries) break;

      // Exponential-ish backoff: 600ms, 1200ms, ...
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * getSalesforceToken()
 * - Uses OAuth2 client credentials to obtain an access token from Salesforce.
 * - Reads credentials & token URL from env.
 */
async function getSalesforceToken() {
  try {
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "client_credentials",
        client_id: SALESFORCE.clientId,
        client_secret: SALESFORCE.clientSecret,
        username: SALESFORCE.username,
        password: SALESFORCE.password,
      },
    });
    return resp.data.access_token;
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    throw new Error("Salesforce token generation failed");
  }
}

/**
 * sfGet(pathname, params?)
 * - Helper to GET Salesforce Apex REST with automatic token + retry.
 */
async function sfGet(pathname, params = {}) {
  const token = await getSalesforceToken();

  return withRetry(() =>
    axiosSF.get(pathname, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

/** ───────────────────────────────────────────────────────────────────────────
 *  UTC date helper functions (used for strict month boundaries)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * toUtcDate(input)
 * - Converts a string or Date into a Date object interpreted as UTC.
 * - If string has no explicit timezone, appends "Z" (UTC).
 */
function toUtcDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = String(input);

  // If string already contains timezone info, keep it; else assume UTC
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasTZ ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * isSameUtcMonth(dateLike, targetY, targetM)
 * - Returns true if given date is in the same UTC year & month.
 *   targetM is 0-based (0..11).
 */
function isSameUtcMonth(dateLike, targetY, targetM) {
  const d = toUtcDate(dateLike);
  if (!d) return false;
  return d.getUTCFullYear() === targetY && d.getUTCMonth() === targetM;
}

/**
 * utcTodayStart()
 * - Returns a Date set to today's UTC midnight.
 */
function utcTodayStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * allowZeroingNow()
 * - Safe-guard for zeroing metrics:
 *   Returns false for first 45 minutes of UTC day (to avoid wiping data
 *   too early around rollover times).
 */
function allowZeroingNow() {
  const now = new Date();
  const minsFromMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minsFromMidnight > 45;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Month resolver (for manual endpoints)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * resolveMonthUTC(monthParam)
 * - Accepts:
 *   - "this_month" (default)
 *   - "last_month"
 *   - "YYYY-MM" (e.g. "2025-03")
 * - Returns { targetY, targetM }  where targetM is 0-based.
 */
function resolveMonthUTC(monthParam = "this_month") {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();

  if (monthParam === "last_month") {
    if (m === 0) {
      y -= 1;
      m = 11;
    } else {
      m -= 1;
    }
  } else if (/^\d{4}-\d{2}$/.test(monthParam)) {
    const [yy, mm] = monthParam.split("-").map(Number);
    y = yy;
    m = mm - 1; // convert 1-based to 0-based
  }
  return { targetY: y, targetM: m };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Month/year meta builder (1-based month + ISO)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * buildTargetUTCMeta(targetY, targetM)
 * - Returns helper metadata for UI / logs:
 *   - monthIndex0: 0-based
 *   - month: 1-based
 *   - isoMonth: "YYYY-MM"
 */
function buildTargetUTCMeta(targetY, targetM) {
  return {
    year: targetY,
    monthIndex0: targetM,
    month: targetM + 1,
    isoMonth: `${targetY}-${String(targetM + 1).padStart(2, "0")}`,
  };
}

// Additional helper to parse generic date strings safely (not heavily used here)
function parseUtcDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * amountNumber(raw)
 * - Normalizes numeric amounts:
 *   - If string, removes commas/spaces then casts to Number.
 *   - Else casts directly, falling back to 0.
 */
function amountNumber(raw) {
  return typeof raw === "string" ? Number(raw.replace(/[, ]/g, "")) : Number(raw) || 0;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Commission effective date helper (shared)
 *  ─────────────────────────────────────────────────────────────────────────── */

const COMMISSION_CONTRACT_DATE_TYPES = new Set([
  "Landlord Commission",
  "Landlord Referral Commission",
  "Tenant Commission",
  "Tenant Referral",
]);

/**
 * getEffectiveDateForCommission(c)
 * - For some commission record types:
 *   use offer_contract_date
 * - For all others:
 *   use from_f_startdate
 */
function getEffectiveDateForCommission(c) {
  const recordType = c?.record_type;

  if (COMMISSION_CONTRACT_DATE_TYPES.has(recordType)) {
    return c.offer_contract_date || null;
  }

  return c.from_f_startdate;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Leaderboard snapshot builder for current UTC month
 *  - Fetches all SF data
 *  - Aggregates metrics per agent
 *  - Does NOT write to DB (that’s applyLeaderboardSnapshot)
 *  ─────────────────────────────────────────────────────────────────────────── */

async function buildLeaderboardSnapshotCurrentMonth() {
  const nowUTC = new Date();
  const targetY = nowUTC.getUTCFullYear();
  const targetM = nowUTC.getUTCMonth();

  console.log(
    `🔄 [LEADERBOARD SNAPSHOT] Building for UTC ${targetY}-${String(
      targetM + 1
    ).padStart(2, "0")}`
  );

  // 1) Call all relevant SF endpoints in parallel, including listingsAPI
  const [
    dealsMonthlyResp,
    dealsYtdResp,
    commissionsResp,
    viewingsResp,
    listingsResp,
  ] = await Promise.all([
    sfGet("/services/apexrest/deals", { month: "this_month" }),
    sfGet("/services/apexrest/deals", { month: "ytd" }),
    sfGet("/services/apexrest/commissions"),
    sfGet("/services/apexrest/viewings"),
    sfGet("/services/apexrest/listingsAPI"),
  ]);

  // Normalize raw responses
  const monthlyDealsRaw = dealsMonthlyResp?.data?.deals || [];
  const ytdDealsRaw = dealsYtdResp?.data?.deals || [];
  const commissionsRaw = commissionsResp?.data?.commissions || [];
  const viewingsRaw = viewingsResp?.data?.viewings || [];
  const listingsRaw = listingsResp?.data?.listings || [];

  // 2) Load all active leaderboard agents from Mongo
  const agents = await Agent.find({ activeOnLeaderboard: true });

  // Map agents by normalized name for matching against SF data
  const agentMap = new Map(
    agents.map((a) => [normalizeAgentName(a.agentName), a])
  );

  // Map agents by email for listings mapping
  const agentEmailMap = new Map(
    agents
      .filter((a) => a.email)
      .map((a) => [a.email.trim().toLowerCase(), a])
  );

  // 3) Metrics map: per normalized agent name
  const metricsByKey = new Map();

  // Initializes metrics entry lazily
  const ensureMetrics = (key) => {
    let m = metricsByKey.get(key);
    if (!m) {
      m = {
        propertiesSold: 0,
        totalCommission: 0,
        viewings: 0,
        lastDealDate: null,
        activePropertiesThisMonth: 0, // NEW via listingsAPI
      };
      metricsByKey.set(key, m);
    }
    return m;
  };

  /* ───────────── DEALS: propertiesSold (monthly) + lastDealDate (YTD) ────── */

  // Filter monthly deals strictly by current UTC month
  const monthlyDeals = monthlyDealsRaw.filter((d) =>
    isSameUtcMonth(d?.createddate, targetY, targetM)
  );

  const unmatchedMonthly = [];
  const unmatchedYtd = [];

  // Collect all deal agent names (main + additional) and dedupe within a deal
  const namesFromDeal = (deal) => {
    const nameCandidates = [];
    if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
    if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
    if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

    return [
      ...new Set(
        nameCandidates
          .map((n) => (typeof n === "string" ? n.trim() : "").trim())
          .filter(Boolean)
      ),
    ];
  };

  // Monthly counts → leaderboard.propertiesSold
  for (const deal of monthlyDeals) {
    const names = namesFromDeal(deal);
    if (!names.length) continue;

    for (const nm of names) {
      const key = normalizeAgentName(nm);
      if (!key || !agentMap.has(key)) {
        if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
        continue;
      }
      const m = ensureMetrics(key);
      m.propertiesSold += 1;
    }
  }

  // YTD deals used only for lastDealDate
  for (const deal of ytdDealsRaw) {
    const names = namesFromDeal(deal);
    if (!names.length) continue;

    const created = deal.createddate;
    const dealDate = created ? new Date(created) : null;
    if (!dealDate || Number.isNaN(dealDate.getTime())) continue;

    for (const nm of names) {
      const key = normalizeAgentName(nm);
      if (!key) continue;
      if (!agentMap.has(key)) {
        if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
        continue;
      }
      const m = ensureMetrics(key);
      if (!m.lastDealDate || dealDate > m.lastDealDate) {
        m.lastDealDate = dealDate;
      }
    }
  }

  /* ───────────── COMMISSIONS: totalCommission ───────────── */

  const unmatchedCommissionAgents = [];
  let filteredCommissionsCount = 0;

  for (const c of commissionsRaw) {
    const effectiveDate = getEffectiveDateForCommission(c);
    const keep =
      effectiveDate && isSameUtcMonth(effectiveDate, targetY, targetM);

    if (!keep) continue;
    filteredCommissionsCount++;

    const agentName = c.agent_name || c.commission_agents;
    if (!agentName) continue;

    const key = normalizeAgentName(agentName);
    if (!agentMap.has(key)) {
      if (!unmatchedCommissionAgents.includes(agentName)) {
        unmatchedCommissionAgents.push(agentName);
      }
      continue;
    }

    const rawAmount = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
    const amt = amountNumber(rawAmount);

    const m = ensureMetrics(key);
    m.totalCommission += amt;
  }

  /* ───────────── VIEWINGS: viewings count ───────────── */

  const unmatchedViewingOwners = new Set();

  // Restrict to current UTC month on 'start'
  const currentMonthViewings = viewingsRaw.filter((v) =>
    isSameUtcMonth(v?.start, targetY, targetM)
  );

  for (const v of currentMonthViewings) {
    const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
    const key = normalizeAgentName(owner);
    if (!key) continue;

    if (agentMap.has(key)) {
      const m = ensureMetrics(key);
      m.viewings += 1;
    } else if (owner) {
      unmatchedViewingOwners.add(owner);
    }
  }

  /* ───────────── LISTINGS: activePropertiesThisMonth ───────────── */

  // Helper: detect relisted IDs based on extra numeric segment at end
  const isRelistedId = (id) => {
    if (!id) return false;
    const segments = id.split("-");
    if (segments.length <= 3) return false;
    const lastSegment = segments[segments.length - 1];
    return /^\d+$/.test(lastSegment);
  };

  // Helper: base ID = first 3 segments
  const getBaseId = (id) => {
    if (!id) return null;
    const segments = id.split("-");
    if (segments.length < 3) return id.trim();
    return segments.slice(0, 3).join("-");
  };

  let totalListingsConsidered = 0;
  let totalListingsMatched = 0;
  let totalActivePropsThisMonth = 0;
  const unmatchedListingEmails = new Set();

  // For deduping per agent: map normalizedName → Set(baseIds)
  const listingsPerAgentBaseIds = new Map();

  console.log("📊 Processing listingsAPI for activePropertiesThisMonth...");

  for (const listing of listingsRaw) {
    totalListingsConsidered++;

    const status = listing.status;
    const id = listing.id;
    const email = listing.listing_agent_email;
    const pfDateRaw = listing.PF_Published_Date;

    if (!pfDateRaw) continue;

    // Convert "YYYY-MM-DD HH:mm:ss" → Date (UTC)
    const pfDate = new Date(pfDateRaw.replace(" ", "T") + "Z");
    if (!pfDate || Number.isNaN(pfDate.getTime())) continue;

    // 1) Only same UTC month as target
    if (!isSameUtcMonth(pfDate, targetY, targetM)) continue;

    // 2) Only Live listings
    if (status !== "Live") continue;

    // 3) Skip relisted IDs (we only count originals)
    if (isRelistedId(id)) continue;

    // 4) Match agent via email
    if (!email) {
      unmatchedListingEmails.add("(missing email)");
      continue;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const agent = agentEmailMap.get(normalizedEmail);

    if (!agent) {
      unmatchedListingEmails.add(normalizedEmail);
      continue;
    }

    const key = normalizeAgentName(agent.agentName);
    if (!key) continue;

    // 5) Base ID & per-agent dedupe
    const baseId = getBaseId(id);
    if (!baseId) continue;

    let baseIdSet = listingsPerAgentBaseIds.get(key);
    if (!baseIdSet) {
      baseIdSet = new Set();
      listingsPerAgentBaseIds.set(key, baseIdSet);
    }

    if (baseIdSet.has(baseId)) {
      // Already counted this property for this agent
      continue;
    }
    baseIdSet.add(baseId);

    // 6) Increment activePropertiesThisMonth metric
    const m = ensureMetrics(key);
    m.activePropertiesThisMonth =
      (m.activePropertiesThisMonth || 0) + 1;

    totalListingsMatched++;
    totalActivePropsThisMonth++;
  }

  console.log(
    `✅ Listings processed → considered: ${totalListingsConsidered}, ` +
      `matched: ${totalListingsMatched}, activePropertiesThisMonth total: ${totalActivePropsThisMonth}`
  );

  if (unmatchedListingEmails.size > 0) {
    console.log(
      "⚠️ Unmatched listing_agent_email values:",
      Array.from(unmatchedListingEmails)
    );
  }

  // Return all snapshot data (nothing written to DB here)
  return {
    targetY,
    targetM,
    targetUTC: buildTargetUTCMeta(targetY, targetM),
    agents,
    agentMap,
    metricsByKey,
    meta: {
      deals: {
        monthlyDeals: monthlyDeals.length,
        totalDealsResp: monthlyDealsRaw.length,
        unmatchedMonthly,
        unmatchedYtd,
      },
      commissions: {
        filteredCommissionsCount,
        totalCommissionsResp: commissionsRaw.length,
        unmatchedCommissionAgents,
      },
      viewings: {
        totalViewingsResp: viewingsRaw.length,
        viewingsThisMonth: currentMonthViewings.length,
        unmatchedViewingOwners: Array.from(unmatchedViewingOwners),
      },
      listings: {
        totalListingsConsidered,
        totalListingsMatched,
        totalActivePropsThisMonth,
        unmatchedListingEmails: Array.from(unmatchedListingEmails),
      },
    },
  };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Apply snapshot to DB (bulkWrite)
 *  ─────────────────────────────────────────────────────────────────────────── */

async function applyLeaderboardSnapshot(snapshot) {
  const {
    targetY,
    targetM,
    agentMap,
    metricsByKey,
    meta,
  } = snapshot;

  const todayUTC = utcTodayStart();
  const canZero = allowZeroingNow();
  const now = new Date();

  const ops = [];
  let agentsTouched = 0;

  // Loop over all agents in map and compute final leaderboard values
  for (const [key, agent] of agentMap.entries()) {
    const m = metricsByKey.get(key) || {
      propertiesSold: 0,
      totalCommission: 0,
      viewings: 0,
      lastDealDate: null,
      activePropertiesThisMonth: 0,
    };

    const propertiesSold = m.propertiesSold || 0;
    const totalCommission =
      Math.round((m.totalCommission || 0) * 100) / 100;
    const viewings = m.viewings || 0;
    const activeProps =
      typeof m.activePropertiesThisMonth === "number"
        ? m.activePropertiesThisMonth
        : 0;

    let lastDealDays = null;
    if (m.lastDealDate) {
      const d0 = new Date(m.lastDealDate);
      d0.setUTCHours(0, 0, 0, 0);
      lastDealDays = Math.max(
        0,
        Math.floor((todayUTC - d0) / 86400000)
      );
    }

    const $set = {
      "leaderboard.lastUpdated": now,
      lastUpdated: now,
    };

    if (propertiesSold !== 0 || canZero) {
      $set["leaderboard.propertiesSold"] = propertiesSold;
    }
    if (totalCommission !== 0 || canZero) {
      $set["leaderboard.totalCommission"] = totalCommission;
    }
    if (viewings !== 0 || canZero) {
      $set["leaderboard.viewings"] = viewings;
    }

    // Always overwrite activePropertiesThisMonth from snapshot (no stale values)
    $set["leaderboard.activePropertiesThisMonth"] = activeProps;

    if (m.lastDealDate) {
      $set["leaderboard.lastDealDate"] = m.lastDealDate;
      $set["leaderboard.lastDealDays"] = lastDealDays;
    } else if (canZero) {
      $set["leaderboard.lastDealDate"] = null;
      $set["leaderboard.lastDealDays"] = null;
    }

    ops.push({
      updateOne: {
        filter: { _id: agent._id },
        update: { $set },
      },
    });

    if (
      propertiesSold !== 0 ||
      totalCommission !== 0 ||
      viewings !== 0 ||
      activeProps !== 0 ||
      m.lastDealDate
    ) {
      agentsTouched++;
    }
  }

  if (!ops.length) {
    console.log(
      `ℹ️ [LEADERBOARD SNAPSHOT] No leaderboard updates needed for UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );
    return {
      targetY,
      targetM,
      targetUTC: buildTargetUTCMeta(targetY, targetM),
      agentsTouched: 0,
      meta,
    };
  }

  await Agent.bulkWrite(ops, { ordered: false });

  console.log(
    `✅ [LEADERBOARD SNAPSHOT] Applied in single bulkWrite for UTC ${targetY}-${String(
      targetM + 1
    ).padStart(2, "0")} → Agents touched: ${agentsTouched}`
  );

  if (meta?.listings) {
    console.log(
      `📊 [LEADERBOARD SNAPSHOT] Listings summary → ` +
        `considered: ${meta.listings.totalListingsConsidered}, ` +
        `matched: ${meta.listings.totalListingsMatched}, ` +
        `activePropertiesThisMonth total: ${meta.listings.totalActivePropsThisMonth}`
    );
  }

  return {
    targetY,
    targetM,
    targetUTC: buildTargetUTCMeta(targetY, targetM),
    agentsTouched,
    meta,
  };
}

/**
 * syncLeaderboardCoreCurrentMonth()
 * - Orchestrates snapshot build + apply for current month.
 * - After writing to DB, it also refreshes the leaderboard cache.
 */
async function syncLeaderboardCoreCurrentMonth() {
  const snapshot = await buildLeaderboardSnapshotCurrentMonth();
  const result = await applyLeaderboardSnapshot(snapshot);
  
  // Update cache AFTER DB write is successful
  try {
    await updateLeaderboardCache();
    console.log("✅ [CACHE] Leaderboard cache updated successfully");
  } catch (cacheError) {
    console.error("⚠️ [CACHE] Failed to update cache:", cacheError.message);
    // Don't fail the sync because of cache problems
  }
  
  return result;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Update leaderboard cache from DB
 *  ─────────────────────────────────────────────────────────────────────────── */

async function updateLeaderboardCache() {
  const pipeline = [
    {
      $match: {
        activeOnLeaderboard: true
      }
    },
    {
      $project: {
        agentName: 1,
        agentLanguage: 1,
        designation: 1,
        email: 1,
        whatsapp: 1,
        phone: 1,
        imageUrl: 1,
        isActive: 1,
        agentId: 1,
        leaderboard: 1,
        sequenceNumber: 1,
        reraNumber: 1,
        propertiesCount: { $size: { $ifNull: ["$properties", []] } },
      },
    },
    {
      $addFields: {
        _commission: { $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] } },
        _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
      },
    },
    { $sort: { _commission: -1, _tieSeq: 1 } },
  ];

  // Aggregate all leaderboard agents sorted by commission then sequence
  const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

  const globalTotalCommission = allAgents.reduce(
    (sum, a) => sum + (a.leaderboard?.totalCommission ?? 0),
    0
  );

  // Flatten agents into lightweight leaderboard objects
  const agentsWithPositions = allAgents.map((agent, index) => ({
    position: index + 1,
    name: agent.agentName,
    imageUrl: agent.imageUrl,
    leaderboard: {
      activePropertiesThisMonth: agent.leaderboard?.activePropertiesThisMonth ?? 0,
      propertiesSold: agent.leaderboard?.propertiesSold ?? 0,
      totalCommission: agent.leaderboard?.totalCommission ?? 0,
      lastDealDate: agent.leaderboard?.lastDealDate ?? null,
      viewings: agent.leaderboard?.viewings ?? 0,
      lastDealDays: agent.leaderboard?.lastDealDays ?? 0,
      offers: agent.leaderboard?.offers ?? 0,
    },
    propertiesCount: agent.propertiesCount ?? 0,
    agentId: agent.agentId,
  }));

  // Store complete leaderboard in in-memory cache
  lastLeaderboardCache = {
    success: true,
    allAgents: agentsWithPositions,
    globalTotalCommission,
    cachedAt: new Date(),
  };
  
  lastLeaderboardCacheAt = new Date();
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Cron orchestration
 *  ─────────────────────────────────────────────────────────────────────────── */

async function runAllSyncs() {
  return runAllSyncsLocked("master-sync", async () => {
    console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
    const t0 = Date.now();
    try {
      // Single unified snapshot-style sync (deals, commissions, viewings, listings)
      const leaderboardResult = await syncLeaderboardCoreCurrentMonth();

      const sec = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(
        `✅ [CRON] All syncs completed successfully in ${sec}s`
      );
      console.log(
        `   → Leaderboard: agentsTouched=${leaderboardResult.agentsTouched}, month=${leaderboardResult.targetM + 1}/${leaderboardResult.targetY}`
      );
    } catch (error) {
      console.error("❌ [CRON] Error in scheduled sync job:", error.message);
    }
  });
}

let cronScheduled = false;

/**
 * setupCronJobs()
 * - Registers a cron job to run every 12 minutes (UTC).
 * - Uses runAllSyncs() (which is lock-protected).
 * - Also triggers an immediate initial sync at startup.
 */
function setupCronJobs() {
  if (cronScheduled) {
    console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
    return;
  }

  cron.schedule(
    "*/12 * * * *", // every 12 minutes
    async () => {
      const now = new Date().toISOString();
      console.log(`🔔 [CRON TICK] Triggered at ${now} (UTC)`);
      await runAllSyncs();
    },
    { timezone: "UTC" }
  );

  cronScheduled = true;
  console.log("✅ Cron job scheduled: Salesforce sync will run every 12 minutes (UTC)");

  // Optional immediate run at app startup
  console.log("🚀 Running initial sync on startup...");
  runAllSyncs();
}

/** ───────────────────────────────────────────────────────────────────────────
 *  API Handlers (manual + leaderboard)
 *  ─────────────────────────────────────────────────────────────────────────── */

// Manual: raw Salesforce token endpoint (for diagnostics)
const GetSalesForceToken = async (req, res) => {
  try {
    console.log("WORKING");
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "client_credentials",
        client_id: SALESFORCE.clientId,
        client_secret: SALESFORCE.clientSecret,
        username: SALESFORCE.username,
        password: SALESFORCE.password,
      },
    });
    console.log(resp.data.access_token);
    return res.status(200).json({ access_token: resp.data.access_token });
  } catch (error) {
    console.error("❌ Failed to generate Salesforce token:", error.message);
    return res.status(500).json({ success: false, error: "Salesforce token generation failed" });
  }
};

/**
 * getLeaderboardAgents
 * - Public API endpoint returning leaderboard agents with pagination.
 * - Prefers in-memory cache while sync is running (or on DB failure).
 * - Always sorted by totalCommission desc, then sequenceNumber.
 */
const getLeaderboardAgents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
    const skip = (page - 1) * limit;

    // Serve from cache while master sync is in progress
    if (masterSyncRunning && lastLeaderboardCache) {
      console.log(
        "📊 [LEADERBOARD] Serving cached leaderboard while master sync is running."
      );
      
      const allAgents = lastLeaderboardCache.allAgents;
      const total = allAgents.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedAgents = allAgents.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        data: paginatedAgents,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
        globalTotalCommission: lastLeaderboardCache.globalTotalCommission,
        cached: true,
        cachedAt: lastLeaderboardCache.cachedAt,
      });
    }

    // Normal: query DB (same aggregation as cache builder)
    const pipeline = [
      {
        $match: {
          activeOnLeaderboard: true
        }
      },
      {
        $project: {
          agentName: 1,
          agentLanguage: 1,
          designation: 1,
          email: 1,
          whatsapp: 1,
          phone: 1,
          imageUrl: 1,
          isActive: 1,
          agentId: 1,
          leaderboard: 1,
          sequenceNumber: 1,
          reraNumber: 1,
          propertiesCount: { $size: { $ifNull: ["$properties", []] } },
        },
      },
      {
        $addFields: {
          _commission: { $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] } },
          _tieSeq: { $toLong: { $ifNull: ["$sequenceNumber", 999999] } },
        },
      },
      { $sort: { _commission: -1, _tieSeq: 1 } },
    ];

    const allAgents = await Agent.aggregate(pipeline).allowDiskUse(true);

    const globalTotalCommission = allAgents.reduce(
      (sum, a) => sum + (a.leaderboard?.totalCommission ?? 0),
      0
    );

    const agentsWithPositions = allAgents.map((agent, index) => ({
      ...agent,
      position: index + 1,
    }));

    const paginatedAgents = agentsWithPositions.slice(skip, skip + limit);
    const total = agentsWithPositions.length;
    const totalPages = Math.ceil(total / limit);

    const mapped = paginatedAgents.map((a) => ({
      position: a.position,
      name: a.agentName,
      imageUrl: a.imageUrl,
      leaderboard: {
        activePropertiesThisMonth: a.leaderboard?.activePropertiesThisMonth ?? 0,
        propertiesSold: a.leaderboard?.propertiesSold ?? 0,
        totalCommission: a.leaderboard?.totalCommission ?? 0,
        lastDealDate: a.leaderboard?.lastDealDate ?? null,
        viewings: a.leaderboard?.viewings ?? 0,
        lastDealDays: a.leaderboard?.lastDealDays ?? 0,
        offers: a.leaderboard?.offers ?? 0,
      },
      propertiesCount: a.propertiesCount ?? 0,
      agentId: a.agentId,
    }));

    return res.status(200).json({
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      globalTotalCommission,
      cached: false,
    });
  } catch (err) {
    // Fallback to in-memory cache if DB query fails
    if (lastLeaderboardCache) {
      console.log("⚠️ [LEADERBOARD] DB error, falling back to cached data");
      
      const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
      const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
      const skip = (page - 1) * limit;
      
      const allAgents = lastLeaderboardCache.allAgents;
      const total = allAgents.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedAgents = allAgents.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        data: paginatedAgents,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
        globalTotalCommission: lastLeaderboardCache.globalTotalCommission,
        cached: true,
        cachedAt: lastLeaderboardCache.cachedAt,
        fallback: true,
      });
    }
    
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** ───────────────────────────────────────────────────────────────────────────
 *  Manual sync endpoints (deals / commissions / viewings)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * syncAgentDealsFromSalesforce
 * - Manually syncs ONLY deals metrics:
 *   - propertiesSold for given month
 *   - lastDealDate + lastDealDays (YTD)
 */
const syncAgentDealsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;

    const { targetY, targetM } = resolveMonthUTC(month);

    console.log(
      `🔄 Starting Salesforce DEALS-ONLY sync for: ${month} -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    // Fetch monthly deals and YTD deals
    const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
      sfGet("/services/apexrest/deals", { month }),
      sfGet("/services/apexrest/deals", { month: "ytd" }),
    ]);

    const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
    const ytdDealsRaw = ytdDealsResp?.data?.deals || [];

    // Strict filter on createddate for this month
    const monthlyDeals = monthlyDealsRaw.filter((d) =>
      isSameUtcMonth(d.createddate, targetY, targetM)
    );

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    // Maps: monthly counts + YTD last deal date
    const dealCountsByAgent = new Map();
    const unmatchedMonthly = [];

    for (const deal of monthlyDeals) {
      const nameCandidates = [];
      if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
      if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
      if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

      const names = [
        ...new Set(
          nameCandidates
            .map((n) => (typeof n === "string" ? n.trim() : "").trim())
            .filter(Boolean)
        ),
      ];

      if (names.length === 0) continue;

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key || !agentMap.has(key)) {
          if (nm && !unmatchedMonthly.includes(nm)) unmatchedMonthly.push(nm);
          continue;
        }
        dealCountsByAgent.set(key, (dealCountsByAgent.get(key) || 0) + 1);
      }
    }

    const ytdDeals = ytdDealsRaw;
    const agentLastDealDateYTD = new Map();
    const unmatchedYtd = [];

    for (const deal of ytdDeals) {
      const nameCandidates = [];
      if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
      if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
      if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

      const names = [
        ...new Set(
          nameCandidates
            .map((n) => (typeof n === "string" ? n.trim() : "").trim())
            .filter(Boolean)
        ),
      ];

      if (names.length === 0) continue;

      const created = deal.createddate;
      const dealDate = created ? new Date(created) : null;
      if (!dealDate || isNaN(dealDate.getTime())) continue;

      for (const nm of names) {
        const key = normalizeAgentName(nm);
        if (!key) continue;
        if (!agentMap.has(key)) {
          if (nm && !unmatchedYtd.includes(nm)) unmatchedYtd.push(nm);
          continue;
        }

        const prev = agentLastDealDateYTD.get(key);
        if (!prev || dealDate > prev) {
          agentLastDealDateYTD.set(key, dealDate);
        }
      }
    }

    // Compute days since last deal (UTC-based)
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const ops = [];
    let agentsUpdated = 0;
    const agentDeals = [];

    for (const [key, agent] of agentMap.entries()) {
      const dealCount = dealCountsByAgent.get(key) || 0;
      const lastDealDate = agentLastDealDateYTD.get(key) || null;

      let lastDealDays = null;
      if (lastDealDate) {
        const dealDateUTC = new Date(lastDealDate);
        dealDateUTC.setUTCHours(0, 0, 0, 0);
        const diffMs = todayUTC.getTime() - dealDateUTC.getTime();
        lastDealDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        lastDealDays = Math.max(0, lastDealDays);
      }

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: {
              "leaderboard.propertiesSold": dealCount,
              "leaderboard.lastDealDate": lastDealDate,
              "leaderboard.lastDealDays": lastDealDays,
              "leaderboard.lastUpdated": new Date(),
              lastUpdated: new Date(),
            },
          },
        },
      });

      agentDeals.push({
        agentName: agent.agentName,
        agentId: agent.agentId,
        dealCount,
        lastDealDate,
        daysSinceLastDeal: lastDealDays,
      });

      if (dealCount > 0) agentsUpdated++;
    }

    if (ops.length) {
      await Agent.bulkWrite(ops, { ordered: false });
    }

    console.log(
      `✅ DEALS-ONLY sync completed for ${targetY}-${String(targetM + 1).padStart(
        2,
        "0"
      )} (UTC).`
    );
    console.log(
      `- Monthly deals (after strict UTC filter): ${monthlyDeals.length}`
    );
    console.log(`- YTD deals scanned: ${ytdDeals.length}`);
    console.log(`- Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${monthlyDeals.length} monthly deals (strict UTC month). Updated ${agentsUpdated} agents with deal counts only.`,
      note: "Deals assigned using deal_agent, deal_agent_1 and deal_agent_2 (referrers excluded). Month inclusion = createddate in target UTC month.",
      data: {
        period: month,
        targetUTC: buildTargetUTCMeta(targetY, targetM),
        totalDealsReturnedByAPI: monthlyDealsRaw.length,
        totalDealsCountedAfterStrictFilter: monthlyDeals.length,
        agentsUpdated,
        agentDeals: agentDeals.sort((a, b) => b.dealCount - a.dealCount),
        unmatchedOwners: {
          monthly: unmatchedMonthly,
          ytd: unmatchedYtd,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error syncing deals:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * syncAgentCommissionsFromSalesforce
 * - Manual endpoint for syncing ONLY commissions for current UTC month.
 * - Uses the same effective date logic as the snapshot.
 */
const syncAgentCommissionsFromSalesforce = async (req, res) => {
  try {
    const nowUTC = new Date();
    const targetY = nowUTC.getUTCFullYear();
    const targetM = nowUTC.getUTCMonth();

    console.log(
      `🔄 Starting Salesforce COMMISSIONS sync (single dataset) -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    const commissionsResp = await sfGet("/services/apexrest/commissions");
    const commissions = commissionsResp?.data?.commissions || [];

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    // These are defined earlier as COMMISSION_CONTRACT_DATE_TYPES
    const CONTRACT_DATE_TYPES = new Set([
      "Landlord Commission",
      "Landlord Referral Commission",
      "Tenant Commission",
      "Tenant Referral",
    ]);

    const getEffectiveDateForCommission = (c) => {
      const recordType = c?.record_type;
      if (CONTRACT_DATE_TYPES.has(recordType)) {
        return c.offer_contract_date || null;
      }
      return c.from_f_startdate;
    };

    const commissionsByAgent = new Map();
    const unmatchedCommissionAgents = [];
    let filteredCount = 0;

    const traceIncluded = [];
    const traceSkipped = [];

    for (const c of commissions) {
      const effectiveDate = getEffectiveDateForCommission(c);
      const keep =
        effectiveDate && isSameUtcMonth(effectiveDate, targetY, targetM);

      if (!keep) {
        if (traceSkipped.length < 20)
          traceSkipped.push({
            ref: c.commission_ref_no,
            agent: c.agent_name || c.commission_agents,
            record_type: c.record_type,
            effectiveDate,
            created: c.createddate,
          });
        continue;
      }

      filteredCount++;
      if (traceIncluded.length < 20)
        traceIncluded.push({
          ref: c.commission_ref_no,
          agent: c.agent_name || c.commission_agents,
          record_type: c.record_type,
          effectiveDate,
          created: c.createddate,
        });

      const agentName = c.agent_name || c.commission_agents;
      if (!agentName) continue;

      const key = normalizeAgentName(agentName);
      if (!agentMap.has(key)) {
        if (!unmatchedCommissionAgents.includes(agentName))
          unmatchedCommissionAgents.push(agentName);
        continue;
      }

      const raw = c.commission_amount_excl_vat ?? c.total_commissions ?? 0;
      const amount = amountNumber(raw);

      commissionsByAgent.set(
        key,
        (commissionsByAgent.get(key) || 0) + amount
      );
    }

    const canZero = allowZeroingNow();
    const ops = [];
    let agentsUpdated = 0;
    const agentCommissions = [];

    for (const [key, agent] of agentMap.entries()) {
      const totalCommission =
        Math.round((commissionsByAgent.get(key) || 0) * 100) / 100;

      const now = new Date();
      const $set = {
        "leaderboard.lastUpdated": now,
        lastUpdated: now,
      };

      if (totalCommission !== 0 || canZero) {
        $set["leaderboard.totalCommission"] = totalCommission;
      }

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: { $set },
        },
      });

      if (totalCommission > 0) agentsUpdated++;
      agentCommissions.push({
        agentName: agent.agentName,
        agentId: agent.agentId,
        totalCommission,
        currentDeals: agent.leaderboard?.propertiesSold || 0,
      });
    }

    if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

    console.log(
      `✅ COMMISSIONS sync completed for UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );
    console.log(`   - Current month records (by effective date): ${filteredCount}`);
    console.log(`   - Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Synced ${filteredCount} commission records for current month (UTC) based on business logic dates.`,
      data: {
        targetUTC: buildTargetUTCMeta(targetY, targetM),
        totalCommissionRecordsReturned: commissions.length,
        currentMonthRecords: filteredCount,
        agentsWithCommission: agentsUpdated,
        agentsResetToZero: agents.length - agentsUpdated,
        agentCommissions: agentCommissions
          .filter((a) => a.totalCommission > 0)
          .sort((a, b) => b.totalCommission - a.totalCommission),
        unmatchedAgents: unmatchedCommissionAgents,
        debugSample: {
          includedFirst20: traceIncluded,
          skippedFirst20: traceSkipped,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error syncing commissions:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * syncAgentViewingsFromSalesforce
 * - Manual endpoint for syncing ONLY viewings for current UTC month.
 */
const syncAgentViewingsFromSalesforce = async (req, res) => {
  try {
    const nowUTC = new Date();
    const targetY = nowUTC.getUTCFullYear();
    const targetM = nowUTC.getUTCMonth();

    console.log(
      `🔄 Starting Salesforce VIEWINGS sync (single dataset) -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    const resp = await sfGet("/services/apexrest/viewings");
    const raw = resp?.data?.viewings || [];

    const viewings = raw.filter((v) => {
      const start = v?.start;
      return start && isSameUtcMonth(start, targetY, targetM);
    });

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    const counts = new Map();
    const unmatchedOwners = new Set();

    for (const v of viewings) {
      const owner = v.owner || v.owner_name || v.agent_name || v.createdById;
      const key = normalizeAgentName(owner);
      if (!key) continue;

      if (agentMap.has(key)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      } else if (owner) {
        unmatchedOwners.add(owner);
      }
    }

    const canZero = allowZeroingNow();
    const ops = [];
    let agentsUpdated = 0;

    for (const [key, agent] of agentMap.entries()) {
      const viewingsCount = counts.get(key) || 0;

      const $set = {
        "leaderboard.lastUpdated": new Date(),
        lastUpdated: new Date(),
      };
      if (viewingsCount !== 0 || canZero) {
        $set["leaderboard.viewings"] = viewingsCount;
      }

      ops.push({
        updateOne: {
          filter: { _id: agent._id },
          update: { $set },
        },
      });

      if (viewingsCount > 0) agentsUpdated++;
    }

    if (ops.length) await Agent.bulkWrite(ops, { ordered: false });

    console.log(
      `✅ Viewings sync completed for UTC ${targetY}-${String(targetM + 1).padStart(
        2,
        "0"
      )}.`
    );

    return res.status(200).json({
      success: true,
      message: `Synced ${viewings.length} viewings for current UTC month.`,
      note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set with safe-zero guard.",
      data: {
        targetUTC: buildTargetUTCMeta(targetY, targetM),
        totalViewings: viewings.length,
        agentsUpdated,
        agentViewings: Array.from(counts.entries())
          .map(([k, c]) => ({
            agentName: agentMap.get(k)?.agentName,
            agentId: agentMap.get(k)?.agentId,
            viewingCount: c,
          }))
          .sort((a, b) => b.viewingCount - a.viewingCount),
        unmatchedOwners: unmatchedOwners.size ? Array.from(unmatchedOwners) : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error syncing Salesforce viewings:", error);
    const status = error?.response?.status || 500;
    const msg =
      status === 401
        ? "Salesforce authentication failed. Invalid or expired Bearer token"
        : "Failed to fetch viewings from Salesforce";
    return res.status(status === 401 ? 401 : 503).json({
      success: false,
      error: msg,
      details: error.message,
    });
  }
};

/**
 * updateMonthlyPropertiesForAllAgents
 * - Manual endpoint that triggers Agent.updateAllAgentsMonthlyProperties()
 *   (your model method) to recalculate monthly property counts.
 * - Separate from the cron snapshot logic (which uses listingsAPI + base IDs).
 */
const updateMonthlyPropertiesForAllAgents = async (req, res) => {
  try {
    console.log("📊 Starting monthly properties update...");
    const result = await Agent.updateAllAgentsMonthlyProperties();

    return res.status(200).json({
      success: true,
      message: "Successfully updated monthly properties for all agents",
      data: {
        ...result,
        note: "Relisted properties (IDs ending with -1, -2, -3, etc.) are excluded from counts",
      },
    });
  } catch (error) {
    console.error("❌ Error updating monthly properties:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to update monthly properties",
      details: error.message,
    });
  }
};

/** ───────────────────────────────────────────────────────────────────────────
 *  Exports
 *  ─────────────────────────────────────────────────────────────────────────── */

module.exports = {
  // Leaderboard API
  getLeaderboardAgents,

  // Manual sync endpoints
  syncAgentDealsFromSalesforce,
  syncAgentViewingsFromSalesforce,
  syncAgentCommissionsFromSalesforce,

  // Monthly properties manual
  updateMonthlyPropertiesForAllAgents,

  // Token diagnostic (raw helper + express handler)
  getSalesforceToken: getSalesforceToken, // not an express handler
  GetSalesForceToken,                     // express handler for tests / manual

  // Cron setup
  setupCronJobs,
};
