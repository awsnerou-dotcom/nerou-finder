import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

describe("the published legal documents", () => {
  it("serve the full Terms of Use and Privacy Policy, naming the company and its CR number", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/legal").expect(200);
    const terms = res.body.find((d: any) => d.slug === "terms-of-use");
    const privacy = res.body.find((d: any) => d.slug === "privacy-policy");
    expect(terms).toBeTruthy();
    expect(privacy).toBeTruthy();
    for (const d of [terms, privacy]) {
      expect(d.content).toContain("209013");
      expect(d.contentAr).toContain("209013");
      expect(d.content.length).toBeGreaterThan(4000);
      expect(d.contentAr.length).toBeGreaterThan(4000);
      expect(d.content).not.toMatch(/Nerou Property/);
    }
    expect(terms.content).toMatch(/does not negotiate/);
    expect(terms.contentAr).toMatch(/لا تتفاوض/);
  });

  it("keeps the other policies", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const slugs = (await request(app).get("/api/legal")).body.map((d: any) => d.slug);
    for (const s of ["saas-terms", "cookie-policy", "listing-provider-terms", "ai-disclaimer", "advertising-policy"]) expect(slugs).toContain(s);
  });
});
