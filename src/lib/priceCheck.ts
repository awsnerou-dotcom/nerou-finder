// "Is this price fair?": a verdict on a price someone was offered (a flat on another site, a post in a group, an agent's
// quote), worked out only from the live listings on the platform. It says how far the price is from what comparable
// listings ask, how many of them are cheaper, what a fair target would be, and warns when a price is so low that it is more
// likely bait than a bargain. Never a promise: with too few comparable listings it says so. Pure functions, unit tested.
//
// Comparable listings, from the most specific group that has enough to the least:
//   1. same district, property type and bedrooms (at least 3)
//   2. same district and property type (at least 3)
//   3. same district, any type (at least 3)
//   4. same city, property type and bedrooms (at least 5)
//   5. same city and property type (at least 5)
// When the person gives the size, the comparison is per square metre (so a big flat is not called dear for being big).

import { ListingStatus, VerificationStatus } from "../types.js";
import type { Property } from "../types.js";
import { COMPARISON_MIN_SAMPLE, dealOf } from "./marketComparison.js";
import type { Deal } from "./marketComparison.js";
import { CITY_LEVEL_MIN_SAMPLE, MAX_AREA_SQM, MIN_AREA_SQM, percentile } from "./valuation.js";

export type Verdict = "far-below" | "below" | "fair" | "above" | "far-above";
export type CheckBasis = "district-type-bedrooms" | "district-type" | "district" | "city-type-bedrooms" | "city-type";

/** within this many percent of the typical price counts as fair */
export const FAIR_BAND_PERCENT = 8;
/** beyond this many percent is "far" from the typical price */
export const FAR_BAND_PERCENT = 25;
/** below this many percent under the typical price, the price is more likely bait than a bargain */
export const SUSPICIOUS_LOW_PERCENT = 35;
export const MAX_PRICE = 1_000_000_000;

export interface PriceCheckInput {
  deal: Deal;
  city: string;
  district: string;
  propertyType: string;
  bedrooms?: number;
  /** the price as offered; for a rent, per month */
  price: number;
  areaSqm?: number;
}

export interface SimilarForCheck { id: string; title: string; price: number; area: number; bedrooms: number; rentalPeriod?: string }

export type PriceCheckResult =
  | { ok: false; reason: "invalid" | "not-enough-data"; comparableCount: number }
  | {
      ok: true;
      deal: Deal;
      city: string;
      district: string;
      basis: CheckBasis;
      measure: "total" | "per-sqm";
      comparableCount: number;
      verdict: Verdict;
      /** signed: negative = cheaper than typical */
      differencePercent: number;
      suspiciouslyLow: boolean;
      asked: number;
      typical: number;
      low: number;
      high: number;
      /** asked - typical, in the same unit as `asked` (monthly for a rent) */
      difference: number;
      /** for a rent: what the difference adds up to over a year */
      yearlyDifference: number | null;
      /** a fair figure to aim for when the price is above the market, otherwise null */
      target: number | null;
      /** share (0-100) of comparable listings that are cheaper than the asked price */
      cheaperThanPercent: number;
      confidence: "low" | "medium" | "high";
      perMonth: boolean;
      similar: SimilarForCheck[];
    };

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** A listing's price as a monthly figure for a rent, the whole price for a sale. */
export function monthlyPrice(p: Pick<Property, "price" | "transactionType" | "rentalPeriod">): number {
  if (dealOf(p.transactionType) !== "RENT") return p.price;
  switch (p.rentalPeriod) {
    case "YEARLY": return p.price / 12;
    case "WEEKLY": return (p.price * 52) / 12;
    case "DAILY": return (p.price * 365) / 12;
    default: return p.price; // monthly, or not stated
  }
}

export function validatePriceCheckInput(raw: Record<string, unknown>): { ok: true; value: PriceCheckInput } | { ok: false; error: string } {
  const deal = raw.deal === "SALE" || raw.deal === "RENT" ? (raw.deal as Deal) : null;
  if (!deal) return { ok: false, error: "Choose whether the price is for a rent or for a purchase." };
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  const district = typeof raw.district === "string" ? raw.district.trim() : "";
  if (!city || city.length > 80) return { ok: false, error: "Choose the municipality." };
  if (!district || district.length > 80) return { ok: false, error: "Choose the area." };
  const propertyType = typeof raw.propertyType === "string" ? raw.propertyType.trim() : "";
  if (!propertyType || propertyType.length > 40) return { ok: false, error: "Choose the property type." };
  const price = typeof raw.price === "number" ? raw.price : typeof raw.price === "string" && raw.price.trim() !== "" ? Number(raw.price.replace(/[,\s]/g, "")) : NaN;
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) return { ok: false, error: "Enter the price you were offered." };
  let bedrooms: number | undefined;
  if (raw.bedrooms !== undefined && raw.bedrooms !== null && raw.bedrooms !== "") {
    const b = Number(raw.bedrooms);
    if (!Number.isInteger(b) || b < 0 || b > 20) return { ok: false, error: "Bedrooms must be a whole number from 0 to 20." };
    bedrooms = b;
  }
  let areaSqm: number | undefined;
  if (raw.area !== undefined && raw.area !== null && raw.area !== "") {
    const a = Number(raw.area);
    if (!Number.isFinite(a) || a < MIN_AREA_SQM || a > MAX_AREA_SQM) return { ok: false, error: `The size must be between ${MIN_AREA_SQM} and ${MAX_AREA_SQM.toLocaleString("en-US")} square metres.` };
    areaSqm = a;
  }
  return { ok: true, value: { deal, city, district, propertyType, bedrooms, price, areaSqm } };
}

