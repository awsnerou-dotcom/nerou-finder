// Sales-desk (CRM) rules that don't need the database: pipeline stages, commission math, CSV
// writing, Qatar-time helpers and "who is due a reminder". Kept free of server code so the same
// logic can be unit tested and shared with the browser.

import { Deal, Lead, LeadSource, LeadStatus, ViewingRequest } from "../types.js";

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

// ---------------------------------------------------------------------------------------------
// Clients registered by hand (not from the platform)
// ---------------------------------------------------------------------------------------------

export const LEAD_SOURCES: LeadSource[] = [
  "WHATSAPP", "PHONE_CALL", "WALK_IN", "REFERRAL", "INSTAGRAM", "FACEBOOK", "OTHER_PORTAL", "OTHER"
];

export const LEAD_SOURCE_TEXT: Record<LeadSource, { en: string; ar: string }> = {
  WHATSAPP: { en: "WhatsApp", ar: "واتساب" },
  PHONE_CALL: { en: "Phone call", ar: "اتصال هاتفي" },
  WALK_IN: { en: "Walk-in / office visit", ar: "زيارة للمكتب" },
  REFERRAL: { en: "Referral", ar: "توصية / إحالة" },
  INSTAGRAM: { en: "Instagram", ar: "إنستغرام" },
  FACEBOOK: { en: "Facebook", ar: "فيسبوك" },
  OTHER_PORTAL: { en: "Another property portal", ar: "منصة عقارية أخرى" },
  OTHER: { en: "Other", ar: "أخرى" }
};

/** Everything an agent can tell us about a client they register themselves. */
export interface ClientInput {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  source: LeadSource;
  interest?: string;
  budget?: number;
  notes?: string;
}

const PHONE_OK = /^[+0-9 ()-]{5,25}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Arabic-Indic and Persian digits -> 0-9 (clients' numbers are often typed on an Arabic keyboard). */
export function westernDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0));
}

/** What identifies the same person by phone: the last 8 digits (ignores +974 / 00974 / spaces). */
export function phoneKey(phone: string | undefined): string {
  const digits = westernDigits(phone || "").replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-8) : "";
}

function cleanText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

function cleanPhone(v: unknown): string | undefined | "invalid" {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" && typeof v !== "number") return "invalid";
  const s = westernDigits(String(v)).trim();
  if (!s) return undefined;
  return PHONE_OK.test(s) && s.replace(/\D/g, "").length >= 5 ? s : "invalid";
}

export type ClientValidation = { ok: true; value: ClientInput } | { ok: false; error: string };

/** Checks and cleans one client. Needs a name and at least one way to reach them. */
export function validateClientInput(raw: Record<string, unknown>): ClientValidation {
  const name = cleanText(raw.name, 120);
  if (!name) return { ok: false, error: "A name is required." };

  const phone = cleanPhone(raw.phone);
  const whatsapp = cleanPhone(raw.whatsapp);
  if (phone === "invalid") return { ok: false, error: "The phone number is not valid." };
  if (whatsapp === "invalid") return { ok: false, error: "The WhatsApp number is not valid." };

  let email: string | undefined;
  if (raw.email !== undefined && raw.email !== null && String(raw.email).trim() !== "") {
    email = String(raw.email).trim().toLowerCase();
    if (email.length > 120 || !EMAIL_OK.test(email)) return { ok: false, error: "The email address is not valid." };
  }
  if (!phone && !whatsapp && !email) return { ok: false, error: "Add a phone number, WhatsApp or email so you can reach this client." };

  let source: LeadSource = "OTHER";
  if (raw.source !== undefined && raw.source !== null && raw.source !== "") {
    if (!LEAD_SOURCES.includes(raw.source as LeadSource)) return { ok: false, error: "Unknown source." };
    source = raw.source as LeadSource;
  }

  let budget: number | undefined;
  if (raw.budget !== undefined && raw.budget !== null && raw.budget !== "") {
    const n = Number(raw.budget);
    if (!Number.isFinite(n) || n < 0 || n > 1e11) return { ok: false, error: "The budget must be a positive number." };
    budget = n || undefined;
  }

  return {
    ok: true,
    value: { name, phone, whatsapp, email, source, interest: cleanText(raw.interest, 300), budget, notes: cleanText(raw.notes, 1000) }
  };
}

