# Nerou Finder Production Operations Guide

This app is deployed on [Render](https://render.com) (see `render.yaml`), backed by a
PostgreSQL database Render does not manage for you directly - you provision it separately
(Render's own managed Postgres, or any external Postgres provider) and point `DATABASE_URL`/
`DIRECT_URL` at it. This guide covers backups, uptime monitoring, and manual export options
for that setup specifically.

---

## 1. Database Backups

How you configure this depends on where your Postgres instance actually lives:

- **Render's managed PostgreSQL**: Render takes automated daily backups and supports
  point-in-time recovery on paid plans. Configure retention and PITR from the database's page
  in the Render dashboard, under **Backups**.
- **A different managed Postgres provider** (Supabase, Neon, RDS, Cloud SQL, etc.): follow
  that provider's own backup/PITR configuration - Render itself has no visibility into or
  control over a database it doesn't host.

Either way, treat automated backups as required, not optional: the app has no other
persistent store (see "Single source of truth" below).

---

## 2. Uptime Monitoring

`GET /api/health` reports application status, real Postgres connectivity (it runs
`prisma.user.count()`), and the timestamp/details of the last background database sync
failure, if any (`lastSyncError`) - point an uptime monitor at it.

### Using UptimeRobot (free)
1. Create a free account at [UptimeRobot](https://uptimerobot.com/).
2. **Add New Monitor** → Monitor Type: `HTTPS`.
3. URL: `https://[YOUR_RENDER_APP_URL]/api/health`.
4. Interval: 5 minutes (free tier).
5. Add your email as an alert contact.

A healthy response is HTTP 200 with `"status": "ok"` and `"database": "CONNECTED"`. A 500
response or `"lastSyncError"` being non-null means something needs attention.

---

## 3. Manual Safety-Net Export (JSON)

Independent of automated database backups, the **Control Center** provides an
application-level export:
1. Log in as a `PLATFORM_ADMIN`.
2. Navigate to **Control Center → Overview**.
3. Find **Database Management & Backup Operations** and click **Download JSON Database
   Export**.
4. This downloads a full JSON snapshot of every table, generated live from the database at
   request time.

---

## 4. Single source of truth

Postgres is the only place this app's data lives - there is no other fallback store. If
Postgres is unreachable at boot, the server refuses to start rather than silently running on
stale or default data (see `initDb()` in `server-db.ts`). This means:

- Database backups are not optional - there is nothing else to recover from.
- **Migrations are applied manually, not automatically.** `render.yaml`'s `buildCommand` does
  *not* run `npx prisma migrate deploy` (it was tried and started hard-failing every build with
  Prisma error P1013, undiagnosed so far) - after adding a migration under `prisma/migrations/`,
  apply it on production yourself via Render's **Shell** tab: `npx prisma migrate deploy`. If
  you change the Prisma schema, always generate a migration (`npx prisma migrate dev` locally)
  and commit it - never edit the live schema by hand, and don't forget to actually apply it on
  Render afterward since nothing does that step for you.

## 5. Uploaded media

Property photos/documents are stored on Render's persistent disk (`render.yaml`'s `disk:
uploads`, mounted at `assets/uploads`), not in Postgres. Render persistent disks are tied to
a single service instance - this means the app currently cannot run more than one instance at
once without either moving uploads to object storage (S3/GCS/Cloudinary) or accepting that a
second instance would have its own separate, out-of-sync uploads directory. Something to
revisit before scaling beyond one instance.
