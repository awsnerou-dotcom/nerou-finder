import { describe, it, expect } from "vitest";
import { escapeHtml } from "../../server.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert('x')</script> & "quoted"`)).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;"
    );
  });

  it("neutralizes a script-injection attempt so no tag survives", () => {
    const payload = `<img src=x onerror="alert(1)">`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).not.toContain(">");
  });

  it("passes plain text through unchanged", () => {
    expect(escapeHtml("Ahmed Al-Mansoori")).toBe("Ahmed Al-Mansoori");
  });

  it("treats null/undefined as an empty string instead of the literal word", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("coerces non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});
