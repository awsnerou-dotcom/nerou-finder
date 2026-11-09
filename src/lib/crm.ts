// Sales-desk (CRM) rules that don't need the database: pipeline stages, commission math, CSV
// writing, Qatar-time helpers and "who is due a reminder". Kept free of server code so the same
// logic can be unit tested and shared with the browser.

import { Deal, Lead, LeadStatus, ViewingRequest } from "../types.js";

// ---------------------------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------------------------

/** The board's columns, left to right. ASSIGNED and VIEWING_REQUESTED have no column of their
 *  own - see columnForStatus. */
export const BOARD_COLUMNS: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.VIEWING_SCHEDULED,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED,
  LeadStatus.LOST
];

export function columnForStatus(status: LeadStatus): LeadStatus {
  if (status === LeadStatus.ASSIGNED) return LeadStatus.NEW;
  if (status === LeadStatus.VIEWING_REQUESTED) return LeadStatus.VIEWING_SCHEDULED;
  return status;
}

export function isClosedStatus(status: LeadStatus): boolean {
  return status === LeadStatus.CONVERTED || status === LeadStatus.LOST;
}

/** A lead somebody still has to work: not archived, not won, not lost. */
export function isOpenLead(lead: Pick<Lead, "status" | "isArchived">): boolean {
  return !lead.isArchived && !isClosedStatus(lead.status);
}

// ---------------------------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** commission = value x rate%, to 2 decimals. */
export function computeCommission(dealValue: number, ratePercent: number): number {
  return round2((dealValue * ratePercent) / 100);
}

export interface MonthlySummaryRow {
  month: string; // YYYY-MM
  deals: number;
  saleValue: number;
  rentValue: number;
  commissionTotal: number;
  commissionReceived: number;
  commissionExpected: number;
}

