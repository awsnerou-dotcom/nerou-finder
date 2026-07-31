import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp } from "../helpers.js";

// These tests need a real, reachable Postgres database (DATABASE_URL/DIRECT_URL). They
// soft-skip (via ctx.skip()) rather than hard-fail when no test database is configured, so
// `npm test` still runs the pure unit tests for a contributor without one set up locally -
// CI provisions a real Postgres service and sets DATABASE_URL before running the suite.
let dbReady = false;

beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

describe("auth: password hash must never be returned to the client", () => {
  it("signup response does not include a password field", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("signup");
    const res = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", ip)
      .send({
        email,
        password: "correct-horse-battery-staple",
        fullName: "Test Signup User",
        phone: "+974 5555 0000",
        role: "REGISTERED",
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("login response does not include a password field", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("login");
    const password = "correct-horse-battery-staple";
    await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email,
      password,
      fullName: "Test Login User",
      phone: "+974 5555 0001",
      role: "REGISTERED",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects login with the wrong password", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("wrongpw");
    await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email,
      password: "correct-horse-battery-staple",
      fullName: "Test Wrong Password User",
      phone: "+974 5555 0002",
      role: "REGISTERED",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ email, password: "definitely-not-the-password" });

    expect(res.status).toBe(401);
  });

  it("self-signup cannot grant PLATFORM_ADMIN even if requested", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("privesc");
    const res = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", ip)
      .send({
        email,
        password: "correct-horse-battery-staple",
        fullName: "Attempted Privilege Escalation",
        phone: "+974 5555 0003",
        role: "PLATFORM_ADMIN",
      });

    expect(res.status).toBe(400);
  });
});
