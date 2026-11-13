// Two things visitors expect from a property portal that the platform recorded but never showed: how long ago a listing was
// published, and whether its price has recently come down. Both are worked out only from what is stored on the listing
// (its created date and its price history), by pure functions shared by the search endpoint and the listing cards.

import type { Property } from "../types.js";

export const NEW_LISTING_DAYS = 7;
/** a price cut older than this is history, not news */
export const PRICE_DROP_RECENT_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PriceDrop {
  previous: number;
  /** whole percent, at least 1 */
  percent: number;
  /** the day the new, lower price took effect */
  date: string;
}

/**
 * The recent price cut on a listing, or null. The entry that set the current price is the last history entry equal to
 * it; the cut is the price before that one, provided it was higher and the change is recent.
 */
export function priceDrop(p: Pick<Property, "price" | "priceHistory">, now: number = Date.now()): PriceDrop | null {
  const history = p.priceHistory || [];
  if (!(p.price > 0)) return null;
  let at = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].price === p.price) { at = i; break; }
  }
  if (at < 1) return null;
  const previous = history[at - 1].price;
  if (!(previous > p.price)) return null;
  const changed = Date.parse(history[at].date);
  if (!Number.isFinite(changed) || now - changed > PRICE_DROP_RECENT_DAYS * DAY_MS) return null;
  return { previous, percent: Math.max(1, Math.round(((previous - p.price) / previous) * 100)), date: history[at].date };
}

/** Whole days since the listing was published; null when its date is missing or invalid. */
export function listedDaysAgo(createdDate: string | undefined, now: number = Date.now()): number | null {
  if (!createdDate) return null;
  const t = Date.parse(createdDate);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export const isNewListing = (days: number | null): boolean => days !== null && days <= NEW_LISTING_DAYS;

// Arabic number agreement: 1 and 2 have their own forms, 3-10 the plural, 11+ the singular accusative.
function ar(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`;
}

/** "Listed today", "Listed 5 days ago", "Listed 3 weeks ago", "Listed 2 months ago" - or the Arabic wording. */
export function listedLabel(days: number, isRtl: boolean): string {
  if (days <= 0) return isRtl ? "نُشر اليوم" : "Listed today";
  if (days === 1) return isRtl ? "نُشر أمس" : "Listed yesterday";
  if (days < 14) return isRtl ? `نُشر منذ ${ar(days, "يوم", "يومين", "أيام", "يوماً")}` : `Listed ${days} days ago`;
  if (days < 60) {
    const w = Math.floor(days / 7);
    return isRtl ? `نُشر منذ ${ar(w, "أسبوع", "أسبوعين", "أسابيع", "أسبوعاً")}` : `Listed ${w} weeks ago`;
  }
  const m = Math.floor(days / 30);
  return isRtl ? `نُشر منذ ${ar(m, "شهر", "شهرين", "أشهر", "شهراً")}` : `Listed ${m} months ago`;
}
