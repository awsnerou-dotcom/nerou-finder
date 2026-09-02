/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { FileBarChart, Loader2 } from "lucide-react";
import { Property, User } from "../types.js";
import { generateCmaReportPdf, MarketIndexGroup } from "../lib/generateCmaReport.js";

interface CmaReportButtonProps {
  property: Property;
  // Acting user credited as the report's author in its footer ("Prepared by ..."). Any of the
  // three workspaces can pass either the listing's own agent or the signed-in agency/developer
  // admin acting on its behalf - the PDF doesn't distinguish, same as the existing brochure.
  agent: Pick<User, "fullName">;
  // Agency/Developer org name, when the acting user belongs to one - shown alongside their name
  // in the footer. Omitted for an independent agent generating their own report.
  orgName?: string;
  isRtl: boolean;
  // Lets each workspace match this button's classes to its own neighboring Performance/Edit/
  // Delete action buttons exactly, rather than this component guessing one shared style.
  className?: string;
}

const DEFAULT_CLASSNAME =
  "flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded cursor-pointer disabled:opacity-50";

// Per-listing "CMA Report" action - fetches live comparable listings and district market-index
// stats (both existing public GET endpoints, no new backend route needed) and hands them to
// generateCmaReportPdf() (src/lib/generateCmaReport.ts) to produce a downloadable PDF. Mounted
// next to the existing Performance/Edit/Delete actions on a listing row in AgentWorkspace,
// AgencyWorkspace and DeveloperWorkspace.
export default function CmaReportButton({ property, agent, orgName, isRtl, className }: CmaReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Live/published comps only, excluding the subject property itself - a CMA should
      // reflect the current real market, not the listing's own history or draft/archived
      // listings (GET /api/properties defaults to PUBLISHED-only unless includeAllStatuses).
      const compsParams = new URLSearchParams({
        district: property.district,
        city: property.city,
        transactionType: property.transactionType,
        includeAllStatuses: "false"
      });
      const marketParams = new URLSearchParams({
        district: property.district,
        city: property.city
      });

      const [compsRes, marketRes] = await Promise.all([
        fetch(`/api/properties?${compsParams.toString()}`, { headers }),
        fetch(`/api/market-index?${marketParams.toString()}`, { headers })
      ]);

      if (!compsRes.ok || !marketRes.ok) {
        throw new Error(`CMA data fetch failed (comps: ${compsRes.status}, market: ${marketRes.status})`);
      }

      const compsData = await compsRes.json();
      const marketData = await marketRes.json();

      // GET /api/properties returns a plain array by default, or { items, total, ... } only
      // when ?limit= is passed (not the case here) - handled defensively either way.
      const compsList: Property[] = Array.isArray(compsData) ? compsData : compsData.items || [];
      const comps = compsList.filter(p => p.id !== property.id);
      const marketStats: MarketIndexGroup[] = marketData?.groups || [];

      await generateCmaReportPdf(property, comps, marketStats, { fullName: agent.fullName, orgName }, isRtl);
    } catch (e) {
      console.error("Failed to generate CMA report:", e);
      setError(isRtl ? "تعذر إنشاء تقرير تحليل السوق. حاول مرة أخرى." : "Couldn't generate the CMA report. Please try again.");
      setTimeout(() => setError(""), 6000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className || DEFAULT_CLASSNAME}
        title={isRtl ? "إنشاء تقرير تحليل السوق المقارن (PDF)" : "Generate a Comparative Market Analysis (CMA) PDF report"}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <FileBarChart size={11} />}
        <span>{isRtl ? "تقرير تحليل السوق" : "CMA Report"}</span>
      </button>
      {error && <p className="text-[9px] text-red-600 mt-0.5 max-w-[180px]">{error}</p>}
    </div>
  );
}
