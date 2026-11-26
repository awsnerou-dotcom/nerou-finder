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

const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Owner" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const as = (id: string, role: string) => ({ Authorization: `Bearer ${tokenFor(id, role)}`, "X-Forwarded-For": uniqueIp() });
const ip = () => ({ "X-Forwarded-For": uniqueIp() });
const tag = `adm${Date.now().toString(36)}`;
const ownerId = `owner-${tag}`;

function seedOwner() {
  const db = readDb();
  if (!db.users.some(u => u.id === ownerId)) {
    db.users.push({ id: ownerId, email: `${ownerId}@test.local`, password: "x", fullName: "Owner", phone: "", role: "PLATFORM_ADMIN", verificationStatus: "APPROVED", createdDate: new Date().toISOString(), emailVerified: true } as never);
    writeDb(db);
  }
}
const add = (body: object, id = ownerId, role = "PLATFORM_ADMIN") => request(app).post("/api/admin/admins").set(as(id, role)).send(body);

describe("an admin adds another admin", () => {
  it("creates an admin with no password, who sets their own from the emailed link and gets admin access", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seedOwner();
    const email = `second-${tag}@test.local`;
    const res = await add({ email: `  ${email.toUpperCase()} `, fullName: "Second Admin" }).expect(201);
    expect(res.body.user).toMatchObject({ email, role: "PLATFORM_ADMIN", fullName: "Second Admin" });
    // nothing that would let the creator sign in as the new person comes back
    for (const secret of ["password", "passwordResetToken", "passwordResetExpiresAt"]) expect(res.body.user).not.toHaveProperty(secret);

    const stored = readDb().users.find(u => u.email === email)!;
    expect(stored.password).toBeFalsy();
    expect(new Date(stored.passwordResetExpiresAt!).getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000);
    // cannot be signed into before the owner of the email chooses a password
    await request(app).post("/api/auth/login").set(ip()).send({ email, password: "anything-at-all" }).expect(401);

    const chosen = `Chosen-${tag}-pass`;
    await request(app).post("/api/auth/reset-password").set(ip()).send({ token: stored.passwordResetToken, newPassword: chosen }).expect(200);
    const login = await request(app).post("/api/auth/login").set(ip()).send({ email, password: chosen }).expect(200);
    await request(app).get("/api/admin/prospects").set({ Authorization: `Bearer ${login.body.token}`, ...ip() }).expect(200);
    expect(readDb().auditLogs.some(l => l.action === "CREATE_ADMIN" && l.actorId === ownerId)).toBe(true);
  });

  it("refuses an email that already has an account, whatever its capitals", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seedOwner();
    await add({ email: `${ownerId.toUpperCase()}@TEST.local`, fullName: "Copy" }).expect(409);
  });

  it("refuses a missing name or a bad email", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seedOwner();
    await add({ email: "not-an-email", fullName: "Someone" }).expect(400);
    await add({ email: `noname-${tag}@test.local`, fullName: " " }).expect(400);
    await add({ email: `<b>@test.local`, fullName: "Someone" }).expect(400);
  });

  it("is closed to everyone else, including a token whose owner is not (or no longer) an admin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seedOwner();
    const body = { email: `intruder-${tag}@test.local`, fullName: "Intruder" };
    await request(app).post("/api/admin/admins").set(ip()).send(body).expect(401);
    await add(body, ownerId, "AGENT").expect(403);
    await add(body, `gone-${tag}`).expect(403);
    expect(readDb().users.some(u => u.email === body.email)).toBe(false);
  });

  it("never hands out reset tokens or two-factor secrets in the user list", async (ctx) => {
    if (!dbReady) return ctx.skip();
    seedOwner();
    const db = readDb();
    const me = db.users.find(u => u.id === ownerId) as any;
    me.passwordResetToken = `tok-${tag}`;
    me.passwordResetExpiresAt = new Date(Date.now() + 1000).toISOString();
    me.twoFactorSecret = `SECRET${tag}`;
    writeDb(db);
    const res = await request(app).get("/api/users").set(as(ownerId, "PLATFORM_ADMIN")).expect(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(`tok-${tag}`);
    expect(text).not.toContain(`SECRET${tag}`);
  });
});
