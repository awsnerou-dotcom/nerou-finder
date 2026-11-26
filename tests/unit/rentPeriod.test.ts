import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rentPeriodSuffix } from "../../src/lib/propertySpecs.js";

describe("what follows a rent figure", () => {
  it("is per month when the listing does not say (rents here are monthly figures)", () => {
    expect(rentPeriodSuffix(undefined, false)).toBe("/ month");
    expect(rentPeriodSuffix("", true)).toBe("/ شهر");
    expect(rentPeriodSuffix("something-else", false)).toBe("/ month");
  });
  it("follows the listing when it does say, in the reader's language", () => {
    expect(rentPeriodSuffix("MONTHLY", false)).toBe("/ month");
    expect(rentPeriodSuffix("YEARLY", true)).toBe("/ سنة");
    expect(rentPeriodSuffix("WEEKLY", false)).toBe("/ week");
    expect(rentPeriodSuffix("DAILY", true)).toBe("/ يوم");
  });
  it("is never replaced by a yearly default on any screen", () => {
    const root = path.join(process.cwd(), "src");
    const files = (fs.readdirSync(root, { recursive: true }) as string[]).filter(f => /\.tsx?$/.test(f));
    const offenders = files.filter(f => /rentalPeriod \|\| ["']YR["']/.test(fs.readFileSync(path.join(root, f), "utf-8")));
    expect(offenders).toEqual([]);
  });
});
