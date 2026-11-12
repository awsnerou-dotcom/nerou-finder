import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp, signupAndVerify } from "../helpers.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const ADMIN_ID = "user-platform-admin";
const admin = () => ({ Authorization: `Bearer ${jwt.sign({ id: ADMIN_ID, email: "x@test.local", role: "PLATFORM_ADMIN", fullName: "Admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" })}` });

let seq = 0;
const phone = () => `+974 5${String(Date.now()).slice(-3)} ${String(1000 + seq++).slice(-4)}`;
const body = (over: object = {}) => ({ fullName: "Sara Al Thani", companyName: "Gulf Realty", email: uniqueEmail("planreq"), phone: phone(), planId: "plan-premium", agents: 6, message: "We have six agents.", consent: true, ...over });
const send = (b: object) => request(app).post("/api/plan-requests").set("X-Forwarded-For", uniqueIp()).send(b);
const prospectFor = (email: string) => readDb().prospects!.find(p => p.email === email.toLowerCase());

describe("GET /api/plans hides prices from visitors", () => {
  it("shows what a plan includes but not what it costs to someone who is not signed in", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/plans").expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    for (const p of res.body) {
      expect(p).not.toHaveProperty("priceMonthly");
      expect(p).not.toHaveProperty("priceYearly");
      expect(p).toHaveProperty("propertyLimit");
    }
    expect(JSON.stringify(res.body)).not.toMatch(/"price/i);
  });

  it("still gives the prices to a signed-in user", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await signupAndVerify(app, uniqueIp(), { email: uniqueEmail("plans-agent"), password: "correct-horse-battery-staple", fullName: "Plans Agent", phone: "+974 5555 9833", role: "AGENT" });
    const res = await request(app).get("/api/plans").set({ Authorization: `Bearer ${agent.body.token}` }).expect(200);
    for (const p of res.body) expect(typeof p.priceMonthly).toBe("number");
    const byId = (id: string) => res.body.find((p: any) => p.id === id);
    expect(byId("plan-trial").priceMonthly).toBe(0);
    expect(byId("plan-basic").propertyLimit).toBe(-1);
  });

  it("gives the prices to an admin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/plans").set(admin()).expect(200);
    for (const p of res.body) expect(typeof p.priceMonthly).toBe("number");
  });
});

describe("POST /api/plan-requests", () => {
  it("turns a request into a website prospect with a follow-up for today and tells the admins", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const b = body();
    const res = await send(b);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const p = prospectFor(b.email)!;
    expect(p).toMatchObject({ name: "Sara Al Thani", company: "Gulf Realty", kind: "AGENCY", source: "WEBSITE", stage: "NEW", interestedPlanId: "plan-premium" });
    expect(p.nextFollowUp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.activity.some(a => a.text.includes("Subscription request"))).toBe(true);
    expect(p.notes).toContain("six agents");
    // (the app keeps only an admin's latest notifications, so look for this one rather than counting)
    expect(readDb().notifications!.some(n => n.type === "plan_request" && n.userId === ADMIN_ID && n.link === p.id)).toBe(true);
  });

  it("shows up in the admin sales pipeline", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const b = body({ planId: "plan-developer", companyName: "Pearl Developments" });
    await send(b).expect(200);
    const list = await request(app).get("/api/admin/prospects").set(admin()).expect(200);
    const p = list.body.prospects.find((x: any) => x.email === b.email.toLowerCase());
    expect(p).toMatchObject({ kind: "DEVELOPER", source: "WEBSITE", interestedPlanId: "plan-developer" });
  });

  it("accepts 'not sure which plan' and records it as such", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const b = body({ planId: "", agents: undefined });
    await send(b).expect(200);
    const p = prospectFor(b.email)!;
    expect(p.kind).toBe("OTHER");
    expect(p.interestedPlanId).toBeUndefined();
    expect(p.activity.some(a => a.text.includes("not sure"))).toBe(true);
  });

  it("a second request from the same person updates their card instead of adding another", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const b = body({ planId: "plan-basic" });
    await send(b).expect(200);
    await send({ ...b, planId: "plan-premium", message: "Actually the bigger one." }).expect(200);
    const same = readDb().prospects!.filter(p => p.email === b.email.toLowerCase());
    expect(same).toHaveLength(1);
    expect(same[0].interestedPlanId).toBe("plan-premium");
    expect(same[0].activity.filter(a => a.text.includes("Subscription request")).length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a request without the consent box, an email or a phone number", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const noConsent = body({ consent: false });
    expect((await send(noConsent)).status).toBe(400);
    expect(prospectFor(noConsent.email)).toBeUndefined();
    expect((await send(body({ email: "" }))).status).toBe(400);
    expect((await send(body({ phone: "" }))).status).toBe(400);
    expect((await send(body({ email: "not-an-email" }))).status).toBe(400);
  });

  it("pretends to accept a bot but stores nothing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const b = body({ website: "http://spam.example" });
    const count = readDb().prospects!.length;
    const res = await send(b);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prospectFor(b.email)).toBeUndefined();
    expect(readDb().prospects!.length).toBe(count);
  });

  it("does not need an account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).post("/api/plan-requests").set("X-Forwarded-For", uniqueIp()).send(body());
    expect(res.status).toBe(200);
  });
});
