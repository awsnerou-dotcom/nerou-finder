# Nerou Finder Production Operations Guide

This operations runbook outlines the steps for setting up high-availability database backups on Google Cloud SQL, configuring uptime monitoring alerts, and managing manual backups.

---

## 1. Cloud SQL Automated Daily Backups

To ensure data resilience and prevent data loss on the ephemeral Google Cloud Run container architecture, you must enable automated daily backups on your Cloud SQL (PostgreSQL) instance.

### Step-by-Step Enablement via Google Cloud Console
1. **Navigate to the SQL Dashboard**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - From the left sidebar navigation menu, select **SQL** (or search for "SQL" in the search bar).
2. **Select your Database Instance**:
   - Click on your PostgreSQL instance name (e.g., `nerou-finder-postgres`).
3. **Open Instance Configurations**:
   - In the left-side navigation of the SQL instance page, click on **Backups**.
   - Click on the **Edit** button (or **Configure backup settings**).
4. **Enable Automated Backups**:
   - Check the **Automated backups** checkbox.
   - **Configure Backup Window**: Under **Backup start time**, select a 4-hour window when your application traffic is at its lowest (e.g., *02:00 AM - 06:00 AM AST*).
   - **Enable Point-In-Time Recovery (PITR)**: Check the **Enable point-in-time recovery** checkbox (this enables transaction log archiving, allowing database restoration to a specific second).
5. **Set Retention Policy**:
   - Set the backup retention count (e.g., retain last **7 days** or **30 days** depending on your audit and space requirements).
6. **Save Configurations**:
   - Click the **Save** or **Update** button at the bottom of the page. Google Cloud SQL will initiate a rolling configuration update (this is non-disruptive and has zero downtime).

---

## 2. Setting Up Free Uptime Monitoring

Uptime monitoring ensures you receive instant notifications via Slack, Email, or Webhooks if your application is unreachable or if database connectivity fails.

### Using UptimeRobot (Free & Setup in 2 Minutes)
1. **Create an Account**:
   - Visit [UptimeRobot](https://uptimerobot.com/) and register for a free account.
2. **Add a New Monitor**:
   - Click on **Add New Monitor**.
   - **Monitor Type**: Choose `HTTPS`.
   - **Friendly Name**: Enter `Nerou Finder Prod`.
   - **URL (or IP)**: Provide your production health check URL:
     ```
     https://[YOUR_PROD_APP_URL]/api/health
     ```
   - **Monitoring Interval**: Set to `5 minutes` (the free tier limit).
3. **Configure Alert Contacts**:
   - Select the checkbox next to your email address to receive instant downtime email reports.
4. **Save**:
   - Click **Create Monitor** to initiate the live polling stream.

### Using Google Cloud Monitoring (Free Tier Eligible)
1. **Navigate to Monitoring**:
   - In the [Google Cloud Console](https://console.cloud.google.com/), search for **Monitoring** and select it.
2. **Create Uptime Check**:
   - In the Monitoring sidebar, click on **Uptime Checks**, then click **Create Uptime Check**.
3. **Configure Target**:
   - **Protocol**: HTTPS
   - **Resource Type**: URL
   - **Hostname**: `[YOUR_PROD_APP_URL]`
   - **Path**: `/api/health`
4. **Set Response Timeout & Polling Frequency**:
   - Set the timeout to `10 seconds` and polling frequency to `1 minute`.
5. **Configure Alerting Policies**:
   - Enable alert notifications, and create a notification channel (e.g. Email or Slack) to notify your admin team.
6. **Save**:
   - Click **Create** to activate.

---

## 3. Manual Safety Net Backups (JSON Exports)

As an independent administrative backup, the **Nerou Finder Control Center** provides an application-level snapshot export capability:
1. Log in to the application as a `PLATFORM_ADMIN` (e.g., `platform_admin@nerou.com`).
2. Navigate to the **Control Center** (Admin Panel).
3. On the **Overview** sub-tab, locate the **Database Management & Backup Operations** card.
4. Click **Download JSON Database Export**.
5. This generates a secure JSON snapshot of all tables (`Properties`, `Users`, `Leads`, `SubscriptionPlans`, `AuditLogs`, etc.) in real-time, matching the schema and downloadable directly to your browser on demand.
