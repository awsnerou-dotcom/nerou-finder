// Plain-language names for the statuses the dashboards show, in both languages (they used to print the raw
// ENUM_VALUE), and a short "2 h ago" for when an enquiry arrived. Pure functions, unit tested.

import { LeadStatus, ListingStatus } from "../types.js";

const LEAD: Record<string, { en: string; ar: string }> = {
  [LeadStatus.NEW]: { en: "New", ar: "جديد" },
  [LeadStatus.ASSIGNED]: { en: "Assigned", ar: "مُسند" },
  [LeadStatus.CONTACTED]: { en: "Contacted", ar: "تم التواصل" },
  [LeadStatus.VIEWING_REQUESTED]: { en: "Viewing requested", ar: "طلب معاينة" },
  [LeadStatus.VIEWING_SCHEDULED]: { en: "Viewing scheduled", ar: "معاينة محددة" },
  [LeadStatus.NEGOTIATION]: { en: "Negotiating", ar: "قيد التفاوض" },
  [LeadStatus.CONVERTED]: { en: "Won", ar: "تمت الصفقة" },
  [LeadStatus.LOST]: { en: "Lost", ar: "مفقود" }
};

const LISTING: Record<string, { en: string; ar: string }> = {
  [ListingStatus.DRAFT]: { en: "Draft", ar: "مسودة" },
  [ListingStatus.PENDING_REVIEW]: { en: "In review", ar: "قيد المراجعة" },
  [ListingStatus.PUBLISHED]: { en: "Live", ar: "منشور" },
  [ListingStatus.PAUSED]: { en: "Paused", ar: "متوقف" },
  [ListingStatus.SOLD]: { en: "Sold", ar: "مباع" },
  [ListingStatus.RENTED]: { en: "Rented", ar: "مؤجر" },
  [ListingStatus.SUSPENDED]: { en: "Suspended", ar: "معلّق" }
};

function pretty(raw: string) {
  const s = raw.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function leadStatusLabel(status: string, isRtl: boolean): string {
  const l = LEAD[status];
  return l ? (isRtl ? l.ar : l.en) : pretty(status);
}

export function listingStatusLabel(status: string, isRtl: boolean): string {
  const l = LISTING[status];
  return l ? (isRtl ? l.ar : l.en) : pretty(status);
}

/** "5 min ago", "3 h ago", "2 d ago", then the date. Empty when the date is unusable. */
export function timeAgo(iso: string | undefined, now: number, isRtl: boolean): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return isRtl ? "الآن" : "just now";
  if (mins < 60) return isRtl ? `منذ ${mins} د` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isRtl ? `منذ ${hours} س` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return isRtl ? `منذ ${days} يوم` : `${days} d ago`;
  return new Date(t).toLocaleDateString(isRtl ? "ar" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
