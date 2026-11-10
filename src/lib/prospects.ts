// Rules for the platform sales pipeline (admin only) that don't need the database: stages,
// validating what an admin types in, who is due a follow-up reminder, the numbers shown on the
// dashboard, CSV import and export. Pure functions, unit tested.

import type { Prospect, ProspectKind, ProspectSource, ProspectStage } from "../types.js";
import { addDaysToDate, daysBetween, parseCsv, phoneKey, qatarDate, toCsv, westernDigits } from "./crm.js";

export const PROSPECT_STAGES: ProspectStage[] = ["NEW", "CONTACTED", "DEMO", "TRIAL", "NEGOTIATION", "WON", "LOST"];
export const OPEN_STAGES: ProspectStage[] = ["NEW", "CONTACTED", "DEMO", "TRIAL", "NEGOTIATION"];
export const PROSPECT_KINDS: ProspectKind[] = ["AGENT", "AGENCY", "DEVELOPER", "OTHER"];
export const PROSPECT_SOURCES: ProspectSource[] = ["REFERRAL", "WEBSITE", "WHATSAPP", "PHONE", "EVENT", "SOCIAL", "COLD_OUTREACH", "SIGNUP", "OTHER"];

export const STAGE_TEXT: Record<ProspectStage, { en: string; ar: string }> = {
  NEW: { en: "New", ar: "جديد" },
  CONTACTED: { en: "Contacted", ar: "تم التواصل" },
  DEMO: { en: "Demo / meeting", ar: "عرض / اجتماع" },
  TRIAL: { en: "On free trial", ar: "في التجربة المجانية" },
  NEGOTIATION: { en: "Negotiating", ar: "تفاوض" },
  WON: { en: "Subscribed", ar: "اشترك" },
  LOST: { en: "Lost", ar: "خسرناه" }
};
export const KIND_TEXT: Record<ProspectKind, { en: string; ar: string }> = {
  AGENT: { en: "Agent", ar: "وسيط" },
  AGENCY: { en: "Agency", ar: "مكتب عقاري" },
  DEVELOPER: { en: "Developer", ar: "مطور" },
  OTHER: { en: "Other", ar: "أخرى" }
};
export const SOURCE_TEXT: Record<ProspectSource, { en: string; ar: string }> = {
  REFERRAL: { en: "Referral", ar: "توصية" },
  WEBSITE: { en: "Website", ar: "الموقع" },
  WHATSAPP: { en: "WhatsApp", ar: "واتساب" },
  PHONE: { en: "Phone call", ar: "اتصال" },
  EVENT: { en: "Event", ar: "فعالية" },
  SOCIAL: { en: "Social media", ar: "السوشيال ميديا" },
  COLD_OUTREACH: { en: "Our outreach", ar: "تواصلنا نحن" },
  SIGNUP: { en: "Signed up on site", ar: "سجّل في الموقع" },
  OTHER: { en: "Other", ar: "أخرى" }
};

export const isOpenProspect = (p: Pick<Prospect, "stage">): boolean => OPEN_STAGES.includes(p.stage);

// ---------------------------------------------------------------------------------------------
// Validating input
// ---------------------------------------------------------------------------------------------

export interface ProspectInput {
  name: string;
  company?: string;
  kind: ProspectKind;
  email?: string;
  phone?: string;
  whatsapp?: string;
  source: ProspectSource;
  interestedPlanId?: string;
  expectedMonthly?: number;
  nextFollowUp?: string;
  followUpNote?: string;
  notes?: string;
}
export type ProspectValidation = { ok: true; value: ProspectInput } | { ok: false; error: string };

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime());

export function validateProspectInput(raw: Record<string, unknown>): ProspectValidation {
  const name = text(raw.name, 120);
  if (!name) return { ok: false, error: "A name is required." };

  const email = text(raw.email, 160)?.toLowerCase();
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address doesn't look right." };

  const phoneOf = (v: unknown, label: string): { v?: string; error?: string } => {
    const t = text(v, 40);
    if (!t) return {};
    if (westernDigits(t).replace(/\D/g, "").length < 5) return { error: `The ${label} number looks too short.` };
    return { v: t };
  };
  const phone = phoneOf(raw.phone, "phone");
  if (phone.error) return { ok: false, error: phone.error };
  const whatsapp = phoneOf(raw.whatsapp, "WhatsApp");
  if (whatsapp.error) return { ok: false, error: whatsapp.error };

  if (!email && !phone.v && !whatsapp.v) return { ok: false, error: "Add at least one way to reach them: email, phone or WhatsApp." };

  const kind = PROSPECT_KINDS.includes(raw.kind as ProspectKind) ? (raw.kind as ProspectKind) : "OTHER";
  const source = PROSPECT_SOURCES.includes(raw.source as ProspectSource) ? (raw.source as ProspectSource) : "OTHER";

  let expectedMonthly: number | undefined;
  if (raw.expectedMonthly !== undefined && raw.expectedMonthly !== null && raw.expectedMonthly !== "") {
    const n = Number(raw.expectedMonthly);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: "The expected monthly value must be a positive number." };
    expectedMonthly = n;
  }

  let nextFollowUp: string | undefined;
  if (typeof raw.nextFollowUp === "string" && raw.nextFollowUp.trim()) {
    if (!validDate(raw.nextFollowUp.trim())) return { ok: false, error: "The follow-up date must look like 2026-12-31." };
    nextFollowUp = raw.nextFollowUp.trim();
  }

  return {
    ok: true,
    value: {
      name, kind, source, email,
      company: text(raw.company, 120),
      phone: phone.v,
      whatsapp: whatsapp.v,
      interestedPlanId: text(raw.interestedPlanId, 60),
      expectedMonthly,
      nextFollowUp,
      followUpNote: text(raw.followUpNote, 300),
      notes: text(raw.notes, 4000)
    }
  };
}

