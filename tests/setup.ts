// Runs before every test file. server.ts fails fast (process.exit) if JWT_SECRET is unset,
// and Prisma validates the shape of DATABASE_URL/DIRECT_URL at client construction time even
// before any query runs - so both need a value just to *import* server.ts/server-db.ts, even
// in test files that never touch the database.
process.env.JWT_SECRET ??= "test-only-secret-do-not-use-in-production";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/nerou_test?schema=public";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.NODE_ENV = "test";

// Every test file runs in its own worker with its own Prisma client, and each client opens a
// connection pool sized by the machine's CPU count (cpus x 2 + 1). With a dozen test files that
// adds up to more than PostgreSQL's default of 100 connections, the database answers "too many
// clients", a file's initDb() fails, and its DB-backed tests are SKIPPED rather than run - so a
// green run could silently prove nothing. A small pool per client is plenty for tests.
if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "") && !/[?&]connection_limit=/.test(process.env.DATABASE_URL!)) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL!.includes("?") ? "&" : "?") + "connection_limit=3";
}
