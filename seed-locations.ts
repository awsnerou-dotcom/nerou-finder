import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_LOCATIONS } from "./server-db.js";

const DB_FILE = path.join(process.cwd(), "data.json");
const prisma = new PrismaClient();

async function run() {
  console.log("Starting locations database sync script...");

  // 1. Sync data.json file
  if (fs.existsSync(DB_FILE)) {
    try {
      console.log("Loading data.json...");
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const dbState = JSON.parse(raw);
      
      console.log(`Current locations count in data.json: ${dbState.locations ? dbState.locations.length : 0}`);
      
      dbState.locations = DEFAULT_LOCATIONS;
      
      console.log(`Updating data.json to have ${DEFAULT_LOCATIONS.length} official locations...`);
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
      console.log("Successfully wrote updated locations to data.json!");
    } catch (err) {
      console.error("Error updating data.json:", err);
    }
  } else {
    console.log("data.json not found on disk, skipping JSON sync.");
  }

  // 2. Sync SQLite via Prisma
  try {
    console.log("Syncing to SQLite database via Prisma...");
    
    console.log("Deleting old location records from SQLite...");
    await prisma.locationItem.deleteMany({});
    
    console.log(`Inserting ${DEFAULT_LOCATIONS.length} new official locations to SQLite...`);
    await prisma.locationItem.createMany({
      data: DEFAULT_LOCATIONS.map(l => ({
        id: l.id,
        data: JSON.stringify(l),
      }))
    });
    
    const count = await prisma.locationItem.count();
    console.log(`Sync completed! SQLite locations count: ${count}`);
  } catch (err) {
    console.error("Error syncing to SQLite database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
