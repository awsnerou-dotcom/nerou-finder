/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { BadgeCheck, Building2, ExternalLink } from "lucide-react";
import type { ShowcaseKind } from "../types.js";
import { KIND_LABEL, formatSince } from "../lib/showcase.js";

// "Trusted by" section: the real-estate companies that subscribed to the platform, each with a group
// photo taken with them, their logo and a short description. A platform admin adds each company (with
// its agreement) from the control center; nothing here is invented, and with no entries the section
// does not appear at all.

interface PublicEntry {
  id: string;
  name: string;
  nameAr?: string;
  kind: ShowcaseKind;
  description: string;
  descriptionAr?: string;
  logoUrl?: string;
  photoUrl?: string;
  website?: string;
  since?: string;
  verified: boolean;
  orgId?: string;
  listingCount: number;
}

let cache: PublicEntry[] | null = null;

export default function SubscribersShowcase({ isRtl, onOpenCompany }: { isRtl: boolean; onOpenCompany?: (orgId: string) => void }) {
  const [entries, setEntries] = useState<PublicEntry[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetch("/api/showcase")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const list: PublicEntry[] = Array.isArray(d?.entries) ? d.entries : [];
        cache = list;
        if (!cancelled) setEntries(list);
      })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, []);

  if (!entries || entries.length === 0) return null;
  const lang = isRtl ? "ar" : "en";

  return (
    <section aria-labelledby="subscribers-title" className="space-y-6 py-4" data-testid="subscribers-showcase">
      <div className="max-w-3xl space-y-1.5">
        <h2 id="subscribers-title" className="text-2xl md:text-3xl font-serif text-ink font-medium tracking-tight">
          {isRtl ? "شركات عقارية تثق بنا" : "Real-estate companies that trust Nerou Finder"}
        </h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          {isRtl
            ? "شركات عقارية وشركات وساطة ومطورون اشتركوا في المنصة وينشرون عقاراتهم عليها."
            : "Agencies, brokerages and developers who subscribed and publish their properties here."}
        </p>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(e => {
          const name = (isRtl && e.nameAr) || e.name;
          const description = (isRtl && e.descriptionAr) || e.description;
          const since = formatSince(e.since, lang);
          return (
            <li key={e.id} className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col" data-testid="subscriber-card">
              <div className="relative aspect-[16/10] bg-surface-2">
                {e.photoUrl ? (
                  <img
                    src={e.photoUrl}
                    alt={isRtl ? `صورة جماعية مع فريق ${name}` : `Group photo with the ${name} team`}
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={400}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-chrome to-gold/40 flex items-center justify-center" aria-hidden="true">
                    <Building2 size={42} className="text-white/70" />
                  </div>
                )}
                {e.logoUrl && (
                  <div className="absolute -bottom-6 start-4 w-14 h-14 rounded-xl bg-white border border-border shadow-md flex items-center justify-center overflow-hidden">
                    <img src={e.logoUrl} alt={isRtl ? `شعار ${name}` : `${name} logo`} loading="lazy" decoding="async" className="max-w-full max-h-full object-contain p-1" />
                  </div>
                )}
              </div>

              <div className={`p-4 ${e.logoUrl ? "pt-9" : "pt-4"} flex-1 flex flex-col gap-2.5`}>
                <div className="space-y-1">
                  <h3 className="text-lg font-serif font-semibold text-ink leading-snug">{name}</h3>
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted font-semibold">{KIND_LABEL[e.kind][lang]}</span>
                    {e.verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-success font-semibold">
                        <BadgeCheck size={12} />{isRtl ? "حساب موثّق" : "Verified account"}
                      </span>
                    )}
                    {since && <span className="text-ink-muted">{isRtl ? `مشترك منذ ${since}` : `Subscribed ${since}`}</span>}
                  </div>
                </div>

                <p className="text-sm text-ink-muted leading-relaxed">{description}</p>

                <div className="mt-auto pt-2 flex items-center gap-4 flex-wrap text-xs font-semibold">
                  {e.orgId && onOpenCompany && (
                    <button type="button" onClick={() => onOpenCompany(e.orgId!)} className="text-gold-active hover:underline cursor-pointer">
                      {isRtl
                        ? (e.listingCount > 0 ? `عرض الشركة (${e.listingCount} عقار)` : "عرض الشركة")
                        : (e.listingCount > 0 ? `View company (${e.listingCount} listing${e.listingCount === 1 ? "" : "s"})` : "View company")}
                    </button>
                  )}
                  {e.website && (
                    <a href={e.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
                      <ExternalLink size={12} />{isRtl ? "الموقع" : "Website"}
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
