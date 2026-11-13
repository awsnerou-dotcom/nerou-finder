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

let seq = 0;
const listing = (district: string, per: number, over: Record<string, unknown> = {}) => ({
  id: `mkt-${Date.now()}-${seq++}`, listingId: `MKT-${seq}`, title: `Market search ${per}`, description: "x", agentId: "user-agent-1", orgId: "org-agency-1",
  images: [], amenities: [], priceHistory: [], propertyType: "APARTMENT", transactionType: "FOR_SALE", currency: "QAR", sizeUnit: "SQM",
  price: per * 100, area: 100, city: "Doha", district, latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2, parking: false,
  listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 80, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString(), ...over
});

describe("market position in search", () => {
  const district = `MarketTown-${Date.now()}`;
  const set = [8000, 9000, 10000, 11000, 12000].map(per => listing(district, per));
  const byPer = (per: number) => set[[8000, 9000, 10000, 11000, 12000].indexOf(per)];

  beforeAll(() => {
    if (!dbReady) return;
    const db = readDb();
    db.properties.unshift(...(set as never[]));
    writeDb(db);
  });

  it("puts every result's distance from the market on the listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/properties").query({ district }).expect(200);
    const pos = (per: number) => res.body.find((p: any) => p.id === byPer(per).id).marketPosition;
    expect(pos(8000)).toEqual({ percent: -24, position: "below" });
    expect(pos(9000)).toEqual({ percent: -14, position: "below" });
    expect(pos(10000)).toEqual({ percent: 0, position: "in-line" });
    expect(pos(12000)).toEqual({ percent: 26, position: "above" });
  });

  it("keeps only the listings at least 10% under the market with belowMarket=true", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/properties").query({ district, belowMarket: "true" }).expect(200);
    expect(res.body.map((p: any) => p.id).sort()).toEqual([byPer(8000).id, byPer(9000).id].sort());
    const all = await request(app).get("/api/properties").query({ district, belowMarket: "false" }).expect(200);
    expect(all.body).toHaveLength(5); // only "true" switches it on
  });

  it("combines with the other filters", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/properties").query({ district, belowMarket: "true", maxPrice: "850000" }).expect(200);
    expect(res.body.map((p: any) => p.id)).toEqual([byPer(8000).id]);
  });

  it("does not store the position on the listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).get("/api/properties").query({ district }).expect(200);
    expect((readDb().properties.find(p => p.id === byPer(8000).id) as any).marketPosition).toBeUndefined();
  });
});

describe("GET /api/search/facets", () => {
  it("counts the live listings of each city and district, and leaves out what a visitor cannot see", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `FacetTown-${Date.now()}`;
    const db = readDb();
    db.properties.unshift(
      ...([listing(district, 9000), listing(district, 9500), listing(district, 9800),
        listing(district, 9000, { listingStatus: "DRAFT" }), listing(district, 9000, { verificationStatus: "PENDING" })] as never[]));
    writeDb(db);
    const res = await request(app).get("/api/search/facets").expect(200);
    expect(res.body.districts).toContainEqual({ city: "Doha", name: district, count: 3 });
    const doha = res.body.cities.find((c: any) => c.name.toLowerCase() === "doha");
    expect(doha.count).toBeGreaterThanOrEqual(3);
    expect(res.body.cities.map((c: any) => c.count)).toEqual([...res.body.cities.map((c: any) => c.count)].sort((a, b) => b - a)); // biggest first
  });
});
