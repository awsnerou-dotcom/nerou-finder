/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { withLang } from "../lib/seo.js";

// The text of an SEO landing page (/apartments-for-rent-in-lusail ...) shown to people: the page's
// heading and intro above the listings, the frequently asked questions and related searches below.
// It is the same text the server writes into the page for search engines, so what a visitor reads is
// what Google indexed (the app used to replace that text with the bare search page).

interface Content {
  h1: string;
  intro: string;
  faq: { q: string; a: string }[];
  related: { path: string; label: string }[];
  areaGuide: { slug: string; title: string } | null;
}

const cache = new Map<string, Content | null>();

function useLandingContent(path: string, isRtl: boolean) {
  const key = `${isRtl ? "ar" : "en"}:${path}`;
  const [data, setData] = useState<Content | null | undefined>(cache.get(key));
  useEffect(() => {
    if (cache.has(key)) { setData(cache.get(key)); return; }
    let cancelled = false;
    fetch(`/api/seo/landing?path=${encodeURIComponent(path)}&lang=${isRtl ? "ar" : "en"}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { cache.set(key, d); if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [key, path, isRtl]);
  return data;
}

export function LandingIntro({ path, isRtl }: { path: string; isRtl: boolean }) {
  const c = useLandingContent(path, isRtl);
  if (!c) return null;
  return (
    <section className="space-y-2" data-testid="landing-intro">
      <h1 className="text-2xl md:text-3xl font-serif text-ink font-medium tracking-tight">{c.h1}</h1>
      <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">{c.intro}</p>
      {c.areaGuide && (
        <a href={withLang(`/areas/${c.areaGuide.slug}`, isRtl ? "ar" : "en")} className="inline-block text-sm font-semibold text-gold-active underline underline-offset-2">
          {c.areaGuide.title}
        </a>
      )}
    </section>
  );
}

export function LandingFaq({ path, isRtl }: { path: string; isRtl: boolean }) {
  const c = useLandingContent(path, isRtl);
  if (!c) return null;
  return (
    <div className="space-y-8 pt-4" data-testid="landing-faq">
      {c.faq.length > 0 && (
        <section>
          <h2 className="text-lg font-serif text-ink font-medium mb-3">{isRtl ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
          <dl className="grid gap-4 md:grid-cols-2">
            {c.faq.map(f => (
              <div key={f.q} className="bg-surface border border-border rounded-xl p-4">
                <dt className="text-sm font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-ink-muted leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {c.related.length > 0 && (
        <nav aria-label={isRtl ? "عمليات بحث ذات صلة" : "Related searches"}>
          <h2 className="text-lg font-serif text-ink font-medium mb-3">{isRtl ? "عمليات بحث ذات صلة" : "Related searches"}</h2>
          <ul className="flex flex-wrap gap-2">
            {c.related.map(r => (
              <li key={r.path}>
                <a href={withLang(r.path, isRtl ? "ar" : "en")} className="inline-block px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs font-semibold text-ink hover:border-gold">
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
