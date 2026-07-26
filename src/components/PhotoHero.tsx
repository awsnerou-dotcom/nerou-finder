/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function PhotoHero() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <img
        src="/assets/images/hero-doha-skyline.jpg"
        alt=""
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
