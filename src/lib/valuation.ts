// "What is my property worth?": an estimate for an owner, worked out only from the live listings on the platform.
// It is a range, never a promise: the price per square metre of comparable listings (median for the middle,
// the 25th and 75th percentiles for the range) times the owner's size. When there are not enough comparable
// listings it says so instead of inventing a number. Pure functions, unit tested.
//
// Comparables, from the most specific group that has enough listings to the least:
//   1. same district and city, same property type and same number of bedrooms (when the owner gave bedrooms)  - at least 3
//   2. same district and city, same property type                                                          - at least 3
//   3. same district and city, any property type                                                           - at least 3
//   4. same city, same property type                                                                       - at least 5
// Only live, approved listings of the same deal (sale or rent) count; a rent is first brought to a monthly figure.

import { ListingStatus, VerificationStatus } from "../types.js";
import type { Property } from "../types.js";
import { COMPARISON_MIN_SAMPLE, dealOf, pricePerSqm } from "./marketComparison.js";
import type { Deal } from "./marketComparison.js";

export const CITY_LEVEL_MIN_SAMPLE = 5;
export const MIN_AREA_SQM = 10;
export const MAX_AREA_SQM = 100_000;

export interface ValuationInput {
  deal: Deal;
  city: string;
  district: string;
  propertyType: string;
  areaSqm: number;
  bedrooms?: number;
}

export type ValuationBasis = "district-type-bedrooms" | "district-type" | "district" | "city-type";

export interface SimilarListing {
  id: string;
  title: string;
  price: number;
  area: number;
  bedrooms: number;
}

export type ValuationResult =
  | { ok: false; reason: "invalid" | "not-enough-data"; comparableCount: number }
  | {
      ok: true;
      deal: Deal;
      city: string;
      district: string;
      basis: ValuationBasis;
      comparableCount: number;
      medianPerSqm: number;
      lowPerSqm: number;
      highPerSqm: number;
      estimate: number;
      low: number;
      high: number;
      confidence: "low" | "medium" | "high";
      perMonth: boolean;
      similar: SimilarListing[];
    };

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** linear-interpolated percentile (p in 0..100) of a non-empty list */
export function percentile(values: number[], p: number): number {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 1) return v[0];
  const pos = (Math.min(100, Math.max(0, p)) / 100) * (v.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export function validateValuationInput(raw: Record<string, unknown>): { ok: true; value: ValuationInput } | { ok: false; error: string } {
  const deal = raw.deal === "SALE" || raw.deal === "RENT" ? (raw.deal as Deal) : null;
  if (!deal) return { ok: false, error: "Choose whether the property is for sale or for rent." };
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  const district = typeof raw.district === "string" ? raw.district.trim() : "";
  if (!city || city.length > 80) return { ok: false, error: "Choose the municipality." };
  if (!district || district.length > 80) return { ok: false, error: "Choose the area." };
  const propertyType = typeof raw.propertyType === "string" ? raw.propertyType.trim() : "";
  if (!propertyType || propertyType.length > 40) return { ok: false, error: "Choose the property type." };
  const areaSqm = typeof raw.area === "number" ? raw.area : typeof raw.area === "string" && raw.area.trim() !== "" ? Number(raw.area) : NaN;
  if (!Number.isFinite(areaSqm) || areaSqm < MIN_AREA_SQM || areaSqm > MAX_AREA_SQM) return { ok: false, error: `The size must be between ${MIN_AREA_SQM} and ${MAX_AREA_SQM.toLocaleString("en-US")} square metres.` };
  let bedrooms: number | undefined;
  if (raw.bedrooms !== undefined && raw.bedrooms !== null && raw.bedrooms !== "") {
    const b = Number(raw.bedrooms);
    if (!Number.isInteger(b) || b < 0 || b > 20) return { ok: false, error: "Bedrooms must be a whole number from 0 to 20." };
    bedrooms = b;
  }
  return { ok: true, value: { deal, city, district, propertyType, areaSqm, bedrooms } };
}

export function estimateValue(input: ValuationInput, all: Property[]): ValuationResult {
  if (!(input.areaSqm >= MIN_AREA_SQM) || !input.city || !input.district) return { ok: false, reason: "invalid", comparableCount: 0 };

  const live = all.filter(p =>
    p.listingStatus === ListingStatus.PUBLISHED &&
    p.verificationStatus === VerificationStatus.APPROVED &&
    dealOf(p.transactionType) === input.deal &&
    pricePerSqm(p) !== null
  );
  const city = live.filter(p => norm(p.city) === norm(input.city));
  const district = city.filter(p => norm(p.district) === norm(input.district));
  const districtType = district.filter(p => p.propertyType === input.propertyType);
  const districtTypeBeds = input.bedrooms === undefined ? [] : districtType.filter(p => p.bedrooms === input.bedrooms);
  const cityType = city.filter(p => p.propertyType === input.propertyType);

  let group: Property[] = [];
  let basis: ValuationBasis | null = null;
  if (districtTypeBeds.length >= COMPARISON_MIN_SAMPLE) { group = districtTypeBeds; basis = "district-type-bedrooms"; }
  else if (districtType.length >= COMPARISON_MIN_SAMPLE) { group = districtType; basis = "district-type"; }
  else if (district.length >= COMPARISON_MIN_SAMPLE) { group = district; basis = "district"; }
  else if (cityType.length >= CITY_LEVEL_MIN_SAMPLE) { group = cityType; basis = "city-type"; }
  if (!basis) return { ok: false, reason: "not-enough-data", comparableCount: Math.max(districtType.length, district.length) };

  const perSqm = group.map(p => pricePerSqm(p) as number);
  const median = percentile(perSqm, 50);
  const lowPerSqm = percentile(perSqm, 25);
  const highPerSqm = percentile(perSqm, 75);
  const step = input.deal === "RENT" ? 10 : 1000; // round to something a person would say
  const money = (perSqmValue: number) => Math.max(step, Math.round((perSqmValue * input.areaSqm) / step) * step);

  const similar = [...group]
    .sort((a, b) => Math.abs(a.area - input.areaSqm) - Math.abs(b.area - input.areaSqm))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: p.title, price: p.price, area: p.area, bedrooms: p.bedrooms }));

  return {
    ok: true,
    deal: input.deal,
    city: input.city,
    district: input.district,
    basis,
    comparableCount: group.length,
    medianPerSqm: Math.round(median),
    lowPerSqm: Math.round(lowPerSqm),
    highPerSqm: Math.round(highPerSqm),
    estimate: money(median),
    low: money(lowPerSqm),
    high: money(highPerSqm),
    confidence: group.length < 5 ? "low" : group.length < 15 ? "medium" : "high",
    perMonth: input.deal === "RENT",
    similar
  };
}
