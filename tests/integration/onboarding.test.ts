import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { DOCUMENT_DECLARATION } from "../../src/types.js";
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

// /api/admin/* only checks the role claim on the JWT, so a test can act as a platform admin
// by signing one with the same secret the server verifies against.
function adminToken(): string {
  return jwt.sign(
    { id: "user-platform-admin", email: "admin@test.local", role: "PLATFORM_ADMIN", fullName: "Test Admin" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
}

async function signupAgent(label: string) {
  const ip = uniqueIp();
  const res = await signupAndVerify(app, ip, {
    email: uniqueEmail(label),
    password: "correct-horse-battery-staple",
    fullName: `Onboarding ${label}`,
    phone: "+974 5555 9500",
    role: "AGENT"
  });
  return { token: res.body.token as string, userId: res.body.user.id as string, ip };
}

describe("GET /api/auth/me", () => {
  it("rejects a request without a token", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the caller's own record without the password hash", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token, userId } = await signupAgent("me-basic");
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.pendingEmailOtpHash).toBeUndefined();
  });

  it("reflects an admin's onboarding approval on the SAME session, and pushes an account_updated notification", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token, userId } = await signupAgent("me-live");

    const before = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(before.body.user.applicationStatus).toBe("PENDING_APPROVAL");

    const patch = await request(app)
      .patch(`/api/admin/users/${userId}/application-status`)
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "AWAITING_PAYMENT" });
    expect(patch.status).toBe(200);

    // Same token, no re-login - this is exactly what used to require signing out and back in.
    const after = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(after.body.user.applicationStatus).toBe("AWAITING_PAYMENT");

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(notifs.body.some((n: any) => n.type === "account_updated")).toBe(true);
  });
});

describe("verification document accuracy declaration", () => {
  const validBody = (extra: Record<string, unknown> = {}) => ({
    documentType: "QID_FRONT",
    fileUrl: "/assets/uploads/test-id-front.jpg",
    ...extra
  });

  it("rejects an upload that does not carry the declaration", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("decl-missing");
    const res = await request(app)
      .post("/api/verification-documents")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/declaration/i);
  });

  it("rejects declarationAccepted: false", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("decl-false");
    const res = await request(app)
      .post("/api/verification-documents")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody({ declarationAccepted: false, declarationVersion: DOCUMENT_DECLARATION.version }));
    expect(res.status).toBe(400);
  });

  it("rejects an acceptance made against a stale declaration version", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("decl-stale");
    const res = await request(app)
      .post("/api/verification-documents")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody({ declarationAccepted: true, declarationVersion: "1999-01-v0" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/updated|reload/i);
  });

  it("accepts a properly declared upload and records who attested, when, and against which version", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token, userId } = await signupAgent("decl-ok");
    // The file must first go through the private upload endpoint (1x1 PNG signature is enough
    // for the server's content sniffing).
    const up = await request(app)
      .post("/api/verification-documents/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), { filename: "id.png", contentType: "image/png" });
    expect(up.status).toBe(200);
    const res = await request(app)
      .post("/api/verification-documents")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody({ fileUrl: up.body.fileRef, declarationAccepted: true, declarationVersion: DOCUMENT_DECLARATION.version }));
    expect(res.status).toBe(200);
    expect(res.body.document.declarationVersion).toBe(DOCUMENT_DECLARATION.version);
    expect(res.body.document.declarationAcceptedBy).toBe(userId);
    expect(new Date(res.body.document.declarationAcceptedAt).getTime()).toBeGreaterThan(0);
  });
});
