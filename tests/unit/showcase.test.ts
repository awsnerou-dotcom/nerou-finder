import { describe, it, expect } from "vitest";
import { validateShowcaseInput, safeImageUrl, safeWebsite, sortShowcase, formatSince } from "../../src/lib/showcase.js";

const good = { name: "Gulf Elite Realty", kind: "AGENCY", description: "A full-service real-estate company in Doha with ten years of experience.", published: true };

describe("what an admin may enter for a subscriber", () => {
  it("accepts a complete entry and cleans it", () => {
    const r = validateShowcaseInput({ ...good, name: "  Gulf   Elite  Realty ", nameAr: "الخليج النخبة", descriptionAr: "شركة عقارية", since: "2026-11", website: "gulfelite.qa", logoUrl: "/assets/uploads/logo-1.png", photoUrl: "https://cdn.example.com/team.jpg", orgId: "org-1" });
    expect(r).toMatchObject({ ok: true, value: { name: "Gulf Elite Realty", nameAr: "الخليج النخبة", since: "2026-11", website: "https://gulfelite.qa/", logoUrl: "/assets/uploads/logo-1.png", photoUrl: "https://cdn.example.com/team.jpg", orgId: "org-1", published: true } });
  });

  it("needs a name and a real description", () => {
    expect(validateShowcaseInput({ ...good, name: "  " })).toMatchObject({ ok: false });
    expect(validateShowcaseInput({ ...good, description: "Too short" })).toMatchObject({ ok: false });
    expect(validateShowcaseInput({ ...good, description: "x".repeat(601) })).toMatchObject({ ok: false });
    expect(validateShowcaseInput({ ...good, descriptionAr: "ب".repeat(601) })).toMatchObject({ ok: false });
  });

  it("is hidden unless explicitly published, and falls back to a company for unknown kinds", () => {
    const r = validateShowcaseInput({ ...good, published: undefined, kind: "weird" });
    expect(r).toMatchObject({ ok: true, value: { published: false, kind: "AGENCY" } });
  });

  it("rejects images that are not ours or https (no javascript:, data:, http:, path tricks)", () => {
    for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "http://x.com/a.png", "/assets/uploads/../../etc/passwd", "/assets/other/x.png", "//evil.com/x.png", 5]) {
      expect(validateShowcaseInput({ ...good, logoUrl: bad }), String(bad)).toMatchObject({ ok: false });
      expect(validateShowcaseInput({ ...good, photoUrl: bad }), String(bad)).toMatchObject({ ok: false });
    }
    expect(safeImageUrl("")).toBeUndefined();
    expect(safeImageUrl("/assets/uploads/a-b_c.1.jpg")).toBe("/assets/uploads/a-b_c.1.jpg");
  });

  it("only accepts web addresses for the website", () => {
    expect(safeWebsite("javascript:alert(1)")).toBe("invalid");
    expect(safeWebsite("nodots")).toBe("invalid");
    expect(safeWebsite("ftp://x.com")).toBe("invalid");
    expect(safeWebsite("http://x.com")).toBe("http://x.com/");
    expect(safeWebsite("x.com/about")).toBe("https://x.com/about");
    expect(safeWebsite(undefined)).toBeUndefined();
  });

  it("wants the subscription month as YYYY-MM", () => {
    expect(validateShowcaseInput({ ...good, since: "11/2026" })).toMatchObject({ ok: false });
    expect(validateShowcaseInput({ ...good, since: "2026-13" })).toMatchObject({ ok: false });
    expect(validateShowcaseInput({ ...good, since: "2026-02" })).toMatchObject({ ok: true });
  });
});

describe("how the list is shown", () => {
  it("follows the admin's order, newest first among equals", () => {
    const list = [
      { id: "c", sortOrder: 2, createdAt: "2026-01-01" },
      { id: "b", sortOrder: 1, createdAt: "2026-01-01" },
      { id: "a", sortOrder: 1, createdAt: "2026-03-01" }
    ];
    expect(sortShowcase(list).map(x => x.id)).toEqual(["a", "b", "c"]);
  });

  it("writes the subscription month in both languages", () => {
    expect(formatSince("2026-11", "en")).toBe("Nov 2026");
    expect(formatSince("2026-11", "ar")).toBe("نوفمبر 2026");
    expect(formatSince(undefined, "en")).toBe("");
    expect(formatSince("nonsense", "en")).toBe("");
  });
});
