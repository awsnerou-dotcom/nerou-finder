import React, { useEffect, useState } from "react";
import { withLang } from "../lib/seo.js";

// A row of real links to the site's most useful searches ("Apartments for rent in Lusail"...).
// They are ordinary <a href>s, so a visitor can open one in a new tab and a crawler can follow it
// from any page of the site. The list comes from the live listings, so a link only exists while
// there is something behind it.
export default function PopularSearches({ isRtl }: { isRtl: boolean }) {
  const [links, setLinks] = useState<{ path: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/seo/links?lang=${isRtl ? "ar" : "en"}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.links) setLinks(d.links); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isRtl]);
  if (links.length === 0) return null;
  return (
    <nav aria-label={isRtl ? "عمليات بحث شائعة" : "Popular searches"} className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">{isRtl ? "عمليات بحث شائعة" : "Popular searches"}</h3>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {links.map(l => (
            <li key={l.path}>
              <a href={withLang(l.path, isRtl ? "ar" : "en")} className="text-gray-300 hover:text-white underline-offset-2 hover:underline">{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
