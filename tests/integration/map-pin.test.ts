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
    email: uniqueEmail(label), password: "correct-horse-battery-staple", fullName: `Test Agent ${label}`, phone: "+974 5555 9100", role: "AGENT"
  });
  return { Authorization: `Bearer ${res.body.token as string}` };
}

// DRAFT sidesteps the unrelated publish gate for independent agents; includeAllStatuses lets the search see drafts
const payload = (over: Record<string, unknown> = {}) => ({
  title: "Pin test", description: "x", propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 900000, area: 100,
  city: "Doha", district: "West Bay", bedrooms: 2, bathrooms: 2, listingStatus: "DRAFT", ...over
});
const search = (query: string) => request(app).get(`/api/properties?includeAllStatuses=true&${query}`);

describe("the exact pin on a listing", () => {
  it("is stored when it is a real spot in Qatar, and otherwise the listing has no pin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const auth = await signupAgent("pin-create");
    const ok = await request(app).post("/api/properties").set(auth).send(payload({ pin: { latitude: 25.3254, longitude: 51.5301 } })).expect(200);
    expect(ok.body).toMatchObject({ latitude: 25.3254, longitude: 51.5301, exactLocation: true });

    for (const bad of [{ latitude: 51.5, longitude: -0.12 }, { latitude: "x", longitude: 51 }, "25.3,51.5", null]) {
      const res = await request(app).post("/api/properties").set(auth).send(payload({ pin: bad })).expect(200);
      expect(res.body.exactLocation, JSON.stringify(bad)).toBe(false);
    }
    // the old way of sending coordinates no longer makes a pin
    const old = await request(app).post("/api/properties").set(auth).send(payload({ latitude: 25.3254, longitude: 51.5301 })).expect(200);
    expect(old.body.exactLocation).toBe(false);
    const none = await request(app).post("/api/properties").set(auth).send(payload()).expect(200);
    expect(none.body.exactLocation).toBe(false);
  });

  it("an edit can move it, keeps it when not sent, removes it with null, and ignores forged coordinates", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const auth = await signupAgent("pin-edit");
    const created = await request(app).post("/api/properties").set(auth).send(payload({ pin: { latitude: 25.3, longitude: 51.51 } })).expect(200);
    const id = created.body.id;

    const kept = await request(app).post("/api/properties").set(auth).send(payload({ id, title: "Renamed" })).expect(200);
    expect(kept.body).toMatchObject({ latitude: 25.3, longitude: 51.51, exactLocation: true });

    const forged = await request(app).post("/api/properties").set(auth).send(payload({ id, latitude: 10, longitude: 10, exactLocation: true })).expect(200);
    expect(forged.body).toMatchObject({ latitude: 25.3, longitude: 51.51, exactLocation: true });

    const moved = await request(app).post("/api/properties").set(auth).send(payload({ id, pin: { latitude: 25.4, longitude: 51.45 } })).expect(200);
    expect(moved.body).toMatchObject({ latitude: 25.4, longitude: 51.45, exactLocation: true });

    const removed = await request(app).post("/api/properties").set(auth).send(payload({ id, pin: null })).expect(200);
    expect(removed.body.exactLocation).toBe(false);
  });
});

describe("GET /api/properties?bounds=", () => {
  it("returns only listings pinned inside the box, never ones with the placeholder spot", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const auth = await signupAgent("pin-bounds");
    const inside = await request(app).post("/api/properties").set(auth).send(payload({ title: "Inside", pin: { latitude: 25.6, longitude: 51.2 } })).expect(200);
    const outside = await request(app).post("/api/properties").set(auth).send(payload({ title: "Outside", pin: { latitude: 25.9, longitude: 51.2 } })).expect(200);
    // no pin: stored at the placeholder 25.3, 51.5 - which a box around that spot must NOT match
    const unpinned = await request(app).post("/api/properties").set(auth).send(payload({ title: "Unpinned" })).expect(200);

    const box = await search("bounds=25.5,51.1,25.7,51.3").expect(200);
    const ids = box.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(inside.body.id);
    expect(ids).not.toContain(outside.body.id);

    const aroundPlaceholder = await search("bounds=25.29,51.49,25.31,51.51").expect(200);
    expect(aroundPlaceholder.body.map((p: { id: string }) => p.id)).not.toContain(unpinned.body.id);
  });

  it("refuses a box that makes no sense", async (ctx) => {
    if (!dbReady) return ctx.skip();
    for (const bad of ["x", "1,2,3", "25.7,51.1,25.5,51.3", ""]) {
      const res = await search(`bounds=${encodeURIComponent(bad)}`);
      expect(res.status, bad).toBe(400);
    }
  });
});
