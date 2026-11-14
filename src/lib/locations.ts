// Walking the Qatar location tree (municipality > area > district), shared by the listing form, the search filters and the
// server. Pure functions, unit tested.

import type { LocationItem } from "../types.js";

export interface AreaOption { loc: LocationItem; depth: 0 | 1 }

const byName = (a: LocationItem, b: LocationItem) => a.name.localeCompare(b.name);

/**
 * Everything a person can pick inside one municipality: its areas, each followed by the districts under it (The Pearl's
 * Porto Arabia, Lusail's Fox Hills...). Before, only the areas were listed, so those districts could not be chosen at all.
 */
export function areaOptions(locations: LocationItem[], municipalityId: string): AreaOption[] {
  if (!municipalityId) return [];
  const live = locations.filter(l => l.isActive);
  const out: AreaOption[] = [];
  for (const area of live.filter(l => l.parentId === municipalityId).sort(byName)) {
    out.push({ loc: area, depth: 0 });
    for (const d of live.filter(l => l.parentId === area.id).sort(byName)) out.push({ loc: d, depth: 1 });
  }
  return out;
}

/** The municipality a location belongs to, however deep it sits. */
export function municipalityOf(locations: LocationItem[], id: string): LocationItem | undefined {
  let cur = locations.find(l => l.id === id);
  for (let guard = 0; cur && guard < 6; guard++) {
    if (cur.type === "MUNICIPALITY") return cur;
    cur = cur.parentId ? locations.find(l => l.id === cur!.parentId) : undefined;
  }
  return undefined;
}

/** The location and everything beneath it (an area also means its districts). */
export function withDescendants(locations: LocationItem[], id: string): LocationItem[] {
  const root = locations.find(l => l.id === id);
  if (!root) return [];
  const out = [root];
  for (let i = 0; i < out.length && out.length < 500; i++) {
    for (const child of locations.filter(l => l.parentId === out[i].id)) if (!out.includes(child)) out.push(child);
  }
  return out;
}

/** Where to centre a map for this place: its own coordinates, else the nearest parent that has some. */
export function locationCenter(locations: LocationItem[], id: string): { latitude: number; longitude: number } | null {
  let cur = locations.find(l => l.id === id);
  for (let guard = 0; cur && guard < 6; guard++) {
    if (typeof cur.latitude === "number" && typeof cur.longitude === "number" && Number.isFinite(cur.latitude) && Number.isFinite(cur.longitude)) {
      return { latitude: cur.latitude, longitude: cur.longitude };
    }
    cur = cur.parentId ? locations.find(l => l.id === cur!.parentId) : undefined;
  }
  return null;
}

/** Listing counts for an area: its own plus its districts', from per-district facet counts. */
export function areaListingCount(locations: LocationItem[], id: string, cityName: string, countOf: (city: string, name: string) => number | undefined): number {
  return withDescendants(locations, id).reduce((sum, l) => sum + (countOf(cityName, l.name) || 0), 0);
}
