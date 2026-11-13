/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Calculator, ShieldCheck, Info, ArrowRight, ArrowLeft, Home, MapPin } from "lucide-react";
import type { LocationItem } from "../types.js";
import { PropertyType } from "../types.js";
import { useCurrency } from "../currencyContext.js";
import { propertyTypeLabel } from "../lib/propertySpecs.js";
import type { AgentPerformance } from "../lib/agentPerformance.js";
import AgentBadges from "./AgentBadges.js";

// "What is your property worth?": a free estimate for owners, from the live listings around them. A range with the
// listings behind it, never a bare number, and an honest "not enough data" when there is not enough. It also puts the
// owner in touch with the verified agents who sell in that area, which is what the platform's agents want from it.

interface Similar { id: string; title: string; price: number; area: number; bedrooms: number }
type Result =
  | { ok: false; reason: "invalid" | "not-enough-data"; comparableCount: number }
  | {
      ok: true; deal: "SALE" | "RENT"; city: string; district: string;
      basis: "district-type-bedrooms" | "district-type" | "district" | "city-type";
      comparableCount: number; medianPerSqm: number; lowPerSqm: number; highPerSqm: number;
      estimate: number; low: number; high: number; confidence: "low" | "medium" | "high"; perMonth: boolean; similar: Similar[];
    };
interface AgentLite { id: string; fullName: string; avatarUrl?: string; company?: string; listings: number; performance?: AgentPerformance }

const SQFT = 0.092903;
const TYPES: PropertyType[] = [
  PropertyType.APARTMENT, PropertyType.VILLA, PropertyType.TOWNHOUSE, PropertyType.PENTHOUSE, PropertyType.COMPOUND, PropertyType.STUDIO,
  PropertyType.OFFICE, PropertyType.RETAIL, PropertyType.SHOP, PropertyType.WAREHOUSE, PropertyType.BUILDING, PropertyType.LAND
];

