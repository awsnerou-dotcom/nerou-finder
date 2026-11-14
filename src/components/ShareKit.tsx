/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Loader2, MessageCircle, Share2 } from "lucide-react";
import type { Property } from "../types.js";
import { listingShareMessage, listingShareUrl, whatsappShareLink } from "../lib/profiles.js";
import { renderShareCard } from "../lib/shareCard.js";

// The share kit for one listing: a WhatsApp message with the photo preview link, the link itself, and a ready picture
// (photo, price, place, agent) to post as a status or send. Every link carries ?sh=1 so the owner can see how many people
// their sharing brings.

const PERIOD: Record<string, { en: string; ar: string }> = {
  MONTHLY: { en: "/month", ar: "/شهر" },
  YEARLY: { en: "/year", ar: "/سنة" },
  WEEKLY: { en: "/week", ar: "/أسبوع" },
  DAILY: { en: "/day", ar: "/يوم" }
};

function periodFor(p: Pick<Property, "transactionType" | "rentalPeriod">, isRtl: boolean): string {
  const tx = String(p.transactionType);
  if (!(tx.includes("RENT") || tx.includes("LEASE"))) return "";
  const per = PERIOD[p.rentalPeriod || "MONTHLY"];
  return per ? (isRtl ? per.ar : per.en) : "";
}

export default function ShareListingButton({
  property,
  isRtl,
  agentName,
  agentLine,
  label = true
}: {
  property: Pick<Property, "id" | "title" | "titleAr" | "price" | "currency" | "district" | "city" | "images" | "transactionType" | "rentalPeriod" | "bedrooms" | "bathrooms" | "area" | "sizeUnit">;
  isRtl: boolean;
  /** printed on the picture */
  agentName: string;
  agentLine?: string;
  label?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const t = (en: string, ar: string) => (isRtl ? ar : en);

  const url = listingShareUrl(window.location.origin, property.id, isRtl);
  const title = (isRtl ? property.titleAr || property.title : property.title).trim();
  const message = listingShareMessage({ title, price: property.price, currency: property.currency, district: property.district, url, isRtl, period: periodFor(property, isRtl) });

  const flash = (text: string) => { setNote(text); setTimeout(() => setNote(""), 2500); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { flash(t("Copy is blocked in this browser.", "النسخ غير متاح في هذا المتصفح.")); }
  };

  const card = async () => {
    setBusy(true);
    try {
      const isRent = String(property.transactionType).includes("RENT") || String(property.transactionType).includes("LEASE");
      const specs = [
        property.bedrooms === 0 ? t("Studio", "استوديو") : typeof property.bedrooms === "number" ? `${property.bedrooms} ${t("bed", "نوم")}` : "",
        property.bathrooms ? `${property.bathrooms} ${t("bath", "حمام")}` : "",
        property.area ? `${Math.round(property.area)} ${property.sizeUnit === "SQFT" ? t("sqft", "قدم²") : t("sqm", "م²")}` : ""
      ].filter(Boolean).join("  ·  ");
      const blob = await renderShareCard({
        imageUrl: property.images?.[0],
        title,
        price: `${property.currency || "QAR"} ${Math.round(property.price).toLocaleString("en-US")}${periodFor(property, isRtl)}`,
        place: [property.district, property.city].filter(Boolean).join(", "),
        specs,
        agentName,
        agentLine,
        site: "neroufinder.com",
        isRtl,
        badge: isRent ? t("For rent", "للإيجار") : t("For sale", "للبيع")
      });
      const file = new File([blob], `listing-${property.id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], text: message }); setOpen(false); return; } catch { /* cancelled: fall back to a download */ }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash(t("Picture saved. Send it with the link.", "تم حفظ الصورة. أرسلها مع الرابط."));
    } catch {
      flash(t("Could not make the picture.", "تعذر إنشاء الصورة."));
    } finally {
      setBusy(false);
    }
  };

  const item = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-surface-2 cursor-pointer transition-colors text-start";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("Share this listing", "شارك هذا العقار")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg cursor-pointer transition-colors"
      >
        <Share2 size={14} />
        {label && <span>{t("Share", "مشاركة")}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute z-40 bottom-full mb-2 start-0 w-64 bg-surface border border-border rounded-2xl shadow-popover p-1.5">
            <a role="menuitem" href={whatsappShareLink(message)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><MessageCircle size={17} /></span>
              {t("Send on WhatsApp", "إرسال عبر واتساب")}
            </a>
            <button role="menuitem" type="button" onClick={copy} className={item}>
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">{copied ? <Check size={17} /> : <Copy size={17} />}</span>
              {copied ? t("Link copied", "تم نسخ الرابط") : t("Copy link", "نسخ الرابط")}
            </button>
            <button role="menuitem" type="button" onClick={card} disabled={busy} className={`${item} disabled:opacity-60`}>
              <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={17} />}
              </span>
              <span className="min-w-0">
                <span className="block">{t("Picture to post", "صورة جاهزة للنشر")}</span>
                <span className="block text-[11px] font-normal text-ink-muted">{t("Photo, price and your name", "الصورة والسعر واسمك")}</span>
              </span>
              <Download size={14} className="ms-auto text-ink-faint shrink-0" />
            </button>
            {note && <p className="px-3 py-2 text-[12px] text-ink-muted">{note}</p>}
          </div>
        </>
      )}
    </div>
  );
}
