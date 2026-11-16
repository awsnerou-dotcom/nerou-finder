/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Clock, Search } from "lucide-react";
import { GUIDES, GUIDE_CATEGORIES, guideText, hubText, readMinutes } from "../lib/guides.js";
import type { GuideCategory } from "../data/guideTypes.js";

// /guides: every Qatar property guide, grouped by what the reader is trying to do. The server sends the same list as plain HTML
// for search engines; this is the app's own page for people, with a search box and category filter.

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

export default function GuidesView({ isRtl, onOpenGuide, guideOpen }: { isRtl: boolean; onOpenGuide: (slug: string) => void; guideOpen?: boolean }) {
  const lang = isRtl ? "ar" : "en";
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const hub = hubText(lang);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GuideCategory | "all">("all");

  // The tab title is this page's while no guide is open over it. Putting the previous title back is the parent's job (it knows
  // where the visitor went next); doing it here raced with the guide's own cleanup.
  useEffect(() => {
    if (!guideOpen) document.title = hub.title;
  }, [hub.title, guideOpen]);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return GUIDES.filter(g => {
      if (category !== "all" && g.category !== category) return false;
      if (!q) return true;
      const x = guideText(g, lang);
      return norm([x.title, x.description, x.summary].join(" ")).includes(q);
    });
  }, [query, category, lang]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-serif text-ink font-medium flex items-center gap-2">
          <BookOpen className="text-gold" size={24} />
          <span>{hub.h1}</span>
        </h1>
        <p className="text-sm text-ink-muted mt-2 max-w-3xl leading-relaxed">{hub.intro}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <span className="sr-only">{t("Search the guides", "ابحث في الأدلة")}</span>
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("Search the guides", "ابحث في الأدلة")}
            className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-ink focus:outline-none focus:border-gold"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Category", "الفئة")}>
          {[{ id: "all" as const, label: t("All", "الكل") }, ...GUIDE_CATEGORIES.map(c => ({ id: c.id, label: isRtl ? c.label.ar : c.label.en }))].map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border cursor-pointer transition-colors ${category === c.id ? "bg-ink text-white border-ink" : "bg-surface text-ink-muted border-border hover:border-gold"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">{t("No guide matches your search.", "لا يوجد دليل يطابق بحثك.")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map(g => {
            const x = guideText(g, lang);
            const cat = GUIDE_CATEGORIES.find(c => c.id === g.category);
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => onOpenGuide(g.slug)}
                className="text-start p-5 bg-surface border border-border rounded-xl hover:border-gold hover:shadow-xs transition-all cursor-pointer group flex flex-col gap-2"
              >
                <span className="text-[10px] font-bold text-gold uppercase tracking-wider">{cat ? (isRtl ? cat.label.ar : cat.label.en) : ""}</span>
                <span className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-base font-semibold text-ink group-hover:text-gold transition-colors">{x.title}</h2>
                  <ChevronRight size={16} className={`shrink-0 text-ink-muted group-hover:text-gold transition-colors mt-1 ${isRtl ? "rotate-180" : ""}`} />
                </span>
                <span className="text-[12.5px] text-ink-muted leading-relaxed">{x.description}</span>
                <span className="mt-auto pt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-faint"><Clock size={12} />{readMinutes(g, lang)} {t("min read", "د للقراءة")}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