/** Same person already in the pipeline? Matches on email or phone/WhatsApp number. */
export function findDuplicateProspect(existing: Prospect[], candidate: Pick<ProspectInput, "email" | "phone" | "whatsapp">, ignoreId?: string): Prospect | undefined {
  const keys = new Set([phoneKey(candidate.phone), phoneKey(candidate.whatsapp)].filter(Boolean));
  const email = candidate.email?.toLowerCase();
  return existing.find(p => {
    if (p.id === ignoreId) return false;
    if (email && p.email?.toLowerCase() === email) return true;
    return [phoneKey(p.phone), phoneKey(p.whatsapp)].some(k => k && keys.has(k));
  });
}

// ---------------------------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------------------------

export type ProspectReminderReason = "due" | "overdue" | "stale";
export interface ProspectDue { prospect: Prospect; reason: ProspectReminderReason; daysOverdue: number }

export const STALE_AFTER_DAYS = 7;
export const STALE_NUDGE_MAX = 3;

/**
 * Open prospects the owner should hear about today:
 *  - follow-up date is today ("due") or passed ("overdue"), at most one email a day;
 *  - no follow-up booked and nobody has touched them for 7 days ("stale"), at most 3 nudges.
 */
export function prospectsDueForReminder(prospects: Prospect[], now: number): ProspectDue[] {
  const today = qatarDate(now);
  const out: ProspectDue[] = [];
  for (const p of prospects) {
    if (!isOpenProspect(p)) continue;
    const remindedToday = !!p.lastReminderAt && qatarDate(new Date(p.lastReminderAt)) === today;
    if (remindedToday) continue;
    if (p.nextFollowUp) {
      if (p.nextFollowUp <= today) {
        const late = daysBetween(p.nextFollowUp, today);
        out.push({ prospect: p, reason: late > 0 ? "overdue" : "due", daysOverdue: late });
      }
      continue;
    }
    const lastTouch = qatarDate(new Date(p.lastContactAt || p.updatedAt || p.createdAt));
    if (daysBetween(lastTouch, today) >= STALE_AFTER_DAYS && (p.reminderCount ?? 0) < STALE_NUDGE_MAX) {
      out.push({ prospect: p, reason: "stale", daysOverdue: daysBetween(lastTouch, today) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Numbers for the dashboard
// ---------------------------------------------------------------------------------------------

export interface SourceRow { source: ProspectSource; total: number; won: number; lost: number; open: number }
export interface ProspectStats {
  open: number;
  dueNow: number;
  pipelineMonthly: number; // QAR per month if every open prospect subscribed
  wonThisMonth: number;
  wonThisMonthMonthly: number;
  conversionPercent: number | null; // won / (won + lost), null until something has closed
  byStage: Record<ProspectStage, number>;
  bySource: SourceRow[];
}

export function prospectStats(prospects: Prospect[], now: number): ProspectStats {
  const today = qatarDate(now);
  const month = today.slice(0, 7);
  const byStage = Object.fromEntries(PROSPECT_STAGES.map(s => [s, 0])) as Record<ProspectStage, number>;
  const bySource = new Map<ProspectSource, SourceRow>();
  let open = 0, dueNow = 0, pipelineMonthly = 0, wonThisMonth = 0, wonThisMonthMonthly = 0, won = 0, lost = 0;

  for (const p of prospects) {
    byStage[p.stage] += 1;
    let row = bySource.get(p.source);
    if (!row) { row = { source: p.source, total: 0, won: 0, lost: 0, open: 0 }; bySource.set(p.source, row); }
    row.total += 1;
    if (isOpenProspect(p)) {
      open += 1; row.open += 1;
      pipelineMonthly += p.expectedMonthly || 0;
      if (p.nextFollowUp && p.nextFollowUp <= today) dueNow += 1;
    } else if (p.stage === "WON") {
      won += 1; row.won += 1;
      if ((p.wonAt || p.updatedAt || "").slice(0, 7) === month) { wonThisMonth += 1; wonThisMonthMonthly += p.expectedMonthly || 0; }
    } else {
      lost += 1; row.lost += 1;
    }
  }
  return {
    open, dueNow, pipelineMonthly, wonThisMonth, wonThisMonthMonthly,
    conversionPercent: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
    byStage,
    bySource: [...bySource.values()].sort((a, b) => b.total - a.total)
  };
}

// ---------------------------------------------------------------------------------------------
// CSV in and out
// ---------------------------------------------------------------------------------------------

const ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "contact", "contact name", "الاسم", "اسم", "اسم العميل"],
  company: ["company", "agency", "business", "organisation", "organization", "الشركة", "المكتب", "الشركه"],
  kind: ["type", "kind", "role", "النوع", "نوع"],
  email: ["email", "e-mail", "mail", "الايميل", "البريد", "البريد الالكتروني", "الإيميل"],
  phone: ["phone", "mobile", "tel", "telephone", "number", "الجوال", "الهاتف", "رقم الجوال", "رقم الهاتف", "الموبايل"],
  whatsapp: ["whatsapp", "wa", "واتساب", "الواتساب", "واتس اب"],
  source: ["source", "channel", "المصدر", "مصدر"],
  notes: ["notes", "note", "comments", "remarks", "ملاحظات", "ملاحظة"]
};
const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, " ");

function guessKind(t: string): ProspectKind {
  const s = t.toLowerCase();
  if (/develop|مطور/.test(s)) return "DEVELOPER";
  if (/agency|office|مكتب|شركة|شركه/.test(s)) return "AGENCY";
  if (/agent|broker|وسيط|سمسار/.test(s)) return "AGENT";
  return "OTHER";
}
function guessSource(t: string): ProspectSource {
  const s = t.toLowerCase();
  if (/refer|توصي/.test(s)) return "REFERRAL";
  if (/web|site|موقع/.test(s)) return "WEBSITE";
  if (/whats|واتس/.test(s)) return "WHATSAPP";
  if (/phone|call|اتصال|هاتف/.test(s)) return "PHONE";
  if (/event|expo|معرض|فعالي/.test(s)) return "EVENT";
  if (/insta|face|social|linkedin|twitter|tiktok|سناب|انستا|فيس|تويتر/.test(s)) return "SOCIAL";
  if (/cold|outreach|تواصل/.test(s)) return "COLD_OUTREACH";
  return "OTHER";
}

export interface CsvProspectsResult { prospects: Record<string, unknown>[]; recognised: string[]; error?: string }

/** Rows of a spreadsheet (first row = headers) -> raw prospects, ready for validateProspectInput. */
export function rowsToProspects(table: string[][]): CsvProspectsResult {
  if (table.length < 2) return { prospects: [], recognised: [], error: "The file has no rows." };
  const headers = table[0].map(norm);
  const col: Record<string, number> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const i = headers.findIndex(h => names.map(norm).includes(h));
    if (i >= 0) col[field] = i;
  }
  if (col.name === undefined) return { prospects: [], recognised: [], error: "No name column found. The first row must have headers such as Name, Company, Phone, Email." };
  const get = (r: string[], f: string) => (col[f] !== undefined ? (r[col[f]] ?? "").trim() : "");
  return {
    recognised: Object.keys(col),
    prospects: table.slice(1).filter(r => r.some(c => c.trim())).map(r => ({
      name: get(r, "name"), company: get(r, "company"), kind: guessKind(get(r, "kind")),
      email: get(r, "email"), phone: get(r, "phone"), whatsapp: get(r, "whatsapp"),
      source: guessSource(get(r, "source")), notes: get(r, "notes")
    }))
  };
}
export const parseProspectsCsv = (text: string): CsvProspectsResult => rowsToProspects(parseCsv(text));

export function prospectsToCsv(prospects: Prospect[], ownerName: (id: string) => string): string {
  return toCsv(
    ["Name", "Company", "Type", "Email", "Phone", "WhatsApp", "Source", "Stage", "Owner", "Plan interest", "Expected QAR / month", "Next follow-up", "Last contact", "Added", "Notes", "Lost reason"],
    prospects.map(p => [
      p.name, p.company, KIND_TEXT[p.kind].en, p.email, p.phone, p.whatsapp, SOURCE_TEXT[p.source].en, STAGE_TEXT[p.stage].en,
      ownerName(p.ownerId), p.interestedPlanId, p.expectedMonthly, p.nextFollowUp, (p.lastContactAt || "").slice(0, 10), p.createdAt.slice(0, 10), p.notes, p.lostReason
    ])
  );
}

export { addDaysToDate };
