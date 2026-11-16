// Telling search engines about new and changed pages, automatically. Each public page has a "stamp" (a short text that changes when the
// page's content changes: the newest listing date, the number of listings on it, a guide's updated date). The sweep compares today's
// stamps with the ones it sent last time and submits only what is new or changed, so the engines are told once and never nagged.

import { withLang } from "./seo.js";

export type Stamps = Record<string, string>;

/** The paths that are new, or whose stamp changed, since the last successful submission. */
export function changedPaths(previous: Stamps, current: Stamps): string[] {
  return Object.keys(current).filter(p => previous[p] !== current[p]).sort();
}

/** Both languages of every path, as full addresses. */
export function urlsFor(paths: string[], origin: string): string[] {
  const out: string[] = [];
  for (const p of paths) {
    out.push(`${origin}${p === "/" ? "/" : p}`);
    out.push(`${origin}${withLang(p, "ar")}`);
  }
  return out;
}

/** IndexNow accepts at most 10,000 addresses per request. */
export function inBatches<T>(items: T[], size = 10000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The saved record of what was last sent. Anything unreadable counts as "nothing sent yet". */
export function parseStamps(raw: string | null | undefined): Stamps {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: Stamps = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === "string") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Never pings a development machine: the engines would be told about addresses that do not exist. */
export function isPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return !/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(host) && !host.endsWith(".localhost") && !host.endsWith(".test") && host.includes(".");
  } catch {
    return false;
  }
}
