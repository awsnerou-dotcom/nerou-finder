/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Home-page hero: two Qatar skyline photos that dissolve into each other in slow motion.
// The photos are shown at their true size and sharpness - no zoom, no re-compression, and the
// hero is tall enough (see VisitorExperience) to show most of each photo instead of a thin crop.
// Pure CSS - no timers or re-renders - and it stays on a still first photo for visitors who ask
// their device to reduce motion. The timing lives in src/index.css (.hero-slide / hero-fade).

const SLIDES = [
  {
    src: "/assets/images/hero-lusail-towers.jpg",
    // the hero is a wide, short strip, so only the middle band of each photo shows: aim it at the
    // towers' crowns (this one) / the downtown cluster (the other) instead of the sky or the sea
    focus: "50% 66%"
  },
  {
    src: "/assets/images/hero-doha-aerial.jpg",
    focus: "50% 58%"
  }
];

export default function PhotoHero() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d1b2a]" aria-hidden="true">
      {SLIDES.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          // The first photo is the page's LCP image; the second only has to be ready before the
          // first cross-fade, so it must not compete with it.
          fetchPriority={i === 0 ? "high" : "low"}
          decoding="async"
          className={`hero-slide ${i === 1 ? "hero-slide-b" : ""} absolute inset-0 w-full h-full object-cover`}
          style={{ objectPosition: slide.focus }}
          draggable={false}
        />
      ))}

      {/* Header-legibility gradient: protects the logo/nav specifically, independent of any
          other overlay layers rendered by the parent panel. */}
      <div
        className="absolute top-0 inset-x-0 h-[120px] pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(10,8,6,0.5) 0%, rgba(10,8,6,0) 100%)" }}
      />

      {/* Legibility scrim for the white headline and search UI. Kept light so the photos keep their
          colour and contrast: a soft darkening on the text side (start edge) fading to almost
          nothing on the far side, plus a gentle top/bottom vignette. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/35 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-black/35 via-black/10 to-transparent pointer-events-none" />
    </div>
  );
}