export default function ValuationView({ isRtl, locations, onOpenProperty, onSelectAgent }: {
  isRtl: boolean;
  locations: LocationItem[];
  onOpenProperty: (propertyId: string) => void;
  onSelectAgent: (agentId: string) => void;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const { formatPrice } = useCurrency();
  const [deal, setDeal] = useState<"SALE" | "RENT">("SALE");
  const [municipalityId, setMunicipalityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [type, setType] = useState<string>(PropertyType.APARTMENT);
  const [bedrooms, setBedrooms] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<"SQM" | "SQFT">("SQM");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<{ result: Result; agents: AgentLite[]; asked: { district: string; city: string; type: string } } | null>(null);

  const municipalities = useMemo(() => locations.filter(l => l.type === "MUNICIPALITY" && l.isActive !== false), [locations]);
  const areas = useMemo(() => locations.filter(l => l.parentId === municipalityId && l.isActive !== false), [locations, municipalityId]);
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const field = "w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-base md:text-sm focus:outline-none focus:border-gold text-ink";
  const label = "block text-xs font-semibold text-ink-muted mb-1.5";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const muni = municipalities.find(m => m.id === municipalityId);
    const area = areas.find(a => a.id === areaId);
    if (!muni || !area) { setError(t("Choose the municipality and the area.", "اختر البلدية والمنطقة.")); return; }
    const raw = Number(size);
    if (!Number.isFinite(raw) || raw <= 0) { setError(t("Enter the size of the property.", "أدخل مساحة العقار.")); return; }
    const sqm = unit === "SQFT" ? raw * SQFT : raw;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal, city: muni.name, district: area.name, propertyType: type, area: Math.round(sqm * 10) / 10, bedrooms: bedrooms === "" ? undefined : Number(bedrooms) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || t("We could not work that out. Please check the form.", "تعذّر الحساب. يرجى مراجعة النموذج.")); setAnswer(null); return; }
      setAnswer({ result: data.result, agents: data.agents || [], asked: { district: area.name, city: muni.name, type } });
      requestAnimationFrame(() => document.getElementById("valuation-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  const money = (qar: number, perMonth: boolean) => `${formatPrice(qar, isRtl)}${perMonth ? ` ${t("/ month", "/ شهر")}` : ""}`;
  const dealWord = (d: "SALE" | "RENT") => (d === "RENT" ? t("for rent", "للإيجار") : t("for sale", "للبيع"));

  const basisText = (r: Extract<Result, { ok: true }>, askedType: string) => {
    const tp = propertyTypeLabel(askedType, isRtl);
    const place = r.district;
    switch (r.basis) {
      case "district-type-bedrooms":
        return t(`Based on ${r.comparableCount} ${tp.toLowerCase()} listings with the same number of bedrooms ${dealWord(r.deal)} in ${place}.`,
          `مبني على ${r.comparableCount} عقارات من نوع ${tp} بنفس عدد الغرف ${dealWord(r.deal)} في ${place}.`);
      case "district-type":
        return t(`Based on ${r.comparableCount} ${tp.toLowerCase()} listings ${dealWord(r.deal)} in ${place}.`,
          `مبني على ${r.comparableCount} عقارات من نوع ${tp} ${dealWord(r.deal)} في ${place}.`);
      case "district":
        return t(`Based on ${r.comparableCount} listings of every type ${dealWord(r.deal)} in ${place}: there are too few ${tp.toLowerCase()} listings there to compare on their own.`,
          `مبني على ${r.comparableCount} عقارات من كل الأنواع ${dealWord(r.deal)} في ${place}: عدد عقارات ${tp} هناك قليل جداً للمقارنة وحدها.`);
      default:
        return t(`There are not enough listings in ${place} yet, so this uses ${r.comparableCount} ${tp.toLowerCase()} listings ${dealWord(r.deal)} across ${r.city}. Treat it as a rough guide.`,
          `لا توجد عقارات كافية في ${place} حتى الآن، فاعتمد التقدير على ${r.comparableCount} عقارات من نوع ${tp} ${dealWord(r.deal)} في ${r.city}. اعتبره مؤشراً تقريبياً.`);
    }
  };
  const confidenceText = (c: "low" | "medium" | "high") =>
    c === "high" ? t("High confidence: many comparable listings", "ثقة عالية: عقارات مقارنة كثيرة")
      : c === "medium" ? t("Medium confidence", "ثقة متوسطة")
      : t("Low confidence: only a few comparable listings", "ثقة منخفضة: عدد قليل من العقارات المقارنة");

  const agentsBlock = (a: NonNullable<typeof answer>) => a.agents.length > 0 && (
    <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6">
      <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2">
        <ShieldCheck size={18} className="text-gold" />
        {t(`Talk to a verified agent in ${a.asked.district}`, `تحدّث مع وسيط موثّق في ${a.asked.district}`)}
      </h3>
      <p className="text-[13px] text-ink-muted mt-1">{t("These agents have the most live listings in your area.", "هؤلاء الوسطاء لديهم أكثر العقارات المعروضة في منطقتك.")}</p>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {a.agents.map(ag => (
          <li key={ag.id}>
            <button type="button" onClick={() => onSelectAgent(ag.id)} className="w-full text-start p-3.5 rounded-xl bg-canvas border border-border hover:border-gold/60 transition-colors cursor-pointer">
              <span className="flex items-center gap-3">
                {ag.avatarUrl
                  ? <img src={ag.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                  : <span className="w-10 h-10 rounded-full bg-chrome text-white flex items-center justify-center font-semibold">{ag.fullName.charAt(0)}</span>}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink truncate">{ag.fullName}</span>
                  {ag.company && <span className="block text-[11px] text-ink-faint truncate">{ag.company}</span>}
                </span>
              </span>
              {ag.performance && <span className="mt-2 block"><AgentBadges performance={ag.performance} isRtl={isRtl} /></span>}
              <span className="mt-3 flex items-center justify-between text-[12px] text-ink-muted">
                <span>{t(`${ag.listings} live listing${ag.listings === 1 ? "" : "s"} here`, `${ag.listings} عقار معروض هنا`)}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-gold-active">{t("View profile", "عرض الملف")}<Arrow size={13} /></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-8 animate-in fade-in duration-500" dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold-soft text-gold-active text-xs font-semibold uppercase tracking-[0.14em] rounded-full">
          <Calculator size={13} />{t("Free valuation", "تقييم مجاني")}
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-medium text-ink leading-tight">{t("What is your property worth?", "كم يساوي عقارك؟")}</h1>
        <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
          {t("Tell us where it is and what it is. We work out a price range from the real listings around it, and show you the listings it is based on.",
            "أخبرنا أين يقع وما هو. نحسب نطاقاً سعرياً من العقارات المعروضة فعلاً حوله، ونُظهر لك العقارات التي بُني عليها.")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <form onSubmit={submit} className="lg:col-span-2 bg-surface rounded-2xl border border-border p-5 sm:p-6 space-y-4" noValidate>
          <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2/70 border border-border/60">
            {([["SALE", t("I want to sell", "أريد البيع")], ["RENT", t("I want to rent out", "أريد التأجير")]] as const).map(([k, text]) => (
              <button key={k} type="button" role="tab" aria-selected={deal === k} onClick={() => setDeal(k)}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${deal === k ? "bg-chrome text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}>{text}</button>
            ))}
          </div>
          <div>
            <label className={label}>{t("Municipality", "البلدية")}</label>
            <select value={municipalityId} onChange={e => { setMunicipalityId(e.target.value); setAreaId(""); }} className={field}>
              <option value="">{t("Select", "اختر")}</option>
              {municipalities.map(m => <option key={m.id} value={m.id}>{isRtl ? m.nameAr : m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{t("Area", "المنطقة")}</label>
            <select value={areaId} onChange={e => setAreaId(e.target.value)} disabled={!municipalityId} className={`${field} disabled:opacity-50`}>
              <option value="">{t("Select", "اختر")}</option>
              {areas.map(a => <option key={a.id} value={a.id}>{isRtl ? a.nameAr : a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{t("Property type", "نوع العقار")}</label>
              <select value={type} onChange={e => setType(e.target.value)} className={field}>
                {TYPES.map(p => <option key={p} value={p}>{propertyTypeLabel(p, isRtl)}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{t("Bedrooms", "غرف النوم")}</label>
              <select value={bedrooms} onChange={e => setBedrooms(e.target.value)} className={field}>
                <option value="">{t("Not sure", "غير متأكد")}</option>
                <option value="0">{t("Studio", "استوديو")}</option>
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>{t("Size", "المساحة")}</label>
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" min="0" value={size} onChange={e => setSize(e.target.value)} placeholder={unit === "SQM" ? "e.g. 120" : "e.g. 1300"} className={`${field} tabular-nums`} aria-label={t("Size", "المساحة")} />
              <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
                {(["SQM", "SQFT"] as const).map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)} className={`px-3 text-[13px] font-semibold cursor-pointer ${unit === u ? "bg-chrome text-white" : "bg-canvas text-ink-muted hover:text-ink"}`}>
                    {u === "SQM" ? t("sqm", "م²") : t("sqft", "قدم²")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-chrome hover:bg-chrome-hover text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer transition-colors">
            {busy ? t("Working it out...", "جارٍ الحساب...") : t("Estimate my property", "قدّر قيمة عقاري")}
            {!busy && <Arrow size={16} />}
          </button>
          <p className="text-[11px] text-ink-faint flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" />{t("Free, instant and private: nothing you enter is stored.", "مجاني وفوري وخاص: لا يُحفظ أي شيء تدخله.")}</p>
        </form>

        <div id="valuation-result" className="lg:col-span-3 space-y-5 scroll-mt-28">
          {!answer && (
            <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-ink-muted">
              <Home size={30} className="mx-auto mb-3 text-gold" />
              <p className="font-serif text-lg text-ink">{t("Your estimate appears here", "يظهر تقديرك هنا")}</p>
              <p className="text-[13px] mt-1">{t("It comes from live listings on Nerou Finder, so it is only as good as the data in your area, and it says so when there is too little.", "يعتمد على العقارات المعروضة حالياً في نيرو فايندر، فدقته من دقة البيانات في منطقتك، ويخبرك عندما تكون البيانات قليلة.")}</p>
            </div>
          )}

          {answer && !answer.result.ok && (
            <>
              <section className="bg-surface rounded-2xl border border-border p-6 space-y-2">
                <h3 className="font-serif text-xl font-medium text-ink">{t("Not enough data to estimate yet", "لا توجد بيانات كافية للتقدير بعد")}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {t(`There are too few comparable listings in ${answer.asked.district} to give you an honest number, and we would rather not guess. A verified agent who works in the area can value it properly.`,
                    `عدد العقارات المقارنة في ${answer.asked.district} قليل جداً لنعطيك رقماً صادقاً، ونفضّل ألا نخمّن. يستطيع وسيط موثّق يعمل في المنطقة تقييمه بدقة.`)}
                </p>
              </section>
              {agentsBlock(answer)}
            </>
          )}

          {answer && answer.result.ok && (() => {
            const r = answer.result;
            const span = r.high - r.low;
            const pos = span > 0 ? Math.min(100, Math.max(0, ((r.estimate - r.low) / span) * 100)) : 50;
            return (
              <>
                <section className="rounded-2xl bg-chrome text-white p-6 sm:p-8 space-y-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60 flex items-center gap-1.5"><MapPin size={12} />{r.district}, {r.city}</p>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${r.confidence === "high" ? "bg-emerald-400/20 text-emerald-200" : r.confidence === "medium" ? "bg-white/15 text-white/90" : "bg-amber-400/20 text-amber-200"}`}>{confidenceText(r.confidence)}</span>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60 mb-1">{r.deal === "RENT" ? t("Estimated monthly rent", "الإيجار الشهري التقديري") : t("Estimated value", "القيمة التقديرية")}</p>
                    <p className="font-serif text-3xl sm:text-4xl font-medium text-[#e6cf93] tabular-nums leading-tight">{money(r.low, false)} <span className="text-white/40">-</span> {money(r.high, r.perMonth)}</p>
                    <p className="text-sm text-white/75 mt-2">{t("Most likely around", "الأرجح حول")} <strong className="text-white tabular-nums">{money(r.estimate, r.perMonth)}</strong></p>
                  </div>
                  <div aria-hidden="true">
                    <div className="relative h-2 rounded-full bg-white/15">
                      <span className="absolute inset-y-0 start-0 end-0 rounded-full bg-gradient-to-r from-white/10 via-[#e6cf93]/60 to-white/10" />
                      <span className="absolute top-1/2 w-4 h-4 rounded-full bg-[#e6cf93] border-2 border-chrome shadow" style={{ [isRtl ? "right" : "left"]: `${pos}%`, transform: isRtl ? "translate(50%, -50%)" : "translate(-50%, -50%)" }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-white/50 tabular-nums"><span>{money(r.low, false)}</span><span>{money(r.high, false)}</span></div>
                  </div>
                  <p className="text-[13px] text-white/75 leading-relaxed">{basisText(r, answer.asked.type)} {t("Median", "الوسيط")}: {money(r.medianPerSqm, false)} {t("per sqm", "للمتر المربع")}{r.perMonth ? ` ${t("per month", "شهرياً")}` : ""}.</p>
                </section>

                {r.similar.length > 0 && (
                  <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6">
                    <h3 className="font-serif text-lg font-medium text-ink">{t("Listings it is based on", "العقارات التي بُني عليها")}</h3>
                    <ul className="mt-3 divide-y divide-border/70">
                      {r.similar.map(s => (
                        <li key={s.id}>
                          <button type="button" onClick={() => onOpenProperty(s.id)} className="w-full flex items-center justify-between gap-4 py-3 text-start hover:text-gold-active cursor-pointer">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink truncate">{s.title}</span>
                              <span className="block text-[12px] text-ink-faint tabular-nums">{s.area} {t("sqm", "م²")} · {s.bedrooms} {t("bed", "غرف")}</span>
                            </span>
                            <span className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap">{formatPrice(s.price, isRtl)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {agentsBlock(answer)}

                <p className="text-[11px] text-ink-faint flex items-start gap-1.5 leading-relaxed">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  {t("An estimate from advertised prices, not a formal valuation. The price a property actually sells or lets for can differ; a verified agent or a licensed valuer can give you a firm figure.",
                    "تقدير من الأسعار المعلنة وليس تقييماً رسمياً. قد يختلف سعر البيع أو الإيجار الفعلي؛ يستطيع وسيط موثّق أو مقيّم مرخّص إعطاءك رقماً نهائياً.")}
                </p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
