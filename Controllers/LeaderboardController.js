const axios = require("axios");
const Agent = require("../Models/AgentModel");
const cron = require("node-cron");
const mongoose = require("mongoose");

let masterSyncRunning = false;
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

/** ───────────────────────────────────────────────────────────────────────────
 *  Name normalization
 *  ─────────────────────────────────────────────────────────────────────────── */
function normalizeAgentName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKD") // strip diacritics where possible
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Salesforce / HTTP
 *  ─────────────────────────────────────────────────────────────────────────── */
const SALESFORCE = {
  tokenUrl: process.env.SALESFORCE_TOKEN_URL,
  baseUrl: "https://arabianestates.my.salesforce.com",
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  username: process.env.SALESFORCE_USERNAME,
  password: process.env.SALESFORCE_PASSWORD,
};

const axiosSF = axios.create({
  baseURL: SALESFORCE.baseUrl,
  timeout: 30_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

// Simple retry helper for transient errors
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
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// OAuth2 token
async function getSalesforceToken() {
  try {
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "password",
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

// Apex REST GET with token + retry
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
 *  UTC date helpers (critical for month/year boundaries)
 *  ─────────────────────────────────────────────────────────────────────────── */
function toUtcDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = String(input);
  // If lacks TZ info, assume UTC (append 'Z')
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasTZ ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameUtcMonth(dateLike, targetY, targetM) {
  const d = toUtcDate(dateLike);
  if (!d) return false;
  return d.getUTCFullYear() === targetY && d.getUTCMonth() === targetM; // 0..11
}

function utcTodayStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function allowZeroingNow() {
  const now = new Date();
  const minsFromMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minsFromMidnight > 45; // skip zeroing in first 45 minutes of UTC day
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Month resolver (for manual deals endpoint)
 *  ─────────────────────────────────────────────────────────────────────────── */
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
    m = mm - 1;
  }
  return { targetY: y, targetM: m };
}

function amountNumber(raw) {
  return typeof raw === "string"
    ? Number(raw.replace(/[, ]/g, ""))
    : Number(raw) || 0;
}

/** ───────────────────────────────────────────────────────────────────────────
 *  NEW: Leaderboard snapshot builder (parser-style)
 *  ─────────────────────────────────────────────────────────────────────────── */

/**
 * Build a full leaderboard snapshot for the *current UTC month*
 * from Salesforce deals, commissions, and viewings.
 * This only computes in memory – no DB writes here.
 */

async function buildLeaderboardSnapshotCurrentMonth() {
  const nowUTC = new Date();
  const targetY = nowUTC.getUTCFullYear();
  const targetM = nowUTC.getUTCMonth(); // 0..11

  console.log(
    `🔄 [LEADERBOARD SNAPSHOT] Building for UTC ${targetY}-${String(
      targetM + 1
    ).padStart(2, "0")}`
  );

  // 1) Pull all required Salesforce datasets in parallel
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

  const monthlyDealsRaw = dealsMonthlyResp?.data?.deals || [];
  const ytdDealsRaw = dealsYtdResp?.data?.deals || [];
  const commissionsRaw = commissionsResp?.data?.commissions || [];
  const viewingsRaw = viewingsResp?.data?.viewings || [];
  const listingsRaw = listingsResp?.data?.listings || [];

  // 2) Load all active agents once
  const agents = await Agent.find({ isActive: true });
  const agentMap = new Map(
    agents.map((a) => [normalizeAgentName(a.agentName), a])
  );

  // 🔹 NEW: email -> Agent document (to mirror manual function’s Agent.findOne({ email }))
  const emailToAgent = new Map();
  for (const a of agents) {
    if (!a.email) continue;
    const emailKey = a.email.toLowerCase().trim();
    if (emailKey) {
      emailToAgent.set(emailKey, a);
    }
  }

  // 3) Snapshot metrics per agent (keyed by normalized agentName)
  const metricsByKey = new Map();

  const ensureMetrics = (key) => {
    let m = metricsByKey.get(key);
    if (!m) {
      m = {
        propertiesSold: 0,
        totalCommission: 0,
        viewings: 0,
        lastDealDate: null,
        activePropertiesThisMonth: 0, // 🔥 NEW
      };
      metricsByKey.set(key, m);
    }
    return m;
  };

  /* ───────────── DEALS: propertiesSold + lastDealDate ───────────── */
  // ... your deals + commissions + viewings code stays EXACTLY as it is ...

  /* ───────────── MONTHLY PROPERTIES: activePropertiesThisMonth ───────────── */

  // Filter listings by PF_Published_Date (current UTC month) + Live status
  const listingsThisMonth = listingsRaw.filter((listing) => {
    if (!listing.PF_Published_Date) return false;
    if (listing.status !== "Live") return false;

    const publishedDate = toUtcDate(listing.PF_Published_Date);
    if (!publishedDate) return false;

    const isCurrentMonth =
      publishedDate.getUTCFullYear() === targetY &&
      publishedDate.getUTCMonth() === targetM;

    return isCurrentMonth;
  });

  // Mirror manual stats
  const skippedNullDate = listingsRaw.filter(
    (l) => !l.PF_Published_Date
  ).length;
  const skippedOffMarket = listingsRaw.filter(
    (l) => l.status !== "Live"
  ).length;

  let excludedRelisted = 0;
  const unmatchedListingEmails = new Set();

  for (const listing of listingsThisMonth) {
    const emailKey = listing.listing_agent_email
      ?.toLowerCase()
      .trim();

    if (!emailKey) continue;

    // 🔁 Use EXACT same relisted logic as manual (prefer Agent.isRelistedProperty if defined)
    const isRelisted =
      typeof Agent.isRelistedProperty === "function"
        ? Agent.isRelistedProperty(listing.id)
        : (() => {
            const id = listing.id;
            if (!id) return false;
            const segments = id.split("-");
            const lastSegment = segments[segments.length - 1];
            // Relisted if: more than 3 segments AND last is purely numeric
            return segments.length > 3 && /^\d+$/.test(lastSegment);
          })();

    if (isRelisted) {
      excludedRelisted++;
      continue;
    }

    // 🔹 Mirror manual join: email → Agent
    const agentDoc = emailToAgent.get(emailKey);
    if (!agentDoc) {
      unmatchedListingEmails.add(emailKey);
      continue;
    }

    const metricsKey = normalizeAgentName(agentDoc.agentName);
    if (!metricsKey) {
      unmatchedListingEmails.add(`${emailKey} (no agentName)`);
      continue;
    }

    const m = ensureMetrics(metricsKey);
    m.activePropertiesThisMonth =
      (m.activePropertiesThisMonth || 0) + 1;
  }

  console.log(
    `🏠 [MONTHLY PROPERTIES] Listings this month (Live, PF_Published_Date in month): ${listingsThisMonth.length}`
  );
  console.log(
    `   → Excluded relisted: ${excludedRelisted}, skippedNullDate: ${skippedNullDate}, skippedOffMarket: ${skippedOffMarket}`
  );

  return {
    targetY,
    targetM,
    agents,
    agentMap, // still available if needed
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
      properties: {
        totalListingsResp: listingsRaw.length,
        listingsThisMonth: listingsThisMonth.length,
        excludedRelisted,
        skippedNullDate,
        skippedOffMarket,
        unmatchedListingEmails: Array.from(unmatchedListingEmails),
      },
    },
  };
}

/**
 * Apply a leaderboard snapshot to Mongo in a single bulkWrite,
 * parser-style (no per-agent .save() loops).
 */

/**
 * Core function the cron (and optionally manual) can call:
 * builds snapshot + applies it in one go.
 */
/**
 * Core function the cron (and optionally manual) can call:
 * builds snapshot + applies it in one go with retry logic.
 */
async function syncLeaderboardCoreCurrentMonth(maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    const session = await mongoose.startSession();

    try {
      // Start transaction
      session.startTransaction();

      console.log(
        `🔒 [TRANSACTION] Starting leaderboard sync with transaction... (Attempt ${attempt + 1}/${maxRetries})`
      );

      // Build snapshot (read-only operations, no transaction needed)
      const snapshot = await buildLeaderboardSnapshotCurrentMonth();

      // Apply snapshot within transaction
      const result = await applyLeaderboardSnapshotWithTransaction(
        snapshot,
        session
      );

      // Commit transaction - all updates become visible at once
      await session.commitTransaction();
      console.log(
        "✅ [TRANSACTION] Committed successfully - all updates are now visible"
      );

      return result;
    } catch (error) {
      // Rollback on any error - no partial updates will be visible
      await session.abortTransaction();
      
      // Check if it's a transient transaction error that can be retried
      const isTransientError = 
        error.errorLabelSet?.has('TransientTransactionError') ||
        error.code === 112 || // WriteConflict
        error.codeName === 'WriteConflict';

      if (isTransientError && attempt < maxRetries - 1) {
        attempt++;
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(
          `⚠️ [TRANSACTION] Write conflict detected. Retrying in ${delayMs}ms... (Attempt ${attempt}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      console.error(
        "❌ [TRANSACTION] Aborted due to error - no changes applied:",
        error.message
      );
      throw error;
    } finally {
      // Always end session
      session.endSession();
    }
  }
}

/**
 * Apply leaderboard snapshot within a transaction
 */
async function applyLeaderboardSnapshotWithTransaction(snapshot, session) {
  const { targetY, targetM, agentMap, metricsByKey, meta } = snapshot;

  const todayUTC = utcTodayStart();
  const canZero = allowZeroingNow();
  const now = new Date();

  const ops = [];
  let agentsTouched = 0;

  for (const [key, agent] of agentMap.entries()) {
    const m = metricsByKey.get(key) || {
      propertiesSold: 0,
      totalCommission: 0,
      viewings: 0,
      lastDealDate: null,
      activePropertiesThisMonth: 0,
    };

    const propertiesSold = m.propertiesSold || 0;
    const totalCommission = Math.round((m.totalCommission || 0) * 100) / 100;
    const viewings = m.viewings || 0;
    const activePropertiesThisMonth = m.activePropertiesThisMonth || 0;

    let lastDealDays = null;
    if (m.lastDealDate) {
      const d0 = new Date(m.lastDealDate);
      d0.setUTCHours(0, 0, 0, 0);
      lastDealDays = Math.max(0, Math.floor((todayUTC - d0) / 86400000));
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
    if (activePropertiesThisMonth !== 0 || canZero) {
      $set["leaderboard.activePropertiesThisMonth"] = activePropertiesThisMonth;
    }

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
      activePropertiesThisMonth !== 0 ||
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
      agentsTouched: 0,
      meta,
    };
  }

  // Execute bulkWrite with session for transaction support
  await Agent.bulkWrite(ops, {
    ordered: false,
    session, // Pass session to include in transaction
  });

  console.log(
    `✅ [LEADERBOARD SNAPSHOT] Prepared bulkWrite for UTC ${targetY}-${String(
      targetM + 1
    ).padStart(
      2,
      "0"
    )} → Agents to update: ${agentsTouched} (waiting for commit)`
  );

  return {
    targetY,
    targetM,
    agentsTouched,
    meta,
  };
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Cron orchestration (now using parser-style leaderboard snapshot)
 *  ─────────────────────────────────────────────────────────────────────────── */
async function runAllSyncs() {
  return runAllSyncsLocked("master-sync", async () => {
    console.log("⏰ [CRON] Starting scheduled Salesforce sync job...");
    const t0 = Date.now();
    try {
      // 1) Build & apply leaderboard snapshot in one shot
      const leaderboardResult = await syncLeaderboardCoreCurrentMonth();

      // 2) Then monthly properties (agent model method)
      // const monthlyPropsResult = await syncMonthlyPropertiesJobNew();

      const sec = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(`✅ [CRON] All syncs completed successfully in ${sec}s`);
      console.log(
        `   → Leaderboard: agentsTouched=${
          leaderboardResult.agentsTouched
        }, month=${leaderboardResult.targetM + 1}/${leaderboardResult.targetY}`
      );
    } catch (error) {
      console.error("❌ [CRON] Error in scheduled sync job:", error.message);
    }
  });
}

let cronScheduled = false;
function setupCronJobs() {
  if (cronScheduled) {
    console.log("ℹ️  Cron already scheduled; skipping duplicate registration.");
    return;
  }

  // Every 2 minutes, pinned to UTC
  cron.schedule(
    "*/3 * * * *",
    async () => {
      const now = new Date().toISOString();
      console.log(`🔔 [CRON TICK] Triggered at ${now} (UTC)`);
      await runAllSyncs(); // mutex-protected, snapshot-style
    },
    { timezone: "UTC" }
  );

  cronScheduled = true;
  console.log(
    "✅ Cron job scheduled: Salesforce sync will run every 2 minutes (UTC)"
  );

  // Optional immediate run (also mutex-protected)
  console.log("🚀 Running initial sync on startup...");
  runAllSyncs();
}

/** ───────────────────────────────────────────────────────────────────────────
 *  API Handlers (manual triggers & leaderboard route)
 *  ─────────────────────────────────────────────────────────────────────────── */

// Manual: OAuth token (useful for diagnostics; don’t expose publicly)
const GetSalesForceToken = async (req, res) => {
  try {
    console.log("WORKING");
    const resp = await axios.post(SALESFORCE.tokenUrl, null, {
      params: {
        grant_type: "password",
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
    return res
      .status(500)
      .json({ success: false, error: "Salesforce token generation failed" });
  }
};

// Leaderboard (unchanged logic; sorts by totalCommission desc, with seq tiebreaker)
const getLeaderboardAgents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit ?? "8", 10), 1);
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: {
          activeOnLeaderboard: true,
        },
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
          _commission: {
            $toLong: { $ifNull: ["$leaderboard.totalCommission", 0] },
          },
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
        activePropertiesThisMonth:
          a.leaderboard?.activePropertiesThisMonth ?? 0,
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
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** ───────────────────────────────────────────────────────────────────────────
 *  Manual sync endpoints (kept for debugging / analytics)
 *  ─────────────────────────────────────────────────────────────────────────── */

const syncAgentDealsFromSalesforce = async (req, res) => {
  try {
    const { month = "this_month" } = req.query;

    // Reuse the same helpers you used for commissions sync
    const { targetY, targetM } = resolveMonthUTC(month);

    console.log(
      `🔄 Starting Salesforce DEALS-ONLY sync for: ${month} -> UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}`
    );

    // Fetch deals:
    // - monthly: for counting deals in the selected month
    // - ytd (or this_year): for lastDealDate (latest in the calendar year)
    const [monthlyDealsResp, ytdDealsResp] = await Promise.all([
      sfGet("/services/apexrest/deals", { month }),
      sfGet("/services/apexrest/deals", { month: "ytd" }),
    ]);

    const monthlyDealsRaw = monthlyDealsResp?.data?.deals || [];
    const ytdDealsRaw = ytdDealsResp?.data?.deals || [];

    // Strict month filter (createddate ONLY), same rule as commissions
    const monthlyDeals = monthlyDealsRaw.filter((d) =>
      isSameUtcMonth(d.createddate, targetY, targetM)
    );

    const agents = await Agent.find({ isActive: true });
    const agentMap = new Map(
      agents.map((a) => [normalizeAgentName(a.agentName), a])
    );

    // ===== MONTHLY DEAL COUNTS =====
    const dealCountsByAgent = new Map();
    const unmatchedMonthly = [];

    for (const deal of monthlyDeals) {
      // ✅ UPDATED LOGIC: Use deal_agent, deal_agent_1, deal_agent_2
      const nameCandidates = [];
      if (deal.deal_agent) nameCandidates.push(deal.deal_agent);
      if (deal.deal_agent_1) nameCandidates.push(deal.deal_agent_1);
      if (deal.deal_agent_2) nameCandidates.push(deal.deal_agent_2);

      // Clean + dedupe per deal to avoid double-counting same agent
      const names = [
        ...new Set(
          nameCandidates
            .map((n) => (typeof n === "string" ? n.trim() : "").trim())
            .filter(Boolean)
        ),
      ];

      // If no agent fields, skip this deal
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

    // ===== YTD LAST DEAL DATE =====
    const ytdDeals = ytdDealsRaw;
    const agentLastDealDateYTD = new Map();
    const unmatchedYtd = [];

    for (const deal of ytdDeals) {
      // ✅ UPDATED LOGIC: Use deal_agent, deal_agent_1, deal_agent_2
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

      // If no agent fields, skip this deal
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

    // ===== UPDATE AGENTS (DEAL METRICS ONLY) =====
    // Calculate days using UTC midnight for consistency
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const ops = [];
    let agentsUpdated = 0;
    const agentDeals = [];

    for (const [key, agent] of agentMap.entries()) {
      const dealCount = dealCountsByAgent.get(key) || 0;
      const lastDealDate = agentLastDealDateYTD.get(key) || null;

      // Calculate days properly using UTC dates
      let lastDealDays = null;
      if (lastDealDate) {
        const dealDateUTC = new Date(lastDealDate);
        dealDateUTC.setUTCHours(0, 0, 0, 0);

        // Calculate difference in days
        const diffMs = todayUTC.getTime() - dealDateUTC.getTime();
        lastDealDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Ensure it's never negative
        lastDealDays = Math.max(0, lastDealDays);
      }

      // Prepare bulk update operation
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

    // Execute bulk update (safe & fast)
    if (ops.length) {
      await Agent.bulkWrite(ops, { ordered: false });
    }

    console.log(
      `✅ DEALS-ONLY sync completed for ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")} (UTC).`
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
        targetUTC: { year: targetY, monthIndex0: targetM },
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

//     const commissionsByAgent = new Map();
//     const unmatchedCommissionAgents = [];
//     let filteredCount = 0;

//     const traceIncluded = [];
//     const traceSkipped = [];

//     for (const c of commissions) {
//       const created = c?.createddate;
//       const keep = isSameUtcMonth(created, targetY, targetM);

//       if (!keep) {
//         if (traceSkipped.length < 20)
//           traceSkipped.push({
//             ref: c.commission_ref_no,
//             agent: c.agent_name || c.commission_agents,
//             created,
//           });
//         continue;
//       }

//       filteredCount++;
//       if (traceIncluded.length < 20)
//         traceIncluded.push({
//           ref: c.commission_ref_no,
//           agent: c.agent_name || c.commission_agents,
//           created,
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

//       const $set = {
//         "leaderboard.lastUpdated": new Date(),
//         lastUpdated: new Date(),
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
//       `✅ COMMISSIONS sync completed for UTC ${targetY}-${String(targetM + 1).padStart(2, "0")}`
//     );
//     console.log(`   - Current month records: ${filteredCount}`);
//     console.log(`   - Agents updated: ${agentsUpdated}`);

//     return res.status(200).json({
//       success: true,
//       message: `Synced ${filteredCount} commission records for current month (UTC).`,
//       data: {
//         targetUTC: { year: targetY, monthIndex0: targetM },
//         totalCommissionRecordsReturned: commissions.length,
//         currentMonthRecords: filteredCount,
//         agentsWithCommission: agentsUpdated,
//         agentsResetToZero: agents.length - agentsUpdated,
//         agentCommissions: agentCommissions
//           .filter((a) => a.totalCommission > 0)
//           .sort((a, b) => b.totalCommission - a.totalCommission),
//         unmatchedAgents: unmatchedCommissionAgents,
//         debugSample: { includedFirst20: traceIncluded, skippedFirst20: traceSkipped },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error syncing commissions:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };
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

    // 🔹 Record types that should use offer_contract_date for month mapping
    const CONTRACT_DATE_TYPES = new Set([
      "Landlord Commission",
      "Landlord Referral Commission",
      "Tenant Commission",
      "Tenant Referral",
    ]);

    // Funcion to check record type and get appropriate date to map monthly commission for agent
    const getEffectiveDateForCommission = (c) => {
      const recordType = c?.record_type;

      // For these types: use offer_contract_date
      if (CONTRACT_DATE_TYPES.has(recordType)) {
        return c.offer_contract_date || null;
      }

      // For all other record types: use from_f_startdate
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

      commissionsByAgent.set(key, (commissionsByAgent.get(key) || 0) + amount);
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
    console.log(
      `   - Current month records (by effective date): ${filteredCount}`
    );
    console.log(`   - Agents updated: ${agentsUpdated}`);

    return res.status(200).json({
      success: true,
      message: `Synced ${filteredCount} commission records for current month (UTC) based on business logic dates.`,
      data: {
        targetUTC: { year: targetY, monthIndex0: targetM },
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
      `✅ Viewings sync completed for UTC ${targetY}-${String(
        targetM + 1
      ).padStart(2, "0")}.`
    );

    return res.status(200).json({
      success: true,
      message: `Synced ${viewings.length} viewings for current UTC month.`,
      note: "Single dataset from Salesforce. Strict UTC month matching on 'start'. Agents without viewings set with safe-zero guard.",
      data: {
        targetUTC: { year: targetY, monthIndex0: targetM },
        totalViewings: viewings.length,
        agentsUpdated,
        agentViewings: Array.from(counts.entries())
          .map(([k, c]) => ({
            agentName: agentMap.get(k)?.agentName,
            agentId: agentMap.get(k)?.agentId,
            viewingCount: c,
          }))
          .sort((a, b) => b.viewingCount - a.viewingCount),
        unmatchedOwners: unmatchedOwners.size
          ? Array.from(unmatchedOwners)
          : undefined,
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


const updateMonthlyPropertiesForAllAgents = async (req, res) => {
  try {
    console.log("🔄 Starting monthly Salesforce property sync...");

    // ✅ USE sfGet() instead of axios.get() to include authentication
    const response = await sfGet("/services/apexrest/listingsAPI");

    if (!response.data || !response.data.listings) {
      throw new Error("Invalid response from Salesforce API");
    }

    const listings = response.data.listings;
    console.log(`📦 Fetched ${listings.length} listings from Salesforce`);

    // Get current UTC month for filtering
    const nowUTC = new Date();
    const currentYear = nowUTC.getUTCFullYear();
    const currentMonth = nowUTC.getUTCMonth(); // 0-11

    console.log(
      `📅 Filtering for UTC ${currentYear}-${String(currentMonth + 1).padStart(
        2,
        "0"
      )} (November 2025)`
    );

    // ✅ Filter listings by current month's PF_Published_Date
    const currentMonthListings = listings.filter((listing) => {
      // Skip if no PF_Published_Date
      if (!listing.PF_Published_Date) {
        return false;
      }

      // Skip if not Live status
      if (listing.status !== "Live") {
        return false;
      }

      // ✅ Parse the date and check if it's in current month
      const publishedDate = toUtcDate(listing.PF_Published_Date);
      if (!publishedDate) {
        return false;
      }

      const isCurrentMonth =
        publishedDate.getUTCFullYear() === currentYear &&
        publishedDate.getUTCMonth() === currentMonth;

      return isCurrentMonth;
    });

    console.log(
      `✅ Found ${currentMonthListings.length} properties published in November 2025 (Live status only)`
    );

    // Group current month properties by agent email
    const propertiesByEmail = {};
    currentMonthListings.forEach((listing) => {
      const email = listing.listing_agent_email?.toLowerCase().trim();
      if (email) {
        if (!propertiesByEmail[email]) {
          propertiesByEmail[email] = [];
        }
        propertiesByEmail[email].push(listing);
      }
    });

    console.log(
      `👥 Properties distributed across ${
        Object.keys(propertiesByEmail).length
      } agent emails`
    );

    const stats = {
      agentsUpdated: 0,
      totalPropertiesThisMonth: 0,
      agentsNotFound: [],
      excludedRelisted: 0,
      skippedNullDate: 0,
      skippedOffMarket: 0,
    };

    // Count skipped properties
    stats.skippedNullDate = listings.filter((l) => !l.PF_Published_Date).length;
    stats.skippedOffMarket = listings.filter((l) => l.status !== "Live").length;

    // ✅ Process each agent individually
    for (const [email, properties] of Object.entries(propertiesByEmail)) {
      const agent = await Agent.findOne({
        email: email,
        isActive: true,
      });

      if (!agent) {
        stats.agentsNotFound.push(email);
        console.log(`⚠️  Agent not found for email: ${email}`);
        continue;
      }

      // Count excluding relisted properties
      const validProperties = properties.filter((listing) => {
        const isRelisted = Agent.isRelistedProperty(listing.id);
        if (isRelisted) {
          stats.excludedRelisted++;
          return false;
        }
        return true;
      });

      const monthlyCount = validProperties.length;

      // ✅ Update leaderboard with THIS MONTH's property count
      agent.leaderboard = agent.leaderboard || {};
      agent.leaderboard.activePropertiesThisMonth = monthlyCount;
      agent.leaderboard.lastUpdated = new Date();
      agent.lastUpdated = new Date();

      // ✅ Mark as modified for Mongoose
      agent.markModified("leaderboard");

      // ✅ Save the agent
      await agent.save();

      stats.agentsUpdated++;
      stats.totalPropertiesThisMonth += monthlyCount;

      console.log(
        `✅ ${agent.agentName}: ${monthlyCount} properties listed in November 2025`
      );

      // 🔍 Debug: Show property IDs
      if (monthlyCount > 0) {
        console.log(`   📋 Property IDs:`);
        validProperties.forEach((listing) => {
          console.log(
            `      - ${listing.id}: ${listing.PF_Published_Date} (${listing.listing_title})`
          );
        });
      }
    }

    console.log("\n📊 Sync Summary:");
    console.log(`   ✅ Agents updated: ${stats.agentsUpdated}`);
    console.log(
      `   📦 Total properties listed this month: ${stats.totalPropertiesThisMonth}`
    );
    console.log(
      `   🔄 Relisted properties excluded: ${stats.excludedRelisted}`
    );
    console.log(
      `   ⏭️  Properties skipped (null PF_Published_Date): ${stats.skippedNullDate}`
    );
    console.log(
      `   ⏭️  Properties skipped (Off Market): ${stats.skippedOffMarket}`
    );
    console.log(`   ⚠️  Agents not found: ${stats.agentsNotFound.length}`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${currentMonthListings.length} properties published this month from Salesforce`,
      data: {
        totalListings: listings.length,
        currentMonthListings: currentMonthListings.length,
        agentsUpdated: stats.agentsUpdated,
        totalPropertiesThisMonth: stats.totalPropertiesThisMonth,
        excludedRelisted: stats.excludedRelisted,
        skippedNullDate: stats.skippedNullDate,
        skippedOffMarket: stats.skippedOffMarket,
        agentsNotFound: stats.agentsNotFound,
        targetMonth: {
          month: currentMonth + 1,
          year: currentYear,
          monthName: new Date(currentYear, currentMonth).toLocaleString(
            "en-US",
            { month: "long" }
          ),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in monthly property sync:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to sync monthly properties",
      details: error.message,
    });
  }
};

module.exports = {
  // Leaderboard
  getLeaderboardAgents,

  // Manual sync endpoints
  syncAgentDealsFromSalesforce,
  syncAgentViewingsFromSalesforce,
  syncAgentCommissionsFromSalesforce,

  // Monthly properties manual
  updateMonthlyPropertiesForAllAgents,

  // Token diagnostic
  getSalesforceToken: getSalesforceToken, // not an express handler
  GetSalesForceToken, // express handler for tests

  // Cron
  setupCronJobs,
};
