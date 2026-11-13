// The "nearby places" of a listing: entered by the agent who lists the property, shown to visitors as given, and
// shown only when the agent entered some. (They used to be worked out from the listing's map coordinates against a
// fixed list of Doha landmarks, which gave wrong or irrelevant answers whenever the coordinates were a default.)
// Pure functions: used by POST /api/properties to clean what comes in, and by the screens to word it.

import type { NearbyPlace, NearbyPlaceType, NearbyDistanceUnit } from "../types.js";

export const MAX_NEARBY_PLACES = 8;
export const MAX_NEARBY_NAME = 80;

export const NEARBY_TYPES: { type: NearbyPlaceType; en: string; ar: string }[] = [
  { type: "SCHOOL", en: "School", ar: "مدرسة" },
  { type: "HOSPITAL", en: "Hospital / clinic", ar: "مستشفى / عيادة" },
  { type: "MALL", en: "Mall", ar: "مركز تسوق" },
  { type: "SUPERMARKET", en: "Supermarket", ar: "سوبرماركت" },
  { type: "MOSQUE", en: "Mosque", ar: "مسجد" },
  { type: "PARK", en: "Park", ar: "حديقة" },
  { type: "BEACH", en: "Beach", ar: "شاطئ" },
  { type: "METRO", en: "Metro / transport", ar: "مترو / مواصلات" },
  { type: "RESTAURANT", en: "Restaurant / café", ar: "مطعم / مقهى" },
  { type: "OTHER", en: "Other", ar: "أخرى" }
];

export const NEARBY_UNITS: { unit: NearbyDistanceUnit; en: string; ar: string }[] = [
  { unit: "WALK_MIN", en: "min walk", ar: "دقيقة سيراً" },
  { unit: "DRIVE_MIN", en: "min drive", ar: "دقيقة بالسيارة" },
  { unit: "KM", en: "km", ar: "كم" }
];

const TYPES = new Set<string>(NEARBY_TYPES.map(t => t.type));
const UNITS = new Set<string>(NEARBY_UNITS.map(u => u.unit));

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Whatever a client sends, only well-formed places come out: a known type (anything else becomes "other"), a name,
 * a positive distance in a known unit. Entries that cannot be repaired are dropped, never guessed; at most
 * MAX_NEARBY_PLACES are kept. Never throws.
 */
export function sanitizeNearbyPlaces(raw: unknown): NearbyPlace[] {
  if (!Array.isArray(raw)) return [];
  const out: NearbyPlace[] = [];
  for (const item of raw) {
    if (out.length >= MAX_NEARBY_PLACES) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = clean(r.name, MAX_NEARBY_NAME);
    if (!name) continue;
    const unit = typeof r.unit === "string" && UNITS.has(r.unit) ? (r.unit as NearbyDistanceUnit) : null;
    if (!unit) continue;
    const num = typeof r.value === "number" ? r.value : typeof r.value === "string" && r.value.trim() !== "" ? Number(r.value) : NaN;
    if (!Number.isFinite(num) || num <= 0) continue;
    const max = unit === "KM" ? 200 : 180;
    if (num > max) continue;
    const value = unit === "KM" ? Math.round(num * 10) / 10 : Math.round(num);
    if (value <= 0) continue;
    const type = typeof r.type === "string" && TYPES.has(r.type) ? (r.type as NearbyPlaceType) : "OTHER";
    const nameAr = clean(r.nameAr, MAX_NEARBY_NAME);
    out.push({ type, name, ...(nameAr ? { nameAr } : {}), value, unit });
  }
  return out;
}

/** "5 min walk", "12 min drive", "1.2 km" - or the Arabic wording. */
export function formatNearbyDistance(p: Pick<NearbyPlace, "value" | "unit">, isRtl: boolean): string {
  if (p.unit === "KM") return isRtl ? `${p.value} كم` : `${p.value} km`;
  if (p.unit === "WALK_MIN") return isRtl ? `${p.value} دقيقة سيراً` : `${p.value} min walk`;
  return isRtl ? `${p.value} دقيقة بالسيارة` : `${p.value} min drive`;
}

export function nearbyTypeLabel(type: string, isRtl: boolean): string {
  const t = NEARBY_TYPES.find(x => x.type === type) || NEARBY_TYPES[NEARBY_TYPES.length - 1];
  return isRtl ? t.ar : t.en;
}
