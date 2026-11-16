import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";
import { agentSlug, orgSlug } from "../../src/lib/publicProfile.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const tag = `tv${Date.now().toString(36)}`;
let seeded = 0;

// An agency that is verified, with a team: one agent verified on their own, one whose documents are still pending, one suspended,
// and the agency's admin account.
function seed(orgStatus = "APPROVED") {
  const db = readDb();
  const baseUser = db.users.find(u => u.id === "user-agent-1")!;
  const baseOrg = db.organizations.find(o => o.id === "org-agency-1")!;
  const n = ++seeded;
  const orgId = `org-tv-${tag}-${n}`;
  db.organizations.push({ ...baseOrg, id: orgId, name: `Team Agency ${tag} ${orgStatus}`, nameAr: undefined, verificationStatus: orgStatus } as never);
  const mk = (key: string, extra: Record<string, unknown>) => {
    const id = `user-tv-${tag}-${n}-${key}`;
    db.users.push({ ...baseUser, id, fullName: `Agent ${key} ${tag}`, email: `${id}@example.test`, orgId, role: "AGENT", agentType: "AGENCY_AGENT", applicationStatus: "ACTIVE", ...extra } as never);
    return id;
  };
  const ids = {
    verified: mk("verified", { verificationStatus: "APPROVED" }),
    pending: mk("pending", { verificationStatus: "PENDING" }),
    suspended: mk("suspended", { verificationStatus: "SUSPENDED" }),
    admin: mk("admin", { verificationStatus: "APPROVED", role: "AGENCY_ADMIN", agentType: undefined })
  };
  writeDb(db);
  return { orgId, ids, db: readDb() };
}

const teamNames = async (orgId: string) => {
  const org = readDb().organizations.find(o => o.id === orgId)!;
  const res = await request(app).get(`/api/public/profile/agencies/${orgSlug(org as never)}`).set("X-Forwarded-For", uniqueIp());
  return { status: res.status, team: (res.body.team || []) as { name: string; verified: boolean }[] };
};

describe("agents of a verified agency", () => {
  it("all appear on the agency page, as verified, except the suspended one and the admin account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId } = seed();
    const { status, team } = await teamNames(orgId);
    expect(status).toBe(200);
    expect(team.map(t => t.name).sort()).toEqual([`Agent pending ${tag}`, `Agent verified ${tag}`]);
    expect(team.every(t => t.verified)).toBe(true);
  });

  it("appear in the public Agents list with the agency's verified label, and the agency card counts exactly them", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId, ids } = seed();
    const agents = await request(app).get("/api/directory?type=AGENT&q=" + tag).set("X-Forwarded-For", uniqueIp()).expect(200);
    const byId = new Map<string, { verifiedBadgeLabel: string }>(agents.body.items.map((i: { id: string; verifiedBadgeLabel: string }) => [i.id, i]));
    expect(byId.has(ids.pending)).toBe(true);
    expect(byId.get(ids.pending)!.verifiedBadgeLabel).toContain(`Team Agency ${tag}`);
    expect(byId.has(ids.verified)).toBe(true);
    expect(byId.has(ids.suspended)).toBe(false);
    expect(byId.has(ids.admin)).toBe(false);

    const agencies = await request(app).get("/api/directory?type=AGENCY&q=" + tag).set("X-Forwarded-For", uniqueIp()).expect(200);
    const card = agencies.body.items.find((i: { id: string }) => i.id === orgId);
    expect(card.teamSize).toBe(2); // the number on the card is the number of agents the page lists
  });

  it("are in the public user list, but the suspended agent is not", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { ids } = seed();
    const res = await request(app).get("/api/users").set("X-Forwarded-For", uniqueIp()).expect(200);
    const found = new Set(res.body.map((u: { id: string }) => u.id));
    expect(found.has(ids.pending)).toBe(true);
    expect(found.has(ids.suspended)).toBe(false);
    const mine = res.body.find((u: { id: string }) => u.id === ids.pending);
    expect(mine).not.toHaveProperty("password"); // the public shape, never the account's secrets
  });

  it("have their own public page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { ids, db } = seed();
    const u = db.users.find(x => x.id === ids.pending)!;
    await request(app).get(`/api/public/profile/agents/${agentSlug(u as never)}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    const s = db.users.find(x => x.id === ids.suspended)!;
    await request(app).get(`/api/public/profile/agents/${agentSlug(s as never)}`).set("X-Forwarded-For", uniqueIp()).expect(404);
  });
});

describe("agents of an agency that is not verified", () => {
  it("do not appear in the Agents list on the strength of the agency, only on their own documents", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { ids } = seed("PENDING");
    const res = await request(app).get("/api/directory?type=AGENT&q=" + tag).set("X-Forwarded-For", uniqueIp()).expect(200);
    const found = new Set(res.body.items.map((i: { id: string }) => i.id));
    expect(found.has(ids.pending)).toBe(false);
    expect(found.has(ids.verified)).toBe(true); // approved on their own
  });
});
