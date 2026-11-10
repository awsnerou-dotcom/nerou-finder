// Makes the lighter copies of the home-page hero photos (see PHOTOS below).
//
//   node scripts/optimize-hero-images.mjs
//
// For each assets/images/hero-<name>.jpg it writes (the jpg stays as the fallback for old browsers):
//   hero-<name>.avif / .webp      same size as the jpg, same pixels, a third smaller or more
//   hero-<name>-m.avif / -m.webp  for phones: 70% of the width (the middle, or around cropCenter), full height, same pixel
//                                 density. A phone shows a narrow strip from the middle of the photo
//                                 (object-position 50%), so the sides were being downloaded for nothing.
// No resizing and no extra blur: nothing here makes a photo look smaller or softer than before.

/* global process, console */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "assets", "images");
// cropCenter = where the phone copy is centred, as a share of the photo's width (0.5 = the middle).
// A phone only shows a narrow strip, so a photo whose subject sits off-centre says where to cut.
const PHOTOS = [
  { name: "hero-lusail-towers" },
  { name: "hero-qatar-spiral-minaret" },
  { name: "hero-pearl-marina" },
  { name: "hero-qanat-quartier", cropCenter: 0.4 } // the big beige tower and the dark glass tower beside it
];
const MOBILE_KEEP = 0.7; // share of the width kept for phones

const kb = file => Math.round(fs.statSync(file).size / 1024) + "KB";

for (const { name, cropCenter = 0.5 } of PHOTOS) {
  const src = path.join(dir, `${name}.jpg`);
  const { width, height } = await sharp(src).metadata();
  const cropWidth = Math.round(width * MOBILE_KEEP);
  const left = Math.min(width - cropWidth, Math.max(0, Math.round(width * cropCenter - cropWidth / 2)));
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
