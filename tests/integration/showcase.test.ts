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
const agent = () => ({ Authorization: `Bearer ${tokenFor("user-agent-1", "AGENT")}` });

let n = 0;
const body = (over: object = {}) => ({
  name: `Showcase Co ${Date.now()}-${n++}`, kind: "AGENCY",
  description: "A real-estate company in Doha helping families and investors for many years.", published: false, ...over
});
const create = (over: object = {}) => request(app).post("/api/admin/showcase").set(admin()).send(body(over));
const publicNames = async () => (await request(app).get("/api/showcase")).body.entries.map((e: any) => e.name);

describe("subscribers showcase: access", () => {
  it("is managed by platform admins only", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const made = (await create()).body.entry;
    for (const call of [
      (t?: Record<string, string>) => request(app).get("/api/admin/showcase").set(t || {}),
      (t?: Record<string, string>) => request(app).post("/api/admin/showcase").set(t || {}).send(body()),
      (t?: Record<string, string>) => request(app).patch(`/api/admin/showcase/${made.id}`).set(t || {}).send({ published: true }),
      (t?: Record<string, string>) => request(app).post(`/api/admin/showcase/${made.id}/move`).set(t || {}).send({ direction: "up" }),
      (t?: Record<string, string>) => request(app).delete(`/api/admin/showcase/${made.id}`).set(t || {})
    ]) {
      expect((await call()).status).toBe(401);
      expect((await call(agent())).status).toBe(403);
    }
    expect(readDb().showcase!.some(e => e.id === made.id)).toBe(true); // nothing was changed by them
  });
});

describe("subscribers showcase: what visitors see", () => {
  it("shows only published entries, and only fields meant for the public", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const hidden = (await create({ name: `Hidden ${Date.now()}` })).body.entry;
    const shown = (await create({ name: `Shown ${Date.now()}`, published: true, website: "shown.example.qa", since: "2026-11" })).body.entry;
    const res = await request(app).get("/api/showcase").expect(200);
    const ids = res.body.entries.map((e: any) => e.id);
    expect(ids).toContain(shown.id);
    expect(ids).not.toContain(hidden.id);
    const e = res.body.entries.find((x: any) => x.id === shown.id);
    expect(e).toMatchObject({ name: shown.name, kind: "AGENCY", website: "https://shown.example.qa/", since: "2026-11", verified: false, listingCount: 0 });
    expect(e.published).toBeUndefined();
    expect(e.sortOrder).toBeUndefined();
    expect(e.createdAt).toBeUndefined();
  });

  it("publishing and unpublishing takes effect at once", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const made = (await create({ name: `Toggle ${Date.now()}` })).body.entry;
    expect(await publicNames()).not.toContain(made.name);
    await request(app).patch(`/api/admin/showcase/${made.id}`).set(admin()).send({ published: true }).expect(200);
    expect(await publicNames()).toContain(made.name);
    await request(app).patch(`/api/admin/showcase/${made.id}`).set(admin()).send({ published: false }).expect(200);
    expect(await publicNames()).not.toContain(made.name);
  });

  it("gives a verified badge, listing count and profile link only for a verified company account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    const org = db.organizations.find(o => o.verificationStatus === "APPROVED")!;
    const pending = db.organizations.find(o => o.id !== org.id)!;
    const prevStatus = pending.verificationStatus;
    pending.verificationStatus = "PENDING" as any;
    writeDb(db);
    const linked = (await create({ name: `Linked ${Date.now()}`, published: true, orgId: org.id })).body.entry;
    const unverified = (await create({ name: `Unverified ${Date.now()}`, published: true, orgId: pending.id })).body.entry;
    const res = (await request(app).get("/api/showcase")).body.entries;
    const a = res.find((x: any) => x.id === linked.id);
    const b = res.find((x: any) => x.id === unverified.id);
    expect(a).toMatchObject({ verified: true, orgId: org.id });
    expect(typeof a.listingCount).toBe("number");
    expect(b).toMatchObject({ verified: false, listingCount: 0 });
    expect(b.orgId).toBeUndefined();
    const db2 = readDb(); db2.organizations.find(o => o.id === pending.id)!.verificationStatus = prevStatus; writeDb(db2);
  });
});

describe("subscribers showcase: managing entries", () => {
  it("rejects a bad entry with a reason, and a company with no account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await create({ name: "" })).status).toBe(400);
    expect((await create({ description: "short" })).status).toBe(400);
    const bad = await create({ logoUrl: "javascript:alert(1)" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/logo/i);
    expect((await create({ photoUrl: "http://insecure.example/x.png" })).status).toBe(400);
    expect((await create({ website: "nodots" })).status).toBe(400);
    const orphan = await create({ orgId: "org-does-not-exist" });
    expect(orphan.status).toBe(400);
    expect(orphan.body.error).toMatch(/no account/i);
  });

  it("edits an entry and can clear an optional field", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const made = (await create({ website: "first.example.qa", logoUrl: "/assets/uploads/x.png" })).body.entry;
    const res = await request(app).patch(`/api/admin/showcase/${made.id}`).set(admin()).send({ description: "A new, longer description of this company's work.", website: "" });
    expect(res.status).toBe(200);
    const saved = readDb().showcase!.find(e => e.id === made.id)!;
    expect(saved.description).toContain("new, longer");
    expect(saved.website).toBeUndefined();
    expect(saved.logoUrl).toBe("/assets/uploads/x.png");
    expect((await request(app).patch(`/api/admin/showcase/${made.id}`).set(admin()).send({ description: "tiny" })).status).toBe(400);
    expect((await request(app).patch("/api/admin/showcase/nope").set(admin()).send({})).status).toBe(404);
  });

  it("puts new entries last and moves them up and down", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = (await create({ name: `Order A ${Date.now()}`, published: true })).body.entry;
    const b = (await create({ name: `Order B ${Date.now()}`, published: true })).body.entry;
    const order = async () => (await request(app).get("/api/showcase")).body.entries.map((e: any) => e.id).filter((id: string) => id === a.id || id === b.id);
    expect(await order()).toEqual([a.id, b.id]);
    await request(app).post(`/api/admin/showcase/${b.id}/move`).set(admin()).send({ direction: "up" }).expect(200);
    expect(await order()).toEqual([b.id, a.id]);
    await request(app).post(`/api/admin/showcase/${b.id}/move`).set(admin()).send({ direction: "down" }).expect(200);
    expect(await order()).toEqual([a.id, b.id]);
    expect((await request(app).post("/api/admin/showcase/nope/move").set(admin()).send({ direction: "up" })).status).toBe(404);
  });

  it("deletes an entry", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const made = (await create({ name: `Delete ${Date.now()}`, published: true })).body.entry;
    await request(app).delete(`/api/admin/showcase/${made.id}`).set(admin()).expect(200);
    expect(await publicNames()).not.toContain(made.name);
    await request(app).delete(`/api/admin/showcase/${made.id}`).set(admin()).expect(404);
  });
});