// ---------------------------------------------------------------------------------------------
// CSV import (an agent's existing client list, from Excel or Google Sheets)
// ---------------------------------------------------------------------------------------------

/** Reads CSV text into rows. Handles a BOM, quoted cells with commas/quotes/line breaks, CRLF, and
 *  the semicolon or tab separators Excel uses in many regional settings. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a byte-order mark
  // choose the separator by counting candidates on the first line, outside quotes
  const firstLine = (() => {
    let inQ = false, out = "";
    for (const ch of src) {
      if (ch === '"') inQ = !inQ;
      if (!inQ && (ch === "\n" || ch === "\r")) break;
      out += ch;
    }
    return out;
  })();
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = count(";") > count(",") && count(";") >= count("\t") ? ";" : count("\t") > count(",") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

const normHeader = (s: string) =>
  s.toLowerCase().replace(/[\s_\-./:()]+/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "client", "clientname", "customer", "الاسم", "اسم", "العميل", "اسمالعميل", "الاسمالكامل"],
  phone: ["phone", "mobile", "tel", "telephone", "phonenumber", "mobilenumber", "الهاتف", "الجوال", "رقمالهاتف", "رقمالجوال", "موبايل", "هاتف"],
  whatsapp: ["whatsapp", "wa", "واتساب", "واتس", "رقمالواتساب"],
  email: ["email", "mail", "emailaddress", "البريد", "الايميل", "بريد", "البريدالالكتروني", "ايميل"],
  source: ["source", "origin", "channel", "المصدر", "مصدر"],
  interest: ["interest", "property", "requirement", "looking", "lookingfor", "الاهتمام", "العقار", "الطلب", "المطلوب"],
  budget: ["budget", "الميزانيه", "ميزانيه", "السعر"],
  notes: ["notes", "note", "comments", "comment", "remarks", "ملاحظات", "ملاحظه"]
};

/** Free text from a spreadsheet's "Source" column -> one of our sources. */
export function guessSource(text: string | undefined): LeadSource | undefined {
  const t = normHeader(text || "");
  if (!t) return undefined;
  if (/واتس|whats|^wa$/.test(t)) return "WHATSAPP";
  if (/اتصال|هاتف|call|phone|tel/.test(t)) return "PHONE_CALL";
  if (/walk|office|visit|زيار|مكتب/.test(t)) return "WALK_IN";
  if (/refer|recommend|friend|توصي|احال|صديق/.test(t)) return "REFERRAL";
  if (/insta|انستا|انستغرام/.test(t)) return "INSTAGRAM";
  if (/face|فيس|fb/.test(t)) return "FACEBOOK";
  if (/portal|bayut|propertyfinder|mourjan|dubizzle|qatarliving|موقع|منصه/.test(t)) return "OTHER_PORTAL";
  return "OTHER";
}

export interface CsvClientsResult {
  clients: Record<string, unknown>[];
  /** Which columns of the file were recognised (for showing the agent what was understood). */
  recognised: string[];
  error?: string;
}

/** Turns the rows of a spreadsheet (first row = headers) into raw clients, ready for validateClientInput. */
export function rowsToClients(table: string[][]): CsvClientsResult {
  if (table.length < 2) return { clients: [], recognised: [], error: "The file has no client rows." };
  const headers = table[0].map(normHeader);
  const colOf: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = headers.findIndex(h => aliases.map(normHeader).includes(h));
    if (idx >= 0) colOf[field] = idx;
  }
  if (colOf.name === undefined) {
    return { clients: [], recognised: [], error: "No name column found. The first row must have headers such as Name, Phone, WhatsApp, Email." };
  }
  const get = (r: string[], f: string) => (colOf[f] !== undefined ? (r[colOf[f]] ?? "").trim() : "");
  const clients = table.slice(1).map(r => {
    const budgetText = westernDigits(get(r, "budget")).replace(/[^\d.]/g, "");
    return {
      name: get(r, "name"),
      phone: get(r, "phone"),
      whatsapp: get(r, "whatsapp"),
      email: get(r, "email"),
      source: guessSource(get(r, "source")),
      interest: get(r, "interest"),
      budget: budgetText ? Number(budgetText) : undefined,
      notes: get(r, "notes")
    };
  });
  return { clients, recognised: Object.keys(colOf) };
}
