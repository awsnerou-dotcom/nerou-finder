/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Bell, Calculator, Check, Download, FileBarChart, Gauge, Info, MessageCircle, Scale, Search, Share2, ThumbsDown, ThumbsUp
} from "lucide-react";
import type { LocationItem } from "../types.js";
import { PropertyType } from "../types.js";
import { propertyTypeLabel } from "../lib/propertySpecs.js";
import type { PriceCheckResult, Verdict } from "../lib/priceCheck.js";
import { qar } from "../lib/priceReports.js";
import { whatsappShareLink } from "../lib/profiles.js";
import { renderVerdictCard } from "../lib/shareCard.js";

// "Is this price fair?": someone pastes the rent or price they were offered (from any site or post) and gets an honest
// verdict against the live listings: below, fair or above the market, how many comparable listings are cheaper, what a
// fair figure is, and a warning when a price is too good to be true. The answer can be shared as a picture, turned into an
// alert for the next listing at that price, or followed to the listings and the area's full price report.

const SQFT = 0.092903;
const TYPES: PropertyType[] = [
  PropertyType.APARTMENT, PropertyType.VILLA, PropertyType.TOWNHOUSE, PropertyType.PENTHOUSE, PropertyType.COMPOUND, PropertyType.STUDIO,
  PropertyType.OFFICE, PropertyType.SHOP, PropertyType.WAREHOUSE, PropertyType.LAND
];

type Ok = Extract<PriceCheckResult, { ok: true }>;
interface Answer { result: PriceCheckResult; reportPath: string | null; asked: { deal: "RENT" | "SALE"; district: string; city: string; type: string; price: number; bedrooms?: number; municipalityId: string; areaId: string } }

const VERDICT_STYLE: Record<Verdict, { tile: string; text: string; accent: string; Icon: typeof Gauge }> = {
  "far-below": { tile: "bg-amber-100 text-amber-700", text: "text-amber-700", accent: "#f59e0b", Icon: AlertTriangle },
  below: { tile: "bg-emerald-100 text-emerald-700", text: "text-emerald-700", accent: "#10b981", Icon: ThumbsUp },
  fair: { tile: "bg-sky-100 text-sky-700", text: "text-sky-700", accent: "#0ea5e9", Icon: BadgeCheck },
  above: { tile: "bg-amber-100 text-amber-700", text: "text-amber-700", accent: "#f59e0b", Icon: ThumbsDown },
  "far-above": { tile: "bg-rose-100 text-rose-700", text: "text-rose-700", accent: "#f43f5e", Icon: ThumbsDown }
};

