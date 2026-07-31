// Shared helpers for integration tests.

export function uniqueEmail(label: string): string {
  return `test-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
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
