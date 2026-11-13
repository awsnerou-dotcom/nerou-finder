// A listing can carry a link to a 3D / virtual tour (Matterport, Kuula, a 360 viewer...). The visitor opens it in a new
// tab, so the one thing to get right is that only a plain, safe web address is ever stored or followed.
// Pure function, unit tested; used by POST /api/properties and by the agent form.

export const MAX_TOUR_URL = 300;

/**
 * The cleaned address, or undefined when it is empty or not acceptable. Accepts only https links to a real host
 * (a dot in the name), with no embedded login (user:pass@) and no spaces; anything else (javascript:, data:, http:,
 * file:, a bare word) is refused rather than guessed at.
 */
export function cleanTourUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  if (!text || text.length > MAX_TOUR_URL || /\s/.test(text)) return undefined;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  if (url.username || url.password) return undefined;
  if (!url.hostname.includes(".") || url.hostname.startsWith(".") || url.hostname.endsWith(".")) return undefined;
  return url.toString();
}
