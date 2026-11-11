import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";

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
const admin = () => ({ Authorization: `Bearer ${tokenFor("user-platform-admin", "PLATFORM_ADMIN")}` });

const tag = `seo${Date.now().toString(36)}`; // a district no other test uses
const DISTRICT = `Testville ${tag}`;
const SLUG = `testville-${tag}`;

function addListing(over: Record<string, unknown> = {}) {
  const db = readDb();
  const id = `prop-seo-${tag}-${Math.random().toString(36).slice(2, 7)}`;
  db.properties.unshift({
    id, agentId: "user-agent-1", title: `Bright flat in ${DISTRICT} <b>`, description: "A bright flat with a view over the marina and a big balcony, close to everything you need every day.",
    propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 7000, currency: "QAR", rentalPeriod: "MONTHLY", area: 100, sizeUnit: "SQM",
    city: "Doha", district: DISTRICT, bedrooms: 2, bathrooms: 2, furnished: "YES", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", images: ["/assets/uploads/a.jpg"], ...over
  } as any);
  writeDb(db);
  return id;
}

describe("search-engine pages", () => {
  it("serves an English landing page for a real combination, with the listing in the HTML itself", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = addListing();
    const res = await request(app).get(`/apartments-for-rent-in-${SLUG}`).set("Host", "www.neroufinder.com");
    expect(res.status).toBe(200);
    const html = res.text;
    expect(html).toContain("<h1>Apartments for Rent in ");
    expect(html).toContain(`href="/properties/${id}"`);
    expect(html).toContain("Bright flat in "); // title text is there for a crawler with no JavaScript
    expect(html).not.toContain("<b>"); // listing text is escaped
    expect(html).toMatch(/rel="canonical" href="https?:\/\/www[.]neroufinder[.]com\/apartments-for-rent-in-testville/);
    expect(html).toContain('hreflang="ar"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('<html lang="en" dir="ltr">');
  });

  it("serves the Arabic version at /ar/... with Arabic text, RTL and its own canonical", async (ctx) => {
    if (!dbReady) return ctx.skip();
    addListing();
    const res = await request(app).get(`/ar/apartments-for-rent-in-${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="ar" dir="rtl">');
    expect(res.text).toContain("<h1>شقق للإيجار في ");
    expect(res.text).toMatch(/rel="canonical" href="[^"]*\/ar\/apartments-for-rent-in-/);
    expect(res.text).toContain('content="ar_QA"');
    expect(res.text).toContain("/ar/properties/");
  });

  it("does not make up pages: no listings, a bad type or a bad area is a 404", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await request(app).get("/villas-for-sale-in-nowhere-at-all")).status).toBe(404);
    expect((await request(app).get("/spaceships-for-rent-in-qatar")).status).toBe(404);
    expect((await request(app).get("/ar/apartments-for-rent-in-nowhere-at-all")).status).toBe(404);
  });

  it("points a duplicate page at the original instead of competing with it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    addListing();
    // the only listing in this district makes "properties in <area>" identical to "apartments in <area>"
    const res = await request(app).get(`/properties-for-rent-in-${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(new RegExp(`rel="canonical" href="[^"]*/apartments-for-rent-in-${SLUG}"`));
  });

  it("serves the home page in both languages with alternates and a crawlable body", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const en = await request(app).get("/");
    expect(en.status).toBe(200);
    expect(en.text).toContain('hreflang="ar"');
    expect(en.text).toContain("<h1>Verified property listings in Qatar</h1>");
    expect(en.text).toContain('href="/areas/west-bay"');
    expect(en.text).toContain("Popular searches");
    const ar = await request(app).get("/ar");
    expect(ar.status).toBe(200);
    expect(ar.text).toContain('<html lang="ar" dir="rtl">');
    expect(ar.text).toContain("<h1>عقارات موثّقة في قطر</h1>");
    expect(ar.text).toMatch(/rel="canonical" href="[^"]*\/ar"/);
  });

  it("gives every static page its own title and canonical (they used to share the home page's)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const plans = await request(app).get("/plans-pricing");
    expect(plans.text).toContain("<title>Plans for Agents, Companies and Developers | Nerou Finder</title>");
    expect(plans.text).toMatch(/rel="canonical" href="[^"]*\/plans-pricing"/);
    const plansAr = await request(app).get("/ar/plans-pricing");
    expect(plansAr.text).toContain("الباقات للوسطاء والشركات العقارية والمطورين");
    expect((await request(app).get("/ar/not-a-page")).status).toBe(404);
  });
});

describe("sitemap, robots, llms.txt", () => {
  it("lists every page in both languages with hreflang alternates, and only indexable landing pages", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = addListing();
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(res.text).toContain(`/properties/${id}</loc>`);
    expect(res.text).toContain(`/ar/properties/${id}</loc>`);
    expect(res.text).toContain(`/apartments-for-rent-in-${SLUG}</loc>`);
    expect(res.text).toContain(`/ar/apartments-for-rent-in-${SLUG}</loc>`);
    expect(res.text).not.toContain(`/properties-for-rent-in-${SLUG}</loc>`); // duplicate of the one above
    expect(res.text).toContain('hreflang="x-default"');
    expect(res.text).toContain("/ar/plans-pricing</loc>");
    expect(res.text).not.toMatch(/<changefreq>|<priority>/);
  });

  it("robots.txt points at the sitemap, hides the app and welcomes AI search crawlers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/robots.txt").set("Host", "www.neroufinder.com");
    expect(res.text).toMatch(/Sitemap: https?:\/\/www\.neroufinder\.com\/sitemap\.xml/);
    expect(res.text).toContain("Disallow: /api/");
    expect(res.text).toContain("User-agent: GPTBot");
  });

  it("llms.txt describes the site and links the popular searches", async (ctx) => {
    if (!dbReady) return ctx.skip();
    addListing();
    const res = await request(app).get("/llms.txt");
    expect(res.status).toBe(200);
    expect(res.text).toContain("# Nerou Finder");
    expect(res.text).toContain("/plans-pricing");
  });

  it("serves the IndexNow key file only at its own key", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const overview = await request(app).get("/api/admin/seo/overview").set(admin());
    const keyUrl: string = overview.body.indexNowKeyFile;
    const keyPath = new URL(keyUrl).pathname;
    const ok = await request(app).get(keyPath);
    expect(ok.status).toBe(200);
    expect(ok.text).toBe(keyPath.slice(1, -4));
    expect((await request(app).get("/" + "0".repeat(32) + ".txt")).status).toBe(404);
  });
});

