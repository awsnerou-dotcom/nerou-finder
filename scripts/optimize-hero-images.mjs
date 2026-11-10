// Makes the lighter copies of the three home-page hero photos.
//
//   node scripts/optimize-hero-images.mjs
//
// For each assets/images/hero-<name>.jpg it writes (the jpg stays as the fallback for old browsers):
//   hero-<name>.avif / .webp      same size as the jpg, same pixels, a third smaller or more
//   hero-<name>-m.avif / -m.webp  for phones: only the middle 70% of the width, full height, same pixel
//                                 density. A phone shows a narrow strip from the middle of the photo
//                                 (object-position 50%), so the sides were being downloaded for nothing.
// No resizing and no extra blur: nothing here makes a photo look smaller or softer than before.

/* global process, console */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "assets", "images");
const NAMES = ["hero-lusail-towers", "hero-qatar-spiral-minaret", "hero-pearl-marina"];
const MOBILE_KEEP = 0.7; // share of the width kept for phones

const kb = file => Math.round(fs.statSync(file).size / 1024) + "KB";

for (const name of NAMES) {
  const src = path.join(dir, `${name}.jpg`);
  const { width, height } = await sharp(src).metadata();
  const cropWidth = Math.round(width * MOBILE_KEEP);
  const left = Math.round((width - cropWidth) / 2);
  const variants = [
    { suffix: "", make: () => sharp(src) },
    { suffix: "-m", make: () => sharp(src).extract({ left, top: 0, width: cropWidth, height }) }
  ];
  for (const { suffix, make } of variants) {
    await make().avif({ quality: 70, effort: 6 }).toFile(path.join(dir, `${name}${suffix}.avif`));
    await make().webp({ quality: 86, effort: 6 }).toFile(path.join(dir, `${name}${suffix}.webp`));
  }
  console.log(
    `${name} ${width}x${height} | jpg ${kb(src)} | avif ${kb(path.join(dir, `${name}.avif`))} webp ${kb(path.join(dir, `${name}.webp`))}` +
    ` | phone ${cropWidth}x${height}: avif ${kb(path.join(dir, `${name}-m.avif`))} webp ${kb(path.join(dir, `${name}-m.webp`))}`
  );
}
