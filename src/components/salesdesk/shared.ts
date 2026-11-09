// Shared types, labels and small helpers for the Sales Desk screens.

import { Deal, Lead, LeadStatus, ViewingRequest } from "../../types.js";
import { qatarDate } from "../../lib/crm.js";

export type DeskLead = Lead & { propertyTitle: string; agentName: string };
export type DeskViewing = ViewingRequest & {
  propertyTitle: string;
  agentName: string;
  visitorName: string;
  visitorPhone: string;
  visitorWhatsapp: string;
};
export type DeskDeal = Deal & { agentName: string };

export interface DeskOverview {
  leads: DeskLead[];
  viewings: DeskViewing[];
  deals: DeskDeal[];
  settings: { followUpRemindersEnabled: boolean };
  isOrgAdmin: boolean;
  canEditDeals: boolean;
  team: { id: string; fullName: string }[];
}

/** Pick the English or Arabic text. */
export type T = (en: string, ar: string) => string;

export const STAGE_TEXT: Record<string, { en: string; ar: string }> = {
  NEW: { en: "New", ar: "جديد" },
  ASSIGNED: { en: "Assigned", ar: "مُسند" },
  CONTACTED: { en: "Contacted", ar: "تم التواصل" },
  VIEWING_REQUESTED: { en: "Viewing requested", ar: "طلب معاينة" },
  VIEWING_SCHEDULED: { en: "Viewing", ar: "معاينة" },
  NEGOTIATION: { en: "Negotiation", ar: "تفاوض" },
  CONVERTED: { en: "Won", ar: "تمت الصفقة" },
  LOST: { en: "Lost", ar: "خسارة" }
};

export const STAGE_ACCENT: Record<string, string> = {
  NEW: "border-t-red-400",
  CONTACTED: "border-t-amber-400",
  VIEWING_SCHEDULED: "border-t-sky-400",
  NEGOTIATION: "border-t-violet-400",
  CONVERTED: "border-t-emerald-500",
  LOST: "border-t-gray-400"
};

export const VIEWING_STATUS_TEXT: Record<string, { en: string; ar: string }> = {
  REQUESTED: { en: "Requested", ar: "مطلوبة" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكدة" },
  RESCHEDULED: { en: "Rescheduled", ar: "أُعيد جدولتها" },
  COMPLETED: { en: "Done", ar: "تمت" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" }
};

export async function deskApi<R = any>(path: string, init: RequestInit = {}): Promise<R> {
  const token = localStorage.getItem("token");
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as R;
}

/** Western digits in both languages, to match the rest of the site. */
function locale(isRtl: boolean) {
  return isRtl ? "ar-QA-u-nu-latn" : "en-GB";
}

/** "10 Nov" / "10 نوفمبر" from a YYYY-MM-DD string or an ISO timestamp (as a Qatar date). */
export function fmtDay(value: string | undefined, isRtl: boolean): string {
  if (!value) return "";
  const day = value.length > 10 ? qatarDate(Date.parse(value)) : value;
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale(isRtl), { day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtFullDay(value: string, isRtl: boolean): string {
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale(isRtl), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function fmtMoney(n: number, isRtl: boolean): string {
  return `${Number(n || 0).toLocaleString(isRtl ? "ar-QA-u-nu-latn" : "en-US", { maximumFractionDigits: 2 })} ${isRtl ? "ر.ق" : "QAR"}`;
}

/** How long ago, in plain words. */
export function ago(iso: string, isRtl: boolean): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return isRtl ? `منذ ${Math.max(1, mins)} د` : `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return isRtl ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return isRtl ? `منذ ${days} يوم` : `${days}d ago`;
}

export function waLink(phone: string | undefined, text: string): string | undefined {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : undefined;
}

export function leadPhone(l: Lead): string {
  return l.visitorWhatsapp || l.visitorPhone || "";
}

/** The Qatar calendar day the follow-up falls on. */
export function followUpDay(l: Lead): string | undefined {
  return l.nextFollowUpDate ? qatarDate(Date.parse(l.nextFollowUpDate)) : undefined;
}

/** Trigger a browser download of a CSV the server builds (needs the auth header, so not a plain link). */
export async function downloadCsv(kind: string, from: string, to: string): Promise<void> {
  const token = localStorage.getItem("token");
  const qs = new URLSearchParams({ kind });
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`/api/crm/export?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let message = "Export failed";
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nerou-${kind}-${qatarDate(Date.now())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const OPEN_STAGE_VALUES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.VIEWING_SCHEDULED,
  LeadStatus.NEGOTIATION
];
