import { describe, it, expect } from "vitest";
import { areaOptions, municipalityOf, withDescendants, locationCenter, areaListingCount } from "../../src/lib/locations.js";
import { DEFAULT_LOCATIONS } from "../../server-db.js";
import type { LocationItem } from "../../src/types.js";

const loc = (id: string, name: string, type: LocationItem["type"], parentId?: string, extra: Partial<LocationItem> = {}): LocationItem =>
  ({ id, name, nameAr: name, type, parentId, isActive: true, ...extra });

const tree: LocationItem[] = [
  loc("q", "Qatar", "COUNTRY"),
  loc("m1", "Doha", "MUNICIPALITY", "q", { latitude: 25.28, longitude: 51.53 }),
  loc("m2", "Al Rayyan", "MUNICIPALITY", "q"),
  loc("a-b", "Bin Mahmoud", "AREA", "m1"),
  loc("a-p", "The Pearl", "AREA", "m1", { latitude: 25.37, longitude: 51.55 }),
  loc("d-1", "Viva Bahriya", "DISTRICT", "a-p"),
  loc("d-2", "Porto Arabia", "DISTRICT", "a-p", { latitude: 25.369, longitude: 51.549 }),
  loc("a-off", "Hidden", "AREA", "m1", { isActive: false }),
  loc("a-r", "Al Waab", "AREA", "m2")
];

describe("areaOptions", () => {
  it("lists areas A-Z with their districts under them, skipping inactive ones", () => {
    expect(areaOptions(tree, "m1").map(o => `${o.depth}:${o.loc.name}`)).toEqual([
      "0:Bin Mahmoud", "0:The Pearl", "1:Porto Arabia", "1:Viva Bahriya"
    ]);
    expect(areaOptions(tree, "m2").map(o => o.loc.name)).toEqual(["Al Waab"]);
    expect(areaOptions(tree, "")).toEqual([]);
    expect(areaOptions(tree, "nope")).toEqual([]);
  });
});

describe("municipalityOf / withDescendants / locationCenter", () => {
  it("finds the municipality from any depth", () => {
    expect(municipalityOf(tree, "d-1")?.id).toBe("m1");
    expect(municipalityOf(tree, "a-r")?.id).toBe("m2");
    expect(municipalityOf(tree, "m1")?.id).toBe("m1");
    expect(municipalityOf(tree, "q")).toBeUndefined();
  });
  it("an area includes its districts", () => {
    expect(withDescendants(tree, "a-p").map(l => l.id).sort()).toEqual(["a-p", "d-1", "d-2"]);
    expect(withDescendants(tree, "a-b").map(l => l.id)).toEqual(["a-b"]);
    expect(withDescendants(tree, "zzz")).toEqual([]);
  });
  it("centres on the place, else the nearest parent with coordinates", () => {
    expect(locationCenter(tree, "d-2")).toEqual({ latitude: 25.369, longitude: 51.549 });
    expect(locationCenter(tree, "d-1")).toEqual({ latitude: 25.37, longitude: 51.55 }); // from The Pearl
    expect(locationCenter(tree, "a-b")).toEqual({ latitude: 25.28, longitude: 51.53 }); // from Doha
    expect(locationCenter(tree, "a-r")).toBeNull(); // nothing up the chain
    expect(locationCenter(tree, "zzz")).toBeNull();
  });
});

describe("areaListingCount", () => {
  it("adds the districts' listings to the area's own", () => {
    const counts: Record<string, number> = { "doha|the pearl": 2, "doha|porto arabia": 3, "doha|viva bahriya": 1 };
    const countOf = (city: string, name: string) => counts[`${city}|${name}`.toLowerCase()];
    expect(areaListingCount(tree, "a-p", "Doha", countOf)).toBe(6);
    expect(areaListingCount(tree, "d-2", "Doha", countOf)).toBe(3);
    expect(areaListingCount(tree, "a-b", "Doha", countOf)).toBe(0);
  });
});

describe("the built-in Qatar locations", () => {
  const live = DEFAULT_LOCATIONS;
  it("has unique ids and slugs, and every place hangs off a real parent of the right kind", () => {
    const ids = new Set(live.map(l => l.id));
    expect(ids.size).toBe(live.length);
    const slugs = live.map(l => l.seoSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const l of live) {
      if (l.type === "COUNTRY") continue;
      const parent = live.find(p => p.id === l.parentId);
      expect(parent, `${l.name} has no parent`).toBeTruthy();
      if (l.type === "MUNICIPALITY") expect(parent!.type).toBe("COUNTRY");
      if (l.type === "AREA") expect(parent!.type).toBe("MUNICIPALITY");
      if (l.type === "DISTRICT") expect(parent!.type).toBe("AREA");
    }
  });
  it("has coordinates inside Qatar wherever it gives them", () => {
    for (const l of live.filter(x => x.latitude !== undefined || x.longitude !== undefined)) {
      expect(l.latitude, l.name).toBeGreaterThan(24.4);
      expect(l.latitude, l.name).toBeLessThan(26.25);
      expect(l.longitude, l.name).toBeGreaterThan(50.7);
      expect(l.longitude, l.name).toBeLessThan(51.75);
    }
  });
  it("covers the well-known neighbourhoods that were missing", () => {
    const names = new Set(live.map(l => l.name));
    for (const n of ["Al Dafna", "Al Mirqab", "Al Markhiya", "Duhail", "Onaiza", "Al Sailiya", "Dukhan", "Zekreet", "Qetaifan Island"]) expect(names.has(n), n).toBe(true);
  });
  it("every municipality can be centred on the map", () => {
    for (const m of live.filter(l => l.type === "MUNICIPALITY")) expect(locationCenter(live, m.id), m.name).not.toBeNull();
  });
});
