/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Property } from "../types.js";
import { loadLeaflet } from "../lib/leaflet.js";
import { hasExactPin, formatBounds } from "../lib/mapPin.js";

interface InteractiveMapProps {
  properties: Property[];
  onPropertyClick: (property: Property) => void;
  isRtl: boolean;
  /** called with "south,west,north,east" when the visitor presses "Search this area" */
  onSearchArea?: (bounds: string) => void;
  /** an area search is in force: keep the visitor's view instead of re-fitting the map to the results */
  areaActive?: boolean;
  onClearArea?: () => void;
}

// Leaflet's bindPopup() sets innerHTML directly - any agent-supplied listing field
// (title/city/district) interpolated into that HTML unescaped would execute as script
// in every visitor's browser viewing the map.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only listings whose agent placed an exact pin are drawn. The others are stored at a placeholder point, and drawing them
// there would put many listings on one wrong spot, so they are left off and counted instead.
export default function InteractiveMap({ properties, onPropertyClick, isRtl, onSearchArea, areaActive, onClearArea }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
   
  const mapInstanceRef = useRef<any>(null);
   
  const markersRef = useRef<any[]>([]);
  // set while the map moves because the code moved it (fitting the results), so only the visitor's own pan/zoom counts
  const programmaticMove = useRef(false);
  const [moved, setMoved] = useState(false);
  const t = (en: string, ar: string) => (isRtl ? ar : en);

  const pinned = properties.filter(hasExactPin);
  const unpinned = properties.length - pinned.length;

  // Expose view function globally for Leaflet popup click handlers
  useEffect(() => {
     
    (window as any).viewMapPropertyDetails = (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (prop) onPropertyClick(prop);
    };
    return () => {
       
      delete (window as any).viewMapPropertyDetails;
    };
  }, [properties, onPropertyClick]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(() => { if (!cancelled) setLeafletLoaded(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Initialize and update map
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current) return;

     
    const L = (window as any).L;
    if (!L) return;

    // Standard fix for Leaflet marker icon paths when using dynamic imports/bundlers
    L.Marker.prototype.options.icon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    if (!mapInstanceRef.current) {
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([25.3, 51.2], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("moveend", () => {
        if (programmaticMove.current) { programmaticMove.current = false; return; }
        setMoved(true);
      });
      mapInstanceRef.current = map;
    }
    const map = mapInstanceRef.current;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current = [];

    pinned.forEach((prop) => {
      const marker = L.marker([prop.latitude, prop.longitude]).addTo(map);
      const popupContent = `
        <div class="p-1 min-w-[200px] text-left leading-normal font-sans">
          <img src="${escapeHtml(prop.images[0])}" alt="${escapeHtml(prop.title)}" class="w-full h-24 object-cover rounded-md mb-2 border border-border" />
          <h4 class="font-bold text-xs text-ink truncate mb-0.5">${escapeHtml(prop.title)}</h4>
          <p class="text-[10px] text-ink-muted mb-1">${escapeHtml(prop.city)}, ${escapeHtml(prop.district)}</p>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs font-semibold text-gold">${prop.price.toLocaleString()} QAR</span>
            <span class="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-bold uppercase">${escapeHtml(prop.propertyType)}</span>
          </div>
          <button onclick="window.viewMapPropertyDetails('${escapeHtml(prop.id)}')" class="mt-2.5 w-full text-center bg-gold hover:bg-gold-hover text-gold-ink font-bold py-1 px-2 rounded text-[10px] cursor-pointer transition-colors border-none">
            ${isRtl ? "عرض التفاصيل" : "View Details"}
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // fit the map to the results, unless the visitor chose an area (then their view stays exactly as they left it)
    if (!areaActive && pinned.length > 0) {
      programmaticMove.current = true;
      if (pinned.length === 1) map.setView([pinned[0].latitude, pinned[0].longitude], 15);
      else map.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.1));
      setMoved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletLoaded, properties, isRtl, areaActive]);

  // Clean up completely on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const searchHere = () => {
    const map = mapInstanceRef.current;
    if (!map || !onSearchArea) return;
    const b = map.getBounds();
    onSearchArea(formatBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }));
    setMoved(false);
  };

  return (
    <div className="relative w-full h-[550px] bg-canvas border border-border rounded-xl overflow-hidden">
      {!leafletLoaded ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted bg-surface">
          <svg className="animate-spin h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs">{t("Initializing interactive map...", "جاري تحميل الخريطة...")}</span>
        </div>
      ) : null}
      <div id="map-container" ref={containerRef} className="w-full h-full z-10" />

      {leafletLoaded && onSearchArea && (moved || areaActive) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2">
          {moved && (
            <button type="button" onClick={searchHere} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chrome text-white text-sm font-semibold shadow-lg hover:bg-chrome-hover cursor-pointer">
              <Search size={15} />{t("Search this area", "ابحث في هذه المنطقة")}
            </button>
          )}
          {areaActive && !moved && (
            <span className="inline-flex items-center gap-2 ps-4 pe-2 py-1.5 rounded-full bg-white text-ink text-sm font-medium shadow-lg border border-border">
              {t(`${pinned.length} on the map in this area`, `${pinned.length} عقار على الخريطة في هذه المنطقة`)}
              <button type="button" onClick={onClearArea} aria-label={t("Clear area", "إلغاء المنطقة")} className="w-6 h-6 rounded-full hover:bg-surface flex items-center justify-center cursor-pointer"><X size={14} /></button>
            </span>
          )}
        </div>
      )}

      {leafletLoaded && (pinned.length === 0 || unpinned > 0) && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[500] flex items-start gap-2 p-3 rounded-lg bg-white/95 border border-border shadow-md text-xs text-ink-muted">
          <MapPin size={14} className="text-gold shrink-0 mt-0.5" />
          <span>
            {pinned.length === 0
              ? t("None of these listings has an exact pin on the map yet. Agents are adding them; see the list view for every listing.", "لا يوجد لأي من هذه العقارات دبوس دقيق على الخريطة بعد. الوكلاء يضيفونها؛ شاهد القائمة لعرض كل العقارات.")
              : t(`${unpinned} more listing${unpinned === 1 ? " has" : "s have"} no exact pin yet, so ${unpinned === 1 ? "it is" : "they are"} not shown here. See the list view.`, `${unpinned} عقار بدون دبوس دقيق بعد، لذلك لا يظهر هنا. شاهد القائمة.`)}
          </span>
        </div>
      )}
    </div>
  );
}
