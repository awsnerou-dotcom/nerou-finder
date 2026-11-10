import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
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

const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const PRIVATE_FIELDS = ["password", "pendingEmailOtpHash", "referralCode", "emailVerified", "subscriptionPlanId", "subscriptionStatus", "applicationStatus", "hasSeenOnboardingTour"];

async function newUser(label: string, role: string) {
  const res = await signupAndVerify(app, uniqueIp(), {
    email: uniqueEmail(label), password: "correct-horse-battery-staple", fullName: `Priv ${label}`, phone: "+974 5555 9877", role
  });
  return { id: res.body.user.id as string, token: res.body.token as string, email: res.body.user.email as string };
}

describe("GET /api/users no longer hands every account to anyone", () => {
  it("hides accounts that are not public professionals (buyers, admins, pending applicants)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const buyer = await newUser("priv-buyer", "REGISTERED");
    const pending = await newUser("priv-pending", "AGENT");
    const db = readDb();
    const p = db.users.find(u => u.id === pending.id)!;
    (p as any).applicationStatus = "PENDING_APPROVAL";
    p.verificationStatus = "PENDING" as any;
    writeDb(db);

    const res = await request(app).get("/api/users").expect(200);
    const ids = res.body.map((u: any) => u.id);
    expect(ids).not.toContain(buyer.id);
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain("user-platform-admin");
    expect(ids).not.toContain("user-super-admin");
    expect(JSON.stringify(res.body)).not.toContain(buyer.email);
  });

  it("shows verified professionals, only with the fields the public pages read", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/users").expect(200);
    const agent = res.body.find((u: any) => u.id === "user-agent-1");
    expect(agent).toBeTruthy();
    expect(agent.fullName).toBeTruthy();
    for (const f of PRIVATE_FIELDS) expect(agent[f], f).toBeUndefined();
    for (const u of res.body) for (const f of PRIVATE_FIELDS) expect(u[f], `${u.id}.${f}`).toBeUndefined();
  });

  it("still lists someone with a published listing, so listing cards keep their agent", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newUser("priv-lister", "AGENT");
    const db = readDb();
    const u = db.users.find(x => x.id === agent.id)!;
    (u as any).applicationStatus = "PENDING_APPROVAL";
    db.properties.unshift({ id: `prop-priv-${Date.now()}`, agentId: agent.id, title: "Listing", images: [], listingStatus: "PUBLISHED", verificationStatus: "APPROVED" } as any);
    writeDb(db);
    const res = await request(app).get("/api/users").expect(200);
    const found = res.body.find((x: any) => x.id === agent.id);
    expect(found).toBeTruthy();
    expect(found.referralCode).toBeUndefined();
    expect(found.applicationStatus).toBeUndefined();
  });

  it("gives a signed-in person their own full record", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const buyer = await newUser("priv-self", "REGISTERED");
    const res = await request(app).get("/api/users").set(auth(buyer.token)).expect(200);
    const me = res.body.find((u: any) => u.id === buyer.id);
    expect(me).toBeTruthy();
    expect(me.email).toBe(buyer.email);
    expect(me.password).toBeUndefined();
    expect(res.body.filter((u: any) => u.role === "REGISTERED")).toHaveLength(1); // only themselves
  });

  it("gives an agency admin full records for their own organisation, and public profiles for the rest", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    const admin = db.users.find(u => u.role === "AGENCY_ADMIN" && u.orgId)!;
    const member = db.users.find(u => u.orgId === admin.orgId && u.id !== admin.id);
    const res = await request(app).get("/api/users").set(auth(tokenFor(admin.id, "AGENCY_ADMIN"))).expect(200);
    const mine = res.body.find((u: any) => u.id === admin.id);
    expect(mine.emailVerified !== undefined || mine.referralCode !== undefined || mine.createdDate !== undefined).toBe(true);
    expect(mine.password).toBeUndefined();
    if (member) {
      const m = res.body.find((u: any) => u.id === member.id);
      expect(m).toBeTruthy();
      expect(m.password).toBeUndefined();
    }
    const outsider = res.body.find((u: any) => u.orgId && u.orgId !== admin.orgId);
    if (outsider) for (const f of PRIVATE_FIELDS) expect(outsider[f], f).toBeUndefined();
  });

  it("gives platform admins everyone (never a password)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const buyer = await newUser("priv-admin-sees", "REGISTERED");
    const res = await request(app).get("/api/users").set(auth(tokenFor("user-platform-admin", "PLATFORM_ADMIN"))).expect(200);
    expect(res.body.map((u: any) => u.id)).toContain(buyer.id);
    expect(res.body.every((u: any) => u.password === undefined && u.pendingEmailOtpHash === undefined)).toBe(true);
  });

  it("treats a bad or expired token like no token", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const buyer = await newUser("priv-badtoken", "REGISTERED");
    const res = await request(app).get("/api/users").set({ Authorization: "Bearer not-a-real-token" }).expect(200);
    expect(res.body.map((u: any) => u.id)).not.toContain(buyer.id);
  });
});

describe("the market chart survives a listing with no area", () => {
  it("skips a published listing that has no district or city instead of failing for everyone", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    db.properties.unshift({ id: `prop-noarea-${Date.now()}`, agentId: "user-agent-1", title: "No area", images: [], listingStatus: "PUBLISHED", verificationStatus: "APPROVED", price: 1000, propertyType: "APARTMENT", transactionType: "FOR_RENT" } as any);
    writeDb(db);
    const res = await request(app).get("/api/market-index");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.groups)).toBe(true);
  });
});
