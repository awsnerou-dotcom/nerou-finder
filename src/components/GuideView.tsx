/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Building, Check, CheckCircle2, Clock, Compass, CreditCard, ExternalLink, Lightbulb, PlayCircle, Search, Sparkles, TrendingUp, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GuideArt from "./GuideArt.js";
import { SectionHeader } from "./WorkspaceParts.js";
import { GUIDE_ARTICLES } from "../lib/guideContent.js";
import {
  CATEGORIES, GUIDE_LANG_KEY, READ_KEY, START_PATH, articlesFor, goToFor, nextInPath, parseGuideLang, parseRead, pathProgress, searchGuide, serializeRead, suggestArticles
} from "../lib/guide.js";
import type { AccountFacts, GuideAccent, GuideArticle, GuideCategory, GuideLang, Persona } from "../lib/guide.js";

// The subscriber guide inside the workspaces: a catalogue of every feature with a picture, the steps, why it matters and a button
// that takes you to the place. Reads in Arabic or English whatever language the site is in; suggests what to read from where the account is.

const CAT_ICON: Record<GuideCategory, LucideIcon> = { start: Compass, listings: Building, clients: Briefcase, growth: TrendingUp, team: Users, account: CreditCard };

const TONE: Record<GuideAccent, { chip: string; num: string }> = {
  indigo: { chip: "bg-indigo-100 text-indigo-700", num: "bg-indigo-500" },
  emerald: { chip: "bg-emerald-100 text-emerald-700", num: "bg-emerald-500" },
  amber: { chip: "bg-amber-100 text-amber-700", num: "bg-amber-500" },
  sky: { chip: "bg-sky-100 text-sky-700", num: "bg-sky-500" },
  teal: { chip: "bg-teal-100 text-teal-700", num: "bg-teal-500" },
  violet: { chip: "bg-violet-100 text-violet-700", num: "bg-violet-500" },
  rose: { chip: "bg-rose-100 text-rose-700", num: "bg-rose-500" },
  fuchsia: { chip: "bg-fuchsia-100 text-fuchsia-700", num: "bg-fuchsia-500" },
  gold: { chip: "bg-gold-soft text-gold-active", num: "bg-gold" }
};

function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: it just will not be remembered */ }
}

function Ring({ percent, size = 64 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-white/15" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-gold transition-[stroke-dashoffset] duration-500" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
    </svg>
  );
}