/** One row per month of closing, newest first. Cancelled deals are ignored. */
export function monthlySummary(deals: Deal[]): MonthlySummaryRow[] {
  const byMonth = new Map<string, MonthlySummaryRow>();
  for (const d of deals) {
    if (d.status === "CANCELLED") continue;
    const month = (d.closedDate || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    let row = byMonth.get(month);
    if (!row) {
      row = { month, deals: 0, saleValue: 0, rentValue: 0, commissionTotal: 0, commissionReceived: 0, commissionExpected: 0 };
      byMonth.set(month, row);
    }
    row.deals += 1;
    if (d.dealType === "SALE") row.saleValue = round2(row.saleValue + d.dealValue);
    else row.rentValue = round2(row.rentValue + d.dealValue);
    row.commissionTotal = round2(row.commissionTotal + d.commissionAmount);
    if (d.commissionStatus === "RECEIVED") row.commissionReceived = round2(row.commissionReceived + d.commissionAmount);
    else row.commissionExpected = round2(row.commissionExpected + d.commissionAmount);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

// ---------------------------------------------------------------------------------------------
// CSV (opens correctly in Excel, including Arabic)
// ---------------------------------------------------------------------------------------------

// A clean international phone number is safe even though it starts with "+".
const PLAIN_PHONE = /^\+[0-9][0-9 ()-]*$/;

/**
 * One CSV cell. Visitor-supplied text (names, messages) ends up in these files, and a cell that
 * starts with = + - @ (or a tab/CR) is run as a FORMULA by Excel and Google Sheets - the classic
 * "CSV injection". Such cells get a leading apostrophe, which makes spreadsheets treat them as
 * plain text. Real numbers are written as they are.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !PLAIN_PHONE.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** CSV text with a UTF-8 byte-order mark (so Excel reads Arabic correctly) and CRLF line ends. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map(r => r.map(csvCell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------------------------
// Qatar time (UTC+3, no daylight saving) - reminders must follow the agent's day, not the server's
// ---------------------------------------------------------------------------------------------

const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** YYYY-MM-DD in Qatar for a moment in time. */
export function qatarDate(now: Date | number): string {
  const t = typeof now === "number" ? now : now.getTime();
  return new Date(t + QATAR_OFFSET_MS).toISOString().slice(0, 10);
}

export function qatarHour(now: Date | number): number {
  const t = typeof now === "number" ? now : now.getTime();
  return new Date(t + QATAR_OFFSET_MS).getUTCHours();
}

export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Reminder emails are not sent overnight: nothing goes out between 21:00 and 07:00 in Qatar. */
export function isQuietHourInQatar(now: Date | number): boolean {
  const h = qatarHour(now);
  return h < 7 || h >= 21;
}

// ---------------------------------------------------------------------------------------------
// Who is due a reminder
// ---------------------------------------------------------------------------------------------

export type ReminderReason = "follow_up_due" | "follow_up_overdue" | "unanswered" | "no_activity";
export interface DueLead {
  lead: Lead;
  reason: ReminderReason;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** After this many automatic "no activity" nudges the system stops nagging about a lead. */
export const AUTO_NUDGE_MAX = 3;

/**
 * Leads that deserve a reminder email right now:
 *  - follow_up_due:     the date the agent set has arrived (once per date).
 *  - follow_up_overdue: that date passed and nothing happened - repeated every 3 days.
 *  - unanswered:        still NEW/ASSIGNED a full day after arriving, nobody has replied.
 *  - no_activity:       in progress but untouched for 3 days.
 * Repeats (overdue / unanswered / no_activity) stop after AUTO_NUDGE_MAX nudges, unanswered and
 * no_activity are skipped while the agent has a future follow-up date planned (they already
 * decided when to come back), and nothing is sent for archived, won or lost leads.
 */
export function leadsDueForReminder(leads: Lead[], now: number): DueLead[] {
  const due: DueLead[] = [];
  for (const lead of leads) {
    if (!isOpenLead(lead)) continue;
    const lastReminder = lead.lastReminderAt ? Date.parse(lead.lastReminderAt) : NaN;

    if (lead.nextFollowUpDate) {
      const when = Date.parse(lead.nextFollowUpDate);
      if (!Number.isNaN(when)) {
        if (when <= now) {
          if (Number.isNaN(lastReminder) || lastReminder < when) {
            due.push({ lead, reason: "follow_up_due" });
          } else if (now - lastReminder >= 3 * DAY && (lead.reminderCount ?? 0) < AUTO_NUDGE_MAX) {
            due.push({ lead, reason: "follow_up_overdue" });
          }
        }
        // a follow-up date is set: that decides, no automatic nudges either way
        continue;
      }
    }

    const lastActivity = Date.parse(lead.updatedDate || lead.createdDate);
    if (Number.isNaN(lastActivity)) continue;
    const sent = lead.reminderCount ?? 0;
    if (sent >= AUTO_NUDGE_MAX) continue;

    const waiting = lead.status === LeadStatus.NEW || lead.status === LeadStatus.ASSIGNED;
    const idleLimit = waiting ? DAY : 3 * DAY;
    const repeatEvery = waiting ? 2 * DAY : 3 * DAY;
    if (now - lastActivity < idleLimit) continue;
    if (!Number.isNaN(lastReminder) && now - lastReminder < repeatEvery) continue;
    due.push({ lead, reason: waiting ? "unanswered" : "no_activity" });
  }
  return due;
}

/** The reminder key a viewing was (or will be) reminded for - changes when it is rescheduled. */
export function viewingReminderKey(v: Pick<ViewingRequest, "preferredDate" | "preferredTimeSlot">): string {
  return `${v.preferredDate}|${v.preferredTimeSlot}`;
}

/** Confirmed viewings happening today or tomorrow (Qatar time) that haven't been reminded yet. */
export function viewingsDueForReminder(viewings: ViewingRequest[], now: number): ViewingRequest[] {
  const today = qatarDate(now);
  const tomorrow = addDaysToDate(today, 1);
  return viewings.filter(
    v =>
      v.status === "CONFIRMED" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.preferredDate) &&
      v.preferredDate >= today &&
      v.preferredDate <= tomorrow &&
      v.reminderSentFor !== viewingReminderKey(v)
  );
}
