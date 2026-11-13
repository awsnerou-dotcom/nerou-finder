import { describe, it, expect } from "vitest";
import { cleanPin, hasExactPin, parseBounds, formatBounds, inBounds, QATAR_BOUNDS, PLACEHOLDER_PIN } from "../../src/lib/mapPin.js";

describe("cleanPin", () => {
  it("accepts a spot in Qatar, as numbers or numeric text, to six decimals", () => {
    expect(cleanPin({ latitude: 25.2854, longitude: 51.531 })).toEqual({ latitude: 25.2854, longitude: 51.531 });
    expect(cleanPin({ latitude: "25.2854123456", longitude: "51.5310999999" })).toEqual({ latitude: 25.285412, longitude: 51.5311 });
  });

  it("refuses anything outside Qatar, unreadable, or missing", () => {
    expect(cleanPin({ latitude: 51.5, longitude: -0.12 })).toBeNull();      // London
    expect(cleanPin({ latitude: 25.3, longitude: 40 })).toBeNull();
    expect(cleanPin({ latitude: NaN, longitude: 51.5 })).toBeNull();
    expect(cleanPin({ latitude: "abc", longitude: 51.5 })).toBeNull();
    expect(cleanPin({ latitude: "", longitude: "" })).toBeNull();
    expect(cleanPin({ latitude: 25.3 })).toBeNull();
    expect(cleanPin(null)).toBeNull();
    expect(cleanPin("25.3,51.5")).toBeNull();
  });
});

describe("hasExactPin", () => {
  it("is true only when the agent placed the pin, and it is a real spot", () => {
    expect(hasExactPin({ exactLocation: true, latitude: 25.28, longitude: 51.53 })).toBe(true);
    expect(hasExactPin({ latitude: 25.28, longitude: 51.53 })).toBe(false);                    // never placed
    expect(hasExactPin({ exactLocation: false, latitude: 25.28, longitude: 51.53 })).toBe(false);
    expect(hasExactPin({ exactLocation: true, latitude: 0, longitude: 0 })).toBe(false);       // flagged but nonsense
    expect(hasExactPin({ ...PLACEHOLDER_PIN })).toBe(false);
  });
});

describe("map boxes", () => {
  it("reads south,west,north,east", () => {
    expect(parseBounds("25.2,51.4,25.4,51.6")).toEqual({ south: 25.2, west: 51.4, north: 25.4, east: 51.6 });
    expect(formatBounds({ south: 25.2000001, west: 51.4, north: 25.4, east: 51.6 })).toBe("25.2,51.4,25.4,51.6");
  });

  it("rejects boxes that make no sense", () => {
    for (const bad of [undefined, 5, "", "1,2,3", "1,2,3,4,5", "a,b,c,d", "25.4,51.4,25.2,51.6", "25.2,51.6,25.4,51.4", "-95,0,10,10", "0,-200,10,10", "25,51,25,52"]) {
      expect(parseBounds(bad as never)).toBeNull();
    }
  });

  it("says whether a point is inside, edges included", () => {
    const b = { south: 25.2, west: 51.4, north: 25.4, east: 51.6 };
    expect(inBounds({ latitude: 25.3, longitude: 51.5 }, b)).toBe(true);
    expect(inBounds({ latitude: 25.2, longitude: 51.6 }, b)).toBe(true);
    expect(inBounds({ latitude: 25.41, longitude: 51.5 }, b)).toBe(false);
    expect(inBounds({ latitude: 25.3, longitude: 51.39 }, b)).toBe(false);
    expect(inBounds(PLACEHOLDER_PIN, QATAR_BOUNDS)).toBe(true);
  });
});
