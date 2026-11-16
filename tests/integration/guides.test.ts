import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";
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

const page = (path: string) => request(app).get(path).set("Host", "www.neroufinder.com").set("X-Forwarded-Proto", "https").set("X-Forwarded-For", uniqueIp());

describe("the guides pages", () => {
  it("serves the list in English with a canonical, both languages, structured data and every guide linked", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await page("/guides");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="en" dir="ltr">');
    expect(res.text).toContain("<h1>Qatar property guides</h1>");
    expect(res.text).toMatch(/rel="canonical" href="https:\/\/www[.]neroufinder[.]com\/guides"/);
    expect(res.text).toContain('hreflang="ar" href="https://www.neroufinder.com/ar/guides"');
    expect(res.text).toContain('"@type":"CollectionPage"');
    for (const g of GUIDES) expect(res.text).toContain(`href="/guides/${g.slug}"`);
  });

  it("serves the list in Arabic, right to left, with its own canonical", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await page("/ar/guides");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="ar" dir="rtl">');
    expect(res.text).toContain("<h1>أدلة العقارات في قطر</h1>");
    expect(res.text).toMatch(/rel="canonical" href="https:\/\/www[.]neroufinder[.]com\/ar\/guides"/);
    expect(res.text).toContain('content="ar_QA"');
  });

  it("serves each guide with its own title, the answer in the HTML, FAQ data and an Arabic twin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    for (const g of GUIDES) {
      const en = await page(`/guides/${g.slug}`);
      expect(en.status, g.slug).toBe(200);
      expect(en.text, g.slug).toContain(`<title>${g.title.en.replace(/&/g, "&amp;")} | Nerou Finder</title>`);
      expect(en.text).toContain(`rel="canonical" href="https://www.neroufinder.com/guides/${g.slug}"`);
      expect(en.text).toContain(`hreflang="ar" href="https://www.neroufinder.com/ar/guides/${g.slug}"`);
      expect(en.text).toContain('"@type":"Article"');
      expect(en.text).toContain('"@type":"FAQPage"');
      expect(en.text.match(/<h1>/g)).toHaveLength(1);

      const ar = await page(`/ar/guides/${g.slug}`);
      expect(ar.status, g.slug).toBe(200);
      expect(ar.text).toContain('<html lang="ar" dir="rtl">');
      expect(ar.text).toContain(`rel="canonical" href="https://www.neroufinder.com/ar/guides/${g.slug}"`);
      expect(ar.text).toContain("أسئلة شائعة");
    }
  });

  it("does not make up guides: an unknown guide is a 404 with no index", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await page("/guides/not-a-real-guide")).status).toBe(404);
    expect((await page("/ar/guides/not-a-real-guide")).status).toBe(404);
    expect((await page("/guides/renting-an-apartment-in-qatar/extra")).status).toBe(404);
  });

  it("lists the guides in the sitemap (both languages) and in llms.txt, and links the list from the home page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const sitemap = (await page("/sitemap.xml")).text;
    expect(sitemap).toContain("<loc>https://www.neroufinder.com/guides</loc>");
    expect(sitemap).toContain("<loc>https://www.neroufinder.com/ar/guides</loc>");
    for (const g of GUIDES) {
      expect(sitemap).toContain(`<loc>https://www.neroufinder.com/guides/${g.slug}</loc>`);
      expect(sitemap).toContain(`<loc>https://www.neroufinder.com/ar/guides/${g.slug}</loc>`);
    }
    const llms = (await page("/llms.txt")).text;
    expect(llms).toContain("/guides");
    for (const g of GUIDES) expect(llms).toContain(`/guides/${g.slug}`);
    expect((await page("/")).text).toContain('href="/guides"');
    expect((await page("/ar")).text).toContain('href="/ar/guides"');
  });
});

describe("one address per area", () => {
  // letters only: "Al" glued to a name is read as the same area as "Al" apart
  const tag = `zq${Date.now().toString(36).replace(/[0-9]/g, c => "abcdefghij"[Number(c)])}`;
  const glued = `Al${tag}`; // "Alzqxyz" ...
  const spaced = `Al ${tag}`; // "Al zqxyz"
  const slug = `al-${tag}`;

  function seed(district: string, i: number) {
    const db = readDb();
    db.properties.unshift({
      id: `prop-alias-${tag}-${i}`, agentId: "user-agent-1", title: `Alias flat ${i}`, description: "A flat used by the alias tests, with enough words to be a description of a home.",
      propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 6000 + i * 500, currency: "QAR", rentalPeriod: "MONTHLY", area: 90, sizeUnit: "SQM",
      city: "Doha", district, bedrooms: 2, bathrooms: 2, furnished: "YES", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", images: [],
      createdDate: new Date().toISOString(), updatedDate: new Date().toISOString()
    } as never);
    writeDb(db);
  }

  it("shows both spellings on one page, and sends the old spelling there for good", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed(glued, 1);
    seed(spaced, 2);

    const canonical = await page(`/apartments-for-rent-in-${slug}`);
    expect(canonical.status).toBe(200);
    expect(canonical.text).toContain(`prop-alias-${tag}-1`);
    expect(canonical.text).toContain(`prop-alias-${tag}-2`);

    const old = await page(`/apartments-for-rent-in-al${tag}`).redirects(0);
    expect(old.status).toBe(301);
    expect(old.headers.location).toBe(`/apartments-for-rent-in-${slug}`);
    const oldAr = await page(`/ar/apartments-for-rent-in-al${tag}`).redirects(0);
    expect(oldAr.status).toBe(301);
    expect(oldAr.headers.location).toBe(`/ar/apartments-for-rent-in-${slug}`);
  });

  it("does not redirect to a page that does not exist", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await page("/apartments-for-rent-in-alnowhereatall").redirects(0);
    expect(res.status).toBe(404);
  });

  it("sitemap lists the area once", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seed(glued, 3);
    const sitemap = (await page("/sitemap.xml")).text;
    expect(sitemap).toContain(`/apartments-for-rent-in-${slug}</loc>`);
    expect(sitemap).not.toContain(`/apartments-for-rent-in-al${tag}</loc>`);
  });
});
