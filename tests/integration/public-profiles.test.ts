import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";
import { agentSlug } from "../../src/lib/publicProfile.js";

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
const tag = `pp${Date.now().toString(36)}`;

function seed() {
  const db = readDb();
  const base = db.users.find(u => u.id === "user-agent-1")!;
  const agentId = `user-prof-${tag}`;
  db.users.push({ ...base, id: agentId, fullName: `Profile Tester ${tag}`, email: `${agentId}@example.test`, bio: "Sells Pearl apartments <script>x</script>", orgId: undefined, verificationStatus: "APPROVED" } as never);
  const liveId = `prop-prof-${tag}`;
  const draftId = `prop-prof-draft-${tag}`;
  const common = {
    agentId, title: `Profile listing ${tag}`, description: "A listing on a profile page.", propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 1200000,
    currency: "QAR", area: 100, sizeUnit: "SQM", city: "Doha", district: "West Bay", bedrooms: 2, bathrooms: 2, verificationStatus: "APPROVED", images: [],
    createdDate: new Date().toISOString(), updatedDate: new Date().toISOString()
  };
  db.properties.unshift({ ...common, id: liveId, listingStatus: "PUBLISHED" } as never);
  db.properties.unshift({ ...common, id: draftId, title: `Hidden draft ${tag}`, listingStatus: "DRAFT" } as never);
  db.reviews = db.reviews || [];
  db.reviews.unshift({ id: `rev-ok-${tag}`, reviewerId: "user-agent-2", targetType: "AGENT", targetId: agentId, rating: 5, comment: "Excellent service", createdDate: new Date().toISOString(), status: "APPROVED" } as never);
  db.reviews.unshift({ id: `rev-pending-${tag}`, reviewerId: "user-agent-2", targetType: "AGENT", targetId: agentId, rating: 1, comment: "Waiting for moderation", createdDate: new Date().toISOString(), status: "PENDING" } as never);
  writeDb(db);
  const user = readDb().users.find(u => u.id === agentId)!;
  return { agentId, liveId, draftId, slug: agentSlug(user as never) };
}

describe("public agent page: data", () => {
  it("returns the profile with only live listings and approved reviews", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { agentId, slug, liveId, draftId } = seed();
    const res = await request(app).get(`/api/public/profile/agents/${slug}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body).toMatchObject({ kind: "agents", id: agentId, slug, name: `Profile Tester ${tag}`, listingsCount: 1 });
    expect(res.body.listings.map((l: { id: string }) => l.id)).toEqual([liveId]);
    expect(JSON.stringify(res.body)).not.toContain(draftId);
    expect(res.body.reviews.map((r: { comment: string }) => r.comment)).toEqual(["Excellent service"]);
    expect(res.body.rating).toEqual({ average: 5, count: 1 });
    // the visitor-facing statistics counters are not part of it
    expect(res.body).not.toHaveProperty("profileViewsByDay");
  });

  it("answers 404 for an unknown address and for a kind that does not exist", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).get("/api/public/profile/agents/nobody-zzzzzz").set("X-Forwarded-For", uniqueIp()).expect(404);
    await request(app).get("/api/public/profile/pets/anything-abcdef").set("X-Forwarded-For", uniqueIp()).expect(404);
  });
});

describe("public agent page: HTML for search engines", () => {
  it("serves the page with its own title, text, listing, reviews and structured data, escaped", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { slug, liveId } = seed();
    const res = await request(app).get(`/agents/${slug}`).set("Host", "www.neroufinder.com").set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<h1>Profile Tester ${tag}</h1>`);
    expect(res.text).toContain(`<title>Profile Tester ${tag} | Property agent in Qatar | Nerou Finder</title>`);
    expect(res.text).toContain(`href="/properties/${liveId}"`);
    expect(res.text).toContain("Excellent service");
    expect(res.text).not.toContain("Waiting for moderation");
    expect(res.text).not.toContain("<script>x</script>"); // the bio is escaped
    expect(res.text).toContain('"@type":"RealEstateAgent"');
    expect(res.text).toContain('"@type":"AggregateRating"');
    expect(res.text).toMatch(new RegExp(`rel="canonical" href="https?://www[.]neroufinder[.]com/agents/${slug}"`));
    expect(res.text).toContain('hreflang="ar"');
  });

  it("serves the Arabic version under /ar, and 404s an unknown profile", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { slug } = seed();
    const ar = await request(app).get(`/ar/agents/${slug}`).set("Host", "www.neroufinder.com").set("X-Forwarded-For", uniqueIp());
    expect(ar.status).toBe(200);
    expect(ar.text).toContain('<html lang="ar" dir="rtl">');
    expect(ar.text).toContain("وكيل عقاري في قطر");
    await request(app).get("/agents/nobody-zzzzzz").set("X-Forwarded-For", uniqueIp()).expect(404);
  });

  it("redirects an old name part to the current address", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { slug } = seed();
    const code = slug.slice(-6);
    const res = await request(app).get(`/agents/old-name-${code}`).set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`/agents/${slug}`);
  });

  it("lists the page in the sitemap", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { slug } = seed();
    const res = await request(app).get("/sitemap.xml").set("Host", "www.neroufinder.com").set("X-Forwarded-For", uniqueIp());
    expect(res.text).toContain(`/agents/${slug}</loc>`);
  });
});

