// A picture of a listing made for WhatsApp, Instagram and status updates: the photo, the price, the place, the agent and the
// site. Drawn on a canvas in the browser, so it needs no server and no paid design tool. Text-fitting is plain arithmetic
// (wrapLines) and is unit tested; the drawing itself is checked by eye.

export interface ShareCardInput {
  imageUrl?: string;
  title: string;
  price: string;
  place: string;
  specs: string;
  agentName: string;
  agentLine?: string;
  site: string;
  isRtl: boolean;
  /** shown on a ribbon over the photo, e.g. "For rent" */
  badge?: string;
}

/** Splits text into lines no wider than `maxWidth` using `measure`, at most `maxLines` (the last is cut with an ellipsis). */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const trial = line ? `${line} ${words[i]}` : words[i];
    if (measure(trial) <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) { line = ""; break; }
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const W = 1080;
const H = 1350;
const PHOTO_H = 760;

/** Draws the card and returns it as a PNG. A photo that cannot be read (another site forbids it) just leaves a plain panel. */
export async function renderShareCard(i: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  try { await (document as any).fonts?.ready; } catch { /* fonts are a nicety */ }

  const serif = `"Playfair Display", "Noto Naskh Arabic", Georgia, serif`;
  const sans = `"Manrope", "Noto Sans Arabic", system-ui, -apple-system, "Segoe UI", sans-serif`;
  const rtl = i.isRtl;
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const x = rtl ? W - 64 : 64;

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0e1b2e");
  bg.addColorStop(1, "#16243d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // photo, cropped to fill
  const img = i.imageUrl ? await loadImage(i.imageUrl) : null;
  if (img) {
    const scale = Math.max(W / img.width, PHOTO_H / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (W - dw) / 2, (PHOTO_H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1d2f50";
    ctx.fillRect(0, 0, W, PHOTO_H);
  }
  const fade = ctx.createLinearGradient(0, PHOTO_H - 220, 0, PHOTO_H);
  fade.addColorStop(0, "rgba(14,27,46,0)");
  fade.addColorStop(1, "rgba(14,27,46,0.95)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, PHOTO_H - 220, W, 220);

  // ribbon
  if (i.badge) {
    ctx.font = `700 34px ${sans}`;
    const bw = ctx.measureText(i.badge).width + 56;
    const bx = rtl ? W - 48 - bw : 48;
    ctx.fillStyle = "#c9a24a";
    ctx.beginPath();
    const rounded = (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect;
    if (rounded) rounded.call(ctx, bx, 48, bw, 64, 32);
    else ctx.rect(bx, 48, bw, 64);
    ctx.fill();
    ctx.fillStyle = "#0f1a2b";
    ctx.textAlign = "center";
    ctx.fillText(i.badge, bx + bw / 2, 92);
    ctx.textAlign = rtl ? "right" : "left";
  }

  // price
  ctx.fillStyle = "#e3c26a";
  ctx.font = `700 78px ${serif}`;
  ctx.fillText(i.price, x, PHOTO_H + 92);

  // title
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 48px ${serif}`;
  const lines = wrapLines(i.title, W - 128, s => ctx.measureText(s).width, 2);
  lines.forEach((l, n) => ctx.fillText(l, x, PHOTO_H + 168 + n * 60));
  const afterTitle = PHOTO_H + 168 + (lines.length - 1) * 60;

  // place and specs
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(i.place, x, afterTitle + 64);
  ctx.fillStyle = "#94a3b8";
  ctx.font = `500 32px ${sans}`;
  ctx.fillText(i.specs, x, afterTitle + 114);

  // footer: the agent and the site
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, H - 150, W, 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 38px ${sans}`;
  ctx.fillText(i.agentName, x, H - 86);
  if (i.agentLine) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 28px ${sans}`;
    ctx.fillText(i.agentLine, x, H - 42);
  }
  ctx.fillStyle = "#e3c26a";
  ctx.font = `700 34px ${sans}`;
  ctx.textAlign = rtl ? "left" : "right";
  ctx.direction = "ltr";
  ctx.fillText(i.site, rtl ? 64 : W - 64, H - 64);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}
