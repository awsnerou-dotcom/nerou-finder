/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Property } from "../types.js";

interface InteractiveMapProps {
  properties: Property[];
  onPropertyClick: (property: Property) => void;
  isRtl: boolean;
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

export default function InteractiveMap({ properties, onPropertyClick, isRtl }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Expose view function globally for Leaflet popup click handlers
  useEffect(() => {
    (window as any).viewMapPropertyDetails = (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (prop) {
        onPropertyClick(prop);
      }
    };
    return () => {
      delete (window as any).viewMapPropertyDetails;
    };
  }, [properties, onPropertyClick]);

  // Load Leaflet dynamically from CDN
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.id = "leaflet-css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.id = "leaflet-js";
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Keep Leaflet global assets to avoid refetching on toggle, but clean up references if needed
    };
  }, []);

  // Initialize and update map
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Standard fix for Leaflet marker icon paths when using dynamic imports/bundlers
    const DefaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    // Determine initial center
    let center: [number, number] = [25.3725, 51.53]; // Default Doha / Lusail center
    const validProps = properties.filter((p) => p.latitude && p.longitude);
    if (validProps.length > 0) {
      // Center on average of filtered properties
      const avgLat = validProps.reduce((sum, p) => sum + p.latitude, 0) / validProps.length;
      const avgLng = validProps.reduce((sum, p) => sum + p.longitude, 0) / validProps.length;
      center = [avgLat, avgLng];
    }

    // Initialize Map Instance if it doesn't exist
    if (!mapInstanceRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(center, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      // Re-center if properties collection changed and has elements
      if (validProps.length > 0) {
        mapInstanceRef.current.panTo(center);
      }
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current = [];

    // Add new markers
    validProps.forEach((prop) => {
      const marker = L.marker([prop.latitude, prop.longitude]).addTo(map);

      const formattedPrice = prop.price.toLocaleString();
      const popupContent = `
        <div class="p-1 min-w-[200px] text-left leading-normal font-sans">
          <img src="${escapeHtml(prop.images[0])}" alt="${escapeHtml(prop.title)}" class="w-full h-24 object-cover rounded-md mb-2 border border-border" />
          <h4 class="font-bold text-xs text-ink truncate mb-0.5">${escapeHtml(prop.title)}</h4>
          <p class="text-[10px] text-ink-muted mb-1">${escapeHtml(prop.city)}, ${escapeHtml(prop.district)}</p>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs font-semibold text-gold">${formattedPrice} QAR</span>
            <span class="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-bold uppercase">${escapeHtml(prop.propertyType)}</span>
          </div>
          <button onclick="window.viewMapPropertyDetails('${escapeHtml(prop.id)}')" class="mt-2.5 w-full text-center bg-gold hover:bg-gold-hover text-white font-bold py-1 px-2 rounded text-[10px] cursor-pointer transition-colors border-none">
            ${isRtl ? "عرض التفاصيل" : "View Details"}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // Auto-adjust bounds to fit all markers if multiple
    if (validProps.length > 1) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      // Don't remove the map instance on minor updates, just clean up in complete destroy
    };
  }, [leafletLoaded, properties, isRtl]);

  // Clean up completely on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[550px] bg-canvas border border-border rounded-xl overflow-hidden">
      {!leafletLoaded ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted bg-surface">
          <svg className="animate-spin h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs">{isRtl ? "جاري تحميل الخريطة..." : "Initializing interactive map..."}</span>
        </div>
      ) : null}
      <div id="map-container" ref={containerRef} className="w-full h-full z-10" />
    </div>
  );
}
