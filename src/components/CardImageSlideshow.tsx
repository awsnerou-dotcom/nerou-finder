/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { getThumbnailUrl } from "../lib/image.js";

// The photo area of a listing card: the listing's photos change by themselves, dissolving into one
// another with a slow, gentle zoom, so a card feels alive and shows more than its first photo.
//
// It stops - and stays on the photo it is showing - as soon as someone touches the card, hovers it
// with a mouse, or moves to it with the keyboard; a finger resumes it a few seconds after it lifts.
// Everything else about the card is untouched.
//
// Careful with people's phones and data:
//  - a card only starts moving once it is on screen, and stops when scrolled away or the tab is hidden;
//  - a photo is only downloaded when its turn is next (the first card photo loads as before);
//  - no movement at all for visitors who asked their device for reduced motion or turned on data saver;
//  - cards do not flip in step: each one starts at a slightly different moment.

const MAX_PHOTOS = 6;
const INTERVAL_MS = 3800;
const FADE_MS = 900;
const ZOOM_MS = 6000;
const TOUCH_RESUME_MS = 4000;

function prefersCalm(): boolean {
  if (typeof window === "undefined") return true;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
  return !!reduce || !!saveData;
}

export default function CardImageSlideshow({ images, alt }: { images: string[]; alt: string }) {
  const photos = (images || []).filter(Boolean).slice(0, MAX_PHOTOS);
  const many = photos.length > 1;
  const box = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false); // has been on screen: later photos may now download
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  // the furthest photo that has been put on the page so far: once there, a photo stays (so fading back
  // to an earlier one never waits on the network, and a photo never vanishes mid-fade)
  const [reached, setReached] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const calm = useRef(prefersCalm());

  // on screen or not
  useEffect(() => {
    const el = box.current;
    if (!el || !many || calm.current) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); setStarted(true); return; }
    const io = new IntersectionObserver(entries => {
      const visible = entries.some(e => e.isIntersecting);
      setInView(visible);
      if (visible) setStarted(true);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [many]);

  // after the card has been seen: the photo showing and the next one are put on the page
  useEffect(() => {
    if (started) setReached(r => Math.min(Math.max(r, index + 1), photos.length - 1));
  }, [started, index, photos.length]);

  // a hidden browser tab does not need to animate
  useEffect(() => {
    if (!many || calm.current) return;
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [many]);

  // touching / hovering / focusing anywhere on the card stops the movement
  useEffect(() => {
    const el = box.current;
    if (!el || !many || calm.current) return;
    const card = (el.closest("[data-listing-card]") as HTMLElement | null) ?? el;
    let resume: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { if (resume) clearTimeout(resume); setPaused(true); };
    const go = () => { if (resume) clearTimeout(resume); setPaused(false); };
    const touchEnd = () => { if (resume) clearTimeout(resume); resume = setTimeout(() => setPaused(false), TOUCH_RESUME_MS); };
    card.addEventListener("mouseenter", stop);
    card.addEventListener("mouseleave", go);
    card.addEventListener("focusin", stop);
    card.addEventListener("focusout", go);
    card.addEventListener("touchstart", stop, { passive: true });
    card.addEventListener("touchend", touchEnd, { passive: true });
    card.addEventListener("touchcancel", touchEnd, { passive: true });
    return () => {
      if (resume) clearTimeout(resume);
      card.removeEventListener("mouseenter", stop);
      card.removeEventListener("mouseleave", go);
      card.removeEventListener("focusin", stop);
      card.removeEventListener("focusout", go);
      card.removeEventListener("touchstart", stop);
      card.removeEventListener("touchend", touchEnd);
      card.removeEventListener("touchcancel", touchEnd);
    };
  }, [many]);

  // the timer: runs only while the card is on screen, not touched, and the tab is showing
  const running = many && !calm.current && inView && !paused && tabVisible;
  useEffect(() => {
    if (!running) return;
    // the first change comes after a slightly different wait on every card so they do not move in step
    const first = INTERVAL_MS * 0.5 + Math.random() * 1800;
    let timer = setTimeout(function tick() {
      setIndex(i => (i + 1) % photos.length);
      timer = setTimeout(tick, INTERVAL_MS);
    }, first);
    return () => clearTimeout(timer);
  }, [running, photos.length]);

  if (photos.length === 0) {
    return <div className="absolute inset-0 bg-gray-100" aria-hidden="true" />;
  }


  return (
    <div ref={box} className="absolute inset-0 bg-gray-100">
      {photos.map((src, i) => {
        if (i > reached) return null;
        const active = i === index;
        return (
          <img
            key={src + i}
            src={getThumbnailUrl(src)}
            onError={(e) => { if (e.currentTarget.src !== src) e.currentTarget.src = src; }}
            alt={i === 0 ? alt : ""}
            aria-hidden={i === 0 ? undefined : true}
            loading={i === 0 ? "lazy" : "eager"}
            decoding="async"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: active ? 1 : 0,
              // a slow push-in on the photo that is showing; it only snaps back once it has faded out
              transform: active && many && !calm.current ? "scale(1.07)" : "scale(1)",
              transition: active
                ? `opacity ${FADE_MS}ms ease-in-out, transform ${ZOOM_MS}ms linear`
                : `opacity ${FADE_MS}ms ease-in-out, transform 0s linear ${FADE_MS}ms`,
              willChange: many ? "opacity, transform" : undefined
            }}
          />
        );
      })}
      {many && (
        <div className="pointer-events-none absolute bottom-2 inset-x-0 flex justify-center gap-1" aria-hidden="true">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/55"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