export default function PriceCheckView({
  isRtl,
  locations,
  currentUser,
  onLoginTrigger,
  onOpenProperty,
  onOpenReport,
  onSeeMatches,
  onOpenValuation,
  onAlertCreated
}: {
  isRtl: boolean;
  locations: LocationItem[];
  currentUser?: any;
  onLoginTrigger?: () => void;
  onOpenProperty: (propertyId: string) => void;
  onOpenReport: (path: string) => void;
  onSeeMatches: (district: string) => void;
  onOpenValuation: () => void;
  onAlertCreated?: () => void;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [deal, setDeal] = useState<"RENT" | "SALE">("RENT");
  const [municipalityId, setMunicipalityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [type, setType] = useState<string>(PropertyType.APARTMENT);
  const [bedrooms, setBedrooms] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<"SQM" | "SQFT">("SQM");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState("");

  const municipalities = useMemo(() => locations.filter(l => l.type === "MUNICIPALITY" && l.isActive !== false), [locations]);
  const areas = useMemo(() => locations.filter(l => l.parentId === municipalityId && l.isActive !== false), [locations, municipalityId]);
  const field = "w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-base md:text-sm focus:outline-none focus:border-gold text-ink";
  const label = "block text-xs font-semibold text-ink-muted mb-1.5";
  const flash = (text: string) => { setNote(text); setTimeout(() => setNote(""), 3500); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const muni = municipalities.find(m => m.id === municipalityId);
    const area = areas.find(a => a.id === areaId);
    if (!muni || !area) { setError(t("Choose the municipality and the area.", "اختر البلدية والمنطقة.")); return; }
    const cleaned = Number(price.replace(/[,\s]/g, ""));
    if (!Number.isFinite(cleaned) || cleaned <= 0) { setError(t("Enter the price you were offered.", "أدخل السعر الذي عُرض عليك.")); return; }
    const rawSize = size.trim() === "" ? undefined : Number(size);
    if (rawSize !== undefined && (!Number.isFinite(rawSize) || rawSize <= 0)) { setError(t("The size must be a number, or leave it empty.", "المساحة يجب أن تكون رقماً، أو اتركها فارغة.")); return; }
    const sqm = rawSize === undefined ? undefined : Math.round((unit === "SQFT" ? rawSize * SQFT : rawSize) * 10) / 10;
    setBusy(true); setError(""); setNote("");
    try {
      const res = await fetch("/api/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal, city: muni.name, district: area.name, propertyType: type, bedrooms: bedrooms === "" ? undefined : Number(bedrooms), price: cleaned, area: sqm })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || t("We could not check that. Please review the form.", "تعذّر الفحص. يرجى مراجعة النموذج.")); setAnswer(null); return; }
      setAnswer({ result: data.result, reportPath: data.reportPath || null, asked: { deal, district: area.name, city: muni.name, type, price: cleaned, bedrooms: bedrooms === "" ? undefined : Number(bedrooms), municipalityId: muni.id, areaId: area.id } });
      requestAnimationFrame(() => document.getElementById("price-check-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  const verdictText = (v: Verdict, r: Ok) => {
    const pct = Math.abs(r.differencePercent);
    switch (v) {
      case "far-below": return r.suspiciouslyLow
        ? { title: t("Too good to be true?", "أرخص من أن يكون حقيقياً؟"), line: t(`${pct}% below the typical price`, `أقل بنسبة ${pct}% من السعر المعتاد`) }
        : { title: t("Well below the market", "أقل بكثير من السوق"), line: t(`${pct}% below the typical price`, `أقل بنسبة ${pct}% من السعر المعتاد`) };
      case "below": return { title: t("Below the market: a good price", "أقل من السوق: سعر جيد"), line: t(`${pct}% below the typical price`, `أقل بنسبة ${pct}% من السعر المعتاد`) };
      case "fair": return { title: t("A fair price", "سعر عادل"), line: r.differencePercent === 0 ? t("Right at the typical price", "تماماً عند السعر المعتاد") : t(`Within ${Math.max(1, pct)}% of the typical price`, `ضمن ${Math.max(1, pct)}% من السعر المعتاد`) };
      case "above": return { title: t("Above the market", "أعلى من السوق"), line: t(`${pct}% above the typical price`, `أعلى بنسبة ${pct}% من السعر المعتاد`) };
      default: return { title: t("Well above the market", "أعلى بكثير من السوق"), line: t(`${pct}% above the typical price`, `أعلى بنسبة ${pct}% من السعر المعتاد`) };
    }
  };

  const per = (r: Ok) => (r.perMonth ? ` ${t("/ month", "/ شهر")}` : "");
  const money = (n: number, r: Ok) => `${qar(n)}${per(r)}`;

  const shareLink = `${window.location.origin}${isRtl ? "/ar" : ""}/price-check`;
  const shareMessage = (a: Answer, r: Ok) => {
    const v = verdictText(r.verdict, r);
    return t(
      `I checked a ${a.asked.deal === "RENT" ? "rent" : "price"} on Nerou Finder: ${money(r.asked, r)} in ${a.asked.district}. ${v.title} (${v.line}). Check yours for free: ${shareLink}`,
      `فحصت ${a.asked.deal === "RENT" ? "إيجاراً" : "سعراً"} على نيرو فايندر: ${money(r.asked, r)} في ${a.asked.district}. ${v.title} (${v.line}). افحص سعرك مجاناً: ${shareLink}`
    );
  };

  const makeCard = async (a: Answer, r: Ok) => {
    setWorking("card");
    try {
      const v = verdictText(r.verdict, r);
      const blob = await renderVerdictCard({
        headline: r.verdict === "fair" ? (isRtl ? "سعر عادل" : "Fair price") : `${Math.abs(r.differencePercent)}% ${r.differencePercent < 0 ? t("below", "أقل") : t("above", "أعلى")}`,
        verdict: v.title,
        accent: VERDICT_STYLE[r.verdict].accent,
        asked: money(r.asked, r),
        typical: money(r.typical, r),
        place: `${a.asked.district}, ${a.asked.city} · ${propertyTypeLabel(a.asked.type, isRtl)}${a.asked.bedrooms !== undefined ? ` · ${a.asked.bedrooms === 0 ? t("Studio", "استوديو") : `${a.asked.bedrooms} ${t("bed", "نوم")}`}` : ""}`,
        facts: [
          t(`Compared with ${r.comparableCount} live listings`, `مقارنة مع ${r.comparableCount} عقاراً معروضاً`),
          t(`${r.cheaperThanPercent}% of them are cheaper`, `${r.cheaperThanPercent}% منها أرخص`)
        ],
        site: "neroufinder.com/price-check",
        isRtl
      });
      const file = new File([blob], "price-check.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], text: shareMessage(a, r) }); return; } catch { /* cancelled: fall back to a download */ }
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      flash(t("Picture saved. Send it with the link.", "تم حفظ الصورة. أرسلها مع الرابط."));
    } catch {
      flash(t("Could not make the picture.", "تعذر إنشاء الصورة."));
    } finally {
      setWorking("");
    }
  };

  const createAlert = async (a: Answer) => {
    const token = localStorage.getItem("token");
    if (!currentUser || !token) {
      flash(t("Sign in to get an alert, then press the button again.", "سجّل الدخول لتصلك التنبيهات، ثم اضغط الزر مرة أخرى."));
      onLoginTrigger?.();
      return;
    }
    setWorking("alert");
    try {
      const filters = {
        searchQuery: "", selectedMunicipality: a.asked.municipalityId, selectedArea: a.asked.areaId, propType: a.asked.type,
        transType: a.asked.deal === "RENT" ? "FOR_RENT" : "FOR_SALE", minPrice: "", maxPrice: String(Math.round(a.asked.price)),
        beds: a.asked.bedrooms !== undefined ? String(a.asked.bedrooms) : "", baths: "", furnished: "", minArea: ""
      };
      const name = t(`${a.asked.district}: up to ${qar(a.asked.price)}`, `${a.asked.district}: حتى ${qar(a.asked.price)}`);
      const res = await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, filters }) });
      if (res.ok) { flash(t("Done. We will tell you when a listing like this appears.", "تم. سنخبرك عندما يظهر عقار مثل هذا.")); onAlertCreated?.(); }
      else flash(t("Could not save the alert. Please try again.", "تعذر حفظ التنبيه. حاول مرة أخرى."));
    } catch {
      flash(t("Could not save the alert. Please try again.", "تعذر حفظ التنبيه. حاول مرة أخرى."));
    } finally {
      setWorking("");
    }
  };

  const confidenceText = (c: "low" | "medium" | "high") =>
    c === "high" ? t("High confidence: many comparable listings", "ثقة عالية: عقارات مقارنة كثيرة")
      : c === "medium" ? t("Medium confidence", "ثقة متوسطة")
      : t("Low confidence: only a few comparable listings, so treat it as a guide", "ثقة منخفضة: عدد قليل من العقارات المقارنة، فاعتبرها مؤشراً");

  const basisText = (r: Ok, a: Answer) => {
    const tp = propertyTypeLabel(a.asked.type, isRtl).toLowerCase();
    const word = r.deal === "RENT" ? t("for rent", "للإيجار") : t("for sale", "للبيع");
    switch (r.basis) {
      case "district-type-bedrooms": return t(`Compared with ${r.comparableCount} ${tp} listings with the same bedrooms ${word} in ${r.district}.`, `مقارنة مع ${r.comparableCount} عقاراً من نوع ${propertyTypeLabel(a.asked.type, true)} بنفس عدد الغرف ${word} في ${r.district}.`);
      case "district-type": return t(`Compared with ${r.comparableCount} ${tp} listings ${word} in ${r.district}.`, `مقارنة مع ${r.comparableCount} عقاراً من نوع ${propertyTypeLabel(a.asked.type, true)} ${word} في ${r.district}.`);
      case "district": return t(`Compared with ${r.comparableCount} listings of every type ${word} in ${r.district}: too few ${tp} listings there on their own.`, `مقارنة مع ${r.comparableCount} عقاراً من كل الأنواع ${word} في ${r.district}: عدد قليل من نوعك وحده.`);
      case "city-type-bedrooms": return t(`Few listings in ${r.district} yet, so this uses ${r.comparableCount} ${tp} listings with the same bedrooms across ${r.city}.`, `عقارات قليلة في ${r.district}، فاعتمدت المقارنة على ${r.comparableCount} عقاراً بنفس عدد الغرف في ${r.city}.`);
      default: return t(`Few listings in ${r.district} yet, so this uses ${r.comparableCount} ${tp} listings across ${r.city}.`, `عقارات قليلة في ${r.district}، فاعتمدت المقارنة على ${r.comparableCount} عقاراً في ${r.city}.`);
    }
  };

  const resultBlock = (a: Answer) => {
    const r = a.result;
    if ("reason" in r) {
      return (
        <section id="price-check-result" className="bg-surface rounded-2xl border border-border p-6 space-y-3">
          <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2"><Info size={18} className="text-gold" />{r.reason === "not-enough-data" ? t("Not enough listings to judge this price yet", "لا توجد عقارات كافية للحكم على هذا السعر بعد") : t("We could not check that", "تعذّر الفحص")}</h3>
          <p className="text-sm text-ink-muted">{t(`We only give a verdict when there are enough live listings to compare with, and we found ${r.comparableCount} in ${a.asked.district}. We would rather say so than guess.`, `لا نعطي حكماً إلا عند وجود عقارات معروضة كافية للمقارنة، ووجدنا ${r.comparableCount} في ${a.asked.district}. نفضّل أن نقول ذلك على أن نخمّن.`)}</p>
          <button type="button" onClick={() => onSeeMatches(a.asked.district)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-chrome text-white text-sm font-semibold hover:bg-chrome-hover cursor-pointer"><Search size={15} />{t(`See listings in ${a.asked.district}`, `شاهد العقارات في ${a.asked.district}`)}</button>
        </section>
      );
    }
    const v = verdictText(r.verdict, r);
    const style = VERDICT_STYLE[r.verdict];
    const Icon = style.Icon;
    // where the asked price sits on a bar from half to one and a half times the typical price
    const lowEnd = r.typical * 0.5;
    const span = r.typical;
    const pos = (n: number) => Math.min(100, Math.max(0, ((n - lowEnd) / span) * 100));
    return (
      <div id="price-check-result" className="space-y-5">
        <section className="bg-surface rounded-2xl border border-border shadow-card p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-4">
            <span className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${style.tile}`}><Icon size={28} strokeWidth={2.25} /></span>
            <div className="min-w-0">
              <h3 className={`font-serif text-2xl font-semibold leading-tight ${style.text}`}>{v.title}</h3>
              <p className="text-[14px] text-ink-muted mt-1">{v.line} · {a.asked.district}</p>
            </div>
          </div>

          {r.suspiciouslyLow && (
            <div className="rounded-xl bg-warning-soft border border-warning/30 p-4 text-[13px] text-ink space-y-1.5">
              <p className="font-bold flex items-center gap-2"><AlertTriangle size={16} className="text-warning" />{t("Be careful with a price this low", "احذر من سعر بهذا الانخفاض")}</p>
              <p>{t("Prices far under the market are often bait. Ask to see the owner's title deed and the agent's licence, view the property in person, and never pay a deposit or send money before you have.", "الأسعار المنخفضة جداً عن السوق كثيراً ما تكون طُعماً. اطلب رؤية صك الملكية ورخصة الوسيط، وعاين العقار بنفسك، ولا تدفع عربوناً ولا ترسل مالاً قبل ذلك.")}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border p-4"><p className="text-[12px] text-ink-muted">{t("The price you were offered", "السعر الذي عُرض عليك")}</p><p className="font-serif text-xl font-semibold text-ink mt-1 tabular-nums">{money(r.asked, r)}</p></div>
            <div className="rounded-2xl border border-gold/50 bg-gold-soft/40 p-4"><p className="text-[12px] text-ink-muted">{t("Typical in the market", "المعتاد في السوق")}</p><p className="font-serif text-xl font-semibold text-gold-active mt-1 tabular-nums">{money(r.typical, r)}</p></div>
            <div className="rounded-2xl border border-border p-4"><p className="text-[12px] text-ink-muted">{t("Cheaper than yours", "أرخص من سعرك")}</p><p className="font-serif text-xl font-semibold text-ink mt-1 tabular-nums">{r.cheaperThanPercent}%</p><p className="text-[11px] text-ink-faint">{t("of comparable listings", "من العقارات المقارنة")}</p></div>
          </div>

          <div>
            <div className="relative h-3 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
              <div className="absolute inset-y-0 bg-emerald-200/80" style={{ insetInlineStart: `${pos(r.low)}%`, width: `${Math.max(2, pos(r.high) - pos(r.low))}%` }} />
            </div>
            <div className="relative h-6" aria-hidden>
              <span className="absolute -translate-x-1/2 rtl:translate-x-1/2 top-0.5" style={{ insetInlineStart: `${pos(r.asked)}%` }}>
                <span className="block w-0 h-0 mx-auto border-x-[6px] border-x-transparent border-b-[8px]" style={{ borderBottomColor: style.accent }} />
                <span className="block text-[11px] font-bold whitespace-nowrap" style={{ color: style.accent }}>{t("You", "أنت")}</span>
              </span>
            </div>
            <p className="text-[12px] text-ink-muted">{t("The green band is where most comparable listings sit: ", "الشريط الأخضر هو نطاق معظم العقارات المقارنة: ")}<span className="font-semibold text-ink">{money(r.low, r)} – {money(r.high, r)}</span></p>
          </div>

          {r.target !== null && (
            <p className="rounded-xl bg-surface-2/70 p-4 text-[14px] text-ink">
              {t(`You could aim for about `, `يمكنك أن تطلب نحو `)}<span className="font-bold">{money(r.target, r)}</span>
              {r.yearlyDifference !== null && r.yearlyDifference > 0 ? t(`. That would save you about ${qar(r.yearlyDifference)} a year.`, `. وهذا يوفر عليك نحو ${qar(r.yearlyDifference)} في السنة.`) : "."}
            </p>
          )}

          <p className="text-[12px] text-ink-muted flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /><span>{basisText(r, a)} {confidenceText(r.confidence)}. {r.measure === "per-sqm" ? t("Compared per square metre.", "المقارنة لكل متر مربع.") : ""}</span></p>

          <div className="flex flex-wrap gap-2 pt-1">
            <a href={whatsappShareLink(shareMessage(a, r))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"><MessageCircle size={16} />{t("Send the verdict", "أرسل الحكم")}</a>
            <button type="button" onClick={() => makeCard(a, r)} disabled={working === "card"} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-60 cursor-pointer transition-colors"><Download size={16} />{t("Picture to share", "صورة للمشاركة")}</button>
          </div>
          {note && <p role="status" className="text-[13px] font-semibold text-ink bg-surface-2 rounded-xl px-4 py-2.5">{note}</p>}
        </section>

        {/* what to do next: turn the answer into something */}
        <section className="grid sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => createAlert(a)} disabled={working === "alert"} className="text-start flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-gold transition cursor-pointer disabled:opacity-60">
            <span className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0"><Bell size={21} strokeWidth={2.25} /></span>
            <span><span className="block text-sm font-semibold text-ink">{t(`Tell me when one appears at ${qar(a.asked.price)} or less`, `نبّهني عندما يظهر عقار بـ ${qar(a.asked.price)} أو أقل`)}</span><span className="block text-[12px] text-ink-muted mt-0.5">{t("A free alert for this area, type and price.", "تنبيه مجاني لهذه المنطقة والنوع والسعر.")}</span></span>
          </button>
          <button type="button" onClick={() => onSeeMatches(a.asked.district)} className="text-start flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-gold transition cursor-pointer">
            <span className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><Search size={21} strokeWidth={2.25} /></span>
            <span><span className="block text-sm font-semibold text-ink">{t(`See listings in ${a.asked.district}`, `شاهد العقارات في ${a.asked.district}`)}</span><span className="block text-[12px] text-ink-muted mt-0.5">{t("Verified agents, availability confirmed.", "وسطاء موثّقون وتوفر مؤكد.")}</span></span>
          </button>
          {a.reportPath && (
            <button type="button" onClick={() => onOpenReport(a.reportPath!)} className="text-start flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-gold transition cursor-pointer">
              <span className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><FileBarChart size={21} strokeWidth={2.25} /></span>
              <span><span className="block text-sm font-semibold text-ink">{a.asked.deal === "RENT" ? t(`Average rent in ${a.asked.district}`, `متوسط الإيجار في ${a.asked.district}`) : t(`Property prices in ${a.asked.district}`, `أسعار العقارات في ${a.asked.district}`)}</span><span className="block text-[12px] text-ink-muted mt-0.5">{t("By bedrooms, with the full range.", "حسب عدد الغرف مع النطاق الكامل.")}</span></span>
            </button>
          )}
          <button type="button" onClick={onOpenValuation} className="text-start flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-gold transition cursor-pointer">
            <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Calculator size={21} strokeWidth={2.25} /></span>
            <span><span className="block text-sm font-semibold text-ink">{t("Are you the owner?", "هل أنت المالك؟")}</span><span className="block text-[12px] text-ink-muted mt-0.5">{t("Find out what your own property is worth.", "اعرف كم يساوي عقارك.")}</span></span>
          </button>
        </section>

        {r.similar.length > 0 && (
          <section className="bg-surface rounded-2xl border border-border shadow-card p-5 space-y-3">
            <h3 className="font-serif text-lg font-semibold text-ink">{t("Closest listings to your price", "أقرب العقارات إلى سعرك")}</h3>
            <ul className="divide-y divide-border/70">
              {r.similar.map(s => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpenProperty(s.id)} className="w-full flex items-center justify-between gap-3 py-3 text-start cursor-pointer hover:bg-surface-2/60 rounded-lg px-2 -mx-2 transition-colors">
                    <span className="min-w-0"><span className="block text-sm font-semibold text-ink truncate">{s.title}</span><span className="block text-[12px] text-ink-muted">{s.bedrooms === 0 ? t("Studio", "استوديو") : `${s.bedrooms} ${t("bed", "نوم")}`} · {Math.round(s.area)} {t("sqm", "م²")}</span></span>
                    <span className="font-bold text-gold-active tabular-nums shrink-0">{money(s.price, r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white px-6 py-8 sm:px-10 sm:py-10 shadow-popover">
        <div className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-4">
          <span className="w-14 h-14 rounded-2xl bg-white/10 text-gold flex items-center justify-center shrink-0"><Scale size={28} strokeWidth={2.25} /></span>
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium leading-tight">{t("Is this price fair?", "هل هذا السعر عادل؟")}</h1>
            <p className="text-[14px] sm:text-[15px] text-gray-300 mt-2 leading-relaxed">{t("Enter the rent or price you were offered, even from another website or a post in a group. We compare it with the live listings in the same area and tell you the truth.", "أدخل الإيجار أو السعر الذي عُرض عليك، حتى لو كان من موقع آخر أو منشور في مجموعة. نقارنه بالعقارات المعروضة فعلاً في المنطقة نفسها ونقول لك الحقيقة.")}</p>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="bg-surface rounded-2xl border border-border shadow-card p-5 sm:p-6 space-y-4">
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2/70 border border-border/60">
          {([["RENT", t("A rent", "إيجار")], ["SALE", t("A purchase price", "سعر شراء")]] as const).map(([k, text]) => (
            <button key={k} type="button" role="tab" aria-selected={deal === k} onClick={() => setDeal(k)}
              className={`py-2.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${deal === k ? "bg-chrome text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}>{text}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
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
          <label className={label}>{deal === "RENT" ? t("Rent you were offered (QAR per month)", "الإيجار الذي عُرض عليك (ر.ق شهرياً)") : t("Price you were offered (QAR)", "السعر الذي عُرض عليك (ر.ق)")}</label>
          <input type="text" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder={deal === "RENT" ? "e.g. 8,500" : "e.g. 1,500,000"} className={`${field} tabular-nums text-lg font-semibold`} aria-label={t("Price", "السعر")} />
        </div>
        <div>
          <label className={label}>{t("Size (optional, makes the answer more accurate)", "المساحة (اختيارية، تجعل الجواب أدق)")}</label>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" min="0" value={size} onChange={e => setSize(e.target.value)} placeholder={unit === "SQM" ? "e.g. 120" : "e.g. 1300"} className={`${field} tabular-nums`} aria-label={t("Size", "المساحة")} />
            <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
              {(["SQM", "SQFT"] as const).map(u => (
                <button key={u} type="button" onClick={() => setUnit(u)} className={`px-3 text-[13px] font-semibold cursor-pointer ${unit === u ? "bg-chrome text-white" : "bg-canvas text-ink-muted hover:text-ink"}`}>{u === "SQM" ? t("sqm", "م²") : t("sqft", "قدم²")}</button>
              ))}
            </div>
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-gold text-gold-ink text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer hover:brightness-95 transition">
          {busy ? t("Checking...", "جارٍ الفحص...") : t("Check this price", "افحص هذا السعر")}
          {!busy && <Check size={18} strokeWidth={2.5} />}
        </button>
        <p className="text-[11px] text-ink-faint flex items-start gap-1.5"><Share2 size={12} className="shrink-0 mt-0.5" />{t("Free, instant and private: nothing you enter is stored. Asking prices from the live listings on Nerou Finder, not completed deals.", "مجاني وفوري وخاص: لا يُحفظ أي شيء تدخله. أسعار معروضة من العقارات المنشورة على نيرو فايندر، وليست صفقات مكتملة.")}</p>
      </form>

      {answer && resultBlock(answer)}
    </div>
  );
}
