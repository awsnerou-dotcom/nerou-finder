/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Search, Star, Building2, Briefcase, MapPin, ShieldCheck } from "lucide-react";

export type DirectoryType = "AGENT" | "AGENCY" | "DEVELOPER";

interface DirectoryItem {
  id: string;
  type: DirectoryType;
  name: string;
  photoUrl: string | null;
  verifiedBadgeLabel: string;
  verifiedBadgeLabelAr: string;
  averageRating: number;
  reviewCount: number;
  listingCount?: number;
  teamSize?: number;
  activeProjectCount?: number;
  cities: string[];
}

interface DirectorySearchProps {
  type: DirectoryType;
  isRtl: boolean;
  onSelect: (type: DirectoryType, id: string) => void;
  pageSize?: number;
}

const PLACEHOLDER_PHOTO = "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80";
const PLACEHOLDER_LOGO = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=150&h=150&q=80";

// Directory search/browse for Agents, Agencies, and Developers - a separate identity lookup
// from property search (which finds listings, not people/companies). Backed by GET
// /api/directory, which already excludes any unverified/suspended account server-side.
export default function DirectorySearch({ type, isRtl, onSelect, pageSize = 12 }: DirectorySearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Reset to page 1 whenever the query/filters/type change.
  useEffect(() => {
    setOffset(0);
  }, [debouncedQuery, minRating, type]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ type, limit: String(pageSize), offset: String(offset) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (minRating > 0) params.set("minRating", String(minRating));

    fetch(`/api/directory?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        console.error("Directory search failed:", err);
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, debouncedQuery, minRating, offset, pageSize]);

  const typeLabel = {
    AGENT: isRtl ? "وكيل" : "agent",
    AGENCY: isRtl ? "مكتب عقاري" : "agency",
    DEVELOPER: isRtl ? "مطور" : "developer"
  }[type];

  const placeholderText = isRtl
    ? `ابحث بالاسم عن ${typeLabel}...`
    : `Search by ${typeLabel} name...`;

  const StatIcon = type === "AGENT" ? Briefcase : type === "AGENCY" ? Building2 : Building2;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholderText}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-gold text-ink"
          />
          <Search size={16} className={`absolute ${isRtl ? "right-3" : "left-3"} top-3 text-ink-faint`} />
        </div>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-ink cursor-pointer"
        >
          <option value={0}>{isRtl ? "كل التقييمات" : "Any rating"}</option>
          <option value={3}>{isRtl ? "٣ نجوم فأعلى" : "3+ stars"}</option>
          <option value={4}>{isRtl ? "٤ نجوم فأعلى" : "4+ stars"}</option>
          <option value={4.5}>{isRtl ? "٤.٥ نجوم فأعلى" : "4.5+ stars"}</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <p className="text-sm text-ink-muted">
            {isRtl ? "لا توجد نتائج مطابقة." : "No matching results found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.type, item.id)}
              className="text-left rtl:text-right bg-surface rounded-xl border border-border hover:border-gold hover:shadow-md transition-all p-4 flex gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <img
                src={item.photoUrl || (type === "AGENT" ? PLACEHOLDER_PHOTO : PLACEHOLDER_LOGO)}
                alt={item.name}
                loading="lazy"
                className={`w-14 h-14 object-cover shrink-0 border border-border ${type === "AGENT" ? "rounded-full" : "rounded-lg"}`}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-serif font-bold text-sm text-ink truncate">{item.name}</p>
                <p className="text-[10px] text-gold font-semibold flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span className="truncate">{isRtl ? item.verifiedBadgeLabelAr : item.verifiedBadgeLabel}</span>
                </p>
                <div className="flex items-center gap-3 text-[11px] text-ink-muted pt-0.5">
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-gold fill-gold" />
                    {item.averageRating > 0 ? item.averageRating.toFixed(1) : (isRtl ? "جديد" : "New")}
                    {item.reviewCount > 0 && <span className="text-ink-faint">({item.reviewCount})</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <StatIcon size={11} />
                    {type === "AGENT" && `${item.listingCount ?? 0} ${isRtl ? "عقار" : "listings"}`}
                    {type === "AGENCY" && `${item.teamSize ?? 0} ${isRtl ? "وكيل" : "agents"}`}
                    {type === "DEVELOPER" && `${item.activeProjectCount ?? 0} ${isRtl ? "مشروع" : "projects"}`}
                  </span>
                </div>
                {item.cities.length > 0 && (
                  <p className="text-[10px] text-ink-faint flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0" />
                    <span className="truncate capitalize">{item.cities.slice(0, 3).join(", ")}</span>
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-ink-muted pt-1">
          <span>
            {isRtl
              ? `عرض ${offset + 1}-${Math.min(offset + pageSize, total)} من ${total}`
              : `Showing ${offset + 1}-${Math.min(offset + pageSize, total)} of ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
              disabled={offset === 0}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:border-gold cursor-pointer disabled:cursor-not-allowed"
            >
              {isRtl ? "السابق" : "Previous"}
            </button>
            <button
              onClick={() => setOffset(offset + pageSize)}
              disabled={offset + pageSize >= total}
              className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:border-gold cursor-pointer disabled:cursor-not-allowed"
            >
              {isRtl ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