function verdictFor(differencePercent: number): Verdict {
  if (differencePercent < -FAR_BAND_PERCENT) return "far-below";
  if (differencePercent < -FAIR_BAND_PERCENT) return "below";
  if (differencePercent <= FAIR_BAND_PERCENT) return "fair";
  if (differencePercent <= FAR_BAND_PERCENT) return "above";
  return "far-above";
}

export function checkPrice(input: PriceCheckInput, all: Property[]): PriceCheckResult {
  if (!(input.price > 0) || !input.city || !input.district) return { ok: false, reason: "invalid", comparableCount: 0 };

  const live = all.filter(p =>
    p.listingStatus === ListingStatus.PUBLISHED &&
    p.verificationStatus === VerificationStatus.APPROVED &&
    dealOf(p.transactionType) === input.deal &&
    p.price > 0
  );
  const city = live.filter(p => norm(p.city) === norm(input.city));
  const district = city.filter(p => norm(p.district) === norm(input.district));
  const districtType = district.filter(p => p.propertyType === input.propertyType);
  const hasBeds = input.bedrooms !== undefined;
  const districtTypeBeds = hasBeds ? districtType.filter(p => p.bedrooms === input.bedrooms) : [];
  const cityType = city.filter(p => p.propertyType === input.propertyType);
  const cityTypeBeds = hasBeds ? cityType.filter(p => p.bedrooms === input.bedrooms) : [];

  let group: Property[] = [];
  let basis: CheckBasis | null = null;
  if (districtTypeBeds.length >= COMPARISON_MIN_SAMPLE) { group = districtTypeBeds; basis = "district-type-bedrooms"; }
  else if (districtType.length >= COMPARISON_MIN_SAMPLE) { group = districtType; basis = "district-type"; }
  else if (district.length >= COMPARISON_MIN_SAMPLE) { group = district; basis = "district"; }
  else if (cityTypeBeds.length >= CITY_LEVEL_MIN_SAMPLE) { group = cityTypeBeds; basis = "city-type-bedrooms"; }
  else if (cityType.length >= CITY_LEVEL_MIN_SAMPLE) { group = cityType; basis = "city-type"; }
  if (!basis) return { ok: false, reason: "not-enough-data", comparableCount: Math.max(districtType.length, district.length) };

  // with a size, compare per square metre among the listings that state one; otherwise compare the whole price
  const sized = group.filter(p => p.area > 0);
  const perSqm = !!input.areaSqm && sized.length >= COMPARISON_MIN_SAMPLE;
  const values = perSqm ? sized.map(p => monthlyPrice(p) / p.area) : group.map(p => monthlyPrice(p));
  const askedValue = perSqm ? input.price / (input.areaSqm as number) : input.price;
  const unit = perSqm ? (input.areaSqm as number) : 1;

  const med = percentile(values, 50);
  const diffPercent = ((askedValue - med) / med) * 100;
  const rounded = Math.round(diffPercent);
  const step = input.deal === "RENT" ? 50 : 5000; // round to something a person would say
  const money = (v: number) => Math.max(step, Math.round((v * unit) / step) * step);
  const typical = money(med);
  const verdict = verdictFor(diffPercent);
  const difference = Math.round(input.price - typical);
  const cheaper = values.filter(v => v < askedValue).length;

  const similar = [...group]
    .sort((a, b) => Math.abs(monthlyPrice(a) - input.price) - Math.abs(monthlyPrice(b) - input.price))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: p.title, price: Math.round(monthlyPrice(p)), area: p.area, bedrooms: p.bedrooms, rentalPeriod: input.deal === "RENT" ? "MONTHLY" : undefined }));

  return {
    ok: true,
    deal: input.deal,
    city: input.city,
    district: input.district,
    basis,
    measure: perSqm ? "per-sqm" : "total",
    comparableCount: values.length,
    verdict,
    differencePercent: rounded,
    suspiciouslyLow: diffPercent < -SUSPICIOUS_LOW_PERCENT,
    asked: Math.round(input.price),
    typical,
    low: money(percentile(values, 25)),
    high: money(percentile(values, 75)),
    difference,
    yearlyDifference: input.deal === "RENT" ? difference * 12 : null,
    target: verdict === "above" || verdict === "far-above" ? typical : null,
    cheaperThanPercent: Math.round((cheaper / values.length) * 100),
    confidence: values.length >= 10 ? "high" : values.length >= 5 ? "medium" : "low",
    perMonth: input.deal === "RENT",
    similar
  };
}
