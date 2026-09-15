// Shared helpers for integration tests.
import request from "supertest";
import type { Express } from "express";
import { __testOtpCodesByEmail } from "../server.js";

export function uniqueEmail(label: string): string {
  return `test-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

// POST /api/auth/signup now withholds the JWT for a self-service (non-invitation) signup until
// the emailed OTP is confirmed (see POST /api/auth/verify-otp) - most existing tests only care
// about ending up with a valid { user, token }, not about exercising the OTP step itself, so
// this drives both calls and returns the same shape the old direct-signup response used to.
// Uses __testOtpCodesByEmail (server.ts) rather than the network/email layer, since the emailed
// code is otherwise only ever visible in a bcrypt hash or a console log line.
export async function signupAndVerify(
  app: Express,
  ip: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const email = payload.email as string;
  const signupRes = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send(payload);
  if (signupRes.status !== 200 || !signupRes.body.requiresVerification) {
    // Invitation-based signups (or a signup error) skip/never reach the OTP gate - return as-is.
    return signupRes;
  }
  const code = __testOtpCodesByEmail.get(email);
  if (!code) throw new Error(`No OTP code was issued for ${email} - signupAndVerify can't proceed.`);
  return request(app).post("/api/auth/verify-otp").set("X-Forwarded-For", ip).send({ email, code });
}

// authRateLimiter (and the other rate limiters added in Phase 1) key by IP - all supertest
// requests otherwise share one loopback address, so a full test run across multiple files
// could trip the very rate limits this hardening pass added. Each caller gets its own fake
// X-Forwarded-For (trust proxy is enabled in server.ts) to keep the suite independent of them.
let ipCounter = 1;
export function uniqueIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 8) & 0xff}.${ipCounter & 0xff}.1`;
}
