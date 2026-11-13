// Two small things the agent and subscriber dashboards were missing, both worked out only from real account data:
//   - a "complete your profile" checklist for an agent (what to do next to be found, trusted and listed), and
//   - a warning when a paid subscription has run out or is about to.
// Pure functions, unit tested.

import type { User } from "../types.js";

export type ChecklistTab = "verification" | "profile" | "properties";

export interface ChecklistItem {
  id: "verification" | "bio" | "languages" | "specialties" | "whatsapp" | "listing" | "published";
  done: boolean;
  tab: ChecklistTab;
  en: string;
  ar: string;
  hintEn: string;
  hintAr: string;
}

export interface Checklist {
  items: ChecklistItem[];
  done: number;
  total: number;
  percent: number;
}

const MIN_BIO = 40;

export function agentChecklist(
  agent: Pick<User, "verificationStatus" | "bio" | "languages" | "specialties" | "whatsapp">,
  counts: { listings: number; published: number }
): Checklist {
  const bio = (agent.bio || "").trim();
  const items: ChecklistItem[] = [
    { id: "verification", done: agent.verificationStatus === "APPROVED", tab: "verification",
      en: "Get your account verified", ar: "وثّق حسابك",
      hintEn: "Upload your documents. Verified agents are shown first and earn visitors' trust.", hintAr: "ارفع مستنداتك. الوكلاء الموثّقون يظهرون أولاً ويكسبون ثقة الزوار." },
    { id: "bio", done: bio.length >= MIN_BIO, tab: "profile",
      en: "Write a short bio", ar: "اكتب نبذة قصيرة",
      hintEn: `A few sentences about your experience (at least ${MIN_BIO} characters).`, hintAr: `بضع جمل عن خبرتك (لا تقل عن ${MIN_BIO} حرفاً).` },
    { id: "languages", done: (agent.languages || []).length > 0, tab: "profile",
      en: "Add the languages you speak", ar: "أضف اللغات التي تتحدثها",
      hintEn: "So clients know they can talk to you in their language.", hintAr: "ليعرف العملاء أنهم يستطيعون التحدث معك بلغتهم." },
    { id: "specialties", done: (agent.specialties || []).length > 0, tab: "profile",
      en: "Add your areas of expertise", ar: "أضف مجالات تخصصك",
      hintEn: "The areas and property types you know best.", hintAr: "المناطق وأنواع العقارات التي تعرفها جيداً." },
    { id: "whatsapp", done: !!(agent.whatsapp || "").trim(), tab: "profile",
      en: "Add your WhatsApp number", ar: "أضف رقم واتساب",
      hintEn: "Most enquiries arrive on WhatsApp.", hintAr: "معظم الاستفسارات تصل عبر واتساب." },
    { id: "listing", done: counts.listings > 0, tab: "properties",
      en: "Add your first property", ar: "أضف أول عقار",
      hintEn: "Photos, price and a clear description.", hintAr: "صور وسعر ووصف واضح." },
    { id: "published", done: counts.published > 0, tab: "properties",
      en: "Publish a property", ar: "انشر عقاراً",
      hintEn: "Only published properties are visible to visitors.", hintAr: "العقارات المنشورة فقط تظهر للزوار." }
  ];
  const done = items.filter(i => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

export const SUBSCRIPTION_WARNING_DAYS = 14;

export interface SubscriptionAlert {
  level: "expired" | "soon";
  /** whole days left (0 on the last day) for "soon"; whole days since it ended for "expired" */
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** null when there is no expiry date, it is invalid, or it is more than two weeks away. */
export function subscriptionAlert(expiry: string | undefined, now: number): SubscriptionAlert | null {
  if (!expiry) return null;
  let end = Date.parse(expiry);
  if (!Number.isFinite(end)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry.trim())) end += DAY_MS - 1; // a plain date runs to the end of that day
  if (now > end) return { level: "expired", days: Math.floor((now - end) / DAY_MS) };
  const left = Math.floor((end - now) / DAY_MS);
  return left <= SUBSCRIPTION_WARNING_DAYS ? { level: "soon", days: left } : null;
}
