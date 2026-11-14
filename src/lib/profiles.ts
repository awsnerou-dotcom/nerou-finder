// Public profile pages for agents and agencies, and the share kit that sends people to them: the address of each page,
// the ready-to-send WhatsApp messages, and the little statistics shown to the owner. Pure functions shared by the server
// (which renders the page for search engines) and the browser, unit tested.

import { slugify } from "./seo.js";

export type ProfileKind = "agents" | "agencies";

/** Short, stable code from an id (FNV-1a, base 36), so two people with the same name never share an address. */
export function shortId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, "0").slice(-6);
}

/** "faisal-hassan-0k3x9a": readable in a link, unique by the code on the end. Arabic-only names fall back to "agent"/"agency". */
export function profileSlug(kind: ProfileKind, entity: { id: string; name: string }): string {
  const base = slugify(entity.name || "").slice(0, 48).replace(/-+$/g, "") || (kind === "agents" ? "agent" : "agency");
  return `${base}-${shortId(entity.id)}`;
}

/** The entity a slug belongs to: matched on the code at the end, so a renamed person's old link still works. */
export function findBySlug<T extends { id: string }>(list: T[], slug: string): T | undefined {
  const code = /-([a-z0-9]{6})$/.exec((slug || "").toLowerCase())?.[1];
  if (!code) return undefined;
  return list.find(e => shortId(e.id) === code);
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

export function profilePath(kind: ProfileKind, slug: string, isRtl = false): string {
  return `${isRtl ? "/ar" : ""}/${kind}/${slug}`;
}

/** A profile address; `review` opens it straight at the review form, `shared` marks a visit that came from a shared link. */
export function profileUrl(origin: string, kind: ProfileKind, slug: string, o: { isRtl?: boolean; review?: boolean; shared?: boolean } = {}): string {
  const q = [o.review ? "review=1" : "", o.shared ? "sh=1" : ""].filter(Boolean).join("&");
  return `${trimSlash(origin)}${profilePath(kind, slug, !!o.isRtl)}${q ? `?${q}` : ""}`;
}

/** A listing address for sharing: the `sh=1` mark lets us count the people a shared link brings. */
export function listingShareUrl(origin: string, propertyId: string, isRtl = false): string {
  return `${trimSlash(origin)}${isRtl ? "/ar" : ""}/properties/${propertyId}?sh=1`;
}

export function listingShareMessage(o: { title: string; price: number; currency?: string; district?: string; url: string; isRtl: boolean; period?: string }): string {
  const price = `${o.currency || "QAR"} ${Math.round(o.price).toLocaleString("en-US")}${o.period || ""}`;
  const place = o.district ? ` - ${o.district}` : "";
  return o.isRtl
    ? `${o.title}${place}\n${price}\nالتفاصيل والصور: ${o.url}`
    : `${o.title}${place}\n${price}\nPhotos and details: ${o.url}`;
}

export function whatsappShareLink(message: string, phoneDigits?: string): string {
  const digits = (phoneDigits || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** The message an agent sends a happy client asking for a review. */
export function reviewRequestMessage(o: { clientName?: string; agentName: string; url: string; isRtl: boolean }): string {
  const first = (o.clientName || "").trim().split(/\s+/)[0];
  return o.isRtl
    ? `${first ? `مرحباً ${first}، ` : "مرحباً، "}شكراً لثقتك بي. إن كنت راضياً عن خدمتي أكون ممتناً لو كتبت تقييماً قصيراً هنا (يستغرق دقيقة): ${o.url}\n${o.agentName}`
    : `${first ? `Hi ${first}, ` : "Hi, "}thank you for trusting me. If you were happy with my service I would really appreciate a short review here (it takes a minute): ${o.url}\n${o.agentName}`;
}

/** Total of a { "YYYY-MM-DD": count } record over the last `days` days (today included). */
export function sumLastDays(record: Record<string, number> | undefined, days: number, now: number): number {
  if (!record) return 0;
  const from = new Date(now - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(now).toISOString().slice(0, 10);
  let total = 0;
  for (const [day, n] of Object.entries(record)) if (day >= from && day <= to) total += Number(n) || 0;
  return total;
}

/** Adds one to today's count in a { "YYYY-MM-DD": count } record, keeping only the last 120 days so it never grows without end. */
export function bumpDay(record: Record<string, number> | undefined, now: number): Record<string, number> {
  const out: Record<string, number> = { ...(record || {}) };
  const today = new Date(now).toISOString().slice(0, 10);
  out[today] = (out[today] || 0) + 1;
  const keep = new Date(now - 120 * 86_400_000).toISOString().slice(0, 10);
  for (const day of Object.keys(out)) if (day < keep) delete out[day];
  return out;
}

/** Shortens a reviewer's name for the public page: "Mariam Al-Kuwari" -> "Mariam A.". */
export function publicReviewerName(full: string | undefined): string {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Verified client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}
