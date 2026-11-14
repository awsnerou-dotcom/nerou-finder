/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Info, Sparkles, X } from "lucide-react";
import { parseListingText, splitAds } from "../lib/listingFromText.js";
import type { ParsedField, ParsedListing, PlaceRef } from "../lib/listingFromText.js";
import { propertyTypeLabel } from "../lib/propertySpecs.js";

// The quickest way to add a listing: paste the ad you already wrote (a WhatsApp message, a post from another site, in Arabic or
// English) and the form is filled with what we can read in it. The agent only adds photos and the pin, checks, and publishes.

const SAMPLE_EN = "Luxury 2BR apartment for rent in West Bay\n120 sqm, 2 bathrooms, fully furnished\nQAR 9,500 per month";
const SAMPLE_AR = "شقة للايجار في لوسيل\n3 غرف نوم و3 حمامات\n160 متر\nالسعر 12000 ريال شهريا\nمفروشة";

export default function PasteAdPanel({ isRtl, locations, onApply }: { isRtl: boolean; locations: PlaceRef[]; onApply: (p: ParsedListing) => void }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(0);
  const [read, setRead] = useState(false);

  const ads = useMemo(() => (read ? (splitAds(text).length > 0 ? splitAds(text) : text.trim().length >= 15 ? [text.trim()] : []) : []), [read, text]);
  const parsed = useMemo(() => ads.map(a => parseListingText(a, locations)), [ads, locations]);
  const current = parsed[Math.min(picked, Math.max(0, parsed.length - 1))];
  const Next = isRtl ? ArrowLeft : ArrowRight;

  const FIELDS: { id: ParsedField; label: string }[] = [
    { id: "transaction", label: t("Rent or sale", "إيجار أو بيع") },
    { id: "propertyType", label: t("Property type", "نوع العقار") },
    { id: "place", label: t("Area", "المنطقة") },
    { id: "price", label: t("Price", "السعر") },
    { id: "bedrooms", label: t("Bedrooms", "غرف النوم") },
    { id: "bathrooms", label: t("Bathrooms", "الحمامات") },
    { id: "area", label: t("Size", "المساحة") },
    { id: "furnishing", label: t("Furnishing", "الفرش") }
  ];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-4 rounded-2xl border border-gold/50 bg-gradient-to-br from-gold-soft/60 to-surface p-4 sm:p-5 text-start shadow-card hover:border-gold cursor-pointer transition"
      >
        <span className="w-12 h-12 rounded-2xl bg-chrome text-gold flex items-center justify-center shrink-0"><ClipboardPaste size={24} strokeWidth={2.25} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-lg font-semibold text-ink leading-tight">{t("Paste your ad, we fill the form", "الصق إعلانك ونملأ النموذج")}</span>
          <span className="block text-[13px] text-ink-muted mt-0.5">{t("Already wrote it on WhatsApp or another site? Paste it, in Arabic or English, and add your listing in seconds.", "كتبته في واتساب أو موقع آخر؟ الصقه بالعربية أو الإنجليزية وأضف عقارك خلال ثوانٍ.")}</span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-bold text-gold-active"><Sparkles size={16} />{t("Try it", "جرّبها")}</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-gold/50 bg-surface shadow-card p-5 space-y-4" aria-label={t("Paste your ad", "الصق إعلانك")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl bg-chrome text-gold flex items-center justify-center shrink-0"><ClipboardPaste size={22} strokeWidth={2.25} /></span>
          <div>
            <h3 className="font-serif text-lg font-semibold text-ink leading-tight">{t("Paste your ad", "الصق إعلانك")}</h3>
            <p className="text-[13px] text-ink-muted mt-0.5">{t("We read the deal, type, price, size, bedrooms and area. Anything we cannot find stays empty for you to fill in.", "نقرأ نوع الصفقة والعقار والسعر والمساحة والغرف والمنطقة. وما لا نجده يبقى فارغاً لتكمله.")}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setOpen(false); setRead(false); }} aria-label={t("Close", "إغلاق")} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-2 cursor-pointer"><X size={18} /></button>
      </div>

      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setRead(false); }}
        rows={6}
        dir="auto"
        placeholder={t("Paste the text of your ad here…", "الصق نص إعلانك هنا…")}
        aria-label={t("Your ad", "إعلانك")}
        className="w-full px-4 py-3 bg-canvas border border-border rounded-xl text-[14px] leading-relaxed resize-y"
      />
      {text.trim() === "" && (
        <p className="text-[12px] text-ink-faint">
          {t("For example: ", "مثال: ")}
          <button type="button" onClick={() => setText(SAMPLE_EN)} className="font-semibold text-gold-active hover:underline cursor-pointer">{t("English", "إنجليزي")}</button>
          {" · "}
          <button type="button" onClick={() => setText(SAMPLE_AR)} className="font-semibold text-gold-active hover:underline cursor-pointer">{t("Arabic", "عربي")}</button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={text.trim().length < 15} onClick={() => { setRead(true); setPicked(0); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-chrome hover:bg-chrome-hover text-white text-sm font-semibold disabled:opacity-40 cursor-pointer transition-colors">
          <Sparkles size={16} className="text-gold" />{t("Read my ad", "اقرأ إعلاني")}
        </button>
        <span className="text-[12px] text-ink-faint">{t("Phone numbers, e-mails and links are removed: enquiries come through the platform.", "تُحذف أرقام الهاتف والبريد والروابط: الاستفسارات تصل عبر المنصة.")}</span>
      </div>

      {read && parsed.length === 0 && (
        <p className="text-[13px] text-ink bg-warning-soft border border-warning/30 rounded-xl px-4 py-3">{t("That is too short to read. Paste the whole ad.", "النص قصير جداً للقراءة. الصق الإعلان كاملاً.")}</p>
      )}

      {read && current && (
        <div className="space-y-4 border-t border-border pt-4">
          {parsed.length > 1 && (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-ink">{t(`We found ${parsed.length} ads. Which one now?`, `وجدنا ${parsed.length} إعلانات. أيّها الآن؟`)}</p>
              <div className="flex flex-wrap gap-2">
                {parsed.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPicked(i)} aria-pressed={picked === i} className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${picked === i ? "bg-chrome text-white border-chrome" : "bg-surface text-ink-muted border-border hover:text-ink"}`}>
                    {i + 1}. {p.title.slice(0, 34) || t("Ad", "إعلان")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[13px] font-semibold text-ink mb-2">{t("What we found", "ما وجدناه")}</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {FIELDS.map(f => {
                const has = current.found.includes(f.id);
                const value =
                  f.id === "transaction" ? (current.transaction === "FOR_RENT" ? t("For rent", "للإيجار") : t("For sale", "للبيع"))
                  : f.id === "propertyType" ? (current.propertyType ? propertyTypeLabel(current.propertyType, isRtl) : "")
                  : f.id === "place" ? (current.placeName || "")
                  : f.id === "price" ? `QAR ${(current.monthlyRent ?? current.price ?? 0).toLocaleString("en-US")}${current.transaction === "FOR_RENT" ? t(" / month", " / شهر") : ""}`
                  : f.id === "bedrooms" ? (current.bedrooms === 0 ? t("Studio", "استوديو") : String(current.bedrooms))
                  : f.id === "bathrooms" ? String(current.bathrooms)
                  : f.id === "area" ? `${current.areaSqm} ${t("sqm", "م²")}`
                  : current.furnishing === "FULLY_FURNISHED" ? t("Furnished", "مفروش") : current.furnishing === "SEMI_FURNISHED" ? t("Semi furnished", "مؤثث جزئياً") : t("Unfurnished", "غير مفروش");
                return (
                  <li key={f.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${has ? "border-emerald-200 bg-emerald-50" : "border-border bg-surface-2/50"}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${has ? "bg-emerald-500 text-white" : "bg-surface-2 text-ink-faint"}`}>{has ? <Check size={14} strokeWidth={3} /> : <span className="text-[11px]">?</span>}</span>
                    <span className="min-w-0"><span className="block text-[11px] text-ink-muted">{f.label}</span><span className={`block font-semibold truncate ${has ? "text-ink" : "text-ink-faint"}`}>{has ? value : t("Not found: you add it", "غير موجود: أضفه أنت")}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>

          {current.monthlyRent !== undefined && (
            <p className="text-[12px] text-ink-muted flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" />{t(`Your ad gives a yearly rent (QAR ${current.price!.toLocaleString("en-US")}). The platform shows rent per month, so we entered QAR ${current.monthlyRent.toLocaleString("en-US")}.`, `إعلانك يذكر إيجاراً سنوياً (${current.price!.toLocaleString("en-US")} ر.ق). المنصة تعرض الإيجار شهرياً، فأدخلنا ${current.monthlyRent.toLocaleString("en-US")} ر.ق.`)}</p>
          )}
          {current.removedContact && (
            <p className="text-[12px] text-ink-muted flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" />{t("We removed phone numbers, e-mails and links from the description.", "حذفنا أرقام الهاتف والبريد والروابط من الوصف.")}</p>
          )}

          <button type="button" onClick={() => onApply(current)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-ink text-sm font-bold hover:brightness-95 cursor-pointer transition">
            {t("Continue: add photos and publish", "تابع: أضف الصور وانشر")}<Next size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </section>
  );
}
