import { describe, it, expect } from "vitest";
import { cleanTourUrl, MAX_TOUR_URL } from "../../src/lib/virtualTour.js";

describe("the virtual tour link", () => {
  it("accepts an ordinary https link and tidies it", () => {
    expect(cleanTourUrl("https://my.matterport.com/show/?m=abc123")).toBe("https://my.matterport.com/show/?m=abc123");
    expect(cleanTourUrl("  https://kuula.co/share/collection/7Xyz1  ")).toBe("https://kuula.co/share/collection/7Xyz1");
    expect(cleanTourUrl("HTTPS://Example.COM/Tour")).toBe("https://example.com/Tour");
  });

  it("refuses anything that is not a plain https web address", () => {
    for (const bad of [
      "http://example.com/tour", // not secure
      "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "ftp://example.com/x", "vbscript:x",
      "//example.com/tour", "example.com/tour", "tour", "https://", "https://localhost/x", "https://intranet/x"
    ]) expect(cleanTourUrl(bad), bad).toBeUndefined();
  });

  it("refuses embedded logins, spaces and over-long links", () => {
    expect(cleanTourUrl("https://user:pass@example.com/tour")).toBeUndefined();
    expect(cleanTourUrl("https://user@example.com/tour")).toBeUndefined();
    expect(cleanTourUrl("https://example.com/my tour")).toBeUndefined();
    expect(cleanTourUrl(`https://example.com/${"a".repeat(MAX_TOUR_URL)}`)).toBeUndefined();
  });

  it("treats anything else as no link", () => {
    for (const v of [undefined, null, "", "   ", 5, {}, []]) expect(cleanTourUrl(v)).toBeUndefined();
  });
});
