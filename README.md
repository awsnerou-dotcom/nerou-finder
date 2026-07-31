# Nerou Finder

AI-powered real estate discovery marketplace, multi-tenant SaaS, and platform control center
for Qatar and international markets.

Stack: React 19 + Vite frontend, a single Express server (`server.ts`) serving both the API
and the frontend, PostgreSQL via Prisma (`server-db.ts`), deployed on [Render](https://render.com)
(see `render.yaml`).

## Prerequisites

- Node.js 20+
- A PostgreSQL database (local or hosted) - Postgres is this app's only data store; there is
  no other fallback.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```
   At minimum you need `DATABASE_URL` (and `DIRECT_URL`, usually the same value locally) and
   `JWT_SECRET` (generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   `GEMINI_API_KEY` is required for the AI search feature; without it that one endpoint
   returns an error, everything else works fine.
3. Apply the database schema:
   ```bash
   npx prisma migrate deploy
   ```
4. Run the app:
   ```bash
   npm run dev
   ```
   On first boot with an empty database, the app seeds a small set of default demo
   users/organizations/properties (see `DEFAULT_USERS` etc. in `server-db.ts`) - none of
   those seeded users have a password set, so they cannot be logged into until you set one.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs the server (with Vite dev middleware) via `tsx`. |
| `npm run build` | Builds the frontend (Vite) and bundles the server (esbuild) into `dist/`. |
| `npm start` | Runs the production build (`dist/server.cjs`). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm test` | Runs the Vitest suite. DB-backed integration tests soft-skip if `DATABASE_URL` isn't reachable; pure unit tests always run. |

## Tests

See `tests/`. Integration tests need a real (ideally disposable/test-only) Postgres database -
point `DATABASE_URL`/`DIRECT_URL` at it before running `npm test`, and apply migrations first
(`npx prisma migrate deploy`). CI (`.github/workflows/ci.yml`) provisions a throwaway Postgres
service container automatically.

## Deployment

Deployed on Render via `render.yaml`. Required environment variables (set in the Render
dashboard, not committed): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GEMINI_API_KEY`,
`RESEND_API_KEY` (optional - enables real outbound email via [Resend](https://resend.com);
without it, emails are only logged, never actually sent), `APP_URL`.

See `OPERATIONS.md` for backup/monitoring guidance specific to this Render deployment.
