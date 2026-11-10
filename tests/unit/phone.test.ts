import { describe, it, expect } from "vitest";
import { firstUsableNumber, formatPhoneForDisplay, normalizePhoneDigits } from "../../src/lib/phone.js";

describe("normalizePhoneDigits", () => {
  it("turns every way of writing the same Qatar number into the same international digits", () => {
    for (const raw of ["+974 3333 4444", "00974 3333 4444", "0097433334444", "974-3333-4444", "(974) 33334444", "3333 4444", "33334444", "+٩٧٤ ٣٣٣٣ ٤٤٤٤", "٣٣٣٣٤٤٤٤"]) {
      expect(normalizePhoneDigits(raw), raw).toBe("97433334444");
    }
  });

  it("keeps a foreign number as it is and rejects anything that is not a real number", () => {
    expect(normalizePhoneDigits("+44 7700 900123")).toBe("447700900123");
    expect(normalizePhoneDigits("0044 7700 900123")).toBe("447700900123");
    for (const bad of ["", "   ", "Call Event", "WhatsApp Event", "12345", "abc", "1234567", "1".repeat(16)]) {
      expect(normalizePhoneDigits(bad), bad).toBe("");
    }
    expect(normalizePhoneDigits(undefined)).toBe("");
    expect(normalizePhoneDigits(null)).toBe("");
  });
});

describe("firstUsableNumber", () => {
  it("skips empty and unusable entries and returns the first real number, normalised", () => {
    expect(firstUsableNumber([undefined, "", "Call Event", "5555 1234", "+974 6666 7777"])).toBe("97455551234");
    expect(firstUsableNumber(["", "n/a"])).toBe("");
    expect(firstUsableNumber([])).toBe("");
  });
});

describe("formatPhoneForDisplay", () => {
  it("groups a Qatar number and prefixes others with +", () => {
    expect(formatPhoneForDisplay("97433334444")).toBe("+974 3333 4444");
    expect(formatPhoneForDisplay("447700900123")).toBe("+447700900123");
    expect(formatPhoneForDisplay("")).toBe("");
  });
});
