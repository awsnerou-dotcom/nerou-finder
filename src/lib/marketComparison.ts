// How one listing's price compares with the other live listings around it. Pure functions (no I/O), used by
// GET /api/properties/:id/market-comparison and unit tested.
//
// It is a comparison of what is advertised on the platform, never a valuation, and it says nothing when there is
// not enough to compare with: fewer than COMPARISON_MIN_SAMPLE other listings returns { comparable: false }.
//   - the comparison group is the other live, approved listings in the same district and city with the same deal
//     (rent or sale); if at least COMPARISON_MIN_SAMPLE of them are also the same property type, only those count
//   - the measure is the price per square metre (rent is first brought to a monthly figure), and the reference is
//     the MEDIAN, which a single very cheap or very dear listing cannot drag around
//   - within IN_LINE_BAND_PERCENT of the median counts as "in line"

import { ListingStatus, TransactionType, VerificationStatus } from "../types.js";
import type { Property } from "../types.js";

export const COMPARISON_MIN_SAMPLE = 3;
export const COMPARISON_LOW_CONFIDENCE = 5;
export const IN_LINE_BAND_PERCENT = 5;

export type Deal = "RENT" | "SALE";
export type Position = "below" | "in-line" | "above";

export type MarketComparison =
  | {
      comparable: false;
      deal: Deal | null;
      district: string;
      comparableCount: number;
      listingPricePerSqm: number | null;
    }
  | {
      comparable: true;
      deal: Deal;
      district: string;
      city: string;
      propertyType: string;
      /** "same-type": only listings of the same property type; "any-type": the district's listings of every type */
      basis: "same-type" | "any-type";
      comparableCount: number;
      listingPricePerSqm: number;
      medianPricePerSqm: number;
      differencePercent: number; // signed: negative = cheaper than the median
      position: Position;
      lowConfidence: boolean;
      /** rent is compared as a monthly figure; a sale price is the whole price */
      perMonth: boolean;
    };

export function dealOf(t: TransactionType): Deal | null {
  switch (t) {
    case TransactionType.FOR_RENT:
    case TransactionType.COMMERCIAL_LEASE:
      return "RENT";
    case TransactionType.FOR_SALE:
    case TransactionType.OFF_PLAN:
    case TransactionType.COMMERCIAL_SALE:
    case TransactionType.LAND_SALE:
      return "SALE";
    default:
      return null;
  }
}

/** The price per square metre; a rent is first turned into a monthly rent. null when the listing cannot be measured. */
export function pricePerSqm(p: Pick<Property, "price" | "area" | "transactionType" | "rentalPeriod">): number | null {
  if (!p.area || p.area <= 0 || !p.price || p.price <= 0) return null; // Property.area is always square metres
  let price = p.price;
  if (dealOf(p.transactionType) === "RENT") {
    switch (p.rentalPeriod) {
      case "YEARLY": price = price / 12; break;
      case "WEEKLY": price = (price * 52) / 12; break;
      case "DAILY": price = (price * 365) / 12; break;
      default: break; // monthly, or not stated
    }
  }
  return price / p.area;
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

export function compareWithMarket(target: Property, all: Property[]): MarketComparison {
  const deal = dealOf(target.transactionType);
  const own = pricePerSqm(target);
  const base = { deal, district: target.district || "", listingPricePerSqm: own === null ? null : Math.round(own) };
  if (!deal || own === null || !target.district || !target.city) return { comparable: false, ...base, comparableCount: 0 };

  const pool = all.filter(p =>
    p.id !== target.id &&
    p.listingStatus === ListingStatus.PUBLISHED &&
    p.verificationStatus === VerificationStatus.APPROVED &&
    norm(p.district) === norm(target.district) &&
    norm(p.city) === norm(target.city) &&
    dealOf(p.transactionType) === deal &&
    pricePerSqm(p) !== null
  );
  const sameType = pool.filter(p => p.propertyType === target.propertyType);
  const useSameType = sameType.length >= COMPARISON_MIN_SAMPLE;
  const group = useSameType ? sameType : pool;
  if (group.length < COMPARISON_MIN_SAMPLE) return { comparable: false, ...base, comparableCount: group.length };

  const med = median(group.map(p => pricePerSqm(p) as number));
  const diff = ((own - med) / med) * 100;
  const rounded = Math.round(diff);
  return {
    comparable: true,
    deal,
    district: target.district,
    city: target.city,
    propertyType: target.propertyType,
    basis: useSameType ? "same-type" : "any-type",
    comparableCount: group.length,
    listingPricePerSqm: Math.round(own),
    medianPricePerSqm: Math.round(med),
    differencePercent: rounded,
    position: Math.abs(diff) <= IN_LINE_BAND_PERCENT ? "in-line" : diff < 0 ? "below" : "above",
    lowConfidence: group.length < COMPARISON_LOW_CONFIDENCE,
    perMonth: deal === "RENT"
  };
}
