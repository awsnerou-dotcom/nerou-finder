// The expiry date of a verification document. One rule, used by the upload form, the server and the daily sweep: a document whose
// date is today or earlier has expired. A date that has already passed must never be saved or approved - the sweep would mark the
// document expired again at once, and the applicant and the admin would go round in circles.

const DAY = 24 * 60 * 60 * 1000;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value;
}

/** True when the date is today or in the past. A missing or unreadable date never counts as expired. */
export function hasExpired(expiryDate: string | undefined | null, now: number = Date.now()): boolean {
  if (!expiryDate) return false;
  const t = Date.parse(expiryDate);
  return !Number.isNaN(t) && Math.ceil((t - now) / DAY) <= 0;
}

/** The first date that can still be entered: tomorrow. */
export const earliestExpiryDate = (now: number = Date.now()): string => new Date(now + DAY).toISOString().slice(0, 10);
