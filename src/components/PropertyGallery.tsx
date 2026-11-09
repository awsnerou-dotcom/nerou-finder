/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Listing photo gallery, built the way the large property portals do it:
//  - desktop: a big hero photo with two stacked photos beside it (full width of the page),
//  - mobile: a swipeable full-width carousel,
//  - any tap opens a full-screen viewer that shows the WHOLE photo (never cropped) over a
//    blurred copy of itself, so portrait phone photos and wide shots both look finished.
// Photo categories become text tabs with counts inside the viewer instead of small white pills
// floating on top of the picture (which disappeared on bright photos).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Images, Compass, ImageOff } from "lucide-react";
import { getThumbnailUrl } from "../lib/image.js";

export interface GalleryGroup {
  key: string;
  label: string;
  images: string[];
}

interface PropertyGalleryProps {
  title: string;
  isRtl: boolean;
  groups: GalleryGroup[]; // first group is "all photos"
}

export default function PropertyGallery({ title, isRtl, groups }: PropertyGalleryProps) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mode, setMode] = useState<"photos" | "tour">("photos");
  const [groupKey, setGroupKey] = useState(groups[0]?.key || "ALL");
  const [index, setIndex] = useState(0);
  const [pitch, setPitch] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const markFailed = useCallback((url: string) => {
    setFailed(prev => (prev.has(url) ? prev : new Set(prev).add(url)));
  }, []);

  // Photos whose URL no longer loads are dropped instead of leaving blank holes.
  const visibleGroups = useMemo(
    () =>
      groups
        .map(g => ({ ...g, images: g.images.filter(u => !failed.has(u)) }))
        .filter((g, i) => i === 0 || g.images.length > 0),
    [groups, failed]
  );
  const all = visibleGroups[0]?.images || [];
  const activeGroup = visibleGroups.find(g => g.key === groupKey) || visibleGroups[0];
  const list = activeGroup?.images || [];
  const safeIndex = index >= list.length ? 0 : index;

  const openViewer = (startUrl?: string, nextMode: "photos" | "tour" = "photos") => {
    setMode(nextMode);
    setGroupKey(visibleGroups[0]?.key || "ALL");
    const at = startUrl ? all.indexOf(startUrl) : 0;
    setIndex(at > -1 ? at : 0);
    setViewerOpen(true);
  };

  const step = useCallback(
    (delta: number) => {
      if (list.length === 0) return;
      setIndex(prev => (((prev >= list.length ? 0 : prev) + delta) % list.length + list.length) % list.length);
    },
    [list.length]
  );

  // Keyboard control while the viewer is open. Registered in the capture phase and stopped so
  // that Escape closes only the viewer, not the property page underneath it.
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setViewerOpen(false);
      } else if (e.key === "ArrowRight") {
        step(isRtl ? -1 : 1);
      } else if (e.key === "ArrowLeft") {
        step(isRtl ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [viewerOpen, step, isRtl]);

  if (all.length === 0) {
    return (
      <div className="h-64 sm:h-80 rounded-2xl bg-surface-2 border border-border flex flex-col items-center justify-center gap-2 text-ink-muted">
        <ImageOff size={32} />
        <span className="text-sm font-semibold">{isRtl ? "لا توجد صور لهذا العقار بعد" : "No photos available for this property yet"}</span>
      </div>
    );
  }

  const tile = (url: string, className: string, extra?: React.ReactNode) => (
    <button
      type="button"
      onClick={() => openViewer(url)}
      className={`relative overflow-hidden bg-surface-2 cursor-zoom-in group ${className}`}
      aria-label={isRtl ? "فتح الصورة بالحجم الكامل" : "Open photo full screen"}
    >
      <img
        src={url}
        alt={title}
        onError={() => markFailed(url)}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      {extra}
    </button>
  );

  return (
    <>
      {/* DESKTOP / TABLET: hero + side photos */}
      <div className="hidden sm:block">
        {all.length >= 3 ? (
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5 rounded-2xl overflow-hidden h-[340px] md:h-[420px] lg:h-[500px]">
            {tile(all[0], "col-span-2 row-span-2")}
            {tile(all[1], "")}
            {tile(all[2], "", all.length > 3 ? (
              <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white font-bold text-lg">+{all.length - 3}</span>
            ) : undefined)}
          </div>
        ) : all.length === 2 ? (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden h-[340px] md:h-[420px] lg:h-[500px]">
            {tile(all[0], "")}
            {tile(all[1], "")}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden h-[340px] md:h-[420px] lg:h-[500px] relative">
            {tile(all[0], "w-full h-full")}
          </div>
        )}
      </div>

      {/* MOBILE: swipeable carousel */}
      <div className="sm:hidden relative rounded-2xl overflow-hidden">
        <div
          ref={carouselRef}
          onScroll={e => {
            const el = e.currentTarget;
            setCarouselIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
          }}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
        >
          {all.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => openViewer(url)}
              className="snap-center shrink-0 w-full aspect-[4/3] bg-surface-2"
              aria-label={isRtl ? "فتح الصورة بالحجم الكامل" : "Open photo full screen"}
            >
              <img src={url} alt={title} onError={() => markFailed(url)} loading={i === 0 ? "eager" : "lazy"} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <span className="absolute bottom-3 end-3 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white">
          {Math.min(carouselIndex + 1, all.length)} / {all.length}
        </span>
      </div>

      {/* Action row under the photos - plain labelled buttons, not icons floating on the image */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openViewer()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-bold text-ink hover:border-gold hover:text-gold transition-colors cursor-pointer"
        >
          <Images size={15} />
          {isRtl ? `كل الصور (${all.length})` : `All photos (${all.length})`}
        </button>
        {visibleGroups.slice(1).map(g => (
          <button
            key={g.key}
            type="button"
            onClick={() => {
              openViewer();
              setGroupKey(g.key);
              setIndex(0);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink-muted hover:border-gold hover:text-gold transition-colors cursor-pointer"
          >
            {g.label} ({g.images.length})
          </button>
        ))}
        <button
          type="button"
          onClick={() => openViewer(undefined, "tour")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink-muted hover:border-gold hover:text-gold transition-colors cursor-pointer"
        >
          <Compass size={15} />
          {isRtl ? "جولة ٣٦٠°" : "360° tour"}
        </button>
      </div>

      {/* FULL-SCREEN VIEWER */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black flex flex-col"
          dir={isRtl ? "rtl" : "ltr"}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* top bar */}
          <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 text-white shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {visibleGroups.map(g => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    setMode("photos");
                    setGroupKey(g.key);
                    setIndex(0);
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    mode === "photos" && activeGroup?.key === g.key ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {g.label} <span className="opacity-70">({g.images.length})</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMode("tour")}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  mode === "tour" ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <Compass size={13} />
                {isRtl ? "جولة ٣٦٠°" : "360° tour"}
              </button>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {mode === "photos" && (
                <span className="text-xs font-bold text-white/80 tabular-nums">
                  {safeIndex + 1} / {list.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="rounded-full bg-white/15 p-2 text-white hover:bg-white/30 cursor-pointer"
                aria-label={isRtl ? "إغلاق" : "Close"}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* stage */}
          <div
            className="relative flex-1 min-h-0 overflow-hidden"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (mode !== "photos" || touchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > 50) step((dx < 0 ? 1 : -1) * (isRtl ? -1 : 1));
            }}
          >
            {list[safeIndex] && (
              <>
                {/* blurred copy fills the letterbox so any aspect ratio looks intentional */}
                <img
                  src={list[safeIndex]}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none select-none"
                />
                {mode === "photos" ? (
                  <img
                    key={list[safeIndex]}
                    src={list[safeIndex]}
                    alt={title}
                    onError={() => markFailed(list[safeIndex])}
                    className="relative z-10 w-full h-full object-contain select-none animate-in fade-in duration-200"
                  />
                ) : (
                  <div className="relative z-10 w-full h-full overflow-hidden flex items-center justify-center">
                    <img
                      src={list[safeIndex]}
                      alt="360"
                      className="w-full h-full object-cover opacity-60 select-none pointer-events-none transition-transform duration-200"
                      style={{ transform: `scale(1.15) translateX(${pitch}px)` }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                      <Compass size={34} className="text-gold" />
                      <p className="text-sm font-bold">{isRtl ? "معاينة بانورامية تفاعلية" : "Interactive panorama preview"}</p>
                      <input
                        type="range"
                        min="-200"
                        max="200"
                        value={pitch}
                        onChange={e => setPitch(Number(e.target.value))}
                        className="w-64 accent-gold cursor-ew-resize"
                        aria-label={isRtl ? "تدوير المنظور" : "Rotate view"}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === "photos" && list.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(isRtl ? 1 : -1)}
                  className="absolute z-20 top-1/2 -translate-y-1/2 start-3 sm:start-5 rounded-full bg-black/60 p-3 text-white hover:bg-black/85 cursor-pointer"
                  aria-label={isRtl ? "الصورة التالية" : "Previous photo"}
                >
                  <ChevronLeft size={24} className={isRtl ? "rotate-180" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => step(isRtl ? -1 : 1)}
                  className="absolute z-20 top-1/2 -translate-y-1/2 end-3 sm:end-5 rounded-full bg-black/60 p-3 text-white hover:bg-black/85 cursor-pointer"
                  aria-label={isRtl ? "الصورة السابقة" : "Next photo"}
                >
                  <ChevronRight size={24} className={isRtl ? "rotate-180" : ""} />
                </button>
              </>
            )}
          </div>

          {/* thumbnail strip */}
          {mode === "photos" && list.length > 1 && (
            <div className="shrink-0 flex gap-2 overflow-x-auto scrollbar-none px-3 sm:px-5 py-3 justify-start sm:justify-center">
              {list.map((url, i) => (
                <button
                  key={url + i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                    i === safeIndex ? "border-gold opacity-100" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`${isRtl ? "صورة" : "Photo"} ${i + 1}`}
                >
                  <img
                    src={getThumbnailUrl(url)}
                    onError={e => { if (e.currentTarget.src !== url) e.currentTarget.src = url; }}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
