import { describe, it, expect } from "vitest";
import { getVideoEmbedUrl } from "../../src/lib/video.js";

describe("getVideoEmbedUrl", () => {
  it("turns the usual YouTube link shapes into the privacy-friendly embed address", () => {
    const want = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "  https://youtu.be/dQw4w9WgXcQ  "
    ]) {
      expect(getVideoEmbedUrl(url), url).toBe(want);
    }
  });

  it("handles Vimeo links", () => {
    expect(getVideoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(getVideoEmbedUrl("https://player.vimeo.com/video/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });

  it("rejects anything that is not an https YouTube/Vimeo video", () => {
    for (const url of [
      "",
      "not a url",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ", // not https
      "https://evil.example.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/channel/UC1234567890",
      "https://vimeo.com/channels/staffpicks",
      "javascript:alert(1)",
      "https://www.youtube.com/embed/dQw4w9WgXcQ\"><script>"
    ]) {
      expect(getVideoEmbedUrl(url), url).toBeNull();
    }
    expect(getVideoEmbedUrl(undefined)).toBeNull();
    expect(getVideoEmbedUrl(42)).toBeNull();
  });
});
