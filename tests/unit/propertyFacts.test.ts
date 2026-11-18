import { describe, it, expect } from "vitest";
import { hasRooms, bedsText, bathsText } from "../../src/lib/propertyFacts";

describe("propertyFacts", () => {
  it("knows which property types have rooms", () => {
    for (const t of ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "STUDIO", "COMPOUND", "ROOM", "CHALET", "HOTEL_APARTMENT"]) {
      expect(hasRooms(t)).toBe(true);
    }
    for (const t of ["LAND", "OFFICE", "SHOP", "RETAIL", "WAREHOUSE", "BUILDING", "FARM", "COMMERCIAL", "OTHER"]) {
      expect(hasRooms(t)).toBe(false);
    }
    expect(hasRooms(undefined)).toBe(true);
  });

  it("writes bedrooms in correct English", () => {
    expect(bedsText(1, "APARTMENT", false)).toBe("1 bed");
    expect(bedsText(3, "VILLA", false)).toBe("3 beds");
    expect(bedsText(0, "APARTMENT", false)).toBe("Studio");
    expect(bedsText(2, "STUDIO", false)).toBe("Studio");
  });

  it("writes bedrooms and bathrooms in correct Arabic", () => {
    expect(bedsText(1, "VILLA", true)).toBe("غرفة نوم");
    expect(bedsText(2, "VILLA", true)).toBe("غرفتا نوم");
    expect(bedsText(4, "VILLA", true)).toBe("4 غرف");
    expect(bedsText(12, "VILLA", true)).toBe("12 غرفة");
    expect(bedsText(0, "APARTMENT", true)).toBe("استوديو");
    expect(bathsText(1, "VILLA", true)).toBe("حمام");
    expect(bathsText(2, "VILLA", true)).toBe("حمامان");
    expect(bathsText(5, "VILLA", true)).toBe("5 حمامات");
  });

  it("shows nothing for rooms that do not apply or are unknown", () => {
    expect(bedsText(4, "WAREHOUSE", false)).toBe("");
    expect(bathsText(4, "LAND", false)).toBe("");
    expect(bathsText(0, "APARTMENT", false)).toBe("");
    expect(bathsText(undefined, "APARTMENT", true)).toBe("");
    expect(bedsText(undefined, "APARTMENT", false)).toBe("");
    expect(bedsText(-1, "APARTMENT", false)).toBe("");
  });

  it("bathrooms in English are singular for one", () => {
    expect(bathsText(1, "APARTMENT", false)).toBe("1 bath");
    expect(bathsText(2, "APARTMENT", false)).toBe("2 baths");
  });
});
