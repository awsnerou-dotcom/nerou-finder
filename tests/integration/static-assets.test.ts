import { describe, it, expect } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import { app } from "../../server.js";

describe("site images: type and browser caching", () => {
  it("sends AVIF with the right content type (browsers refuse a wrong one next to nosniff)", async () => {
    const res = await request(app).get("/assets/images/hero-lusail-towers.avif");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/avif");
  });

  it("sends WebP and JPEG with theirs", async () => {
    expect((await request(app).get("/assets/images/hero-lusail-towers.webp")).headers["content-type"]).toBe("image/webp");
    expect((await request(app).get("/assets/images/hero-lusail-towers.jpg")).headers["content-type"]).toBe("image/jpeg");
  });

  it("lets browsers keep the site's images for a day instead of re-checking every visit", async () => {
    const res = await request(app).get("/assets/images/hero-lusail-towers-m.avif");
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });

  it("has a lighter phone copy and a desktop copy for every hero photo", () => {
    const dir = path.join(process.cwd(), "assets", "images");
    for (const n of ["hero-lusail-towers", "hero-qatar-spiral-minaret", "hero-pearl-marina"]) {
      for (const f of [`${n}.jpg`, `${n}.avif`, `${n}.webp`, `${n}-m.avif`, `${n}-m.webp`]) {
        expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
      }
      expect(fs.statSync(path.join(dir, `${n}-m.avif`)).size).toBeLessThan(fs.statSync(path.join(dir, `${n}.jpg`)).size);
    }
  });

  it("still never serves private documents through the static handler", async () => {
    expect((await request(app).get("/assets/.private-docs/anything.pdf")).status).toBe(404);
  });
});
