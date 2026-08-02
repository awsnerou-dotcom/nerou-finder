/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Real, computed "nearby places" for a property, replacing a panel that previously rendered
// the exact same three hardcoded place names/distances ("Qatar International School",
// "DECC Metro Station", "City Center Mall") on every single listing regardless of its actual
// location - see PropertyDetailView.tsx's LOCATION INTELLIGENCE section.
//
// Coordinates below are best-effort approximate landmark locations, not sourced from a
// verified geocoding API (this app has no Places/Geocoding API integration or key
// configured) - they're accurate enough to produce genuinely different, distance-ordered
// results per district instead of one static list for every property, but a real
// geocoding/Places API integration would be a worthwhile follow-up for precision.
export type LandmarkType = "METRO" | "MALL" | "LANDMARK" | "EDUCATION";

interface Landmark {
  type: LandmarkType;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
}

export const DOHA_LANDMARKS: Landmark[] = [
  // Metro stations (Doha Metro - Red/Green/Gold lines)
  { type: "METRO", name: "Msheireb Metro Station", nameAr: "محطة مترو مشيرب", lat: 25.2865, lng: 51.5310 },
  { type: "METRO", name: "Al Sadd Metro Station", nameAr: "محطة مترو السد", lat: 25.2775, lng: 51.5165 },
  { type: "METRO", name: "Education City Metro Station", nameAr: "محطة مترو المدينة التعليمية", lat: 25.3130, lng: 51.4390 },
  { type: "METRO", name: "Sports City Metro Station", nameAr: "محطة مترو المدينة الرياضية", lat: 25.2635, lng: 51.4460 },
  { type: "METRO", name: "Hamad International Airport Metro Station", nameAr: "محطة مترو مطار حمد الدولي", lat: 25.2610, lng: 51.6140 },
  { type: "METRO", name: "Lusail Metro Station (Gold Line)", nameAr: "محطة مترو لوسيل", lat: 25.4100, lng: 51.4900 },
  { type: "METRO", name: "Al Waab Metro Station", nameAr: "محطة مترو الوعب", lat: 25.2660, lng: 51.4680 },

  // Malls / retail
  { type: "MALL", name: "Villaggio Mall", nameAr: "فيلاجيو مول", lat: 25.2620, lng: 51.4430 },
  { type: "MALL", name: "City Center Doha", nameAr: "سيتي سنتر الدوحة", lat: 25.3220, lng: 51.5290 },
  { type: "MALL", name: "Mall of Qatar", nameAr: "مول قطر", lat: 25.2850, lng: 51.4180 },
  { type: "MALL", name: "Place Vendôme (Lusail)", nameAr: "بلاس فاندوم لوسيل", lat: 25.4050, lng: 51.4970 },
  { type: "MALL", name: "Doha Festival City", nameAr: "دوحة فيستيفال سيتي", lat: 25.3480, lng: 51.4390 },

  // Landmarks / culture
  { type: "LANDMARK", name: "Museum of Islamic Art", nameAr: "متحف الفن الإسلامي", lat: 25.2955, lng: 51.5390 },
  { type: "LANDMARK", name: "Souq Waqif", nameAr: "سوق واقف", lat: 25.2870, lng: 51.5330 },
  { type: "LANDMARK", name: "Katara Cultural Village", nameAr: "كتارا", lat: 25.3600, lng: 51.5250 },
  { type: "LANDMARK", name: "The Pearl-Qatar Marina", nameAr: "مرسى لؤلؤة قطر", lat: 25.3710, lng: 51.5510 },
  { type: "LANDMARK", name: "Lusail Marina", nameAr: "مرسى لوسيل", lat: 25.4180, lng: 51.4950 },
  { type: "LANDMARK", name: "Doha Corniche", nameAr: "كورنيش الدوحة", lat: 25.3050, lng: 51.5320 },

  // Education
  { type: "EDUCATION", name: "Education City (Qatar Foundation)", nameAr: "المدينة التعليمية", lat: 25.3150, lng: 51.4400 },
  { type: "EDUCATION", name: "Qatar University", nameAr: "جامعة قطر", lat: 25.3760, lng: 51.4900 },
];

// Haversine great-circle distance between two lat/lng points, in kilometers.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface NearbyPlaceResult extends Landmark {
  distanceKm: number;
  walkingMinutes: number;
  drivingMinutes: number;
}

// Average adult walking speed ~4.8 km/h; average city driving speed (with lights/traffic) ~25 km/h.
const WALKING_KMH = 4.8;
const DRIVING_KMH = 25;

// Returns the `limit` nearest landmarks to the given coordinates, sorted nearest-first, with
// genuinely computed distance/time estimates - previously this panel showed the exact same
// three place names and distances for every property regardless of its actual location.
export function getNearbyPlaces(
  propertyLat: number,
  propertyLng: number,
  limit = 3
): NearbyPlaceResult[] {
  return DOHA_LANDMARKS
    .map((place) => {
      const distanceKm = haversineDistanceKm(propertyLat, propertyLng, place.lat, place.lng);
      return {
        ...place,
        distanceKm,
        walkingMinutes: Math.max(1, Math.round((distanceKm / WALKING_KMH) * 60)),
        drivingMinutes: Math.max(1, Math.round((distanceKm / DRIVING_KMH) * 60)),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
