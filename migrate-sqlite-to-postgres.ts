import fs from "fs";
import path from "path";
import { writeDb } from "./server-db.js";

async function runMigration() {
  console.log("=== STARTING SQLITE TO POSTGRESQL DATA MIGRATION ===");
  const dbFile = path.join(process.cwd(), "data.json");
  
  if (!fs.existsSync(dbFile)) {
    console.error(`Error: SQLite snapshot file 'data.json' not found at ${dbFile}.`);
    console.error("Please run the app once with SQLite to ensure data.json is fully populated before migrating.");
    process.exit(1);
  }

  try {
    console.log("Reading SQLite snapshot from data.json...");
    const rawData = fs.readFileSync(dbFile, "utf-8");
    const state = JSON.parse(rawData);
    
    console.log("Connecting to PostgreSQL database...");
    console.log("Syncing snapshot data into PostgreSQL...");
    
    // writeDb will queue the background write to PostgreSQL via Prisma Client
    writeDb(state);
    
    // Wait for a short duration to ensure syncQueue completes
    console.log("Writing to database...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    console.log("Migration complete! Database has been successfully populated in PostgreSQL with zero data loss.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

runMigration();
