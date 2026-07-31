import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyTOTP, generateTOTPSecret } from "../../server.js";

// Independent RFC 6238 TOTP implementation (kept separate from server.ts's own
// decodeBase32/verifyTOTP so this test can't pass just because both sides share a bug).
function decodeBase32(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val >= 0) bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCodeAt(secret: string, epochSeconds: number): string {
  const key = decodeBase32(secret);
  const timeStep = Math.floor(epochSeconds / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  buffer.writeUInt32BE(timeStep % 0x100000000, 4);
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, "0");
}

describe("TOTP (2FA)", () => {
  it("generateTOTPSecret produces a valid-looking base32 secret", () => {
    const secret = generateTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("accepts the correct current code for a freshly generated secret", () => {
    const secret = generateTOTPSecret();
    const code = totpCodeAt(secret, Date.now() / 1000);
    expect(verifyTOTP(secret, code)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const secret = generateTOTPSecret();
    const realCode = totpCodeAt(secret, Date.now() / 1000);
    const wrongCode = String((Number(realCode) + 1) % 1000000).padStart(6, "0");
    expect(verifyTOTP(secret, wrongCode)).toBe(false);
  });

  it("rejects a code from far outside the +/-1 time-step window", () => {
    const secret = generateTOTPSecret();
    // 10 minutes away - well outside the 90s (+/-1 step) acceptance window.
    const staleCode = totpCodeAt(secret, Date.now() / 1000 - 600);
    expect(verifyTOTP(secret, staleCode)).toBe(false);
  });

  it("two different secrets do not accept each other's codes", () => {
    const secretA = generateTOTPSecret();
    const secretB = generateTOTPSecret();
    const codeForA = totpCodeAt(secretA, Date.now() / 1000);
    expect(verifyTOTP(secretB, codeForA)).toBe(false);
  });
});
