/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Clock, Compass } from "lucide-react";
import { getGuide, guideText, guideTitleTag, linkLabel, readMinutes, relatedGuides, GUIDE_CATEGORIES } from "../lib/guides.js";

// One guide (/guides/<slug>) as the app shows it. The server sends the same text as plain HTML for search engines; this is the
// readable version for people, with the next step one tap away.

export default function GuideArticleView({
  slug,
  isRtl,
  onClose,
  onOpenGuide,
  onGo
}: {
  slug: string;
  isRtl: boolean;
  onClose: () => void;
  onOpenGuide: (slug: string) => void;
  /** a site path from the guide's "next step" links, e.g. "/price-check" */
  onGo: (path: string) => void;
}) {
  const lang = isRtl ? "ar" : "en";
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const guide = getGuide(slug);
  const text = useMemo(() => (guide ? guideText(guide, lang) : null), [guide, lang]);

  // putting the previous title back when this closes is the parent's job (see GuidesView)
  useEffect(() => {
    if (guide) document.title = guideTitleTag(guide, lang);
  }, [guide, lang]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  const Back = isRtl ? ArrowRight : ArrowLeft;
  const Next = isRtl ? ArrowLeft : ArrowRight;
  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink cursor-pointer"><Back size={16} /> {t("All guides", "كل الأدلة")}</button>
        {children}
      </div>
    </div>
  );

  if (!guide || !text) {
    return shell(
      <div className="text-center py-24 space-y-3">
        <BookOpen size={32} className="mx-auto text-ink-faint" />
        <h2 className="font-serif text-xl font-semibold text-ink">{t("This guide does not exist", "هذا الدليل غير موجود")}</h2>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-gold-active underline underline-offset-2 cursor-pointer">{t("See all guides", "شاهد كل الأدلة")}</button>
      </div>
    );
  }

  const category = GUIDE_CATEGORIES.find(c => c.id === guide.category);
  const go = guide.links.map(p => ({ path: p, label: linkLabel(p, lang) })).filter((x): x is { path: string; label: string } => !!x.label);
  const related = relatedGuides(guide);

  return shell(
    <article className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white px-6 py-8 sm:px-10 shadow-popover">
        <div className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative space-y-3">
          {category && <p className="text-xs font-semibold text-gold uppercase tracking-[0.16em]">{isRtl ? category.label.ar : category.label.en}</p>}
          <h1 className="font-serif text-2xl sm:text-4xl font-medium leading-tight">{text.title}</h1>
          <p className="flex items-center gap-3 text-[12px] text-gray-300">
            <span className="inline-flex items-center gap-1.5"><Clock size={13} />{readMinutes(guide, lang)} {t("min read", "د للقراءة")}</span>
            <span aria-hidden>·</span>
            <span>{t("Updated", "آخر تحديث")} <time dateTime={guide.updated}>{guide.updated}</time></span>
          </p>
        </div>
      </header>

      <p className="rounded-2xl border border-gold/40 bg-gold-soft/60 px-5 py-4 text-[15px] leading-relaxed text-ink font-medium">{text.summary}</p>

      {text.sections.map(s => (
        <section key={s.h} className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-ink">{s.h}</h2>
          {s.p.map((x, i) => <p key={i} className="text-[15px] leading-relaxed text-ink-muted">{x}</p>)}
          {s.list.length > 0 && (
            <ul className="space-y-2">
              {s.list.map((x, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-muted">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold shrink-0" aria-hidden />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-ink">{t("Frequently asked questions", "أسئلة شائعة")}</h2>
        <div className="space-y-2">
          {text.faq.map(f => (
            <details key={f.q} className="group rounded-xl border border-border bg-surface px-4 py-3">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-[14px] font-semibold text-ink">
                <span>{f.q}</span>
                <ChevronDown size={16} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-[12px] text-ink-faint leading-relaxed">{t("General information, not legal or financial advice. Rules and fees change: confirm the current ones with the relevant authority.", "معلومات عامة وليست استشارة قانونية أو مالية. القواعد والرسوم تتغير، فتأكد من الحالية لدى الجهة المختصة.")}</p>

      {go.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><Compass size={18} className="text-gold" />{t("Next step", "الخطوة التالية")}</h2>
          <div className="flex flex-wrap gap-2">
            {go.map((x, i) => (
              <button key={x.path} type="button" onClick={() => onGo(x.path)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition ${i === 0 ? "bg-gold text-gold-ink hover:brightness-110" : "bg-surface-2 text-ink hover:bg-border"}`}>
                {x.label}<Next size={14} />
              </button>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-ink">{t("Related guides", "أدلة ذات صلة")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map(r => (
              <button key={r.slug} type="button" onClick={() => onOpenGuide(r.slug)} className="text-start rounded-xl border border-border bg-surface p-4 hover:border-gold transition-colors cursor-pointer">
                <span className="block font-serif text-[15px] font-semibold text-ink">{guideText(r, lang).title}</span>
                <span className="block mt-1 text-[12px] text-ink-muted leading-relaxed">{guideText(r, lang).description}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
