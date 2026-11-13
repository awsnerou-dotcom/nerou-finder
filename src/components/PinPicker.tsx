import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { loadLeaflet } from "../lib/leaflet.js";
import { cleanPin, type Pin } from "../lib/mapPin.js";

// Where is the property, exactly? The agent clicks the map (or drags the pin). Optional: a listing with no pin is simply
// not shown on the map or in "search this area", and the form says so. `center` starts the map near the chosen area.

export default function PinPicker({ value, onChange, center, isRtl }: {
  value: Pin | null;
  onChange: (pin: Pin | null) => void;
  center?: Pin | null;
  isRtl: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
   
  const mapRef = useRef<any>(null);
   
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = (en: string, ar: string) => (isRtl ? ar : en);

  // build the map once the library is there
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !box.current || mapRef.current) return;
      const start = value || center || { latitude: 25.2854, longitude: 51.531 };
      const map = L.map(box.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([start.latitude, start.longitude], value ? 16 : center ? 13 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const pin = cleanPin({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        if (pin) onChangeRef.current(pin);
      });
      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 0);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the marker in step with the value
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
     
    const L = (window as any).L;
    if (!value) {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([value.latitude, value.longitude], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current.getLatLng();
        const pin = cleanPin({ latitude: p.lat, longitude: p.lng });
        if (pin) onChangeRef.current(pin);
      });
    } else {
      markerRef.current.setLatLng([value.latitude, value.longitude]);
    }
  }, [value, ready]);

  // when the agent picks another area, move the map there (only while nothing is pinned yet)
  const centerLat = center?.latitude;
  const centerLng = center?.longitude;
  useEffect(() => {
    if (ready && centerLat !== undefined && centerLng !== undefined && !value && mapRef.current) mapRef.current.setView([centerLat, centerLng], 13);
  }, [centerLat, centerLng, value, ready]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
          <MapPin size={13} className="text-gold" />{t("Exact location on the map", "الموقع الدقيق على الخريطة")}
          <span className="text-ink-faint font-normal">{t("(optional)", "(اختياري)")}</span>
        </span>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-[11px] text-ink-muted hover:text-red-600 inline-flex items-center gap-1 cursor-pointer">
            <X size={12} />{t("Remove pin", "إزالة الدبوس")}
          </button>
        )}
      </div>
      {failed ? (
        <p className="text-xs text-ink-muted p-3 border border-border rounded-lg">{t("The map could not load. You can still save the listing without a pin.", "تعذّر تحميل الخريطة. يمكنك حفظ العقار دون تحديد موقع.")}</p>
      ) : (
        <div ref={box} className="w-full h-56 rounded-lg overflow-hidden border border-border bg-surface" role="application" aria-label={t("Map: click to place the pin", "الخريطة: انقر لوضع الدبوس")} />
      )}
      <p className={`text-[11px] mt-1.5 ${value ? "text-emerald-700" : "text-ink-muted"}`}>
        {value
          ? t("Pin placed. Drag it to fine-tune. The listing will appear on the map and in area searches.", "تم وضع الدبوس. اسحبه لضبطه. سيظهر العقار على الخريطة وفي البحث بالمنطقة.")
          : t("Click the map where the property is. Without a pin the listing is not shown on the map or found by area search.", "انقر على الخريطة في موقع العقار. بدون دبوس لن يظهر العقار على الخريطة ولن يظهر في البحث بالمنطقة.")}
      </p>
    </div>
  );
}
