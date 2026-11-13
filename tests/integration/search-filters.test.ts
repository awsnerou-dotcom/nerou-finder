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

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
let seq = 0;
const listing = (district: string, tag: string, over: Record<string, unknown>) => ({
  id: `flt-${tag}-${Date.now()}-${seq++}`, listingId: `FLT-${seq}`, title: `Filter test ${tag}`, description: "x", agentId: "user-agent-1", orgId: "org-agency-1",
  images: [], amenities: [], priceHistory: [], propertyType: "APARTMENT", transactionType: "FOR_SALE", currency: "QAR", sizeUnit: "SQM",
  city: "Doha", district, latitude: 25.3, longitude: 51.5, parking: false, listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 80,
  updatedDate: new Date().toISOString(), ...over
});

describe("GET /api/properties: the filters visitors expect", () => {
  // three listings in one private district so other tests' data cannot interfere
  const district = `FilterTown-${Date.now()}`;
  const small = listing(district, "small", { bedrooms: 1, bathrooms: 1, price: 500_000, area: 60, furnished: "NO", createdDate: daysAgo(30), priceHistory: [{ price: 500_000, date: daysAgo(30).slice(0, 10) }] });
  const mid = listing(district, "mid", { bedrooms: 3, bathrooms: 2, price: 900_000, area: 150, furnished: "YES", createdDate: daysAgo(0.5),
    priceHistory: [{ price: 1_000_000, date: daysAgo(10).slice(0, 10) }, { price: 900_000, date: daysAgo(2).slice(0, 10) }] });
  const big = listing(district, "big", { bedrooms: 5, bathrooms: 4, price: 2_000_000, area: 400, furnished: "PARTLY", createdDate: daysAgo(3), priceHistory: [{ price: 2_000_000, date: daysAgo(3).slice(0, 10) }] });

  const find = async (query: Record<string, string>) => {
    const res = await request(app).get("/api/properties").query({ district, ...query });
    expect(res.status).toBe(200);
    return (res.body as { id: string }[]).map(p => p.id).sort();
  };
  const ids = (...l: { id: string }[]) => l.map(x => x.id).sort();

  beforeAll(() => {
    if (!dbReady) return;
    const db = readDb();
    db.properties.unshift(small as never, mid as never, big as never);
    writeDb(db);
  });

  it("narrows by bedrooms and bathrooms as 'N or more'", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({})).toEqual(ids(small, mid, big));
    expect(await find({ minBedrooms: "3" })).toEqual(ids(mid, big));
    expect(await find({ minBedrooms: "5" })).toEqual(ids(big));
    expect(await find({ minBedrooms: "6" })).toEqual([]);
    expect(await find({ minBathrooms: "2" })).toEqual(ids(mid, big));
    expect(await find({ minBathrooms: "4" })).toEqual(ids(big));
    expect(await find({ minBedrooms: "0" })).toEqual(ids(small, mid, big)); // "0 or more" is everything
  });

  it("still supports the exact bedroom match older callers use", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({ bedrooms: "3" })).toEqual(ids(mid));
  });

  it("narrows by price, size and furnishing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({ minPrice: "600000", maxPrice: "1500000" })).toEqual(ids(mid));
    expect(await find({ maxPrice: "900000" })).toEqual(ids(small, mid));
    expect(await find({ minArea: "100" })).toEqual(ids(mid, big));
    expect(await find({ furnished: "YES" })).toEqual(ids(mid));
    expect(await find({ furnished: "NO" })).toEqual(ids(small));
  });

  it("finds the listings whose price has recently come down", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({ priceReduced: "true" })).toEqual(ids(mid));
    expect(await find({ priceReduced: "false" })).toEqual(ids(small, mid, big)); // only "true" switches it on
  });

  it("finds the listings published in the last N days", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({ listedWithinDays: "7" })).toEqual(ids(mid, big));
    expect(await find({ listedWithinDays: "1" })).toEqual(ids(mid));
    expect(await find({ listedWithinDays: "60" })).toEqual(ids(small, mid, big));
  });

  it("combines filters, and ignores values that are not numbers instead of failing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(await find({ minBedrooms: "3", priceReduced: "true", furnished: "YES", minPrice: "800000" })).toEqual(ids(mid));
    expect(await find({ minBedrooms: "3", furnished: "NO" })).toEqual([]);
    expect(await find({ minBedrooms: "many", minBathrooms: "", listedWithinDays: "soon" })).toEqual(ids(small, mid, big));
  });
});
