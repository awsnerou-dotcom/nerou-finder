/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Building2, ChevronDown, MapPin, Ruler, Scale, Search, TrendingUp, X } from "lucide-react";
import type { Property } from "../types.js";
import { bedroomsLabel, parseReportPath, qar, reportPath, reportText, roundedFigure } from "../lib/priceReports.js";
import type { PriceReport } from "../lib/priceReports.js";

// "Average rent in Lusail" / "Property prices in West Bay": the figures behind one area, from the live listings. The same page
// is rendered by the server as HTML for search engines; this is the app's own view of it, with the next step one tap away.

interface Payload {
  report: PriceReport;
  country: PriceReport | null;
  areas: { slug: string; district: string; districtAr: string; median: number; count: number }[];
  counterpart: string | null;
  listings: Property[];
}

export default function PriceReportView({
  path,
  isRtl,
  onClose,
  onOpenProperty,
  onOpenReport,
  onCheckPrice,
  onSeeMatches
}: {
  path: string;
  isRtl: boolean;
  onClose: () => void;
  onOpenProperty: (p: Property) => void;
  onOpenReport: (path: string) => void;
  onCheckPrice: () => void;
  onSeeMatches: (district: string) => void;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const parsed = useMemo(() => parseReportPath(path), [path]);
  const [data, setData] = useState<Payload | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setMissing(false);
    if (!parsed) { setMissing(true); return; }
    fetch(`/api/price-reports/${parsed.deal === "RENT" ? "rent" : "sale"}/${parsed.slug}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: Payload | null) => { if (cancelled) return; if (d) setData(d); else setMissing(true); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [parsed]);

  const text = useMemo(() => (data ? reportText(data.report, isRtl ? "ar" : "en", { year: new Date().getFullYear(), country: data.country && data.country.slug !== data.report.slug ? data.country : undefined }) : null), [data, isRtl]);

  useEffect(() => {
    if (!text) return;
    const before = document.title;
    document.title = text.title;
    return () => { document.title = before; };
  }, [text]);

  const Back = isRtl ? ArrowRight : ArrowLeft;
  const Next = isRtl ? ArrowLeft : ArrowRight;
  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink cursor-pointer"><Back size={16} /> {t("Back", "رجوع")}</button>
        {children}
      </div>
    </div>
  );

  if (missing) {
    return shell(
      <div className="text-center py-24 space-y-3">
        <X size={32} className="mx-auto text-ink-faint" />
        <h2 className="font-serif text-xl font-semibold text-ink">{t("There is no report for this yet", "لا يوجد تقرير لهذا بعد")}</h2>
        <p className="text-sm text-ink-muted">{t("A report needs at least three live listings in the area.", "يحتاج التقرير إلى ثلاثة عقارات معروضة على الأقل في المنطقة.")}</p>
      </div>
    );
  }
  if (!data || !text) return shell(<div className="flex justify-center py-32"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>);

  const r = data.report;
  const rent = r.deal === "RENT";
  const per = rent ? ` ${t("/ month", "/ شهر")}` : "";
  const fig = (n: number) => `${qar(roundedFigure(r.deal, n))}${per}`;
  const name = isRtl ? r.districtAr : r.district;
  const widest = Math.max(...r.byBedrooms.map(b => b.median), 1);
  const areaTitle = (a: { district: string; districtAr: string }) => (isRtl ? a.districtAr : a.district);

  return shell(
    <>
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white px-6 py-8 sm:px-10 shadow-popover">
        <div className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative space-y-3">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.16em]">{t("Live from the listings on Nerou Finder", "مباشر من العقارات على نيرو فايندر")}</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium leading-tight">{text.h1}</h1>
          <p className="text-[14px] sm:text-[15px] text-gray-300 leading-relaxed max-w-3xl">{text.intro}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={onCheckPrice} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gold text-gold-ink text-sm font-bold hover:brightness-110 cursor-pointer transition"><Scale size={17} strokeWidth={2.5} />{t("Check a price you were offered", "افحص سعراً عُرض عليك")}</button>
            {r.scope === "area" && <button type="button" onClick={() => onSeeMatches(r.district)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer transition-colors"><Search size={17} />{t(`See listings in ${name}`, `شاهد العقارات في ${name}`)}</button>}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label={t("Key figures", "الأرقام الأساسية")}>
        {[
          { label: t("Typical", "المعتاد"), value: fig(r.median), icon: TrendingUp, tile: "bg-gold-soft text-gold-active" },
          { label: t("Usual range", "المدى المعتاد"), value: `${qar(roundedFigure(r.deal, r.p25))} – ${qar(roundedFigure(r.deal, r.p75))}`, icon: BarChart3, tile: "bg-indigo-100 text-indigo-700" },
          { label: t("Live listings", "عقارات معروضة"), value: String(r.count), icon: Building2, tile: "bg-sky-100 text-sky-700" },
          { label: t("Per square metre", "للمتر المربع"), value: r.medianPerSqm !== null ? `${qar(r.medianPerSqm)}${rent ? per : ""}` : "—", icon: Ruler, tile: "bg-emerald-100 text-emerald-700" }
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${k.tile}`}><Icon size={21} strokeWidth={2.25} /></span>
              <span className="min-w-0"><span className="block font-serif text-lg font-semibold text-ink leading-tight tabular-nums">{k.value}</span><span className="block text-[12px] text-ink-muted mt-0.5">{k.label}</span></span>
            </div>
          );
        })}
      </section>

      {r.byBedrooms.length > 0 && (
        <section className="bg-surface rounded-2xl border border-border shadow-card p-5 sm:p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-ink">{rent ? t("Rent by number of bedrooms", "الإيجار حسب عدد الغرف") : t("Price by number of bedrooms", "السعر حسب عدد الغرف")}</h2>
          <ul className="space-y-3">
            {r.byBedrooms.map(b => (
              <li key={b.bedrooms}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-ink">{bedroomsLabel(b.bedrooms, isRtl ? "ar" : "en")} <span className="font-normal text-ink-faint">· {b.count} {t("listings", "إعلان")}</span></span>
                  <span className="font-bold text-ink tabular-nums">{fig(b.median)}</span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(6, (b.median / widest) * 100)}%` }} /></div>
                <p className="text-[11px] text-ink-faint mt-1 tabular-nums">{fig(b.min)} – {fig(b.max)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.listings.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-ink">{t("Cheapest available now", "أرخص المعروض الآن")}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {data.listings.map(p => (
              <button key={p.id} type="button" onClick={() => onOpenProperty(p)} className="group text-start bg-surface border border-border rounded-2xl shadow-card overflow-hidden hover:shadow-popover hover:border-gold transition cursor-pointer">
                <div className="aspect-[4/3] bg-surface-2 overflow-hidden">{p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-faint"><Building2 size={32} strokeWidth={1.5} /></div>}</div>
                <div className="p-4 space-y-1">
                  <p className="font-serif text-lg font-semibold text-gold-active tabular-nums">{qar(p.price)}{rent ? per : ""}</p>
                  <p className="text-[14px] font-semibold text-ink truncate">{(isRtl ? p.titleAr || p.title : p.title).trim()}</p>
                  <p className="text-[12px] text-ink-muted flex items-center gap-1 truncate"><MapPin size={12} />{p.district}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {r.scope === "country" && data.areas.length > 0 && (
        <section className="bg-surface rounded-2xl border border-border shadow-card p-5 sm:p-6 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-ink">{rent ? t("Average rent by area", "متوسط الإيجار حسب المنطقة") : t("Property prices by area", "أسعار العقارات حسب المنطقة")}</h2>
          <ul className="divide-y divide-border/70">
            {data.areas.map(a => (
              <li key={a.slug}>
                <button type="button" onClick={() => onOpenReport(reportPath(r.deal, a.slug))} className="w-full flex items-center justify-between gap-3 py-3 text-start cursor-pointer hover:bg-surface-2/60 rounded-lg px-2 -mx-2 transition-colors">
                  <span className="font-semibold text-[14px] text-ink">{areaTitle(a)} <span className="font-normal text-[12px] text-ink-faint">· {a.count} {t("listings", "إعلان")}</span></span>
                  <span className="flex items-center gap-2 font-bold text-ink tabular-nums">{fig(a.median)}<Next size={14} className="text-ink-faint" /></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-ink">{t("Frequently asked questions", "أسئلة شائعة")}</h2>
        <div className="space-y-2">
          {text.faq.map(f => (
            <details key={f.q} className="group bg-surface border border-border rounded-2xl shadow-card px-5 py-4">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-semibold text-[14px] text-ink">{f.q}<ChevronDown size={16} className="text-ink-faint group-open:rotate-180 transition-transform shrink-0" /></summary>
              <p className="text-[13px] text-ink-muted leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {(data.counterpart || (r.scope === "area" && data.areas.length > 0)) && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-ink">{t("Keep exploring", "تابع الاستكشاف")}</h2>
          <div className="flex flex-wrap gap-2">
            {data.counterpart && (
              <button type="button" onClick={() => onOpenReport(data.counterpart!)} className="px-4 py-2 rounded-xl border border-gold/60 bg-gold-soft/40 text-[13px] font-semibold text-gold-active hover:bg-gold-soft cursor-pointer transition-colors">
                {rent ? t(`Property prices in ${name}`, `أسعار العقارات في ${name}`) : t(`Average rent in ${name}`, `متوسط الإيجار في ${name}`)}
              </button>
            )}
            {r.scope === "area" && (
              <button type="button" onClick={() => onOpenReport(reportPath(r.deal, "qatar"))} className="px-4 py-2 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2 cursor-pointer transition-colors">
                {rent ? t("Average rent in Qatar", "متوسط الإيجار في قطر") : t("Property prices in Qatar", "أسعار العقارات في قطر")}
              </button>
            )}
            {r.scope === "area" && data.areas.slice(0, 8).map(a => (
              <button key={a.slug} type="button" onClick={() => onOpenReport(reportPath(r.deal, a.slug))} className="px-4 py-2 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors">{areaTitle(a)}</button>
            ))}
          </div>
        </section>
      )}

      <p className="text-[12px] text-ink-faint pb-8">{t("Figures come from the listings live now on Nerou Finder. They are asking prices, not completed deals.", "الأرقام من الإعلانات المنشورة الآن على نيرو فايندر، وهي أسعار معروضة وليست صفقات مكتملة.")}{r.updated ? ` ${t("Last updated", "آخر تحديث")}: ${r.updated}.` : ""}</p>
    </>
  );
}
