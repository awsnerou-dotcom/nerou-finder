import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
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

const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const as = (id: string, role: string) => ({ Authorization: `Bearer ${tokenFor(id, role)}`, "X-Forwarded-For": uniqueIp() });
const tag = `rm${Date.now().toString(36)}`;

const person = (id: string, role: string, orgId?: string) => ({
  id, email: `${id}@test.local`, password: "x", fullName: id, phone: "+974 5000 0000", role, orgId, verificationStatus: "APPROVED",
  createdDate: new Date().toISOString(), emailVerified: true
});

// Every test builds the people and company it needs, so none depends on seed data.
function seed() {
  const db = readDb();
  const platformAdmin = person(`pa-${tag}`, "PLATFORM_ADMIN");
  const solo = person(`solo-${tag}`, "AGENT");
  const orgId = `org-${tag}`;
  const boss = person(`boss-${tag}`, "AGENCY_ADMIN", orgId);
  const mate = person(`mate-${tag}`, "AGENT", orgId);
  const lonerOrg = `org-lone-${tag}`;
  const loner = person(`loner-${tag}`, "AGENCY_ADMIN", lonerOrg);
  for (const u of [platformAdmin, solo, boss, mate, loner]) if (!db.users.some(x => x.id === u.id)) db.users.push(u as never);
  for (const id of [orgId, lonerOrg]) if (!db.organizations.some(o => o.id === id)) db.organizations.push({ id, name: `Company ${id}`, type: "AGENCY" } as never);
  const listing = (id: string, agentId: string, orgId?: string) => ({
    id, title: id, agentId, orgId, listingStatus: "ACTIVE", verificationStatus: "APPROVED", city: "Doha", propertyType: "APARTMENT", price: 1000
  });
  if (!db.properties.some(p => p.id === `prop-solo-${tag}`)) db.properties.push(listing(`prop-solo-${tag}`, solo.id) as never);
  if (!db.properties.some(p => p.id === `prop-loner-${tag}`)) db.properties.push(listing(`prop-loner-${tag}`, loner.id, lonerOrg) as never);
  db.invitations = db.invitations || [];
  const invites = [
    { id: `inv-wrong-${tag}`, email: `typo-${tag}@test.local`, orgId, invitedRole: "AGENT", token: `tk-${tag}-1`, status: "PENDING", createdDate: new Date().toISOString(), expiresDate: new Date(Date.now() + 864e5).toISOString() },
    { id: `inv-done-${tag}`, email: `done-${tag}@test.local`, orgId, invitedRole: "AGENT", token: `tk-${tag}-2`, status: "ACCEPTED", createdDate: new Date().toISOString(), expiresDate: new Date(Date.now() + 864e5).toISOString() }
  ];
  for (const i of invites) if (!db.invitations.some(x => x.id === i.id)) db.invitations.push(i as never);
  writeDb(db);
  return { platformAdmin, solo, boss, mate, loner, orgId, lonerOrg };
}

describe("an admin deletes one subscriber's account", () => {
  it("removes the account and its listings, and lets the email sign up again", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { platformAdmin, solo } = seed();
    const res = await request(app).delete(`/api/admin/users/${solo.id}`).set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(200);
    expect(res.body).toMatchObject({ success: true, listingsRemoved: 1, organizationRemoved: false });
    const db = readDb();
    expect(db.users.some(u => u.id === solo.id)).toBe(false);
    expect(db.properties.some(p => p.id === `prop-solo-${tag}`)).toBe(false);
  });

  it("takes the company with it when the admin was its only member", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { platformAdmin, loner, lonerOrg } = seed();
    const res = await request(app).delete(`/api/admin/users/${loner.id}`).set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(200);
    expect(res.body.organizationRemoved).toBe(true);
    const db = readDb();
    expect(db.organizations.some(o => o.id === lonerOrg)).toBe(false);
    expect(db.properties.some(p => p.id === `prop-loner-${tag}`)).toBe(false);
  });

  it("refuses a company admin whose company still has other members", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { platformAdmin, boss } = seed();
    await request(app).delete(`/api/admin/users/${boss.id}`).set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(409);
    expect(readDb().users.some(u => u.id === boss.id)).toBe(true);
  });

  it("refuses platform admins and the admin's own account", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { platformAdmin } = seed();
    await request(app).delete(`/api/admin/users/${platformAdmin.id}`).set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(400);
    await request(app).delete("/api/admin/users/user-super-admin").set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(403);
  });

  it("is not available to anyone but a platform admin, and 404s on an unknown id", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { platformAdmin, mate, boss } = seed();
    await request(app).delete(`/api/admin/users/${mate.id}`).set(as(boss.id, "AGENCY_ADMIN")).expect(403);
    await request(app).delete(`/api/admin/users/${mate.id}`).expect(401);
    await request(app).delete("/api/admin/users/nobody").set(as(platformAdmin.id, "PLATFORM_ADMIN")).expect(404);
  });
});

describe("an agency cancels an invitation sent to a wrong email", () => {
  it("removes a pending invitation so the right address can be invited", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { boss, orgId } = seed();
    await request(app).delete(`/api/organizations/${orgId}/invitations/inv-wrong-${tag}`).set(as(boss.id, "AGENCY_ADMIN")).expect(200);
    expect(readDb().invitations!.some(i => i.id === `inv-wrong-${tag}`)).toBe(false);
  });

  it("will not cancel one that was already accepted", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { boss, orgId } = seed();
    await request(app).delete(`/api/organizations/${orgId}/invitations/inv-done-${tag}`).set(as(boss.id, "AGENCY_ADMIN")).expect(409);
  });

  it("only that agency's admin can cancel, and an agent cannot", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { boss, mate, loner, orgId } = seed();
    await request(app).delete(`/api/organizations/${orgId}/invitations/inv-wrong-${tag}`).set(as(loner.id, "AGENCY_ADMIN")).expect(403);
    await request(app).delete(`/api/organizations/${orgId}/invitations/inv-wrong-${tag}`).set(as(mate.id, "AGENT")).expect(403);
    await request(app).delete(`/api/organizations/${orgId}/invitations/nope`).set(as(boss.id, "AGENCY_ADMIN")).expect(404);
  });
});
