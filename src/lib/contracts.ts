// Signed contracts kept against the clients who subscribed (platform admin only): checking what the admin typed in, how
// long a contract has left, and which subscribed clients have no contract on file yet. Pure functions, unit tested.

import type { ContractKind, Prospect, ProspectContract } from "../types.js";
import { daysBetween, qatarDate } from "./crm.js";

export const CONTRACT_KINDS: ContractKind[] = ["SUBSCRIPTION", "RENEWAL", "ADDENDUM", "OTHER"];
export const CONTRACT_KIND_TEXT: Record<ContractKind, { en: string; ar: string }> = {
  SUBSCRIPTION: { en: "Subscription agreement", ar: "عقد اشتراك" },
  RENEWAL: { en: "Renewal", ar: "تجديد" },
  ADDENDUM: { en: "Addendum", ar: "ملحق" },
  OTHER: { en: "Other", ar: "أخرى" }
};

/** What the file picker accepts (the server checks the real file bytes, not just the name). */
export const CONTRACT_FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const CONTRACT_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_CONTRACTS_PER_CLIENT = 25;
export const ENDING_SOON_DAYS = 30;

export interface ContractInput {
  title: string;
  kind: ContractKind;
  planId?: string;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  monthlyValue?: number;
  notes?: string;
}
export type ContractValidation = { ok: true; value: ContractInput } | { ok: false; error: string };

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime())
  && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d; // 2026-02-31 is not a date

export function validateContractInput(raw: Record<string, unknown>): ContractValidation {
  const title = text(raw.title, 120);
  if (!title) return { ok: false, error: "Give the contract a title." };

  const kind = CONTRACT_KINDS.includes(raw.kind as ContractKind) ? (raw.kind as ContractKind) : "SUBSCRIPTION";

  const dates: Record<"signedDate" | "startDate" | "endDate", string | undefined> = { signedDate: undefined, startDate: undefined, endDate: undefined };
  const label = { signedDate: "signing", startDate: "start", endDate: "end" } as const;
  for (const k of ["signedDate", "startDate", "endDate"] as const) {
    const v = raw[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !validDate(v.trim())) return { ok: false, error: `The ${label[k]} date must look like 2026-12-31.` };
    dates[k] = v.trim();
  }
  if (dates.startDate && dates.endDate && dates.endDate < dates.startDate) return { ok: false, error: "The end date is before the start date." };

  let monthlyValue: number | undefined;
  if (raw.monthlyValue !== undefined && raw.monthlyValue !== null && raw.monthlyValue !== "") {
    const n = Number(raw.monthlyValue);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: "The monthly value must be a positive number." };
    monthlyValue = n;
  }

  return { ok: true, value: { title, kind, ...dates, monthlyValue, planId: text(raw.planId, 60), notes: text(raw.notes, 1000) } };
}

export type ContractState = "NO_END" | "ACTIVE" | "ENDING_SOON" | "EXPIRED";

/** Where a contract stands today: no end date, running, ending within 30 days, or past its end date. */
export function contractState(c: Pick<ProspectContract, "endDate">, now: number): { state: ContractState; daysLeft: number | null } {
  if (!c.endDate) return { state: "NO_END", daysLeft: null };
  const left = daysBetween(qatarDate(now), c.endDate);
  if (left < 0) return { state: "EXPIRED", daysLeft: left };
  return { state: left <= ENDING_SOON_DAYS ? "ENDING_SOON" : "ACTIVE", daysLeft: left };
}

/** The contract that matters right now: the one running longest into the future; an expired one only if nothing else is left. */
export function currentContract(contracts: ProspectContract[] | undefined, now: number): ProspectContract | undefined {
  const list = contracts || [];
  const live = list.filter(c => contractState(c, now).state !== "EXPIRED");
  const pool = live.length ? live : list;
  return [...pool].sort((a, b) => (b.endDate || "9999-12-31").localeCompare(a.endDate || "9999-12-31") || b.uploadedAt.localeCompare(a.uploadedAt))[0];
}

/** A client who subscribed but nothing signed is on file: someone has to go and get the paper. */
export const needsContract = (p: Pick<Prospect, "stage" | "contracts">): boolean => p.stage === "WON" && !(p.contracts && p.contracts.length > 0);

/** A subscribed client whose current contract is about to end or has already ended: time to renew. */
export function contractNeedsRenewal(p: Pick<Prospect, "stage" | "contracts">, now: number): boolean {
  if (p.stage !== "WON") return false;
  const cur = currentContract(p.contracts, now);
  return !!cur && ["ENDING_SOON", "EXPIRED"].includes(contractState(cur, now).state);
}

export interface ContractStats {
  subscribed: number; // clients at the Subscribed stage
  withContract: number;
  missing: number; // subscribed, no contract on file
  endingSoon: number; // subscribed clients whose current contract ends within 30 days
  expired: number; // subscribed clients whose newest contract is already over
}

export function contractStats(prospects: Prospect[], now: number): ContractStats {
  const won = prospects.filter(p => p.stage === "WON");
  let withContract = 0, endingSoon = 0, expired = 0;
  for (const p of won) {
    const cur = currentContract(p.contracts, now);
    if (!cur) continue;
    withContract += 1;
    const s = contractState(cur, now).state;
    if (s === "ENDING_SOON") endingSoon += 1;
    if (s === "EXPIRED") expired += 1;
  }
  return { subscribed: won.length, withContract, missing: won.length - withContract, endingSoon, expired };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
