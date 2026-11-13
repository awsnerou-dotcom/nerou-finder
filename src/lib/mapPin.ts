// The exact spot an agent puts on the map for a listing, and searching the map by area. A listing only counts as being
// "on the map" when its agent really placed the pin (Property.exactLocation): a listing without one is saved at a
// placeholder point and is never shown at, or searched by, that made-up spot. Pure functions, unit tested.

export interface Pin { latitude: number; longitude: number }
export interface Bounds { south: number; west: number; north: number; east: number }

/** a pin outside Qatar is a mistake (or an attempt to put rubbish on the map) and is refused */
export const QATAR_BOUNDS: Bounds = { south: 24.4, west: 50.7, north: 26.25, east: 51.75 };
/** where a listing without an exact pin is stored; never treated as a real location */
export const PLACEHOLDER_PIN: Pin = { latitude: 25.3, longitude: 51.5 };

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}

export function inBounds(p: Pin, b: Bounds): boolean {
  return p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude <= b.east;
}

/** a usable pin (numbers, inside Qatar, six decimals), or null */
export function cleanPin(raw: unknown): Pin | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const latitude = num(r.latitude);
  const longitude = num(r.longitude);
  if (latitude === null || longitude === null) return null;
  const pin = { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
  return inBounds(pin, QATAR_BOUNDS) ? pin : null;
}

/** did the agent place this listing on the map? */
export function hasExactPin(p: { exactLocation?: boolean; latitude?: number; longitude?: number }): boolean {
  return p.exactLocation === true && cleanPin({ latitude: p.latitude, longitude: p.longitude }) !== null;
}

/** "south,west,north,east" from the query string; null unless it is a sensible box */
export function parseBounds(raw: unknown): Bounds | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",");
  if (parts.length !== 4) return null;
  const nums = parts.map(num);
  if (nums.some(n => n === null)) return null;
  const [south, west, north, east] = nums as number[];
  if (south >= north || west >= east) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  return { south, west, north, east };
}

export function formatBounds(b: Bounds): string {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return `${r(b.south)},${r(b.west)},${r(b.north)},${r(b.east)}`;
}
