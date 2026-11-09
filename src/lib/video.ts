// Listing video tours: agents paste a normal YouTube or Vimeo link and the site embeds it.
// Only these two hosts are accepted, and only as https links, so a listing can never make the
// page embed an arbitrary site. Shared by the server (validation on save) and the browser
// (building the embed address).

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

/** Returns the embeddable player address for a YouTube/Vimeo link, or null if it isn't one. */
export function getVideoEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] || "";
    return YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    let id = "";
    if (parts[0] === "watch") id = url.searchParams.get("v") || "";
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1] || "";
    return YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find(p => VIMEO_ID.test(p)) || "";
    return VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
