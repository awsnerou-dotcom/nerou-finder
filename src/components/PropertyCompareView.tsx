/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Property, TransactionType } from "../types.js";
import { X, Check, Shield, Star, RefreshCw, Plus, MapPin, Bed, Bath } from "lucide-react";

interface PropertyCompareViewProps {
  properties: Property[];
  onRemoveFromCompare: (id: string) => void;
  onClose: () => void;
  isRtl: boolean;
}

export default function PropertyCompareView({
  properties,
  onRemoveFromCompare,
  onClose,
  isRtl,
}: PropertyCompareViewProps) {
  const [displayUnit, setDisplayUnit] = useState<"SQM" | "SQFT">("SQM");

  // Only render as many columns as there are selected properties, plus one open "add" slot
  // (capped at 4) - previously this always rendered all 4 slots regardless of how many
  // properties were actually selected, forcing a wide, mostly-empty horizontal-scroll table
  // on mobile even when comparing just 1-2 listings.
  const slotCount = Math.min(4, properties.length + 1);
  const gridTemplateColumns = `140px repeat(${slotCount}, minmax(150px, 1fr))`;

  const getAreaDisplay = (areaSqm: number) => {
    if (displayUnit === "SQFT") {
      return `${Math.round(areaSqm * 10.7639).toLocaleString()} SQFT`;
    }
    return `${areaSqm.toLocaleString()} SQM`;
  };

  if (properties.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
        <div className="bg-white rounded-xl border border-border p-8 max-w-sm text-center space-y-4">
          <p className="text-sm text-ink-muted">
            {isRtl ? "لم تختر أي عقارات للمقارنة بعد." : "No properties selected for comparison yet."}
          </p>
          <button onClick={onClose} className="px-4 py-2 bg-ink text-white rounded text-xs">
            {isRtl ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in duration-300 max-h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-4 bg-canvas border-b border-border flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-serif text-lg font-medium text-ink">
              {isRtl ? "مقارنة العقارات جنباً إلى جنب" : "Side-by-Side Property Comparison"}
            </h3>
            <p className="text-[10px] text-ink-muted mt-0.5">
              {isRtl ? `مقارنة ${properties.length} عقارات لتسهيل قرارك الاستثماري` : `Compare up to 4 listings to find your optimal Qatar choice`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDisplayUnit((prev) => (prev === "SQM" ? "SQFT" : "SQM"))}
              className="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>{isRtl ? "تغيير وحدة المساحة" : `Show in ${displayUnit === "SQM" ? "SQFT" : "SQM"}`}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full border border-border hover:bg-stone-100 cursor-pointer text-ink-muted"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {slotCount > 1 && (
          <p className="md:hidden text-[10px] text-ink-muted text-center py-1.5 bg-canvas border-b border-border shrink-0">
            {isRtl ? "مرر أفقياً لعرض المزيد ←" : "→ Swipe to see more"}
          </p>
        )}

        {/* COMPRESSION GRID TABLE SCROLLABLE BODY */}
        <div className="overflow-auto flex-1 p-4 md:p-6">
          <div
            className="grid border border-border rounded-xl overflow-hidden bg-white text-xs divide-x divide-y divide-border [grid-auto-rows:minmax(0,1fr)]"
            style={{ gridTemplateColumns, minWidth: `${140 + slotCount * 150}px` }}
          >

            {/* ROW 1: HEADER LABELS & PROPERTY IMAGES */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "العقار" : "Property Profile"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-3 relative bg-white flex flex-col justify-between">
                  {prop ? (
                    <>
                      <button
                        onClick={() => onRemoveFromCompare(prop.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer z-10"
                        title={isRtl ? "إزالة" : "Remove"}
                      >
                        <X size={12} />
                      </button>
                      <div className="space-y-2">
                        <div className="aspect-video rounded overflow-hidden bg-gray-100">
                          <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-bold text-ink line-clamp-2">
                          {isRtl ? prop.titleAr || prop.title : prop.title}
                        </h4>
                        <p className="text-[10px] text-ink-muted flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          <span>{prop.district}, {prop.city}</span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={onClose}
                      className="flex flex-col items-center justify-center h-full w-full text-gold text-[11px] py-8 gap-1.5 cursor-pointer hover:bg-canvas transition-colors rounded-lg font-semibold"
                      title={isRtl ? "العودة للمعرض لإضافة عقار" : "Back to the marketplace to add a property"}
                    >
                      <Plus size={18} />
                      <span>{isRtl ? "أضف عقاراً آخر" : "Add another property"}</span>
                    </button>
                  )}
                </div>
              );
            })}

            {/* ROW 2: TRANSACTION TYPE */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "نوع المعاملة" : "Transaction"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center">
                  {prop && (
                    <span className="px-2 py-0.5 bg-ink text-white text-[9px] font-bold rounded uppercase">
                      {isRtl
                        ? prop.transactionType === TransactionType.FOR_RENT ? "للإيجار" : "للبيع"
                        : prop.transactionType === TransactionType.FOR_RENT ? "RENT" : "SALE"}
                    </span>
                  )}
                </div>
              );
            })}

            {/* ROW 3: PRICE */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "السعر" : "Asking Price"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center text-gold font-bold text-sm">
                  {prop && (
                    <span>
                      {prop.price.toLocaleString()} {prop.currency || "QAR"}
                      {prop.transactionType === TransactionType.FOR_RENT && <span className="text-[10px] text-ink-muted font-normal"> / {prop.rentalPeriod || "YR"}</span>}
                    </span>
                  )}
                </div>
              );
            })}

            {/* ROW 4: TOTAL SIZE */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "المساحة الكلية" : "Total Size"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center font-bold text-ink">
                  {prop && <span>{getAreaDisplay(prop.area)}</span>}
                </div>
              );
            })}

            {/* ROW 5: BEDROOMS & BATHROOMS */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "الغرف والحمامات" : "Beds / Baths"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center text-ink">
                  {prop && (
                    <span className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1"><Bed size={12} />{prop.bedrooms}</span>
                      <span className="flex items-center gap-1"><Bath size={12} />{prop.bathrooms}</span>
                    </span>
                  )}
                </div>
              );
            })}

            {/* ROW 6: FURNISHING */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "حالة التأثيث" : "Furnishing"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center text-ink-muted">
                  {prop && (
                    <span>
                      {prop.furnished === "YES" ? (isRtl ? "مؤثث بالكامل" : "Fully Furnished") :
                       prop.furnished === "NO" ? (isRtl ? "غير مؤثث" : "Unfurnished") : (isRtl ? "شبه مؤثث" : "Partly Furnished")}
                    </span>
                  )}
                </div>
              );
            })}

            {/* ROW 7: QUALITY SCORE */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "تقييم جودة الإعلان" : "Listing Quality Score"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center">
                  {prop && (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-emerald-600">{prop.qualityScore}%</span>
                      <div className="w-12 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${prop.qualityScore}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ROW 8: PORTAL VERIFICATION */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "التوثيق القانوني" : "Portal Verification"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex items-center">
                  {prop && (
                    <div className="flex items-center gap-1">
                      {prop.verificationStatus === "APPROVED" ? (
                        <>
                          <Shield size={13} className="text-emerald-500" fill="currentColor" />
                          <span className="text-emerald-700 font-bold">{isRtl ? "موثق" : "Approved Portal"}</span>
                        </>
                      ) : (
                        <span className="text-ink-muted">{isRtl ? "قيد المراجعة" : "Under verification"}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ROW 9: KEY AMENITIES */}
            <div className="p-4 bg-stone-50 font-bold flex items-center">
              {isRtl ? "أبرز المرافق" : "Key Amenities"}
            </div>
            {Array.from({ length: slotCount }).map((_, idx) => {
              const prop = properties[idx];
              return (
                <div key={idx} className="p-4 flex flex-col gap-1 text-ink-muted text-[10px]">
                  {prop && prop.amenities.slice(0, 4).map((am, amIdx) => (
                    <div key={amIdx} className="flex items-center gap-1">
                      <Check size={10} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{am}</span>
                    </div>
                  ))}
                </div>
              );
            })}

          </div>
        </div>

      </div>
    </div>
  );
}
