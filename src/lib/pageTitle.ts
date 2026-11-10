// Browser-tab titles the page sets itself after it has loaded. The server already writes the right
// <title> for every page it serves; this only covers moves inside the app (opening a listing,
// leaving the dashboard) so the title keeps matching what is on screen.

export const homeTitle = (isRtl: boolean) =>
  isRtl ? "نيرو فايندر | عقارات موثّقة في قطر" : "Nerou Finder | Verified Property Listings in Qatar";

export const listingTitle = (title: string, isRtl: boolean) =>
  `${(title || "").trim() || (isRtl ? "عقار" : "Property")} | ${isRtl ? "نيرو فايندر" : "Nerou Finder"}`;
