// Places added to the built-in Qatar location list, and the map coordinates that go with it.
//
// Coordinates are APPROXIMATE centres. They only decide where the map opens when an agent picks that place in the listing
// form (the agent then clicks the exact spot); they are never shown as a property's position. A place with no entry here
// opens the map on its parent (area, then municipality), which is still better than a default point in the sea.
// Admins can correct or add places in the control centre; those edits are kept (see ensureStateDefaults).

import type { LocationItem } from "../types.js";

const area = (id: string, name: string, nameAr: string, parentId: string, seoSlug: string): LocationItem =>
  ({ id, name, nameAr, type: "AREA", parentId, isActive: true, seoSlug });
const district = (id: string, name: string, nameAr: string, parentId: string, seoSlug: string): LocationItem =>
  ({ id, name, nameAr, type: "DISTRICT", parentId, isActive: true, seoSlug });

/** Neighbourhoods that agents could not pick before. */
export const ADDED_LOCATIONS: LocationItem[] = [
  // Doha
  area("a-dafna", "Al Dafna", "الدفنة", "m-doha", "al-dafna"),
  area("a-mirqab", "Al Mirqab", "المرقاب", "m-doha", "al-mirqab"),
  area("a-muntazah", "Al Muntazah", "المنتزه", "m-doha", "al-muntazah"),
  area("a-onaiza", "Onaiza", "عنيزة", "m-doha", "onaiza"),
  area("a-qassar", "Al Qassar", "القصار", "m-doha", "al-qassar"),
  area("a-bin-omran", "Fereej Bin Omran", "فريج بن عمران", "m-doha", "fereej-bin-omran"),
  area("a-kulaib", "Fereej Kulaib", "فريج كليب", "m-doha", "fereej-kulaib"),
  area("a-fereej-soudan", "Fereej Al Soudan", "فريج السودان", "m-doha", "fereej-al-soudan"),
  area("a-markhiya", "Al Markhiya", "المرخية", "m-doha", "al-markhiya"),
  area("a-duhail", "Duhail", "الدحيل", "m-doha", "duhail"),
  area("a-madinat-khalifa", "Madinat Khalifa", "مدينة خليفة", "m-doha", "madinat-khalifa"),
  area("a-lejbailat", "Lejbailat", "لجبيلات", "m-doha", "lejbailat"),
  area("a-umm-lekhba", "Umm Lekhba", "أم لخبا", "m-doha", "umm-lekhba"),
  area("a-mamoura", "Al Mamoura", "المعمورة", "m-doha", "al-mamoura"),
  area("a-jasra", "Al Jasra", "الجسرة", "m-doha", "al-jasra"),
  area("a-bidda", "Al Bidda", "البدع", "m-doha", "al-bidda"),
  area("a-souq-waqif", "Souq Waqif", "سوق واقف", "m-doha", "souq-waqif"),
  area("a-old-ghanim", "Old Al Ghanim", "الغانم القديم", "m-doha", "old-al-ghanim"),
  area("a-corniche", "Doha Corniche", "كورنيش الدوحة", "m-doha", "doha-corniche"),
  area("a-diplomatic", "Diplomatic Area", "المنطقة الدبلوماسية", "m-doha", "diplomatic-area"),
  // Al Rayyan
  area("a-sailiya", "Al Sailiya", "السيلية", "m-rayyan", "al-sailiya"),
  area("a-rayyan-jadeed", "Al Rayyan Al Jadeed", "الريان الجديد", "m-rayyan", "al-rayyan-al-jadeed"),
  area("a-bani-hajer", "Bani Hajer", "بني هاجر", "m-rayyan", "bani-hajer"),
  area("a-hitmi", "Al Hitmi", "الهتمي", "m-rayyan", "al-hitmi"),
  area("a-umm-al-afai", "Umm Al Afai", "أم العفاي", "m-rayyan", "umm-al-afai"),
  // Al Wakrah
  area("a-mashaf", "Al Mashaf", "المشاف", "m-wakrah", "al-mashaf"),
  // Al Shahaniya (Dukhan and the west coast)
  area("a-dukhan", "Dukhan", "دخان", "m-shahaniya", "dukhan"),
  area("a-zekreet", "Zekreet", "زكريت", "m-shahaniya", "zekreet"),
  area("a-umm-bab", "Umm Bab", "أم باب", "m-shahaniya", "umm-bab"),
  // Al Daayen and Lusail
  district("d-qetaifan", "Qetaifan Island", "جزيرة قطيفان", "a-lusail", "qetaifan-island"),
  district("d-lusail-downtown", "Lusail Downtown", "وسط لوسيل", "a-lusail", "lusail-downtown"),
  district("d-al-maha", "Al Maha Island", "جزيرة الماها", "a-lusail", "al-maha-island"),
  // The Pearl
  district("d-floresta", "Floresta Gardens", "فلوريستا غاردنز", "a-pearl", "floresta-gardens"),
  // Al Khor
  area("a-ghuwariyah", "Al Ghuwariyah", "الغويرية", "m-alkhor", "al-ghuwariyah")
];

