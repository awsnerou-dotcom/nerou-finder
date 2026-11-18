import { describe, it, expect, beforeAll, afterEach } from "vitest";
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

const savedKey = process.env.GEMINI_API_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
});

const tag = Date.now().toString(36);
const PRICE = 5101 + (Date.now() % 97) * 7 + 3; // an odd, unrounded rent: no other test listing has one like it
let seededId = "";

function seed() {
  if (seededId) return;
  const db = readDb();
  seededId = `prop-ai-${tag}`;
  db.properties.unshift({
    id: seededId, listingId: seededId, agentId: "user-agent-1", title: `Instant search flat ${tag}`, description: "A flat used by the search tests, with enough words to be a description.",
    propertyType: "APARTMENT", transactionType: "FOR_RENT", price: PRICE, currency: "QAR", rentalPeriod: "MONTHLY", area: 95, sizeUnit: "SQM",
    city: "Doha", district: `Searchville ${tag}`, latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2, furnished: "YES", parking: true, amenities: ["Swimming Pool"], images: [],
    orgId: "org-agency-1", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 90, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString(), priceHistory: []
  } as never);
  writeDb(db);
}

const ask = (prompt: unknown, conversationId?: string) =>
  request(app).post("/api/ai/search").set("X-Forwarded-For", uniqueIp()).send({ prompt, conversationId });

describe("POST /api/ai/search answers at once when the request names what the visitor wants", () => {
  it("English: finds the listing in milliseconds, with the listing itself and the reason, and no model involved", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    delete process.env.GEMINI_API_KEY; // proves no model is needed
    const t0 = Date.now();
    const res = await ask(`2-bedroom apartment for rent between ${PRICE - 1} and ${PRICE + 1} QAR`);
    const ms = Date.now() - t0;
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("instant");
    expect(ms).toBeLessThan(1500);
    expect(res.body.matches.map((m: { propertyId: string }) => m.propertyId)).toEqual([seededId]);
    expect(res.body.properties.map((p: { id: string }) => p.id)).toEqual([seededId]); // the card needs no second request
    expect(res.body.replyEn).toMatch(/^Found 1 /);
    expect(res.body.replyAr).toMatch(/[؀-ۿ]/);
    expect(res.body.matches[0].whyMatchEn).toContain(`QAR ${PRICE.toLocaleString("en-US")}/month`);
  });

  it("Arabic: the same", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    delete process.env.GEMINI_API_KEY;
    const res = await ask(`شقة غرفتين للإيجار من ${PRICE - 1} الى ${PRICE + 1} ريال`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("instant");
    expect(res.body.matches.map((m: { propertyId: string }) => m.propertyId)).toEqual([seededId]);
    expect(res.body.replyAr).toContain("وجدت عقاراً واحداً");
  });

  it("remembers the chat: 'cheaper' refines the last search instead of starting over", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    delete process.env.GEMINI_API_KEY;
    const conv = `conv-${tag}-follow`;
    const first = await ask(`2-bedroom apartment for rent under ${PRICE + 10} QAR with a pool`, conv);
    expect(first.body.source).toBe("instant");
    expect(first.body.matches.map((m: { propertyId: string }) => m.propertyId)).toContain(seededId);
    const next = await ask("show cheaper options", conv);
    expect(next.status).toBe(200);
    expect(next.body.source).toBe("instant");
    // the new budget is 15% below the old one, so the seeded flat no longer fits exactly
    expect(next.body.replyEn).toMatch(/up to QAR/);
  });

  it("a request that names nothing gets a clear question instead of an error when there is no model", async (ctx) => {
    if (!dbReady) return ctx.skip();
    delete process.env.GEMINI_API_KEY;
    const res = await ask("hello, what is the best area for families?");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("fallback");
    expect(res.body.matches).toEqual([]);
    expect(res.body.replyEn).toContain("Tell me what you are looking for");
    expect(res.body.replyAr).toMatch(/[؀-ۿ]/);
  });

  it("and the same when the model is there but fails: never a 500 for the visitor", async (ctx) => {
    if (!dbReady) return ctx.skip();
    process.env.GEMINI_API_KEY = "invalid-test-key";
    const res = await ask("what makes a good neighbourhood?");
    expect(res.status).toBe(200);
    expect(["fallback", "model"]).toContain(res.body.source);
    expect(typeof res.body.replyEn).toBe("string");
    expect(Array.isArray(res.body.matches)).toBe(true);
  }, 20_000);

  it("rejects an empty prompt, and copes with a huge one", async (ctx) => {
    if (!dbReady) return ctx.skip();
    delete process.env.GEMINI_API_KEY;
    expect((await ask("")).status).toBe(400);
    expect((await ask("   ")).status).toBe(400);
    expect((await ask(42 as unknown)).status).toBe(400);
    const big = await ask("apartment for rent ".repeat(5000));
    expect(big.status).toBe(200);
  });
});
