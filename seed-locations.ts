// Manual one-off utility to force-push the official DEFAULT_LOCATIONS list into Postgres
// immediately, without waiting for a server restart. In normal operation this is no longer
// necessary - ensureStateDefaults() (server-db.ts) already merges in any missing default
// locations by id on every boot, without discarding admin-added/edited ones. This script
// only touches Postgres; there is no data.json step anymore (Postgres is the sole source of
// truth, see server-db.ts).
import { PrismaClient } from "@prisma/client";
import { DEFAULT_LOCATIONS } from "./server-db.js";

const prisma = new PrismaClient();

async function run() {
  console.log("Starting locations database sync script...");

  try {
    console.log(`Upserting ${DEFAULT_LOCATIONS.length} official locations into PostgreSQL...`);
    for (const loc of DEFAULT_LOCATIONS) {
      await prisma.locationItem.upsert({
        where: { id: loc.id },
        create: { id: loc.id, data: JSON.stringify(loc) },
        update: { data: JSON.stringify(loc) },
      });
    }

    const count = await prisma.locationItem.count();
    console.log(`Sync completed! PostgreSQL locations count: ${count}`);
  } catch (err) {
    console.error("Error syncing locations to PostgreSQL:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
