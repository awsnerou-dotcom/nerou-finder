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

const tag = `pt${Date.now().toString(36)}`;
const DISTRICT = `Pricetown ${tag}`;
const SLUG = `pricetown-${tag}`;
let firstId = "";

function seed() {
  const db = readDb();
  if (db.properties.some(p => p.district === DISTRICT)) return;
  [7000, 7600, 8000, 8000, 8400, 9000].forEach((price, i) => {
    const id = `prop-pt-${tag}-${i}`;
    if (i === 0) firstId = id;
    db.properties.unshift({
      id, agentId: "user-agent-1", title: `Pricetown flat ${i}`, description: "A flat used by the price page tests, with enough words to be a description.",
      propertyType: "APARTMENT", transactionType: "FOR_RENT", price, currency: "QAR", rentalPeriod: "MONTHLY", area: 100, sizeUnit: "SQM",
      city: "Doha", district: DISTRICT, bedrooms: 2, bathrooms: 2, furnished: "YES", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", images: [],
      createdDate: new Date().toISOString(), updatedDate: new Date().toISOString()
    } as never);
  });
  writeDb(db);
}

const ask = (over: Record<string, unknown> = {}) => ({ deal: "RENT", city: "Doha", district: DISTRICT, propertyType: "APARTMENT", bedrooms: 2, price: 9000, ...over });
const check = (body: Record<string, unknown>) => request(app).post("/api/price-check").set("X-Forwarded-For", uniqueIp()).send(body);
const page = (path: string) => request(app).get(path).set("Host", "www.neroufinder.com").set("X-Forwarded-For", uniqueIp());

describe("POST /api/price-check", () => {
  it("gives a verdict from the live listings and points to the area's report", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const res = await check(ask({ price: 9000 })).expect(200);
    expect(res.body.result).toMatchObject({ ok: true, verdict: "above", typical: 8000, comparableCount: 6, target: 8000, perMonth: true });
    expect(res.body.reportPath).toBe(`/average-rent-in-${SLUG}`);
    const fair = await check(ask({ price: 8100 })).expect(200);
    expect(fair.body.result.verdict).toBe("fair");
    const bait = await check(ask({ price: 3500 })).expect(200);
    expect(bait.body.result).toMatchObject({ verdict: "far-below", suspiciouslyLow: true });
  });

  it("says so when there is not enough to compare with, and rejects a bad form", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const none = await check(ask({ city: `Nowhere City ${tag}`, district: `Nowhere ${tag}` })).expect(200);
    expect(none.body.result).toMatchObject({ ok: false, reason: "not-enough-data" });
    expect(none.body.reportPath).toBeNull();
    const bad = await check(ask({ price: "abc" })).expect(400);
    expect(bad.body.error).toMatch(/price/i);
    await check(ask({ deal: "LEASE" })).expect(400);
  });
});

describe("price report pages", () => {
  it("serves 'Average rent in X' with real figures, tables, answers and links, in English", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const res = await page(`/average-rent-in-${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<h1>Average rent in ${DISTRICT}</h1>`);
    expect(res.text).toMatch(/<title>Average Rent in Pricetown pt\w+ \(\d{4}\): Prices by Bedrooms \| Nerou Finder<\/title>/);
    expect(res.text).toContain("QAR 8,000 a month");
    expect(res.text).toContain("6 live listings");
    expect(res.text).toContain("<table>");
    expect(res.text).toContain("2 bedrooms");
    expect(res.text).toContain('"@type":"FAQPage"');
    expect(res.text).toContain('"@type":"BreadcrumbList"');
    expect(res.text).toContain('href="/price-check"');
    expect(res.text).toContain(`href="/properties/${firstId}"`); // the cheapest listing
    expect(res.text).toMatch(new RegExp(`rel="canonical" href="https?://www[.]neroufinder[.]com/average-rent-in-${SLUG}"`));
    expect(res.text).toContain('hreflang="ar"');
  });

  it("serves the Arabic version, the country page, and 404s a page there is no data for", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const ar = await page(`/ar/average-rent-in-${SLUG}`);
    expect(ar.status).toBe(200);
    expect(ar.text).toContain('<html lang="ar" dir="rtl">');
    expect(ar.text).toContain("متوسط الإيجار في");
    const country = await page("/average-rent-in-qatar");
    expect(country.status).toBe(200);
    expect(country.text).toContain("<h1>Average rent in Qatar</h1>");
    expect(country.text).toContain(`average-rent-in-`); // links to areas
    await page(`/average-rent-in-nowhere-${tag}`).expect(404);
    await page(`/property-prices-in-${SLUG}`).expect(404); // rent listings only: no sale page
  });

  it("gives the app the same numbers as JSON", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const res = await request(app).get(`/api/price-reports/rent/${SLUG}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body.report).toMatchObject({ deal: "RENT", slug: SLUG, count: 6, median: 8000, scope: "area" });
    expect(res.body.listings.length).toBe(3);
    expect(res.body.country).toMatchObject({ scope: "country" });
    await request(app).get(`/api/price-reports/rent/nowhere-${tag}`).set("X-Forwarded-For", uniqueIp()).expect(404);
    await request(app).get(`/api/price-reports/lease/${SLUG}`).set("X-Forwarded-For", uniqueIp()).expect(404);
  });
});

describe("how the pages are found", () => {
  it("lists the report and the price check in the sitemap and llms.txt, and serves the price-check page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed();
    const sitemap = await page("/sitemap.xml");
    expect(sitemap.text).toContain(`/average-rent-in-${SLUG}</loc>`);
    expect(sitemap.text).toContain("/average-rent-in-qatar</loc>");
    expect(sitemap.text).toContain("/price-check</loc>");
    const llms = await page("/llms.txt");
    expect(llms.text).toContain(`average-rent-in-${SLUG}`);
    expect(llms.text).toContain("/price-check");
    const pc = await page("/price-check");
    expect(pc.status).toBe(200);
    expect(pc.text).toContain("<h1>Is this price fair?</h1>");
  });
});
