// Runs before every test file. server.ts fails fast (process.exit) if JWT_SECRET is unset,
// and Prisma validates the shape of DATABASE_URL/DIRECT_URL at client construction time even
// before any query runs - so both need a value just to *import* server.ts/server-db.ts, even
// in test files that never touch the database.
process.env.JWT_SECRET ??= "test-only-secret-do-not-use-in-production";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/nerou_test?schema=public";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
