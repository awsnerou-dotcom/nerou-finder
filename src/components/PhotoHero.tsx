/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function PhotoHero() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* This is the page's LCP image. A real srcset with multiple pre-resized variants would
          be the fuller fix (mobile visitors currently download the same full-resolution file
          as desktop) but that needs an image pipeline to actually generate those variants,
          which isn't wired up in this project - fetchpriority is a safe, real improvement in
          the meantime, telling the browser to prioritize this fetch immediately. */}
      <img
        src="/assets/images/hero-doha-skyline.jpg"
        alt=""
        fetchPriority="high"
        className="w-full h-full object-cover kenburns-slow"
        draggable={false}
      />

      {/* Header-legibility gradient: protects the logo/nav specifically, independent of any
          other overlay layers rendered by the parent panel. */}
      <div
        className="absolute top-0 inset-x-0 h-[120px] pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(10,8,6,0.5) 0%, rgba(10,8,6,0) 100%)" }}
      />

      {/* Base darkening so the gold/white nav text and search UI stay readable across the
          whole photo, not just the top strip. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60 pointer-events-none" />
    </div>
  );
}
