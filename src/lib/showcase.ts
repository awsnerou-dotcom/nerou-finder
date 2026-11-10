// Rules for the subscribers showcase that don't need the database: what a platform admin may enter
// for a company, and how the public list is ordered. Pure functions, unit tested.

import type { ShowcaseEntry, ShowcaseKind } from "../types.js";

export const SHOWCASE_KINDS: ShowcaseKind[] = ["AGENCY", "BROKERAGE", "DEVELOPER", "OTHER"];
export const KIND_LABEL: Record<ShowcaseKind, { en: string; ar: string }> = {
  AGENCY: { en: "Real-estate company", ar: "شركة عقارية" },
  BROKERAGE: { en: "Brokerage company", ar: "شركة وساطة" },
  DEVELOPER: { en: "Developer", ar: "مطور عقاري" },
  OTHER: { en: "Company", ar: "شركة" }
};

export const MAX_DESCRIPTION = 600;

export interface ShowcaseInput {
  name: string;
  nameAr?: string;
  kind: ShowcaseKind;
  description: string;
  descriptionAr?: string;
  logoUrl?: string;
  photoUrl?: string;
  website?: string;
  orgId?: string;
  since?: string;
  published: boolean;
}
export type ShowcaseValidation = { ok: true; value: ShowcaseInput } | { ok: false; error: string };

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
};

/** An image we host (uploaded through the site) or an https address - never javascript:, data: or http:. */
export function safeImageUrl(v: unknown): string | undefined | "invalid" {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return "invalid";
  const u = v.trim();
  if (/^\/assets\/uploads\/[A-Za-z0-9._-]+$/.test(u)) return u;
  if (/^https:\/\/[^\s"'<>]+$/i.test(u) && u.length <= 500) return u;
  return "invalid";
}

export function safeWebsite(v: unknown): string | undefined | "invalid" {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return "invalid";
  let u = v.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) return "invalid";
    return parsed.toString().slice(0, 300);
  } catch {
    return "invalid";
  }
}

export function validateShowcaseInput(raw: Record<string, unknown>): ShowcaseValidation {
  const name = text(raw.name, 120);
  if (!name) return { ok: false, error: "The company name is required." };

  const description = text(raw.description, MAX_DESCRIPTION);
  if (!description || description.length < 20) return { ok: false, error: "Write a short description of the company (at least 20 characters)." };
  if (typeof raw.description === "string" && raw.description.replace(/\s+/g, " ").trim().length > MAX_DESCRIPTION) {
    return { ok: false, error: `The description is too long (up to ${MAX_DESCRIPTION} characters).` };
  }
  if (typeof raw.descriptionAr === "string" && raw.descriptionAr.replace(/\s+/g, " ").trim().length > MAX_DESCRIPTION) {
    return { ok: false, error: `The Arabic description is too long (up to ${MAX_DESCRIPTION} characters).` };
  }

  const kind = SHOWCASE_KINDS.includes(raw.kind as ShowcaseKind) ? (raw.kind as ShowcaseKind) : "AGENCY";

  const logo = safeImageUrl(raw.logoUrl);
  if (logo === "invalid") return { ok: false, error: "The logo must be an uploaded image or an https address." };
  const photo = safeImageUrl(raw.photoUrl);
  if (photo === "invalid") return { ok: false, error: "The photo must be an uploaded image or an https address." };
  const website = safeWebsite(raw.website);
  if (website === "invalid") return { ok: false, error: "The website address does not look right." };

  let since: string | undefined;
  if (typeof raw.since === "string" && raw.since.trim()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.since.trim())) return { ok: false, error: "The subscription month must look like 2026-11." };
    since = raw.since.trim();
  }

  return {
    ok: true,
    value: {
      name, kind, description,
      nameAr: text(raw.nameAr, 120),
      descriptionAr: text(raw.descriptionAr, MAX_DESCRIPTION),
      logoUrl: logo, photoUrl: photo, website,
      orgId: text(raw.orgId, 80),
      since,
      published: raw.published === true
    }
  };
}

/** The order visitors see: the admin's order first, newest first among equals. */
export function sortShowcase<T extends Pick<ShowcaseEntry, "sortOrder" | "createdAt">>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
}

/** "2026-11" -> "Nov 2026" / "نوفمبر 2026" */
export function formatSince(since: string | undefined, lang: "en" | "ar"): string {
  if (!since || !/^\d{4}-\d{2}$/.test(since)) return "";
  const [y, m] = since.split("-").map(Number);
  const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ar = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${(lang === "ar" ? ar : en)[m - 1]} ${y}`;
}
