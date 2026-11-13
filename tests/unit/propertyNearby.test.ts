import { describe, it, expect } from "vitest";
import { sanitizeNearbyPlaces, formatNearbyDistance, nearbyTypeLabel, MAX_NEARBY_PLACES } from "../../src/lib/propertyNearby.js";

describe("cleaning the nearby places an agent sends", () => {
  it("keeps well-formed places as given", () => {
    expect(sanitizeNearbyPlaces([
      { type: "SCHOOL", name: "Doha College", nameAr: "كلية الدوحة", value: 8, unit: "DRIVE_MIN" },
      { type: "MALL", name: "Lagoona Mall", value: 1.24, unit: "KM" }
    ])).toEqual([
      { type: "SCHOOL", name: "Doha College", nameAr: "كلية الدوحة", value: 8, unit: "DRIVE_MIN" },
      { type: "MALL", name: "Lagoona Mall", value: 1.2, unit: "KM" }
    ]);
  });

  it("accepts numbers typed into a form (as strings) and tidies the name", () => {
    expect(sanitizeNearbyPlaces([{ type: "PARK", name: "  Aspire   Park ", value: "5", unit: "WALK_MIN" }]))
      .toEqual([{ type: "PARK", name: "Aspire Park", value: 5, unit: "WALK_MIN" }]);
  });

  it("turns an unknown type into 'other' but drops what cannot be repaired", () => {
    const out = sanitizeNearbyPlaces([
      { type: "SPACEPORT", name: "Odd one", value: 3, unit: "KM" },
      { type: "SCHOOL", name: "", value: 3, unit: "KM" }, // no name
      { type: "SCHOOL", name: "No unit", value: 3 },
      { type: "SCHOOL", name: "Bad unit", value: 3, unit: "PARSECS" },
      { type: "SCHOOL", name: "Zero", value: 0, unit: "KM" },
      { type: "SCHOOL", name: "Negative", value: -4, unit: "KM" },
      { type: "SCHOOL", name: "Not a number", value: "far", unit: "KM" },
      { type: "SCHOOL", name: "Too far", value: 5000, unit: "KM" },
      { type: "SCHOOL", name: "Too long a walk", value: 600, unit: "WALK_MIN" },
      "text", null, 42, []
    ]);
    expect(out).toEqual([{ type: "OTHER", name: "Odd one", value: 3, unit: "KM" }]);
  });

  it("never throws and returns nothing for anything that is not a list", () => {
    for (const bad of [undefined, null, "x", 5, {}, { 0: { name: "a" } }]) expect(sanitizeNearbyPlaces(bad)).toEqual([]);
  });

  it("keeps at most the allowed number, and limits name length", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ type: "SCHOOL", name: `School ${i}`, value: i + 1, unit: "KM" }));
    expect(sanitizeNearbyPlaces(many)).toHaveLength(MAX_NEARBY_PLACES);
    const long = sanitizeNearbyPlaces([{ type: "MALL", name: "x".repeat(300), value: 1, unit: "KM" }]);
    expect(long[0].name).toHaveLength(80);
  });

  it("rounds minutes to whole numbers and drops a distance that rounds to nothing", () => {
    expect(sanitizeNearbyPlaces([{ type: "MALL", name: "A", value: 4.6, unit: "WALK_MIN" }])[0].value).toBe(5);
    expect(sanitizeNearbyPlaces([{ type: "MALL", name: "B", value: 0.2, unit: "WALK_MIN" }])).toEqual([]);
  });
});

describe("wording a place for the visitor", () => {
  it("says the distance in English and Arabic", () => {
    expect(formatNearbyDistance({ value: 5, unit: "WALK_MIN" }, false)).toBe("5 min walk");
    expect(formatNearbyDistance({ value: 12, unit: "DRIVE_MIN" }, false)).toBe("12 min drive");
    expect(formatNearbyDistance({ value: 1.2, unit: "KM" }, false)).toBe("1.2 km");
    expect(formatNearbyDistance({ value: 5, unit: "WALK_MIN" }, true)).toBe("5 دقيقة سيراً");
    expect(formatNearbyDistance({ value: 12, unit: "DRIVE_MIN" }, true)).toBe("12 دقيقة بالسيارة");
    expect(formatNearbyDistance({ value: 1.2, unit: "KM" }, true)).toBe("1.2 كم");
  });

  it("labels a type, falling back to 'other'", () => {
    expect(nearbyTypeLabel("SCHOOL", false)).toBe("School");
    expect(nearbyTypeLabel("SCHOOL", true)).toBe("مدرسة");
    expect(nearbyTypeLabel("???", false)).toBe("Other");
  });
});
