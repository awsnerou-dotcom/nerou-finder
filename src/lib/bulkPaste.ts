// "Move my listings from another portal" without any portal's own export: the agent copies the text of all their ads (from the portal's
// "my ads" page, a social page, WhatsApp) and pastes it once. Each ad is read the way a single pasted ad is (src/lib/listingFromText.ts),
// then turned into the same rows a file import uses, so the same preview, the same checks and the same drafts apply.

import { parseListingText, splitAds } from "./listingFromText.js";
import type { PlaceRef } from "./listingFromText.js";

export interface BulkPasteResult {
  /** the rows, ready to be sent as JSON to the import endpoints */
  records: Record<string, string | number>[];
  /** how many ads were found in the text */
  found: number;
  /** how many were left out and why */
  skipped: { index: number; reason: string }[];
}

/** A short stable code for a text: the same ad pasted again gets the same code, so it updates the draft instead of adding a second one. */
export function adCode(text: string): string {
  let h = 0x811c9dc5;
  const s = text.replace(/\s+/g, " ").trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `paste-${h.toString(36)}`;
}

const FURNISHING_WORDS = { FULLY_FURNISHED: "furnished", SEMI_FURNISHED: "semi furnished", UNFURNISHED: "unfurnished" } as const;

/** Reads every ad in a pasted text. Ads are separated by a line of dashes or by blank lines (see splitAds). */
export function adsToImportRecords(text: string, places: PlaceRef[], max = 200): BulkPasteResult {
  const ads = splitAds(text);
  // one ad with no separators is still an ad
  const blocks = ads.length > 0 ? ads : text.trim().length >= 15 ? [text.trim()] : [];
  const records: BulkPasteResult["records"] = [];
  const skipped: BulkPasteResult["skipped"] = [];
  const seen = new Set<string>();
  blocks.slice(0, max).forEach((block, i) => {
    const p = parseListingText(block, places);
    // an ad with neither a price nor a kind of property is not an ad we can use (a header, a phone list, a greeting)
    const price = p.monthlyRent ?? p.price;
    if (price === undefined && !p.propertyType) { skipped.push({ index: i + 1, reason: "no price and no kind of property found" }); return; }
    const id = adCode(block);
    if (seen.has(id)) { skipped.push({ index: i + 1, reason: "the same ad appears twice" }); return; }
    seen.add(id);
    const municipality = places.find(x => x.id === p.municipalityId);
    const row: Record<string, string | number> = { id, title: p.title, description: p.description };
    if (p.transaction) row.transaction = p.transaction === "FOR_RENT" ? "rent" : "sale";
    if (p.propertyType) row.type = p.propertyType;
    if (price !== undefined) row.price = price;
    if (p.areaSqm !== undefined) row.size = p.areaSqm;
    if (p.bedrooms !== undefined) row.bedrooms = p.bedrooms;
    if (p.bathrooms !== undefined) row.bathrooms = p.bathrooms;
    if (municipality) row.city = municipality.name;
    if (p.placeName) row.district = p.placeName;
    if (p.furnishing) row.furnished = FURNISHING_WORDS[p.furnishing];
    records.push(row);
  });
  if (blocks.length > max) skipped.push({ index: max + 1, reason: `only the first ${max} ads are read each time` });
  return { records, found: blocks.length, skipped };
}
