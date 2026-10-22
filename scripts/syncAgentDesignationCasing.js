/**
 * Sync Agent Designation Casing Script
 *
 * For every active designation in DesignationCategory, finds agents whose
 * `designation` matches case-insensitively but differs in exact casing, and
 * updates them to the category's current spelling (one-time backfill for
 * renames that happened before live propagation was added to updateCategory).
 *
 * Usage:
 *   node scripts/syncAgentDesignationCasing.js --dry-run
 *   node scripts/syncAgentDesignationCasing.js --execute
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Agent = require("../Models/AgentModel");
const DesignationCategory = require("../Models/CategoryModel");

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--execute");

  console.log(`====================================================`);
  console.log(` AGENT DESIGNATION CASING SYNC`);
  console.log(` Mode: ${isDryRun ? "DRY-RUN (No changes will be saved)" : "EXECUTE (Updating database)"}`);
  console.log(`====================================================\n`);

  const mongoUri = process.env.MongoDbUrl || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("ERROR: No MongoDB connection string found in .env (MongoDbUrl).");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.\n");

    const categories = await DesignationCategory.find({ isActive: true });
    const canonicalNames = new Map(); // lowercased name -> current correct-cased name

    for (const cat of categories) {
      for (const d of cat.designations || []) {
        if (!d.name) continue;
        canonicalNames.set(d.name.toLowerCase(), d.name);
      }
    }

    console.log(`Found ${canonicalNames.size} unique designation name(s) across ${categories.length} active categor(y/ies).\n`);

    let updatedCount = 0;
    let checkedCount = 0;

    for (const [lower, correct] of canonicalNames.entries()) {
      const mismatched = await Agent.find({
        designation: { $regex: `^${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });

      for (const agent of mismatched) {
        checkedCount++;
        if (agent.designation === correct) continue; // already correct

        console.log(`[Agent: ${agent.agentName || agent._id}]`);
        console.log(`  Current: "${agent.designation}"`);
        console.log(`  New:     "${correct}"`);

        if (!isDryRun) {
          agent.designation = correct;
          await agent.save();
          updatedCount++;
          console.log(`  Status:  UPDATED\n`);
        } else {
          console.log(`  Status:  SIMULATED (run with --execute to commit)\n`);
        }
      }
    }

    console.log(`====================================================`);
    if (isDryRun) {
      console.log(`Dry run complete. Checked ${checkedCount} matching agent(s).`);
      console.log(`To apply these changes, run:`);
      console.log(`node scripts/syncAgentDesignationCasing.js --execute`);
    } else {
      console.log(`Successfully updated ${updatedCount} agent(s)!`);
    }
    console.log(`====================================================`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

main();
