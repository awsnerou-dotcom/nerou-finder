// Loads the Leaflet map library once (from the same CDN, with the same element ids, as the results map), so the pin
// picker in the listing form and the results map can share it.

 
type LeafletGlobal = any;

let pending: Promise<LeafletGlobal> | null = null;

export function loadLeaflet(): Promise<LeafletGlobal> {
   
  const existing = (window as any).L;
  if (existing) return Promise.resolve(existing);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.id = "leaflet-css";
      document.head.appendChild(link);
    }
    const done = () => {
       
      const L = (window as any).L;
      if (L) resolve(L); else { pending = null; reject(new Error("Leaflet did not load")); }
    };
    const found = document.getElementById("leaflet-js");
    if (found) { found.addEventListener("load", done); found.addEventListener("error", () => { pending = null; reject(new Error("Leaflet did not load")); }); return; }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.id = "leaflet-js";
    script.async = true;
    script.onload = done;
    script.onerror = () => { pending = null; reject(new Error("Leaflet did not load")); };
    document.body.appendChild(script);
  });
  return pending;
}
