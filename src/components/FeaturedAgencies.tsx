/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

// Shape returned by GET /api/directory?type=AGENCY (see server.ts) - duplicated here rather
// than imported since server.ts isn't part of the client bundle.
interface DirectoryAgencyItem {
  id: string;
  name: string;
  photoUrl: string | null;
  listingCount: number;
  averageRating: number;
  reviewCount: number;
}

interface FeaturedAgenciesProps {
  isRtl: boolean;
  // The directory item only carries a display-shaped subset of Organization's fields, not the
  // full record setSelectedOrgProfile expects - the caller resolves the full org from its own
  // already-fetched `organizations` list by id.
  onSelectAgency: (agencyId: string) => void;
}

// Homepage credibility strip: real agencies who have actually published listings on the
// platform, most-active first - reuses GET /api/directory (built for the Agencies browse tab)
// rather than a new endpoint, re-sorting its response by listingCount instead of the
// directory's own default (rating) since a brand-new agency with one 5-star review shouldn't
// outrank an established one with fifty live listings and no reviews yet.
export default function FeaturedAgencies({ isRtl, onSelectAgency }: FeaturedAgenciesProps) {
  const [agencies, setAgencies] = useState<DirectoryAgencyItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/directory?type=AGENCY&limit=50")
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.items) return;
        const featured = (data.items as DirectoryAgencyItem[])
          .filter(a => a.listingCount > 0)
          .sort((a, b) => b.listingCount - a.listingCount)
          .slice(0, 10);
        setAgencies(featured);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Silently stay out of the way rather than showing an empty strip before the platform has
  // any agencies with live listings yet.
  if (!agencies || agencies.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-serif text-ink font-medium flex items-center gap-2">
        <Building2 size={16} className="text-gold" />
        <span>{isRtl ? "الوكالات الشريكة" : "Featured Agencies"}</span>
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {agencies.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelectAgency(a.id)}
            className="flex flex-col items-center gap-2 shrink-0 w-28 p-3 bg-surface border border-border rounded-lg hover:border-gold transition-colors cursor-pointer text-center"
          >
            <img
              src={a.photoUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=150&h=150&q=80"}
              alt={a.name}
              className="w-14 h-14 rounded-full object-cover border border-border"
            />
            <p className="text-[11px] font-bold text-ink truncate w-full">{a.name}</p>
            <p className="text-[10px] text-ink-muted">
              {a.listingCount} {isRtl ? "إعلان" : "listings"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
