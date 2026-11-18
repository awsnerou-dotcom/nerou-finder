import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";
import { adsToImportRecords } from "../../src/lib/bulkPaste.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const tag = `bp${Date.now().toString(36)}`;
const tokenFor = (id: string) => jwt.sign({ id, email: "x@test.local", role: "AGENT", fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });

function makeAgent() {
  const db = readDb();
  const base = db.users.find(u => u.id === "user-agent-1")!;
  const id = `user-bulk-${tag}`;
  db.users.push({ ...base, id, fullName: "Bulk Importer", email: `${id}@example.test`, listingFeed: undefined } as never);
  writeDb(db);
  return id;
}
const post = (path: string, id: string, body: string) =>
  request(app).post(path).set("Authorization", `Bearer ${tokenFor(id)}`).set("X-Forwarded-For", uniqueIp()).set("Content-Type", "text/plain; charset=utf-8").send(body);
const mine = (id: string) => readDb().properties.filter(p => p.agentId === id && p.isFeedImported);

// what an agent copies from "my ads" on another portal, or from their posts: several ads in one go
const PASTED = [
  `2 bedroom apartment for rent in Lusail ${tag}a\n8,500 QAR per month\n120 sqm, furnished\nCall 5551 2345`,
  `3 bedroom apartment for rent in Lusail ${tag}b\n11,000 QAR per month\n165 sqm, 3 bathrooms`,
  `Apartment for rent in Lusail ${tag}c\n7,000 QAR monthly`
].join("\n---\n");

describe("moving listings from another portal by pasting all the ads at once", () => {
  it("reads the ads on the page, previews them with the server's own checks, and saves them as the agent's drafts", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent();
    const places = (await request(app).get("/api/locations").expect(200)).body;
    const read = adsToImportRecords(PASTED, places);
    expect(read.found).toBe(3);
    expect(read.records).toHaveLength(3);
    const body = JSON.stringify(read.records);

    const preview = await post("/api/listings/import/preview", id, body).expect(200);
    expect(preview.body).toMatchObject({ format: "json", total: 3, counts: { create: 3, update: 0, complete: 2, incomplete: 1 } });
    expect(mine(id)).toHaveLength(0); // a preview saves nothing

    const done = await post("/api/listings/import/commit", id, body).expect(200);
    expect(done.body).toMatchObject({ created: 3, updated: 0, drafts: 3, published: 0 });
    const saved = mine(id);
    expect(saved).toHaveLength(3);
    expect(saved.every(p => p.listingStatus === "DRAFT" && p.agentId === id && p.transactionType === "FOR_RENT")).toBe(true);
    expect(saved.find(p => p.price === 8500)).toMatchObject({ bedrooms: 2, area: 120, district: "Lusail" });
    expect(saved.map(p => p.description).join(" ")).not.toMatch(/5551|2345/); // the phone number never reaches the listing
  });

  it("pasting the same ads again updates them instead of adding copies", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent();
    const places = (await request(app).get("/api/locations").expect(200)).body;
    const body = JSON.stringify(adsToImportRecords(PASTED, places).records);
    const again = await post("/api/listings/import/commit", id, body).expect(200);
    expect(again.body).toMatchObject({ created: 0, updated: 3 });
    expect(mine(id)).toHaveLength(3);
  });
});
