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
const tag = `al${Date.now().toString(36)}`;

const body = (over: Record<string, unknown> = {}) => ({
  title: `Agency listing ${tag}`, propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 7000, area: 90, bedrooms: 2, bathrooms: 2,
  city: "Doha", district: `Agencyville ${tag}`, description: "A listing made from the agency's own workspace.", images: ["/assets/uploads/a.jpg"], ...over
});

// The test builds its own agency (an admin and two agents) and an agent of another agency, so it
// depends on no one else's data.
function people() {
  const db = readDb();
  const org = `org-${tag}`;
  const make = (id: string, role: string, orgId: string) => ({
    id, email: `${id}@test.local`, password: "x", fullName: id, phone: "+974 5000 0000", role, orgId, verificationStatus: "APPROVED",
    createdDate: new Date().toISOString(), emailVerified: true
  });
  const wanted = [
    make(`adm-${tag}`, "AGENCY_ADMIN", org), make(`in1-${tag}`, "AGENT", org), make(`in2-${tag}`, "AGENT", org), make(`out-${tag}`, "AGENT", `org-else-${tag}`)
  ];
  let added = false;
  for (const u of wanted) if (!db.users.some(x => x.id === u.id)) { db.users.push(u as never); added = true; }
  if (added) writeDb(db);
  return { admin: wanted[0], inside: wanted[1], colleague: wanted[2], outsiderId: wanted[3].id };
}

describe("an agency listing in its own name, or for one of its agents", () => {
  it("in the agency's own name by default: the admin owns it, under the agency", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { admin } = people();
    const res = await request(app).post("/api/properties").set(as(admin.id, "AGENCY_ADMIN")).send(body()).expect(200);
    expect(res.body.property ?? res.body).toMatchObject({ agentId: admin.id, orgId: admin.orgId });
  });

  it("for one of its own agents: the listing is that agent's, still under the agency", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { admin, inside } = people();
    const res = await request(app).post("/api/properties").set(as(admin.id, "AGENCY_ADMIN")).send(body({ assignToAgentId: inside.id })).expect(200);
    const made = res.body.property ?? res.body;
    expect(made).toMatchObject({ agentId: inside.id, orgId: admin.orgId });
    expect(readDb().properties.find(p => p.id === made.id)?.agentId).toBe(inside.id);
  });

  it("refuses an agent who works for another agency", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { admin, outsiderId } = people();
    await request(app).post("/api/properties").set(as(admin.id, "AGENCY_ADMIN")).send(body({ assignToAgentId: outsiderId })).expect(403);
  });

  it("refuses an id that is not an agent at all", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { admin } = people();
    await request(app).post("/api/properties").set(as(admin.id, "AGENCY_ADMIN")).send(body({ assignToAgentId: admin.id })).expect(403);
    await request(app).post("/api/properties").set(as(admin.id, "AGENCY_ADMIN")).send(body({ assignToAgentId: "nobody" })).expect(403);
  });

  it("an agent cannot list on behalf of a colleague", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { inside, colleague } = people();
    await request(app).post("/api/properties").set(as(inside.id, "AGENT")).send(body({ assignToAgentId: colleague.id })).expect(403);
  });

  it("the organization is the account's own: a client cannot attach a listing to another agency", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { inside } = people();
    const res = await request(app).post("/api/properties").set(as(inside.id, "AGENT")).send(body({ orgId: "org-someone-else" })).expect(200);
    expect((res.body.property ?? res.body).orgId).toBe(inside.orgId);
  });
});