/** Approximate map centres by location id: [latitude, longitude]. */
export const LOCATION_COORDS: Record<string, [number, number]> = {
  // municipalities
  "m-doha": [25.2854, 51.531], "m-rayyan": [25.2919, 51.4244], "m-wakrah": [25.1715, 51.6034], "m-umsalal": [25.4167, 51.4],
  "m-alkhor": [25.6804, 51.4968], "m-daayen": [25.49, 51.49], "m-shamal": [26.129, 51.21], "m-shahaniya": [25.38, 51.19],
  // Doha
  "a-westbay": [25.323, 51.528], "a-msheireb": [25.287, 51.525], "a-alsadd": [25.28, 51.5], "a-oldairport": [25.26, 51.56],
  "a-binmahmoud": [25.283, 51.513], "a-alnasr": [25.287, 51.504], "a-salata": [25.277, 51.529], "a-najma": [25.274, 51.525],
  "a-ummghuwailina": [25.265, 51.52], "a-almansoura": [25.266, 51.534], "a-althumama": [25.223, 51.54],
  "a-pearl": [25.37, 51.55], "a-westbaylagoon": [25.337, 51.489], "a-gewanisland": [25.385, 51.556],
  "a-dafna": [25.329, 51.519], "a-mirqab": [25.292, 51.517], "a-muntazah": [25.276, 51.516], "a-onaiza": [25.325, 51.538],
  "a-qassar": [25.315, 51.524], "a-bin-omran": [25.29, 51.505], "a-kulaib": [25.27, 51.478], "a-markhiya": [25.315, 51.498],
  "a-duhail": [25.368, 51.468], "a-madinat-khalifa": [25.328, 51.472], "a-umm-lekhba": [25.326, 51.487],
  "a-jasra": [25.297, 51.515], "a-bidda": [25.299, 51.529], "a-souq-waqif": [25.287, 51.533], "a-corniche": [25.301, 51.52],
  "a-diplomatic": [25.324, 51.53], "a-mamoura": [25.258, 51.5],
  // Pearl districts
  "d-porto-arabia": [25.369, 51.549], "d-viva-bahriya": [25.377, 51.556], "d-qanat-quartier": [25.379, 51.547],
  // Al Rayyan
  "a-alrayyan-area": [25.292, 51.424], "a-alwaab": [25.257, 51.445], "a-gharrafah": [25.322, 51.438], "a-education": [25.315, 51.435],
  "a-al-luqta": [25.345, 51.442], "a-abu-hamour": [25.233, 51.495], "a-muaither": [25.23, 51.37], "a-sailiya": [25.22, 51.36],
  // Al Wakrah
  "a-wakrah-city": [25.1715, 51.6034], "a-wukair": [25.15, 51.557], "a-mesaieed": [24.997, 51.549],
  // Al Khor
  "a-alkhor-city": [25.6804, 51.4968], "a-raslaffan": [25.912, 51.545],
  // Al Daayen / Lusail
  "a-lusail": [25.42, 51.49], "d-marina": [25.418, 51.51], "d-foxhills": [25.438, 51.465], "d-qetaifan": [25.415, 51.517],
  // Al Shamal
  "a-ruwais": [26.133, 51.21], "a-madinat-ash-shamal": [26.119, 51.201],
  // Al Shahaniya
  "a-sheehaniya-area": [25.38, 51.19], "a-dukhan": [25.429, 50.784], "a-zekreet": [25.581, 50.84]
};

/** Add the approximate map centre to a place that has none (never overwrites coordinates someone already set). */
export function withCoords(l: LocationItem): LocationItem {
  if (typeof l.latitude === "number" && typeof l.longitude === "number") return l;
  const c = LOCATION_COORDS[l.id];
  return c ? { ...l, latitude: c[0], longitude: c[1] } : l;
}
