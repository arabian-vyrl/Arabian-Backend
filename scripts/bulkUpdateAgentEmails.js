/**
 * Bulk Agent Email Update Script
 * 
 * Usage:
 *   node scripts/bulkUpdateAgentEmails.js --dry-run
 *   node scripts/bulkUpdateAgentEmails.js --execute
 * 
 * You can specify custom domains or mappings via flags:
 *   node scripts/bulkUpdateAgentEmails.js --from="@arabianestates.ae" --to="@barnes-international.com" --execute
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Adjust Model path
const Agent = require("../Models/AgentModel");

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--execute");
  
  let fromDomain = "@arabianestates.ae";
  let toDomain = "@barnes-international.com";

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--from=")) fromDomain = args[i].split("=")[1].toLowerCase();
    if (args[i].startsWith("--to=")) toDomain = args[i].split("=")[1].toLowerCase();
  }

  console.log(`====================================================`);
  console.log(` BULK AGENT EMAIL MIGRATION TOOL`);
  console.log(` Mode: ${isDryRun ? "DRY-RUN (No changes will be saved)" : "EXECUTE (Updating database)"}`);
  console.log(` Pattern: Replacing ${fromDomain} -> ${toDomain}`);
  console.log(`====================================================\n`);

  const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("ERROR: No MongoDB connection string found in .env (MONGO_URI / DATABASE_URL).");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.\n");

    const agents = await Agent.find({ email: { $regex: fromDomain, $options: "i" } });
    console.log(`Found ${agents.length} agent(s) matching "${fromDomain}".\n`);

    if (agents.length === 0) {
      console.log("No agents found matching this domain. Exiting.");
      await mongoose.disconnect();
      return;
    }

    let updatedCount = 0;
    for (const agent of agents) {
      const oldEmail = agent.email;
      const newEmail = oldEmail.toLowerCase().replace(fromDomain, toDomain);

      console.log(`[Agent: ${agent.agentName || agent._id}]`);
      console.log(`  Current: ${oldEmail}`);
      console.log(`  New:     ${newEmail}`);

      if (!isDryRun) {
        agent.email = newEmail;
        await agent.save();
        updatedCount++;
        console.log(`  Status:  UPDATED\n`);
      } else {
        console.log(`  Status:  SIMULATED (run with --execute to commit)\n`);
      }
    }

    console.log(`====================================================`);
    if (isDryRun) {
      console.log(`Dry run complete. ${agents.length} agent email(s) previewed.`);
      console.log(`To apply these changes, run:`);
      console.log(`node scripts/bulkUpdateAgentEmails.js --execute`);
    } else {
      console.log(`Successfully updated ${updatedCount} agent email(s)!`);
    }
    console.log(`====================================================`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

main();
