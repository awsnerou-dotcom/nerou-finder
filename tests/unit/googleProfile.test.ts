import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { COMPANY } from "../../src/companyInfo.js";

// The company's Google Business Profile is named in two places that must agree: the footer (companyInfo.ts) and the site's
// structured data (index.html), where it ties the profile and the website to one organisation.
describe("the Google Business Profile link", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);

  it("is a public https link", () => {
    expect(COMPANY.googleProfile).toMatch(/^https:\/\/(share\.google|maps\.app\.goo\.gl|g\.page|www\.google\.com)\//);
  });

  it("is listed as the organisation's sameAs in the site's structured data, which is still valid JSON", () => {
    expect(block).not.toBeNull();
    const data = JSON.parse(block![1]);
    const org = data["@graph"].find((x: { "@type": string }) => x["@type"] === "Organization");
    expect(org.sameAs).toContain(COMPANY.googleProfile);
    expect(org.url).toBe("https://www.neroufinder.com/");
  });
});