describe("the SEO center (admin)", () => {
  it("is for platform admins only", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).get("/api/admin/seo/overview").expect(401);
    await request(app).get("/api/admin/seo/overview").set({ Authorization: `Bearer ${tokenFor("user-agent-1", "AGENT")}` }).expect(403);
    await request(app).post("/api/admin/seo/indexnow").set({ Authorization: `Bearer ${tokenFor("user-agent-1", "AGENT")}` }).expect(403);
  });

  it("reports page counts and the problems with a listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = addListing({ title: "Flat", description: "short", images: [] });
    const res = await request(app).get("/api/admin/seo/overview").set(admin()).expect(200);
    expect(res.body.landingPages).toBeGreaterThan(0);
    expect(res.body.sitemap).toMatch(/\/sitemap\.xml$/);
    const mine = res.body.issues.find((i: any) => i.id === id);
    expect(mine.problems.join(" ")).toMatch(/Title is very short/);
    expect(mine.problems.join(" ")).toMatch(/Description is thin/);
    expect(mine.problems.join(" ")).toMatch(/photo/);
    expect(res.body.pages.some((p: any) => p.path === `/apartments-for-rent-in-${SLUG}` && p.indexable)).toBe(true);
  });

  it("will not send localhost to the search engines", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).post("/api/admin/seo/indexnow").set(admin()).set("Host", "localhost:3000");
    expect(res.status).toBe(400);
  });
});

describe("the landing text the app shows people", () => {
  it("returns the same heading, intro, FAQ and related links the server puts in the page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    addListing();
    const path = `/apartments-for-rent-in-${SLUG}`;
    const api = await request(app).get("/api/seo/landing").query({ path, lang: "en" });
    expect(api.status).toBe(200);
    expect(api.body.h1).toMatch(/^Apartments for Rent in /);
    expect(api.body.intro).toContain("verified");
    expect(api.body.faq.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(api.body.related)).toBe(true);
    expect(api.body.count).toBeGreaterThan(0);
    const page = await request(app).get(path);
    expect(page.text).toContain(`<h1>${api.body.h1}</h1>`); // what people read is what is indexed
  });

  it("answers in Arabic when asked", async (ctx) => {
    if (!dbReady) return ctx.skip();
    addListing();
    const api = await request(app).get("/api/seo/landing").query({ path: `/apartments-for-rent-in-${SLUG}`, lang: "ar" });
    expect(api.status).toBe(200);
    expect(api.body.h1).toMatch(/^شقق للإيجار في /);
    expect(api.body.faq[0].q).toMatch(/[\u0600-\u06FF]/);
  });

  it("is a 404 for a made-up page or one with no listings", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await request(app).get("/api/seo/landing").query({ path: "/villas-for-sale-in-nowhere-at-all" })).status).toBe(404);
    expect((await request(app).get("/api/seo/landing").query({ path: "/not-a-landing-page" })).status).toBe(404);
    expect((await request(app).get("/api/seo/landing")).status).toBe(404);
  });
});
