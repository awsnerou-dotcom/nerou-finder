/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DashboardChartDatum } from "../components/DashboardChart.js";
import { BadgeTone } from "../components/ui/Badge.js";
import { ListingStatus, LeadStatus } from "../types.js";

// Shared helpers for the dashboard StatCard/DashboardChart work across ControlCenter,
// AgentWorkspace, AgencyWorkspace and DeveloperWorkspace. Everything here is computed
// client-side from data those workspaces already fetch (leads, properties, ad charges) -
// no new server aggregation endpoints needed for day-bucketed trend charts.

/** True if `dateStr` falls in the current calendar month/year. */
export function isThisMonth(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Buckets a list of ISO date strings into a `days`-long daily series ending today, suitable
 * for DashboardChart. Each entry's label is a short localized day/month (e.g. "Aug 24").
 */
export function buildDailyCountSeries(dates: (string | undefined | null)[], days = 30, isRtl = false): DashboardChartDatum[] {
  const counts = new Map<string, number>();
  for (const raw of dates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = dayKey(d);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: DashboardChartDatum[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = dayKey(d);
    series.push({
      label: d.toLocaleDateString(isRtl ? "ar" : "en-US", { month: "short", day: "numeric" }),
      value: counts.get(key) || 0,
    });
  }
  return series;
}

/**
 * Same as buildDailyCountSeries but sums a numeric value per day instead of counting
 * occurrences (e.g. Property.viewsByDay entries), and can merge in a second series
 * (e.g. leads alongside views) for a dual-line/bar chart.
 */
export function buildDailySumSeries(
  primary: Record<string, number>[],
  days = 30,
  isRtl = false,
  secondary?: Record<string, number>[]
): DashboardChartDatum[] {
  const mergeByDay = (records: Record<string, number>[]) => {
    const out = new Map<string, number>();
    for (const rec of records) {
      for (const [key, val] of Object.entries(rec || {})) {
        out.set(key, (out.get(key) || 0) + (val || 0));
      }
    }
    return out;
  };

  const primaryTotals = mergeByDay(primary);
  const secondaryTotals = secondary ? mergeByDay(secondary) : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: DashboardChartDatum[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = dayKey(d);
    const entry: DashboardChartDatum = {
      label: d.toLocaleDateString(isRtl ? "ar" : "en-US", { month: "short", day: "numeric" }),
      value: primaryTotals.get(key) || 0,
    };
    if (secondaryTotals) entry.secondaryValue = secondaryTotals.get(key) || 0;
    series.push(entry);
  }
  return series;
}

/** Converts a flat list of ISO date strings into a {day: count} record, for feeding into
 * buildDailySumSeries alongside per-day records that are already shaped that way (e.g.
 * Property.viewsByDay). */
export function datesToDayRecord(dates: (string | undefined | null)[]): Record<string, number> {
  const rec: Record<string, number> = {};
  for (const raw of dates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = dayKey(d);
    rec[key] = (rec[key] || 0) + 1;
  }
  return rec;
}

/** Maps the real ListingStatus enum onto the shared Badge component's tone palette. */
export function listingStatusTone(status: ListingStatus | string): BadgeTone {
  switch (status) {
    case ListingStatus.PUBLISHED:
      return "success";
    case ListingStatus.PAUSED:
    case ListingStatus.PENDING_REVIEW:
      return "warning";
    case ListingStatus.SOLD:
    case ListingStatus.RENTED:
      return "info";
    case ListingStatus.SUSPENDED:
      return "danger";
    case ListingStatus.DRAFT:
    default:
      return "neutral";
  }
}

/** Maps the real LeadStatus enum onto the shared Badge component's tone palette. */
export function leadStatusTone(status: LeadStatus | string): BadgeTone {
  switch (status) {
    case LeadStatus.NEW:
      return "danger";
    case LeadStatus.CONTACTED:
    case LeadStatus.VIEWING_REQUESTED:
    case LeadStatus.VIEWING_SCHEDULED:
    case LeadStatus.NEGOTIATION:
      return "warning";
    case LeadStatus.CONVERTED:
      return "success";
    case LeadStatus.LOST:
      return "neutral";
    default:
      return "neutral";
  }
}
