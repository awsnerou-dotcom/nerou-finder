import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp } from "../helpers.js";

let dbReady = false;

beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

describe("GET /api/leads must not leak visitor PII to unauthenticated callers", () => {
  it("rejects an unauthenticated request", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
  });

  it("rejects a request with an invalid/garbage token", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const res = await request(app).get("/api/leads").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("allows an authenticated agent, scoped only to their own leads regardless of query params", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const email = uniqueEmail("leads-agent");
    const signupRes = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email,
      password: "correct-horse-battery-staple",
      fullName: "Test Leads Agent",
      phone: "+974 5555 9100",
      role: "AGENT",
    });
    const token = signupRes.body.token;
    const otherAgentId = "user-agent-1"; // seeded default agent, definitely not this new agent

    const res = await request(app)
      .get(`/api/leads?agentId=${otherAgentId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Even though the query string asked for another agent's leads, every returned lead
    // must belong to the caller - the endpoint used to trust agentId/orgId query params
    // outright, which is exactly how it leaked every lead in the system.
    for (const lead of res.body) {
      expect(lead.agentId).toBe(signupRes.body.user.id);
    }
  });
});
