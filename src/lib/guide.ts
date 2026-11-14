import { foldText } from "./listingFromText.js";

// The subscriber guide: what exists, who it is for, how it is searched, what to read next and what has been read.
// The words themselves live in guideContent.ts; this file has no React so all of it can be unit-tested.

export type GuideLang = "en" | "ar";
export interface Bi { en: string; ar: string }

/** Who is reading: an independent agent, an agent working for an agency, or the agency's own admin. */
export type Persona = "independent" | "agencyAgent" | "agencyAdmin";
export type GuideCategory = "start" | "listings" | "clients" | "growth" | "team" | "account";
export type GuideAccent = "indigo" | "emerald" | "amber" | "sky" | "teal" | "violet" | "rose" | "fuchsia" | "gold";

export interface GuideStep { title: Bi; body: Bi }

export interface GuideArticle {
  /** also the id of the picture drawn for it */
  id: string;
  category: GuideCategory;
  audience: Persona[];
  accent: GuideAccent;
  minutes: number;
  title: Bi;
  summary: Bi;
  /** why it is worth the time */
  why: Bi;
  steps: GuideStep[];
  tips: Bi[];
  /** the workspace section where this is done, per kind of workspace */
  goTo?: { agent?: string; agency?: string };
  /** a public page of the site that opens in a new tab (the price check is a public tool, not a workspace section) */
  link?: { path: string; label: Bi };
  related?: string[];
}

export const CATEGORIES: { id: GuideCategory; label: Bi }[] = [
  { id: "start", label: { en: "Getting started", ar: "البداية" } },
  { id: "listings", label: { en: "Listings", ar: "العقارات" } },
  { id: "clients", label: { en: "Clients & sales", ar: "العملاء والمبيعات" } },
  { id: "growth", label: { en: "Grow your reach", ar: "زيادة الوصول" } },
  { id: "team", label: { en: "Your team", ar: "فريقك" } },
  { id: "account", label: { en: "Plan & billing", ar: "الاشتراك والفواتير" } }
];

/** The sections each workspace really has, so a "take me there" button can never point at nothing. */
export const WORKSPACE_TABS = {
  agent: ["dashboard", "leads", "salesdesk", "properties", "verification", "subscription", "reviews", "profile"],
  agency: ["dashboard", "team", "listings", "leads", "salesdesk", "campaigns", "subscription", "verification", "profile"]
} as const;

export type WorkspaceKind = keyof typeof WORKSPACE_TABS;

export const kindOf = (persona: Persona): WorkspaceKind => (persona === "agencyAdmin" ? "agency" : "agent");

export function articlesFor(all: GuideArticle[], persona: Persona): GuideArticle[] {
  return all.filter(a => a.audience.includes(persona));
}

/** The section to open for this reader, or null when the article is only reading. */
export function goToFor(article: GuideArticle, persona: Persona): string | null {
  return article.goTo?.[kindOf(persona)] ?? null;
}

/** Matches in either language, ignoring diacritics and the different ways of writing alef, ya and ta marbuta. Every word must be found. */
export function searchGuide(list: GuideArticle[], query: string): GuideArticle[] {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return list;
  return list.filter(a => {
    const hay = foldText([
      a.title.en, a.title.ar, a.summary.en, a.summary.ar, a.why.en, a.why.ar,
      ...a.steps.flatMap(s => [s.title.en, s.title.ar, s.body.en, s.body.ar]),
      ...a.tips.flatMap(t => [t.en, t.ar])
    ].join(" "));
    return words.every(w => hay.includes(w));
  });
}

/** The order to read things in for someone brand new. */
export const START_PATH: Record<Persona, string[]> = {
  independent: ["dashboard", "verify", "profile", "add-listings", "leads", "pipeline", "public-page"],
  agencyAgent: ["dashboard", "verify", "profile", "add-listings", "leads", "pipeline", "public-page"],
  agencyAdmin: ["dashboard", "verify", "profile", "team", "agency-listings", "agency-leads", "public-page"]
};

export interface AccountFacts {
  verified: boolean;
  listings: number;
  waitingLeads: number;
  /** the profile has a photo or a bio the public can see */
  profileFilled: boolean;
  /** agency only: how many agents have joined */
  teamSize?: number;
}

/** What to read now, judged from where the account actually is (not verified, nothing listed, enquiries waiting...). At most `max`. */
export function suggestArticles(persona: Persona, facts: AccountFacts, read: ReadonlySet<string>, available: GuideArticle[], max = 3): string[] {
  const have = new Set(available.map(a => a.id));
  const out: string[] = [];
  const add = (id: string) => { if (have.has(id) && !out.includes(id)) out.push(id); };
  const admin = persona === "agencyAdmin";

  if (!facts.verified) add("verify");
  if (admin && (facts.teamSize ?? 0) === 0) add("team");
  if (facts.listings === 0) add(admin ? "agency-listings" : "add-listings");
  if (facts.waitingLeads > 0) add(admin ? "agency-leads" : "leads");
  if (!facts.profileFilled) add("profile");
  // Then whatever has not been read yet, in the order a newcomer should meet it.
  for (const id of START_PATH[persona]) if (!read.has(id)) add(id);
  return out.slice(0, max);
}

export function nextInPath(persona: Persona, id: string, available: GuideArticle[]): string | null {
  const have = new Set(available.map(a => a.id));
  const path = START_PATH[persona].filter(x => have.has(x));
  const i = path.indexOf(id);
  return i >= 0 && i < path.length - 1 ? path[i + 1] : null;
}

// ---- what has been read, kept per account on this device ----------------------------------------------------------

export const READ_KEY = (userId: string) => `guide-read:${userId}`;

export function parseRead(raw: string | null | undefined, valid: ReadonlySet<string>): Set<string> {
  if (!raw) return new Set();
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? new Set(v.filter((x): x is string => typeof x === "string" && valid.has(x))) : new Set();
  } catch {
    return new Set();
  }
}

export const serializeRead = (read: ReadonlySet<string>): string => JSON.stringify([...read]);

/** Share of the start path that has been read, 0-100. */
export function pathProgress(persona: Persona, read: ReadonlySet<string>, available: GuideArticle[]): { done: number; total: number; percent: number } {
  const have = new Set(available.map(a => a.id));
  const path = START_PATH[persona].filter(x => have.has(x));
  const done = path.filter(x => read.has(x)).length;
  return { done, total: path.length, percent: path.length === 0 ? 0 : Math.round((done / path.length) * 100) };
}

export const GUIDE_LANG_KEY = "guide-lang";

/** "en", "ar", or null (follow the site) from whatever was stored. */
export function parseGuideLang(raw: string | null | undefined): GuideLang | null {
  return raw === "en" || raw === "ar" ? raw : null;
}
