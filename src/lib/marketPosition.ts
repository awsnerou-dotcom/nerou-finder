// Where every live listing stands against the market around it, for the whole catalogue at once, so a search result can
// carry a "12% below market" label and be filtered by it.
//
// It is exactly the comparison the listing page shows (src/lib/marketComparison.ts compareWithMarket): the same group
// (same district and city, same deal, live and approved, priced and measured), the same preference for the same property
// type when at least COMPARISON_MIN_SAMPLE others share it, the same reference (the MEDIAN price per square metre of the
// OTHERS, never the listing itself) and the same "in line" band. The difference is only speed: a leave-one-out median
// per listing in one pass over the sorted groups instead of a full scan per listing.

import { ListingStatus, VerificationStatus } from "../types.js";
import type { Property } from "../types.js";
import { COMPARISON_MIN_SAMPLE, IN_LINE_BAND_PERCENT, dealOf, pricePerSqm } from "./marketComparison.js";
import type { Position } from "./marketComparison.js";

/** a listing is called "below market" in search from this far under the median */
export const BELOW_MARKET_PERCENT = 10;

export interface MarketPosition {
  /** signed, whole percent: negative = cheaper than the median of the others */
  percent: number;
  position: Position;
}

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

interface Member { id: string; v: number }

/** median of the sorted values with the one at `skip` left out; null when fewer than `min` remain */
function medianWithout(sorted: number[], skip: number, min: number): number | null {
  const m = sorted.length - 1;
  if (m < min) return null;
  const at = (i: number) => (i < skip ? sorted[i] : sorted[i + 1]);
  // an odd count has one middle value; an even count averages the two in the middle
  return m % 2 ? at((m - 1) / 2) : (at(m / 2 - 1) + at(m / 2)) / 2;
}

export function computeMarketPositions(all: Property[]): Map<string, MarketPosition> {
  const broad = new Map<string, Member[]>();
  const narrow = new Map<string, Member[]>();
  const info = new Map<string, { broad: string; narrow: string; v: number }>();

  for (const p of all) {
    if (p.listingStatus !== ListingStatus.PUBLISHED || p.verificationStatus !== VerificationStatus.APPROVED) continue;
    if (!p.district || !p.city) continue;
    const deal = dealOf(p.transactionType);
    const v = pricePerSqm(p);
    if (!deal || v === null) continue;
    const bKey = `${norm(p.district)}|${norm(p.city)}|${deal}`;
    const nKey = `${bKey}|${p.propertyType}`;
    (broad.get(bKey) ?? broad.set(bKey, []).get(bKey)!).push({ id: p.id, v });
    (narrow.get(nKey) ?? narrow.set(nKey, []).get(nKey)!).push({ id: p.id, v });
    info.set(p.id, { broad: bKey, narrow: nKey, v });
  }

  // sort each group once and remember every member's place in it
  const rank = new Map<string, number>(); // `${groupKey}#${id}` -> index
  const values = new Map<string, number[]>();
  for (const groups of [broad, narrow]) {
    for (const [key, members] of groups) {
      members.sort((a, b) => a.v - b.v);
      values.set(key, members.map(m => m.v));
      members.forEach((m, i) => rank.set(`${key}#${m.id}`, i));
    }
  }

  const out = new Map<string, MarketPosition>();
  for (const [id, f] of info) {
    // the same type when at least MIN OTHER listings share it, else every type in the district
    let med = medianWithout(values.get(f.narrow)!, rank.get(`${f.narrow}#${id}`)!, COMPARISON_MIN_SAMPLE);
    if (med === null) med = medianWithout(values.get(f.broad)!, rank.get(`${f.broad}#${id}`)!, COMPARISON_MIN_SAMPLE);
    if (med === null || med <= 0) continue;
    const diff = ((f.v - med) / med) * 100;
    out.set(id, {
      percent: Math.round(diff),
      position: Math.abs(diff) <= IN_LINE_BAND_PERCENT ? "in-line" : diff < 0 ? "below" : "above"
    });
  }
  return out;
}

/** Cheaper than the market by at least BELOW_MARKET_PERCENT. */
export const isBelowMarket = (m: MarketPosition | undefined): boolean => !!m && m.position === "below" && m.percent <= -BELOW_MARKET_PERCENT;
