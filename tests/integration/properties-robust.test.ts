import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

describe("the listings search survives an incomplete listing", () => {
  it("answers with a list (never a 500) when a published listing has no district, city, title or description", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    db.properties.unshift({
      id: `prop-incomplete-${Date.now()}`, agentId: "user-agent-1", images: [], listingStatus: "PUBLISHED", verificationStatus: "APPROVED",
      price: 1000, propertyType: "APARTMENT", transactionType: "FOR_RENT"
    } as any);
    writeDb(db);
    for (const query of [
      { district: "West Bay" },
      { city: "Doha" },
      { searchQuery: "marina" },
      { district: "West Bay", propertyType: "APARTMENT", transactionType: "FOR_RENT" }
    ]) {
      const res = await request(app).get("/api/properties").query(query);
      expect(res.status, JSON.stringify(query)).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
