import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { runIndexNowSweep, seoPathStamps } from "../../server.js";
import { GUIDES } from "../../src/lib/guides.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const ORIGIN = "https://www.neroufinder.com";
const tag = `in${Date.now().toString(36)}`;

function fakeSend(status = 200) {
  const calls: { url: string; body: { host: string; keyLocation: string; urlList: string[] } }[] = [];
  const send = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { status } as Response;
  }) as unknown as typeof fetch;
  return { send, calls };
}
const tmpState = () => path.join(os.tmpdir(), `indexnow-${tag}-${Math.random().toString(36).slice(2)}.json`);

function addListing(n: number) {
  const db = readDb();
  const id = `prop-in-${tag}-${n}`;
  db.properties.unshift({
    id, agentId: "user-agent-1", title: `IndexNow flat ${n}`, description: "A flat used by the automatic search-engine notice tests, with enough words to be a description.",
    propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 6000, currency: "QAR", rentalPeriod: "MONTHLY", area: 90, sizeUnit: "SQM",
    city: "Doha", district: `Indexville ${tag}`, bedrooms: 2, bathrooms: 2, furnished: "YES", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", images: [],
    createdDate: new Date().toISOString(), updatedDate: new Date().toISOString()
  } as never);
  writeDb(db);
  return id;
}

describe("every public page has a stamp", () => {
  it("covers the guides, listings, landing pages and the fixed pages", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = addListing(0);
    const stamps = seoPathStamps(readDb());
    expect(stamps["/"]).toBeDefined();
    expect(stamps["/guides"]).toBeDefined();
    for (const g of GUIDES) expect(stamps[`/guides/${g.slug}`]).toBe(g.updated);
    expect(stamps[`/properties/${id}`]).toBeDefined();
    expect(stamps[`/apartments-for-rent-in-indexville-${tag}`]).toMatch(/^1\|/);
  });
});

describe("the automatic notice to search engines", () => {
  it("tells them everything the first time, then nothing while nothing changes", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const stateFile = tmpState();
    const first = fakeSend();
    const a = await runIndexNowSweep({ origin: ORIGIN, send: first.send, stateFile });
    expect(a.submitted).toBeGreaterThan(20);
    expect(first.calls[0].url).toBe("https://api.indexnow.org/indexnow");
    expect(first.calls[0].body.host).toBe("www.neroufinder.com");
    expect(first.calls[0].body.keyLocation).toMatch(/^https:\/\/www\.neroufinder\.com\/[a-f0-9]{32}\.txt$/);
    const urls = first.calls.flatMap(c => c.body.urlList);
    expect(urls).toContain(`${ORIGIN}/guides`);
    expect(urls).toContain(`${ORIGIN}/ar/guides`);
    expect(urls.every(u => u.startsWith(ORIGIN))).toBe(true);

    const second = fakeSend();
    const b = await runIndexNowSweep({ origin: ORIGIN, send: second.send, stateFile });
    expect(b).toMatchObject({ submitted: 0, note: "nothing new" });
    expect(second.calls).toHaveLength(0);
    fs.rmSync(stateFile, { force: true });
  });

  it("then sends only the page that is new, plus the pages that now show it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const stateFile = tmpState();
    await runIndexNowSweep({ origin: ORIGIN, send: fakeSend().send, stateFile });
    const id = addListing(1);
    const next = fakeSend();
    const r = await runIndexNowSweep({ origin: ORIGIN, send: next.send, stateFile });
    const urls = next.calls.flatMap(c => c.body.urlList);
    expect(r.submitted).toBe(urls.length);
    expect(urls).toContain(`${ORIGIN}/properties/${id}`);
    expect(urls).toContain(`${ORIGIN}/ar/properties/${id}`);
    expect(urls.some(u => u.includes(`/apartments-for-rent-in-indexville-${tag}`))).toBe(true);
    expect(urls).not.toContain(`${ORIGIN}/guides`); // the guides did not change
    expect(urls.length).toBeLessThan(20);
    fs.rmSync(stateFile, { force: true });
  });

  it("remembers nothing when the engines refuse, so the next sweep tries again", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const stateFile = tmpState();
    const bad = fakeSend(429);
    const a = await runIndexNowSweep({ origin: ORIGIN, send: bad.send, stateFile });
    expect(a.note).toMatch(/429/);
    expect(fs.existsSync(stateFile)).toBe(false);
    const good = fakeSend();
    const b = await runIndexNowSweep({ origin: ORIGIN, send: good.send, stateFile });
    expect(b.submitted).toBeGreaterThan(20);
    fs.rmSync(stateFile, { force: true });
  });

  it("does nothing for a development address", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const stateFile = tmpState();
    const f = fakeSend();
    const r = await runIndexNowSweep({ origin: "http://localhost:3000", send: f.send, stateFile });
    expect(r).toMatchObject({ submitted: 0, note: "not a public address" });
    expect(f.calls).toHaveLength(0);
    expect(fs.existsSync(stateFile)).toBe(false);
  });

  it("survives a network failure without touching what was saved", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const stateFile = tmpState();
    const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await runIndexNowSweep({ origin: ORIGIN, send: boom, stateFile });
    expect(r.submitted).toBe(0);
    expect(fs.existsSync(stateFile)).toBe(false);
  });
});
