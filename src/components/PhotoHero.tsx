/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";

// Home-page hero: four photos that dissolve into each other in slow motion.
// The photos are shown at their true size and sharpness - no zoom, no softening: the lighter AVIF /
// WebP copies have the same pixels as the original JPG (made by scripts/optimize-hero-images.mjs),
// and the hero is tall enough (see VisitorExperience) to show most of each photo instead of a thin crop.
// The fade itself is pure CSS (no timers, no re-renders) and it stays on a still first photo for
// visitors who ask their device to reduce motion. The timing lives in src/index.css
// (.hero-slide / hero-fade-4), which is written for exactly four photos - change both together
// if you add or remove one (and add the photo to PHOTOS in scripts/optimize-hero-images.mjs).
//
// Speed: only the FIRST photo is downloaded while the page loads (it is what the visitor sees, and
// what Google measures). The others start downloading once the page has finished loading and the
// browser is idle - the first change of photo is 12 seconds away, so they are always ready in time.
// On a phone the hero shows only a narrow strip of each photo, so phones get a copy cut to 70% of the
// width (same pixel density) instead of the full width.

const SLIDES = [
  {
    base: "/assets/images/hero-lusail-towers",
    // focus = which band of the photo the hero strip should keep in view (the strip is wider
    // than the photos, so the top and bottom get cropped): here the towers' crowns
    focus: "50% 66%"
  },
  {
    base: "/assets/images/hero-qatar-spiral-minaret",
    focus: "50% 8%" // keeps the whole minaret, crest included, in frame
  },
  {
    base: "/assets/images/hero-pearl-marina",
    focus: "50% 64%" // the apartment towers and the yachts in front of them
  },
  {
    base: "/assets/images/hero-qanat-quartier",
    focus: "50% 38%" // the towers' crowns (with some sky above them) down to the quay
  }
];
const SLIDE_SECONDS = 12; // time between one photo taking over and the next doing so
const PHONE = "(max-width: 600px)";

// The phone copies are cut to 70% of the photo's width around a centre chosen per photo (see
// scripts/optimize-hero-images.mjs), so each phone copy shows its own subject at the centre of the
// strip. Every focus above is therefore "50% ...": the horizontal position lives in the cut, not here.

function HeroPicture({ base, focus, first }: { base: string; focus: string; first: boolean }) {
  return (
    <picture>
      <source media={PHONE} type="image/avif" srcSet={`${base}-m.avif`} />
      <source media={PHONE} type="image/webp" srcSet={`${base}-m.webp`} />
      <source type="image/avif" srcSet={`${base}.avif`} />
      <source type="image/webp" srcSet={`${base}.webp`} />
      <img
        src={`${base}.jpg`}
        alt=""
        // The first photo is the page's LCP image; the others only have to be ready before
        // their turn, so they must not compete with it.
        fetchPriority={first ? "high" : "low"}
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: focus }}
        draggable={false}
      />
    </picture>
  );
}

export default function PhotoHero() {
  // photos 2 and 3 wait until the page has loaded and the browser has nothing better to do
  const [loadRest, setLoadRest] = useState(false);
  useEffect(() => {
    const start = () => {
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
      // "timeout": start within 3 seconds even if the browser never goes idle, so photo 2 is always
      // ready well before the first change of photo (12 seconds in)
      if (idle) idle(() => setLoadRest(true), { timeout: 3000 }); else setTimeout(() => setLoadRest(true), 1500);
    };
    if (document.readyState === "complete") { start(); return; }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d1b2a] isolate" aria-hidden="true">
      {SLIDES.map((slide, i) => (
        // Each slide is one animated layer: the fade/stacking animation runs on this wrapper.
        <div
          key={slide.base}
          className="hero-slide absolute inset-0"
          // photo k starts its loop (SLIDES.length - k) steps ahead so they take turns
          style={i === 0 ? undefined : { animationDelay: `-${SLIDE_SECONDS * (SLIDES.length - i)}s` }}
        >
          {(i === 0 || loadRest) && <HeroPicture base={slide.base} focus={slide.focus} first={i === 0} />}
        </div>
      ))}

      {/* Header-legibility gradient: protects the logo/nav specifically, independent of any
          other overlay layers rendered by the parent panel. */}
      <div
        className="absolute top-0 inset-x-0 h-[120px] pointer-events-none z-10"
        style={{ background: "linear-gradient(180deg, rgba(10,8,6,0.5) 0%, rgba(10,8,6,0) 100%)" }}
      />

      {/* Legibility scrim for the white headline and search UI. Kept light so the photos keep their
          colour and contrast: a soft darkening on the text side (start edge) fading to almost
          nothing on the far side, plus a gentle top/bottom vignette. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/35 pointer-events-none z-10" />
      <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-black/35 via-black/10 to-transparent pointer-events-none z-10" />
    </div>
  );
}
