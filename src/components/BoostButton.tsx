/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Zap, Star, Loader2, AlertTriangle } from "lucide-react";
import { Property } from "../types.js";

interface BoostButtonProps {
  property: Property;
  isRtl: boolean;
  onBoosted?: () => void;
}

// AI Listing Quality Score (pre-boost check) - a quick, entirely client-side completeness
// check (no Gemini call needed here, this is not judgment-based). Warns, but never hard-blocks,
// before a boost is actually activated - agents can always "Boost anyway".
const MIN_BOOST_IMAGES = 5;
const MIN_BOOST_DESCRIPTION_LENGTH = 100;

interface QualityWarning {
  en: string;
  ar: string;
}

function checkListingQuality(property: Property): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const imageCount = property.images?.length || 0;
  const descLength = (property.description || "").trim().length;

  if (imageCount < MIN_BOOST_IMAGES) {
    const missing = MIN_BOOST_IMAGES - imageCount;
    warnings.push({
      en: `Add at least ${missing} more photo${missing === 1 ? "" : "s"} for better results — boosted listings with 8+ photos get significantly more engagement.`,
      ar: `أضف ${missing} صورة إضافية على الأقل لنتائج أفضل — الإعلانات المرفوعة التي تحتوي على ٨ صور أو أكثر تحصل على تفاعل أعلى بكثير.`
    });
  }

  if (descLength < MIN_BOOST_DESCRIPTION_LENGTH) {
    warnings.push({
      en: `Expand your description — it's only ${descLength} characters. Listings with a fuller description (100+ characters) tend to convert better.`,
      ar: `قم بتوسيع الوصف — يحتوي حالياً على ${descLength} حرفاً فقط. الإعلانات ذات الوصف الأكمل (١٠٠ حرف أو أكثر) تحقق نتائج أفضل عادةً.`
    });
  }

  const missingFields: string[] = [];
  if (!property.price || property.price <= 0) missingFields.push("price");
  if (property.bedrooms === undefined || property.bedrooms === null || isNaN(property.bedrooms as any)) missingFields.push("bedrooms");
  if (property.bathrooms === undefined || property.bathrooms === null || isNaN(property.bathrooms as any)) missingFields.push("bathrooms");
  if (!property.district || !property.district.trim()) missingFields.push("district/location");

  if (missingFields.length > 0) {
    warnings.push({
      en: `Complete these key fields before boosting: ${missingFields.join(", ")}.`,
      ar: `أكمل هذه الحقول الأساسية قبل الرفع: ${missingFields.join("، ")}.`
    });
  }

  return warnings;
}

export default function BoostButton({ property, isRtl, onBoosted }: BoostButtonProps) {
  const propertyId = property.id;
  const [loading, setLoading] = useState<"BUMP" | "FEATURED" | null>(null);
  const [message, setMessage] = useState<string>("");
  // Pending boost awaiting a "Boost anyway" confirmation after a quality warning was shown.
  const [pendingType, setPendingType] = useState<"BUMP" | "FEATURED" | null>(null);
  const [qualityWarnings, setQualityWarnings] = useState<QualityWarning[]>([]);

  const activate = async (type: "BUMP" | "FEATURED") => {
    setLoading(type);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/ad-charges", {
        method: "POST",
        headers,
        body: JSON.stringify({ propertyId, type })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(isRtl ? `تم التفعيل! (${data.charge.amount} ر.ق)` : `Activated! (${data.charge.amount} QAR)`);
        onBoosted?.();
      } else {
        setMessage(data.error || (isRtl ? "فشل التفعيل" : "Activation failed"));
      }
    } catch (e) {
      setMessage(isRtl ? "فشل التفعيل" : "Activation failed");
    } finally {
      setLoading(null);
      setTimeout(() => setMessage(""), 6000);
    }
  };

  // Runs the client-side quality completeness check first; if it comes back clean, boost
  // immediately as before. If not, show a gentle (non-blocking) warning with a "Boost anyway"
  // option instead of calling the API right away.
  const handleBoostClick = (type: "BUMP" | "FEATURED") => {
    const warnings = checkListingQuality(property);
    if (warnings.length === 0) {
      activate(type);
      return;
    }
    setQualityWarnings(warnings);
    setPendingType(type);
  };

  const handleBoostAnyway = () => {
    if (!pendingType) return;
    const type = pendingType;
    setPendingType(null);
    setQualityWarnings([]);
    activate(type);
  };

  const handleCancelPendingBoost = () => {
    setPendingType(null);
    setQualityWarnings([]);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => handleBoostClick("BUMP")}
          disabled={loading !== null}
          className="px-2 py-1 bg-[#f2ede8] hover:bg-[#e6e2de] text-[#1a1918] rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {loading === "BUMP" ? <Loader2 className="animate-spin" size={11} /> : <Zap size={11} />}
          {isRtl ? "رفع (٤٩ ر.ق)" : "Bump (49 QAR)"}
        </button>
        <button
          type="button"
          onClick={() => handleBoostClick("FEATURED")}
          disabled={loading !== null}
          className="px-2 py-1 bg-[#bf9b30] hover:bg-[#a8842a] text-black rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {loading === "FEATURED" ? <Loader2 className="animate-spin" size={11} /> : <Star size={11} />}
          {isRtl ? "مميز (٢٩٩ ر.ق/أسبوع)" : "Featured (299 QAR/wk)"}
        </button>
      </div>

      {/* AI Listing Quality Score pre-boost warning - gentle, not a hard block. */}
      {pendingType && qualityWarnings.length > 0 && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 max-w-xs">
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {qualityWarnings.map((w, i) => (
                <p key={i} className="text-[9px] text-amber-800 leading-relaxed">{isRtl ? w.ar : w.en}</p>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleBoostAnyway}
              disabled={loading !== null}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9px] font-bold cursor-pointer disabled:opacity-50"
            >
              {isRtl ? "الرفع على أي حال" : "Boost anyway"}
            </button>
            <button
              type="button"
              onClick={handleCancelPendingBoost}
              disabled={loading !== null}
              className="px-2 py-1 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] text-[#1a1918] rounded text-[9px] font-semibold cursor-pointer disabled:opacity-50"
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-[9px] text-[#6e6b66]">{message}</p>}
    </div>
  );
}
