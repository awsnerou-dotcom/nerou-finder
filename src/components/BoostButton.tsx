/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Zap, Star, Loader2 } from "lucide-react";

interface BoostButtonProps {
  propertyId: string;
  isRtl: boolean;
  onBoosted?: () => void;
}

export default function BoostButton({ propertyId, isRtl, onBoosted }: BoostButtonProps) {
  const [loading, setLoading] = useState<"BUMP" | "FEATURED" | null>(null);
  const [message, setMessage] = useState<string>("");

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

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => activate("BUMP")}
          disabled={loading !== null}
          className="px-2 py-1 bg-[#f2ede8] hover:bg-[#e6e2de] text-[#1a1918] rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {loading === "BUMP" ? <Loader2 className="animate-spin" size={11} /> : <Zap size={11} />}
          {isRtl ? "رفع (٤٩ ر.ق)" : "Bump (49 QAR)"}
        </button>
        <button
          type="button"
          onClick={() => activate("FEATURED")}
          disabled={loading !== null}
          className="px-2 py-1 bg-[#bf9b30] hover:bg-[#a8842a] text-black rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {loading === "FEATURED" ? <Loader2 className="animate-spin" size={11} /> : <Star size={11} />}
          {isRtl ? "مميز (٢٩٩ ر.ق/أسبوع)" : "Featured (299 QAR/wk)"}
        </button>
      </div>
      {message && <p className="text-[9px] text-[#6e6b66]">{message}</p>}
    </div>
  );
}
