import { describe, it, expect } from "vitest";
import { fileMatchesDeclaredType } from "../../server.js";

describe("fileMatchesDeclaredType", () => {
  it("accepts a real JPEG signature declared as image/jpeg", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(fileMatchesDeclaredType(jpeg, "image/jpeg")).toBe(true);
  });

  it("accepts a real PNG signature declared as image/png", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(fileMatchesDeclaredType(png, "image/png")).toBe(true);
  });

  it("accepts a real PDF signature declared as application/pdf", () => {
    const pdf = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3", "binary");
    expect(fileMatchesDeclaredType(pdf, "application/pdf")).toBe(true);
  });

  it("accepts a real WEBP signature (RIFF....WEBP) declared as image/webp", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(fileMatchesDeclaredType(webp, "image/webp")).toBe(true);
  });

  it("rejects a spoofed upload - HTML bytes declared as image/jpeg", () => {
    const fakeImage = Buffer.from("<html><script>alert(1)</script></html>", "utf-8");
    expect(fileMatchesDeclaredType(fakeImage, "image/jpeg")).toBe(false);
  });

  it("rejects a PNG's real bytes declared as a different type (image/gif)", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(fileMatchesDeclaredType(png, "image/gif")).toBe(false);
  });

  it("rejects an unrecognized declared mimetype outright", () => {
    const anything = Buffer.from([0x00, 0x01, 0x02]);
    expect(fileMatchesDeclaredType(anything, "application/x-msdownload")).toBe(false);
  });
});