export default function GuideView({
  persona,
  userId,
  isRtl,
  facts,
  onGo,
  onStartTour
}: {
  persona: Persona;
  userId: string;
  /** the language of the site; the guide follows it until the reader picks the other one */
  isRtl: boolean;
  facts: AccountFacts;
  /** open a section of the workspace */
  onGo: (tab: string) => void;
  onStartTour?: () => void;
}) {
  const [picked, setPicked] = useState<GuideLang | null>(() => parseGuideLang(readStored(GUIDE_LANG_KEY)));
  const lang: GuideLang = picked ?? (isRtl ? "ar" : "en");
  const ar = lang === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const L = (b: { en: string; ar: string }) => (ar ? b.ar : b.en);

  const available = useMemo(() => articlesFor(GUIDE_ARTICLES, persona), [persona]);
  const byId = useMemo(() => new Map(available.map(a => [a.id, a])), [available]);
  const validIds = useMemo(() => new Set(available.map(a => a.id)), [available]);

  const [read, setRead] = useState<Set<string>>(() => parseRead(readStored(READ_KEY(userId)), validIds));
  useEffect(() => { setRead(parseRead(readStored(READ_KEY(userId)), validIds)); }, [userId, validIds]);
  const markRead = (id: string) => {
    setRead(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      writeStored(READ_KEY(userId), serializeRead(next));
      return next;
    });
  };

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GuideCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const open = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const close = () => {
    setOpenId(null);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const chooseLang = (l: GuideLang) => { setPicked(l); writeStored(GUIDE_LANG_KEY, l); };

  const article = openId ? byId.get(openId) : undefined;
  const progress = pathProgress(persona, read, available);
  const suggested = useMemo(() => suggestArticles(persona, facts, read, available), [persona, facts, read, available]);

  const shown = useMemo(() => {
    const found = searchGuide(available, query);
    return category === "all" ? found : found.filter(a => a.category === category);
  }, [available, query, category]);

  const Next = ar ? ArrowLeft : ArrowRight;
  const Back = ar ? ArrowRight : ArrowLeft;

  const langToggle = (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-card" role="group" aria-label={t("Guide language", "لغة الدليل")}>
      {(["ar", "en"] as GuideLang[]).map(l => (
        <button
          key={l}
          type="button"
          onClick={() => chooseLang(l)}
          aria-pressed={lang === l}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold cursor-pointer transition-colors ${lang === l ? "bg-chrome text-white" : "text-ink-muted hover:text-ink"}`}
        >
          {l === "ar" ? "العربية" : "English"}
        </button>
      ))}
    </div>
  );

  const header = (
    <SectionHeader
      icon={BookOpen}
      accent="gold"
      title={t("Guide", "دليل الاستخدام")}
      description={t("Every feature with pictures, steps and tips.", "كل ميزة بالصور والخطوات والنصائح.")}
      action={langToggle}
    />
  );

  // ---------------------------------------------------------------------------------------------- one article
  if (article) {
    const tone = TONE[article.accent];
    const goTab = goToFor(article, persona);
    const nextId = nextInPath(persona, article.id, available);
    const next = nextId ? byId.get(nextId) : undefined;
    const related = (article.related || []).map(id => byId.get(id)).filter((a): a is GuideArticle => !!a);
    const isRead = read.has(article.id);
    return (
      <div ref={top} dir={ar ? "rtl" : "ltr"} lang={lang} className="space-y-5 scroll-mt-24">
        {header}
        <button type="button" onClick={close} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gold-active hover:underline cursor-pointer">
          <Back size={16} aria-hidden />{t("All guides", "كل الأدلة")}
        </button>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>{L(CATEGORIES.find(c => c.id === article.category)!.label)}</span>
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-muted"><Clock size={13} aria-hidden />{t(`${article.minutes} min read`, `${article.minutes} د للقراءة`)}</span>
                {isRead && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-success"><CheckCircle2 size={14} aria-hidden />{t("Read", "تمت القراءة")}</span>}
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-ink mt-2 leading-tight">{L(article.title)}</h3>
              <p className="text-[15px] text-ink-muted mt-1.5">{L(article.summary)}</p>
            </div>

            <GuideArt id={article.id} lang={lang} accent={article.accent} className="shadow-card border border-border" />

            <ol className="space-y-3">
              {article.steps.map((s, i) => (
                <li key={i} className="flex gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-card">
                  <span className="w-8 h-8 rounded-full bg-gold text-gold-ink font-bold text-[14px] flex items-center justify-center shrink-0 shadow-sm">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink text-[15px] leading-snug">{L(s.title)}</p>
                    <p className="text-[14px] text-ink-muted mt-1 leading-relaxed">{L(s.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="rounded-2xl border border-border bg-surface shadow-card p-5">
              <h4 className="font-serif text-base font-semibold text-ink flex items-center gap-2"><Sparkles size={17} className="text-gold-active" aria-hidden />{t("Why it matters", "لماذا هذا مهم")}</h4>
              <p className="text-[14px] text-ink-muted mt-2 leading-relaxed">{L(article.why)}</p>
            </section>

            {article.tips.length > 0 && (
              <section className="rounded-2xl border border-gold/40 bg-gold-soft/60 p-5">
                <h4 className="font-serif text-base font-semibold text-ink flex items-center gap-2"><Lightbulb size={17} className="text-gold-active" aria-hidden />{t("Good to know", "نصيحة")}</h4>
                <ul className="mt-2 space-y-2">
                  {article.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[14px] text-ink leading-relaxed"><Check size={16} className="text-gold-active shrink-0 mt-0.5" aria-hidden /><span>{L(tip)}</span></li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-surface shadow-card p-4 space-y-2.5">
              {goTab && (
                <button type="button" onClick={() => { markRead(article.id); onGo(goTab); }} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold text-gold-ink px-4 py-3 text-sm font-bold shadow-card hover:brightness-110 cursor-pointer transition">
                  <PlayCircle size={18} aria-hidden />{t("Try it now", "جرّبها الآن")}
                </button>
              )}
              {article.link && (
                <a href={`${ar ? "/ar" : ""}${article.link.path}`} target="_blank" rel="noreferrer" onClick={() => markRead(article.id)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold text-gold-ink px-4 py-3 text-sm font-bold shadow-card hover:brightness-110 cursor-pointer transition">
                  <ExternalLink size={17} aria-hidden />{L(article.link.label)}
                </a>
              )}
              {next ? (
                <button type="button" onClick={() => { markRead(article.id); open(next.id); }} className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm font-semibold text-ink hover:border-gold cursor-pointer transition">
                  <span className="text-start"><span className="block text-[11px] text-ink-muted font-medium">{t("Next in the start path", "التالي في مسار البداية")}</span>{L(next.title)}</span>
                  <Next size={17} className="shrink-0" aria-hidden />
                </button>
              ) : (
                <button type="button" onClick={() => { markRead(article.id); close(); }} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm font-semibold text-ink hover:border-gold cursor-pointer transition">
                  <Check size={17} aria-hidden />{isRead ? t("Back to all guides", "العودة لكل الأدلة") : t("Done, mark as read", "تم، علّمها كمقروءة")}
                </button>
              )}
            </section>

            {related.length > 0 && (
              <section className="rounded-2xl border border-border bg-surface shadow-card p-4">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-ink-muted mb-2">{t("Related", "مواضيع مرتبطة")}</h4>
                <ul className="space-y-1.5">
                  {related.map(r => (
                    <li key={r.id}>
                      <button type="button" onClick={() => open(r.id)} className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-[13.5px] font-semibold text-ink hover:bg-surface-2 cursor-pointer">
                        <span>{L(r.title)}</span><Next size={15} className="text-ink-muted shrink-0" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------------------------- the catalogue
  const pathItems = START_PATH[persona].map(id => byId.get(id)).filter((a): a is GuideArticle => !!a);
  const searching = query.trim().length > 0 || category !== "all";
  return (
    <div ref={top} dir={ar ? "rtl" : "ltr"} lang={lang} className="space-y-6 scroll-mt-24">
      {header}

      {/* Start here: the shortest road from a new account to a working one. */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white p-5 sm:p-6 shadow-popover">
        <div className="pointer-events-none absolute -top-20 -end-12 w-64 h-64 rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 lg:w-[300px] shrink-0">
            <div className="relative">
              <Ring percent={progress.percent} />
              <span className="absolute inset-0 flex items-center justify-center font-serif text-[15px] font-bold rotate-0">{progress.percent}%</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold uppercase tracking-[0.16em]">{t("Start here", "ابدأ من هنا")}</p>
              <p className="font-serif text-lg font-medium leading-snug mt-0.5">{progress.done >= progress.total ? t("You have read the essentials", "قرأت الأساسيات") : t(`${progress.done} of ${progress.total} essentials read`, `قرأت ${progress.done} من ${progress.total} من الأساسيات`)}</p>
            </div>
          </div>
          <ol className="flex-1 flex flex-wrap gap-2">
            {pathItems.map((a, i) => {
              const done = read.has(a.id);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => open(a.id)} className={`inline-flex items-center gap-2 rounded-full pe-3.5 ps-1.5 py-1.5 text-[13px] font-semibold cursor-pointer transition ${done ? "bg-white/15 text-white" : "bg-white text-chrome hover:bg-gold hover:text-gold-ink"}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? "bg-gold text-gold-ink" : "bg-chrome text-white"}`}>{done ? <Check size={13} /> : i + 1}</span>
                    {L(a.title)}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* What to read now, judged from the account: not verified, nothing listed, enquiries waiting... */}
      {suggested.length > 0 && !searching && (
        <section aria-label={t("Recommended for you", "موصى بها لك")}>
          <h4 className="font-serif text-base font-semibold text-ink mb-2.5 flex items-center gap-2"><Sparkles size={17} className="text-gold-active" aria-hidden />{t("Recommended for you now", "موصى بها لك الآن")}</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            {suggested.map(id => {
              const a = byId.get(id)!;
              const why = suggestionReason(id, facts, t);
              return (
                <button key={id} type="button" onClick={() => open(id)} className="group text-start rounded-2xl border border-gold/50 bg-gold-soft/50 p-4 shadow-card cursor-pointer transition hover:-translate-y-0.5 hover:shadow-popover">
                  {why && <span className="inline-block rounded-full bg-gold text-gold-ink text-[10.5px] font-bold px-2 py-0.5 mb-1.5">{why}</span>}
                  <span className="block font-semibold text-ink text-[15px] leading-snug">{L(a.title)}</span>
                  <span className="block text-[12.5px] text-ink-muted mt-1 leading-snug">{L(a.summary)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Search and topics */}
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{t("Search the guide", "ابحث في الدليل")}</span>
          <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-4 text-ink-muted pointer-events-none" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("Search: boost, WhatsApp, verification, reports…", "ابحث: رفع، واتساب، توثيق، تقارير…")}
            className="w-full ps-11 pe-10 py-3 rounded-2xl border border-border bg-surface text-[15px] shadow-card"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label={t("Clear", "مسح")} className="absolute top-1/2 -translate-y-1/2 end-3 p-1 rounded-full text-ink-muted hover:text-ink cursor-pointer"><X size={16} /></button>
          )}
        </label>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1" role="tablist" aria-label={t("Topics", "المواضيع")}>
          {[{ id: "all" as const, label: { en: "All", ar: "الكل" }, icon: BookOpen }, ...CATEGORIES.filter(c => available.some(a => a.category === c.id)).map(c => ({ ...c, icon: CAT_ICON[c.id] }))].map(c => {
            const Icon = c.icon;
            const on = category === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setCategory(c.id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold cursor-pointer transition-colors border ${on ? "bg-chrome text-white border-chrome" : "bg-surface text-ink-muted border-border hover:text-ink hover:border-gold"}`}>
                <Icon size={15} aria-hidden />{L(c.label)}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <Search size={28} className="mx-auto text-ink-muted" aria-hidden />
          <p className="font-semibold text-ink mt-2">{t("Nothing matches that search.", "لا شيء يطابق هذا البحث.")}</p>
          <p className="text-[13px] text-ink-muted mt-1">{t("Try one word, like “photos” or “reply”.", "جرّب كلمة واحدة مثل «صور» أو «رد».")}</p>
          <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="mt-3 text-[13px] font-bold text-gold-active hover:underline cursor-pointer">{t("Show everything", "اعرض كل شيء")}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(a => {
            const tone = TONE[a.accent];
            const done = read.has(a.id);
            return (
              <button key={a.id} type="button" onClick={() => open(a.id)} className="group text-start rounded-2xl border border-border bg-surface shadow-card overflow-hidden cursor-pointer transition hover:-translate-y-0.5 hover:border-gold hover:shadow-popover">
                <div className="relative">
                  <GuideArt id={a.id} lang={lang} accent={a.accent} className="!rounded-none" />
                  {done && <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-success text-white text-[10.5px] font-bold px-2 py-1 shadow"><Check size={12} aria-hidden />{t("Read", "مقروء")}</span>}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone.chip}`}>{L(CATEGORIES.find(c => c.id === a.category)!.label)}</span>
                    <span className="text-[11.5px] text-ink-muted inline-flex items-center gap-1"><Clock size={12} aria-hidden />{t(`${a.minutes} min`, `${a.minutes} د`)}</span>
                  </div>
                  <p className="font-serif text-[17px] font-semibold text-ink leading-snug mt-2">{L(a.title)}</p>
                  <p className="text-[13px] text-ink-muted mt-1 leading-snug">{L(a.summary)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {onStartTour && (
        <div className="rounded-2xl border border-border bg-surface shadow-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink text-[15px]">{t("Prefer to be shown on the real screen?", "تفضّل أن نريك على الشاشة الحقيقية؟")}</p>
            <p className="text-[13px] text-ink-muted mt-0.5">{t("The guided tour points at each part of your workspace.", "الجولة التعريفية تشير إلى كل جزء في مساحة عملك.")}</p>
          </div>
          <button type="button" onClick={onStartTour} className="inline-flex items-center justify-center gap-2 rounded-xl bg-chrome text-white px-4 py-2.5 text-sm font-bold hover:bg-chrome-hover cursor-pointer transition shrink-0">
            <PlayCircle size={17} aria-hidden />{t("Start the tour", "ابدأ الجولة")}
          </button>
        </div>
      )}
    </div>
  );
}

/** One short reason shown on a recommendation, so it is clear why this one and not another. */
function suggestionReason(id: string, f: AccountFacts, t: (en: string, ar: string) => string): string | null {
  if (id === "verify" && !f.verified) return t("Not verified yet", "غير موثّق بعد");
  if ((id === "add-listings" || id === "agency-listings") && f.listings === 0) return t("No listings yet", "لا عقارات بعد");
  if (id === "team" && (f.teamSize ?? 0) === 0) return t("No agents yet", "لا وسطاء بعد");
  if ((id === "leads" || id === "agency-leads") && f.waitingLeads > 0) return t(`${f.waitingLeads} waiting`, `${f.waitingLeads} ينتظر`);
  if (id === "profile" && !f.profileFilled) return t("Profile is empty", "الملف فارغ");
  return t("Next to read", "التالي للقراءة");
}
