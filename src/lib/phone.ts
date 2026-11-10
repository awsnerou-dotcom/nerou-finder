// Phone numbers come in many shapes ("+974 3333 4444", "0097433334444", "33334444", Arabic digits).
// A tel: or wa.me link needs the plain international digits, so this normalises them. Shared by the
// server (which decides what number a listing's Call/WhatsApp buttons use) and the browser.

const ARABIC_INDIC = /[٠-٩]/g;
const PERSIAN = /[۰-۹]/g;

/** Digits only, with Arabic-Indic and Persian digits turned into 0-9. */
function plainDigits(raw: string): string {
  return raw
    .replace(ARABIC_INDIC, d => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

/**
 * The number as international digits, ready for `tel:+<digits>` or `wa.me/<digits>`, or "" when it
 * is not a usable number. A local 8-digit Qatar number gets the 974 country code; a leading 00 is
 * dropped; anything shorter than 8 digits is rejected.
 */
export function normalizePhoneDigits(raw: string | undefined | null): string {
  if (!raw) return "";
  let digits = plainDigits(String(raw));
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) return `974${digits}`;
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

/** The first of these that is a usable number, normalised ("" if none is). */
export function firstUsableNumber(candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    const n = normalizePhoneDigits(c);
    if (n) return n;
  }
  return "";
}

/** "+974 3333 4444" for a Qatar number, "+<digits>" for any other. */
export function formatPhoneForDisplay(digits: string): string {
  if (/^974\d{8}$/.test(digits)) return `+974 ${digits.slice(3, 7)} ${digits.slice(7)}`;
  return digits ? `+${digits}` : "";
}
