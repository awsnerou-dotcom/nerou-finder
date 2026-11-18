import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
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

const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const as = (id: string, role: string) => ({ Authorization: `Bearer ${tokenFor(id, role)}`, "X-Forwarded-For": uniqueIp() });
const owner = () => as("user-agent-1", "AGENT");
const tag = `tw${Date.now().toString(36)}`;
let n = 0;

function seed(over: Record<string, unknown> = {}) {
  const db = readDb();
  const id = `prop-${tag}-${++n}`;
  db.properties.unshift({
    id, listingId: `N-${tag}${n}`, agentId: "user-agent-1", orgId: "org-agency-1", title: `Twin flat ${n}`, titleAr: "شقة", description: "A flat used by the twin tests, with enough words to be a description.",
    propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 2_100_000, currency: "QAR", area: 100, sizeUnit: "SQM", city: "Doha", district: `Twinville ${tag}`,
    latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2, furnished: "YES", parking: true, amenities: ["Pool"], images: ["/assets/uploads/twin-a.jpg", "/assets/uploads/twin-b.jpg"],
    listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 85, views: 50, uniqueViews: 30, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString(),
    priceHistory: [{ price: 2_100_000, date: "2026-01-01" }], ...over
  } as never);
  writeDb(db);
  return id;
}
const find = (id: string) => readDb().properties.find(p => p.id === id)!;
const makeTwin = (id: string, body: Record<string, unknown>, headers = owner()) => request(app).post(`/api/properties/${id}/twin`).set(headers).send(body);

describe("POST /api/properties/:id/twin: the same unit for sale AND for rent, entered once", () => {
  it("copies the listing into a second one with the other deal and price, linked both ways", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed();
    const res = await makeTwin(id, { price: 9500, rentalPeriod: "MONTHLY" }).expect(200);
    const twin = res.body.property;
    expect(twin).toMatchObject({ transactionType: "FOR_RENT", price: 9500, rentalPeriod: "MONTHLY", title: `Twin flat ${n}`, district: `Twinville ${tag}`, bedrooms: 2, listingStatus: "PUBLISHED", verificationStatus: "APPROVED", twinId: id, agentId: "user-agent-1" });
    expect(twin.id).not.toBe(id);
    expect(twin.listingId).not.toBe(find(id).listingId);
    expect(twin.images).toEqual(["/assets/uploads/twin-a.jpg", "/assets/uploads/twin-b.jpg"]); // nothing uploaded again
    expect(twin.views).toBeUndefined(); // a new offer starts with no views
    expect(find(id).twinId).toBe(twin.id); // linked both ways
    expect(find(id).transactionType).toBe("FOR_SALE"); // the original is untouched
    expect(find(id).price).toBe(2_100_000);
    expect(readDb().properties.some(p => p.id === twin.id)).toBe(true);
  });

  it("each offer is found under its own deal: the rent page and the sale page both list the unit", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed();
    const twin = (await makeTwin(id, { price: 8800 }).expect(200)).body.property;
    const host = { Host: "www.neroufinder.com", "X-Forwarded-For": uniqueIp() };
    const rent = await request(app).get(`/apartments-for-rent-in-twinville-${tag}`).set(host).expect(200);
    const sale = await request(app).get(`/apartments-for-sale-in-twinville-${tag}`).set({ ...host, "X-Forwarded-For": uniqueIp() }).expect(200);
    expect(rent.text).toContain(`/properties/${twin.id}`);
    expect(sale.text).toContain(`/properties/${id}`);
  });

  it("also works the other way round: a letting becomes a sale, leaving the letting terms behind", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed({ transactionType: "FOR_RENT", price: 9000, rentalPeriod: "MONTHLY", deposit: 9000, cheques: 4, contractLength: "12 months" });
    const twin = (await makeTwin(id, { price: 2_050_000 }).expect(200)).body.property;
    expect(twin.transactionType).toBe("FOR_SALE");
    expect(twin.rentalPeriod).toBeUndefined();
    expect(twin.deposit).toBeUndefined();
    expect(twin.cheques).toBeUndefined();
  });

  it("an unpublished listing gives a draft twin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed({ listingStatus: "DRAFT", verificationStatus: "PENDING" });
    const twin = (await makeTwin(id, { price: 7000 }).expect(200)).body.property;
    expect(twin.listingStatus).toBe("DRAFT");
    expect(twin.verificationStatus).toBe("PENDING");
  });

  it("a unit can have only one twin (409), and a bad request is explained (400)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed();
    await makeTwin(id, { price: 9000 }).expect(200);
    const again = await makeTwin(id, { price: 9100 }).expect(409);
    expect(again.body.error).toMatch(/already/i);
    const fresh = seed();
    expect((await makeTwin(fresh, {}).expect(400)).body.error).toMatch(/price/i);
    expect((await makeTwin(fresh, { price: -1 }).expect(400)).body.error).toMatch(/price/i);
    expect((await makeTwin(fresh, { price: 5000, rentalPeriod: "FOREVER" }).expect(400)).body.error).toMatch(/rental period/i);
    const offPlan = seed({ transactionType: "OFF_PLAN" });
    expect((await makeTwin(offPlan, { price: 5000 }).expect(400)).body.error).toMatch(/cannot also/i);
    expect(readDb().properties.filter(p => p.twinId === fresh)).toHaveLength(0);
  });

  it("only the listing's own people may do it: not another agent, not a visitor, not an unknown listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed();
    await makeTwin(id, { price: 9000 }, as("user-agent-2", "AGENT")).expect(403); // a colleague
    await request(app).post(`/api/properties/${id}/twin`).set("X-Forwarded-For", uniqueIp()).send({ price: 9000 }).expect(401);
    await makeTwin("prop-does-not-exist", { price: 9000 }).expect(404);
    expect(find(id).twinId).toBeUndefined();
    // the agency's admin and the platform admin may
    await makeTwin(id, { price: 9000 }, as("user-agency-admin", "AGENCY_ADMIN")).expect(200);
    const other = seed();
    await makeTwin(other, { price: 9000 }, as("user-platform-admin", "PLATFORM_ADMIN")).expect(200);
  });

  it("an independent agent whose authorization letter is not approved cannot publish the second offer either", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    const base = db.users.find(u => u.id === "user-agent-1")!;
    const indId = `user-${tag}-ind`;
    db.users.push({ ...base, id: indId, email: `${indId}@example.test`, orgId: undefined, agentType: "INDEPENDENT_AGENT" } as never);
    writeDb(db);
    const id = seed({ agentId: indId, orgId: undefined });
    const res = await makeTwin(id, { price: 9000 }, as(indId, "AGENT")).expect(403);
    expect(res.body.error).toMatch(/Authorization Letter/);
    expect(find(id).twinId).toBeUndefined();
  });

  it("an edit cannot move or invent the link, and deleting one offer unlinks the other", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = seed();
    const twin = (await makeTwin(id, { price: 9000 }).expect(200)).body.property;
    await request(app).post("/api/properties").set(owner()).send({ id, price: 2_000_000, twinId: "prop-someone-else" }).expect(200);
    expect(find(id).twinId).toBe(twin.id);
    expect(find(id).price).toBe(2_000_000);
    await request(app).delete(`/api/properties/${twin.id}`).set(owner()).expect(200);
    expect(find(id).twinId).toBeUndefined();
  });
});
