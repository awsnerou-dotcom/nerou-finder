// Legacy one-time recovery script. Postgres is now the app's sole source of truth - it no
// longer dual-writes to data.json at runtime, so this script has nothing to migrate FROM in
// normal operation. It only exists in case you have an old data.json snapshot (e.g. a backup
// from before that change) that you need to import into Postgres by hand. It is NOT part of
// the boot path and is safe to run more than once (every row is upserted by id).
import fs from "fs";
import path from "path";
import { writeDb, flushPendingWrites } from "./server-db.js";

async function runMigration() {
  console.log("=== IMPORTING data.json SNAPSHOT INTO POSTGRESQL ===");
  const dbFile = path.join(process.cwd(), "data.json");

  if (!fs.existsSync(dbFile)) {
    console.error(`Error: 'data.json' not found at ${dbFile}. Nothing to import.`);
    process.exit(1);
  }

  try {
    console.log("Reading data.json snapshot...");
    const rawData = fs.readFileSync(dbFile, "utf-8");
    const state = JSON.parse(rawData);

    console.log("Upserting snapshot data into PostgreSQL...");
    writeDb(state);
    await flushPendingWrites();

    console.log("Import complete - data.json has been upserted into PostgreSQL.");
    process.exit(0);
  } catch (error) {
    console.error("Import failed with error:", error);
    process.exit(1);
  }
}

runMigration();
