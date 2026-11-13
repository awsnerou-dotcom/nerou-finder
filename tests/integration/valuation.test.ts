import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

let seq = 0;
const listing = (district: string, per: number, over: Record<string, unknown> = {}) => ({
  id: `val-${Date.now()}-${seq++}`, listingId: `VAL-${seq}`, title: `Valuation comparable ${per}`, description: "x", agentId: "user-agent-1", orgId: "org-agency-1",
  images: [], amenities: [], priceHistory: [], propertyType: "APARTMENT", transactionType: "FOR_SALE", currency: "QAR", sizeUnit: "SQM",
  price: per * 100, area: 100, city: "Doha", district, latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2, parking: false,
  listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 80, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString(), ...over
});
const ask = (body: Record<string, unknown>) => request(app).post("/api/valuation").set("X-Forwarded-For", uniqueIp()).send(body);
const form = (district: string, over: Record<string, unknown> = {}) => ({ deal: "SALE", city: "Doha", district, propertyType: "APARTMENT", area: 120, bedrooms: 2, ...over });

describe("POST /api/valuation", () => {
  it("answers an owner with an estimate and range from the live listings around, and the agents to talk to", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `ValTown-${Date.now()}`;
    const db = readDb();
    db.properties.unshift(...([8000, 9000, 10000, 11000, 12000].map(per => listing(district, per)) as never[]));
    writeDb(db);

    const res = await ask(form(district)).expect(200);
    expect(res.body.result).toMatchObject({
      ok: true, deal: "SALE", district, basis: "district-type-bedrooms", comparableCount: 5, medianPerSqm: 10000,
      estimate: 1_200_000, low: 1_080_000, high: 1_320_000, confidence: "medium", perMonth: false
    });
    expect(res.body.result.similar).toHaveLength(3);
    // the verified agent who owns these listings is offered, with how many live listings they have here
    expect(res.body.agents[0]).toMatchObject({ id: "user-agent-1", listings: 5 });
    expect(typeof res.body.agents[0].fullName).toBe("string");
    expect(res.body.agents[0].password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|"password"|email|phone|whatsapp/i);
  });

  it("does not guess where there is too little to go on", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `Empty-${Date.now()}`;
    const res = await ask(form(district, { city: `Nowhere-${Date.now()}` })).expect(200); // a city with no listings at all
    expect(res.body.result).toEqual({ ok: false, reason: "not-enough-data", comparableCount: 0 });
    expect(res.body.agents).toEqual([]);
  });

  it("rejects an incomplete or nonsensical form with a message", async (ctx) => {
    if (!dbReady) return ctx.skip();
    for (const bad of [{}, form("X", { deal: "BARTER" }), form("X", { area: 3 }), form("X", { city: "" }), form("X", { bedrooms: 99 })]) {
      const res = await ask(bad);
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
    }
  });

  it("needs no account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await ask(form(`Anon-${Date.now()}`))).status).toBe(200);
  });
});
