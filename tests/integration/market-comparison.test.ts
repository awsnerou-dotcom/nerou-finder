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
  id: `cmp-${Date.now()}-${seq++}`, listingId: `CMP-${seq}`, title: "Comparison test listing", description: "x", agentId: "user-agent-1", orgId: "org-agency-1",
  images: [], amenities: [], priceHistory: [], propertyType: "APARTMENT", transactionType: "FOR_SALE", currency: "QAR",
  price: per * 100, area: 100, sizeUnit: "SQM", city: "Doha", district, latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2,
  furnished: "NO", parking: false, listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 80,
  createdDate: new Date().toISOString(), updatedDate: new Date().toISOString(), ...over
});
const add = (...rows: object[]) => { const db = readDb(); db.properties.unshift(...(rows as any[])); writeDb(db); };
const compare = (id: string) => request(app).get(`/api/properties/${id}/market-comparison`);

describe("GET /api/properties/:id/market-comparison", () => {
  it("is public and answers 404 for a listing that does not exist", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await compare("no-such-listing")).status).toBe(404);
  });

  it("does not compare a listing that has too few neighbours, and gives its own rate", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `Quiet-${Date.now()}`;
    const me = listing(district, 10000);
    add(me, listing(district, 9000), listing(district, 11000)); // only two others
    const res = await compare(me.id).expect(200);
    expect(res.body).toMatchObject({ comparable: false, comparableCount: 2, listingPricePerSqm: 10000, district });
  });

  it("compares with the live listings of the same district from real data", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `Busy-${Date.now()}`;
    const me = listing(district, 8000);
    add(me, listing(district, 9000), listing(district, 10000), listing(district, 11000), listing(district, 10000), listing(district, 12000),
      // none of these may count: a draft, an unapproved listing, another deal, another district
      listing(district, 1, { listingStatus: "DRAFT" }), listing(district, 1, { verificationStatus: "PENDING" }),
      listing(district, 1, { transactionType: "FOR_RENT" }), listing(`${district}-other`, 1));
    const res = await compare(me.id).expect(200);
    expect(res.body).toMatchObject({
      comparable: true, deal: "SALE", district, basis: "same-type", comparableCount: 5,
      listingPricePerSqm: 8000, medianPricePerSqm: 10000, differencePercent: -20, position: "below", lowConfidence: false, perMonth: false
    });
  });

  it("compares a rent on a monthly basis whatever period it was advertised in", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const district = `Rents-${Date.now()}`;
    const rent = (price: number, rentalPeriod?: string) => listing(district, 0, { transactionType: "FOR_RENT", price, rentalPeriod });
    const me = rent(60_000, "YEARLY"); // 5,000 a month
    add(me, rent(4000, "MONTHLY"), rent(5000, "MONTHLY"), rent(6000, "MONTHLY"));
    const res = await compare(me.id).expect(200);
    expect(res.body).toMatchObject({ comparable: true, deal: "RENT", perMonth: true, position: "in-line", listingPricePerSqm: 50, medianPricePerSqm: 50 });
  });
});
