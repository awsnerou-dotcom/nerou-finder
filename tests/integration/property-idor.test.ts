import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp } from "../helpers.js";

let dbReady = false;

beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

async function signupAgent(label: string) {
  const ip = uniqueIp();
  const email = uniqueEmail(label);
  const res = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
    email,
    password: "correct-horse-battery-staple",
    fullName: `Test Agent ${label}`,
    phone: "+974 5555 9000",
    role: "AGENT",
  });
  return { token: res.body.token as string, userId: res.body.user.id as string, ip };
}

// DRAFT sidesteps the unrelated "INDEPENDENT_AGENT needs an approved Agency Authorization
// Letter" publish gate, which would otherwise 403 for reasons that have nothing to do with
// what this test is actually checking (ownership).
function draftPropertyPayload(overrides: Record<string, any> = {}) {
  return {
    title: "Test Listing",
    description: "A test listing created by the integration suite.",
    propertyType: "APARTMENT",
    transactionType: "FOR_RENT",
    price: 5000,
    area: 100,
    city: "Doha",
    district: "West Bay",
    bedrooms: 1,
    bathrooms: 1,
    listingStatus: "DRAFT",
    ...overrides,
  };
}

describe("property IDOR protections (POST /api/properties)", () => {
  it("blocks a REGISTERED (non-agent) account from creating a listing", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("registered-creator");
    const signupRes = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email,
      password: "correct-horse-battery-staple",
      fullName: "Test Registered User",
      phone: "+974 5555 9001",
      role: "REGISTERED",
    });
    const token = signupRes.body.token;

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPropertyPayload());

    expect(res.status).toBe(403);
  });

  it("blocks another agent from editing a listing they do not own, and never lets agentId be reassigned", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const owner = await signupAgent("owner");
    const attacker = await signupAgent("attacker");

    const createRes = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(draftPropertyPayload());
    expect(createRes.status).toBe(200);
    const propertyId = createRes.body.id;
    expect(createRes.body.agentId).toBe(owner.userId);

    // The attacker tries to edit the owner's listing and reassign it to themselves.
    const attackRes = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${attacker.token}`)
      .send(draftPropertyPayload({ id: propertyId, title: "Hijacked Listing", agentId: attacker.userId }));

    expect(attackRes.status).toBe(403);

    // Confirm the listing was NOT modified or reassigned by the rejected attempt.
    const checkRes = await request(app).get(`/api/properties/${propertyId}`);
    expect(checkRes.body.agentId).toBe(owner.userId);
    expect(checkRes.body.title).toBe("Test Listing");
  });

  it("allows the owning agent to edit their own listing", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const owner = await signupAgent("selfedit");
    const createRes = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(draftPropertyPayload());
    const propertyId = createRes.body.id;

    const editRes = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(draftPropertyPayload({ id: propertyId, title: "Updated By Owner" }));

    expect(editRes.status).toBe(200);
    expect(editRes.body.title).toBe("Updated By Owner");
    expect(editRes.body.agentId).toBe(owner.userId);
  });
});
