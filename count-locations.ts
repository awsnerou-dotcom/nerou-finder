// Read-only debug utility: prints how many LocationItem rows exist in PostgreSQL, broken
// down by type. Queries Postgres directly (the sole source of truth) rather than data.json.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Location Records Count ===");
  try {
    const rows = await prisma.locationItem.findMany();
    const locations = rows.map(r => JSON.parse(r.data));

    console.log(`Total location records: ${locations.length}`);

    const counts: Record<string, number> = {};
    for (const item of locations) {
      const type = item.type || "UNKNOWN";
      counts[type] = (counts[type] || 0) + 1;
    }

    console.log("Count by type:");
    console.log(JSON.stringify(counts, null, 2));
  } catch (err) {
    console.error("Error reading locations from PostgreSQL:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
