/**
 * Small, honest wording helpers for the facts shown on a listing card or page.
 * A warehouse, a plot of land or a shop has no bedrooms, so the number is not shown for it
 * (it used to print "4 Beds 4 Baths" under a factory). Counts are written in correct grammar
 * in both languages ("1 bed", "2 beds", "غرفتان", "٣ غرف").
 */

/** Property types where a bedroom or bathroom count means nothing. */
const NO_ROOMS = new Set(["LAND", "OFFICE", "SHOP", "RETAIL", "WAREHOUSE", "BUILDING", "FARM", "COMMERCIAL", "OTHER"]);

export function hasRooms(propertyType: string | undefined | null): boolean {
  return !NO_ROOMS.has(String(propertyType || "").toUpperCase());
}

function arabicCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** "Studio", "1 bed", "3 beds"; empty when the type has no bedrooms or the count is unknown. */
export function bedsText(count: number | undefined | null, propertyType: string | undefined | null, isRtl: boolean): string {
  if (!hasRooms(propertyType)) return "";
  const studio = String(propertyType || "").toUpperCase() === "STUDIO";
  if (!studio && (count === undefined || count === null)) return "";
  const n = Number(count);
  if (studio || n === 0) return isRtl ? "استوديو" : "Studio";
  if (!Number.isFinite(n) || n < 0) return "";
  if (isRtl) return arabicCount(n, "غرفة نوم", "غرفتا نوم", "غرف", "غرفة");
  return `${n} ${n === 1 ? "bed" : "beds"}`;
}

/** "1 bath", "3 baths"; empty when the type has no bathrooms or the count is unknown or zero. */
export function bathsText(count: number | undefined | null, propertyType: string | undefined | null, isRtl: boolean): string {
  if (!hasRooms(propertyType)) return "";
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (isRtl) return arabicCount(n, "حمام", "حمامان", "حمامات", "حمامًا");
  return `${n} ${n === 1 ? "bath" : "baths"}`;
}
