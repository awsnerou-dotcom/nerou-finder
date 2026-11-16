import { describe, it, expect } from "vitest";
import { changedPaths, inBatches, isPublicOrigin, parseStamps, urlsFor } from "../../src/lib/indexNow.js";

describe("what is new or changed", () => {
  it("is everything the first time, then only what moved", () => {
    const now = { "/": "a", "/guides": "1", "/properties/p1": "t1" };
    expect(changedPaths({}, now)).toEqual(["/", "/guides", "/properties/p1"]);
    expect(changedPaths(now, now)).toEqual([]);
    expect(changedPaths(now, { ...now, "/properties/p1": "t2", "/properties/p2": "t1" })).toEqual(["/properties/p1", "/properties/p2"]);
  });

  it("does not resend a page that disappeared", () => {
    expect(changedPaths({ "/a": "1", "/b": "1" }, { "/a": "1" })).toEqual([]);
  });
});

describe("addresses", () => {
  it("gives both languages of every page, the home page without a trailing path", () => {
    expect(urlsFor(["/", "/guides"], "https://x.example")).toEqual([
      "https://x.example/", "https://x.example/ar", "https://x.example/guides", "https://x.example/ar/guides"
    ]);
  });

  it("splits long lists into requests the service accepts", () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inBatches([], 2)).toEqual([]);
    expect(inBatches(Array.from({ length: 10001 }, (_, i) => i)).map(b => b.length)).toEqual([10000, 1]);
  });
});

describe("the saved record", () => {
  it("reads what it wrote and treats anything else as nothing sent", () => {
    expect(parseStamps(JSON.stringify({ "/a": "1" }))).toEqual({ "/a": "1" });
    expect(parseStamps("not json")).toEqual({});
    expect(parseStamps("[1,2]")).toEqual({});
    expect(parseStamps("")).toEqual({});
    expect(parseStamps(null)).toEqual({});
    expect(parseStamps(JSON.stringify({ "/a": 5, "/b": "x" }))).toEqual({ "/b": "x" });
  });
});

describe("which addresses may be announced", () => {
  it("only the live site, never a development machine", () => {
    expect(isPublicOrigin("https://www.neroufinder.com")).toBe(true);
    expect(isPublicOrigin("https://neroufinder.com")).toBe(true);
    expect(isPublicOrigin("http://localhost:3000")).toBe(false);
    expect(isPublicOrigin("http://127.0.0.1:3100")).toBe(false);
    expect(isPublicOrigin("http://app.localhost")).toBe(false);
    expect(isPublicOrigin("https://staging.example.test")).toBe(false);
    expect(isPublicOrigin("not a url")).toBe(false);
  });
});
