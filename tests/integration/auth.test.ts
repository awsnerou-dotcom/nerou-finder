import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, __testOtpCodesByEmail } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp, signupAndVerify } from "../helpers.js";

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
  it("signup withholds full access until email verification, then never leaks the password", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("signup");
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", ip)
      .send({
        email,
        password: "correct-horse-battery-staple",
        fullName: "Test Signup User",
        phone: "+974 5555 0000",
        role: "REGISTERED",
      });

    // A self-service signup (no invitation) gets no user/token yet - just a prompt to verify.
    expect(signupRes.status).toBe(200);
    expect(signupRes.body.requiresVerification).toBe(true);
    expect(signupRes.body.user).toBeUndefined();
    expect(signupRes.body.token).toBeUndefined();

    const verifiedRes = await signupAndVerify(app, ip, {
      email: uniqueEmail("signup2"),
      password: "correct-horse-battery-staple",
      fullName: "Test Signup User 2",
      phone: "+974 5555 0000",
      role: "REGISTERED",
    });

    expect(verifiedRes.status).toBe(200);
    expect(verifiedRes.body.user).toBeDefined();
    expect(verifiedRes.body.user.password).toBeUndefined();
    expect(verifiedRes.body.token).toEqual(expect.any(String));
  });

  it("login response does not include a password field", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("login");
    const password = "correct-horse-battery-staple";
    await signupAndVerify(app, ip, {
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
    await signupAndVerify(app, ip, {
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

describe("auth: email OTP verification", () => {
  it("blocks login until the emailed code is confirmed, then allows it", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("otpflow");
    const password = "correct-horse-battery-staple";
    await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email, password, fullName: "OTP Flow User", phone: "+974 5555 0010", role: "REGISTERED",
    });

    // Logging in before verifying re-issues a fresh code rather than granting access.
    const earlyLogin = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password });
    expect(earlyLogin.status).toBe(200);
    expect(earlyLogin.body.requiresVerification).toBe(true);
    expect(earlyLogin.body.token).toBeUndefined();

    const code = __testOtpCodesByEmail.get(email);
    const verifyRes = await request(app).post("/api/auth/verify-otp").set("X-Forwarded-For", ip).send({ email, code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toEqual(expect.any(String));

    const laterLogin = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password });
    expect(laterLogin.status).toBe(200);
    expect(laterLogin.body.token).toEqual(expect.any(String));
  });

  it("rejects an incorrect verification code", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("otpwrong");
    await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email, password: "correct-horse-battery-staple", fullName: "OTP Wrong Code User", phone: "+974 5555 0011", role: "REGISTERED",
    });

    const res = await request(app).post("/api/auth/verify-otp").set("X-Forwarded-For", ip).send({ email, code: "000000" });
    expect(res.status).toBe(401);
  });
});
