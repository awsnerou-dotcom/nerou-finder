import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data.json");

function main() {
  console.log("=== Location Records Count ===");
  if (!fs.existsSync(DB_FILE)) {
    console.log("data.json does not exist yet.");
    return;
  }
  
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const dbState = JSON.parse(raw);
    const locations = dbState.locations || [];
    
    console.log(`Total location records: ${locations.length}`);
    
    const counts: Record<string, number> = {};
    for (const item of locations) {
      const type = item.type || "UNKNOWN";
      counts[type] = (counts[type] || 0) + 1;
    }
    
    console.log("Count by type:");
    console.log(JSON.stringify(counts, null, 2));
  } catch (err) {
    console.error("Error reading data.json:", err);
  }
}

main();
