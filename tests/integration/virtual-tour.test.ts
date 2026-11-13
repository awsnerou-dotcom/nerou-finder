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
  return { Authorization: `Bearer ${res.body.token as string}` };
}

// DRAFT sidesteps the unrelated publish gate for independent agents (see property-idor.test.ts)
const payload = (over: Record<string, unknown> = {}) => ({
  title: "Virtual tour test", description: "x", propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 900000, area: 100,
  city: "Doha", district: "West Bay", bedrooms: 2, bathrooms: 2, listingStatus: "DRAFT", ...over
});

describe("the virtual tour link on a listing", () => {
  it("is stored when it is a safe https link, and is absent otherwise", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const auth = await signupAgent("tour-create");
    const ok = await request(app).post("/api/properties").set(auth).send(payload({ virtualTourUrl: " https://my.matterport.com/show/?m=abc123 " })).expect(200);
    expect(ok.body.virtualTourUrl).toBe("https://my.matterport.com/show/?m=abc123");
    expect((await request(app).get(`/api/properties/${ok.body.id}`)).body.virtualTourUrl).toBe("https://my.matterport.com/show/?m=abc123");

    for (const bad of ["javascript:alert(1)", "http://example.com/tour", "data:text/html,x", "https://user:pw@example.com/t", "not a link"]) {
      const res = await request(app).post("/api/properties").set(auth).send(payload({ virtualTourUrl: bad })).expect(200);
      expect(res.body.virtualTourUrl, bad).toBeUndefined();
    }
    const none = await request(app).post("/api/properties").set(auth).send(payload()).expect(200);
    expect(none.body.virtualTourUrl).toBeUndefined();
  });

  it("an edit can change it, keeps it when the field is not sent, and clears it with an empty value", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const auth = await signupAgent("tour-edit");
    const created = await request(app).post("/api/properties").set(auth).send(payload({ virtualTourUrl: "https://kuula.co/share/abc" })).expect(200);
    const id = created.body.id;

    const kept = await request(app).post("/api/properties").set(auth).send(payload({ id, title: "Renamed" })).expect(200);
    expect(kept.body.virtualTourUrl).toBe("https://kuula.co/share/abc");

    const changed = await request(app).post("/api/properties").set(auth).send(payload({ id, virtualTourUrl: "https://example.com/new-tour" })).expect(200);
    expect(changed.body.virtualTourUrl).toBe("https://example.com/new-tour");

    const unsafe = await request(app).post("/api/properties").set(auth).send(payload({ id, virtualTourUrl: "javascript:alert(1)" })).expect(200);
    expect(unsafe.body.virtualTourUrl).toBeUndefined(); // an unsafe edit never leaves an unsafe link behind

    const again = await request(app).post("/api/properties").set(auth).send(payload({ id, virtualTourUrl: "https://example.com/tour" })).expect(200);
    const cleared = await request(app).post("/api/properties").set(auth).send(payload({ id, virtualTourUrl: "" })).expect(200);
    expect(again.body.virtualTourUrl).toBe("https://example.com/tour");
    expect(cleared.body.virtualTourUrl).toBeUndefined();
  });
});