describe("counting visits and showing the owner their reach", () => {
  it("counts a profile visit once per visitor and shows it only to the owner", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { agentId } = seed();
    const ip = uniqueIp();
    await request(app).post(`/api/public/profile/agents/${agentId}/visit`).set("X-Forwarded-For", ip).expect(200);
    await request(app).post(`/api/public/profile/agents/${agentId}/visit`).set("X-Forwarded-For", ip).expect(200); // refresh: not counted again
    await request(app).post(`/api/public/profile/agents/${agentId}/visit`).set("X-Forwarded-For", uniqueIp()).expect(200);

    await request(app).get("/api/me/share-stats").set("X-Forwarded-For", uniqueIp()).expect(401);
    const res = await request(app).get("/api/me/share-stats").set("Authorization", `Bearer ${tokenFor(agentId, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body.profileViews).toBe(2);
    expect(res.body.kind).toBe("agents");
    expect(res.body.series).toHaveLength(30);
  });

  it("counts visits that arrive through a shared listing link and ranks the listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { agentId, liveId, draftId } = seed();
    await request(app).post(`/api/properties/${liveId}/share-visit`).set("X-Forwarded-For", uniqueIp()).expect(200);
    await request(app).post(`/api/properties/${liveId}/share-visit`).set("X-Forwarded-For", uniqueIp()).expect(200);
    await request(app).post(`/api/properties/${draftId}/share-visit`).set("X-Forwarded-For", uniqueIp()).expect(404); // not live: not counted
    const res = await request(app).get("/api/me/share-stats").set("Authorization", `Bearer ${tokenFor(agentId, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body.shareVisits).toBe(2);
    expect(res.body.top[0]).toMatchObject({ id: liveId, shareVisits: 2 });
  });

  it("does not count a hidden profile and gives other roles no statistics", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).post("/api/public/profile/agents/user-does-not-exist/visit").set("X-Forwarded-For", uniqueIp()).expect(404);
    await request(app).get("/api/me/share-stats").set("Authorization", `Bearer ${tokenFor("user-platform-admin", "PLATFORM_ADMIN")}`).set("X-Forwarded-For", uniqueIp()).expect(403);
  });

  it("shows an agency admin the agency's own numbers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/me/share-stats").set("Authorization", `Bearer ${tokenFor("user-agency-admin", "AGENCY_ADMIN")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(res.body.kind).toBe("agencies");
    expect(res.body.slug).toMatch(/-[a-z0-9]{6}$/);
  });
});
