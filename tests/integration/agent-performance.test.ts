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
const listing = (agentId: string, district: string) => ({
  id: `perf-${Date.now()}-${seq++}`, listingId: `PERF-${seq}`, title: "Performance listing", description: "x", agentId, orgId: "org-agency-1",
  images: [], amenities: [], priceHistory: [], propertyType: "APARTMENT", transactionType: "FOR_SALE", currency: "QAR", sizeUnit: "SQM",
  price: 900000, area: 100, city: "Doha", district, latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2, parking: false,
  listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 80, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString()
});
const lead = (agentId: string, replyAfterMinutes: number | null, over: Record<string, unknown> = {}) => {
  const arrived = Date.now() - 3 * 24 * 3600 * 1000 - seq++ * 1000;
  return {
    id: `perf-lead-${Date.now()}-${seq}`, agentId, createdDate: new Date(arrived).toISOString(), status: replyAfterMinutes === null ? "NEW" : "CONTACTED",
    name: "Buyer", phone: "+97450000000", email: "b@example.com", source: "WEBSITE",
    stageHistory: replyAfterMinutes === null ? [] : [{ status: "CONTACTED", date: new Date(arrived + replyAfterMinutes * 60000).toISOString(), byName: "Agent" }],
    ...over
  };
};

function seedAgent(id: string, district: string, listings: number, leads: Record<string, unknown>[]) {
  const db = readDb();
  const base = db.users.find(u => u.id === "user-agent-1")!;
  db.users.push({ ...base, id, fullName: `Perf ${id}`, email: `${id}@example.test` } as never);
  for (let i = 0; i < listings; i++) db.properties.unshift(listing(id, district) as never);
  db.leads.unshift(...(leads as never[]));
  writeDb(db);
}

describe("GET /api/agents/performance", () => {
  it("gives a quick, verified agent with a real portfolio the 'Top agent' and reply badges", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = `perf-fast-${Date.now()}`;
    seedAgent(id, `PerfTown-${Date.now()}`, 5, [10, 20, 30, 40, 50].map(m => lead(id, m)));
    const res = await request(app).get("/api/agents/performance").set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body[id]).toEqual({ badge: "WITHIN_HOUR", top: true, medianMinutes: 30, responded: 5 });
    // nothing private leaves the server: only the badge facts, keyed by agent id
    expect(JSON.stringify(res.body[id])).not.toMatch(/phone|email|name|Buyer/i);
  });

  it("gives nothing to an agent who ignores enquiries, or who has too few answered", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const slow = `perf-slow-${Date.now()}`;
    const few = `perf-few-${Date.now()}`;
    seedAgent(slow, "PerfSlow", 6, [null, null, null, null, null, 4000].map(m => lead(slow, m)));
    seedAgent(few, "PerfFew", 6, [5, 5].map(m => lead(few, m)));
    const res = await request(app).get("/api/agents/performance").set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body[slow]).toBeUndefined();
    expect(res.body[few]).toBeUndefined();
  });

  it("does not count enquiries a person typed in by hand", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = `perf-manual-${Date.now()}`;
    seedAgent(id, "PerfManual", 6, [1, 2, 3, 4, 5].map(m => lead(id, m, { addedManually: true })));
    const res = await request(app).get("/api/agents/performance").set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body[id]).toBeUndefined();
  });

  it("shows the badge beside the agents offered on the valuation page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = `perf-val-${Date.now()}`;
    const district = `PerfVal-${Date.now()}`;
    seedAgent(id, district, 5, [10, 20, 30, 40, 50].map(m => lead(id, m)));
    const res = await request(app).post("/api/valuation").set("X-Forwarded-For", uniqueIp())
      .send({ deal: "SALE", city: "Doha", district, propertyType: "APARTMENT", area: 100, bedrooms: 2 }).expect(200);
    const agent = res.body.agents.find((a: { id: string }) => a.id === id);
    expect(agent.performance).toMatchObject({ badge: "WITHIN_HOUR", top: true });
  });
});
