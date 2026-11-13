import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp, signupAndVerify } from "../helpers.js";

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
  const res = await signupAndVerify(app, uniqueIp(), {
    email: uniqueEmail(label), password: "correct-horse-battery-staple", fullName: `Test Agent ${label}`, phone: "+974 5555 9000", role: "AGENT"
  });
  return { token: res.body.token as string };
}

// DRAFT sidesteps the unrelated publish gate for independent agents (see property-idor.test.ts)
const payload = (over: Record<string, unknown> = {}) => ({
  title: "Nearby places test", description: "x", propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 900000, area: 100,
  city: "Doha", district: "West Bay", bedrooms: 2, bathrooms: 2, listingStatus: "DRAFT", ...over
});

describe("the nearby places an agent enters with a listing", () => {
  it("a new listing has none unless the agent adds them (nothing is guessed from the map)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("nearby-none");
    const res = await request(app).post("/api/properties").set("Authorization", `Bearer ${token}`).send(payload()).expect(200);
    expect(res.body.nearbyPlaces).toBeUndefined();
    expect((await request(app).get(`/api/properties/${res.body.id}`)).body.nearbyPlaces).toBeUndefined();
  });

  it("stores the places the agent sent, cleaned, and drops what is malformed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("nearby-create");
    const res = await request(app).post("/api/properties").set("Authorization", `Bearer ${token}`).send(payload({
      nearbyPlaces: [
        { type: "SCHOOL", name: "  Doha   College ", nameAr: "كلية الدوحة", value: "8", unit: "DRIVE_MIN" },
        { type: "MALL", name: "City Center", value: 1.26, unit: "KM" },
        { type: "SCHOOL", name: "", value: 3, unit: "KM" },
        { type: "SCHOOL", name: "Bad unit", value: 3, unit: "PARSECS" },
        { type: "SCHOOL", name: "Negative", value: -1, unit: "KM" },
        "not an object"
      ]
    })).expect(200);
    expect(res.body.nearbyPlaces).toEqual([
      { type: "SCHOOL", name: "Doha College", nameAr: "كلية الدوحة", value: 8, unit: "DRIVE_MIN" },
      { type: "MALL", name: "City Center", value: 1.3, unit: "KM" }
    ]);
    expect((await request(app).get(`/api/properties/${res.body.id}`)).body.nearbyPlaces).toHaveLength(2);
  });

  it("stores nothing when the list is nonsense, and never more than eight", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("nearby-junk");
    const junk = await request(app).post("/api/properties").set("Authorization", `Bearer ${token}`).send(payload({ nearbyPlaces: "everything is near" })).expect(200);
    expect(junk.body.nearbyPlaces).toBeUndefined();
    const many = Array.from({ length: 15 }, (_, i) => ({ type: "PARK", name: `Park ${i}`, value: i + 1, unit: "WALK_MIN" }));
    const res = await request(app).post("/api/properties").set("Authorization", `Bearer ${token}`).send(payload({ nearbyPlaces: many })).expect(200);
    expect(res.body.nearbyPlaces).toHaveLength(8);
  });

  it("an edit can change them, keeps them when the field is not sent, and clears them with an empty list", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("nearby-edit");
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app).post("/api/properties").set(auth).send(payload({ nearbyPlaces: [{ type: "BEACH", name: "Katara Beach", value: 6, unit: "DRIVE_MIN" }] })).expect(200);
    const id = created.body.id;

    const kept = await request(app).post("/api/properties").set(auth).send(payload({ id, title: "Renamed" })).expect(200);
    expect(kept.body.nearbyPlaces).toEqual([{ type: "BEACH", name: "Katara Beach", value: 6, unit: "DRIVE_MIN" }]);

    const changed = await request(app).post("/api/properties").set(auth).send(payload({ id, nearbyPlaces: [{ type: "METRO", name: "Lusail QNB", value: 4, unit: "WALK_MIN" }, { type: "BOGUS", name: "Odd place", value: 2, unit: "KM" }] })).expect(200);
    expect(changed.body.nearbyPlaces).toEqual([
      { type: "METRO", name: "Lusail QNB", value: 4, unit: "WALK_MIN" },
      { type: "OTHER", name: "Odd place", value: 2, unit: "KM" }
    ]);

    const cleared = await request(app).post("/api/properties").set(auth).send(payload({ id, nearbyPlaces: [] })).expect(200);
    expect(cleared.body.nearbyPlaces).toBeUndefined();
    expect((await request(app).get(`/api/properties/${id}`)).body.nearbyPlaces).toBeUndefined();
  });
});
