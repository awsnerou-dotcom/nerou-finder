import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the existing live Nerou Finder website as a native Android/iOS shell, rather than
// bundling a static build into the app - this is a full Express-backed dynamic site (live
// listings, auth, search, AI features), not a static SPA, so the app should always load the
// real, currently-deployed site instead of a stale snapshot baked in at build time. This is
// Capacitor's documented "remote URL" mode for exactly this use case.
//
// IMPORTANT: update `server.url` below once a custom domain is live (see MOBILE_APP_SETUP.md),
// then run `npx cap sync` and re-submit a new build to each store - the app itself never
// needs a code change for ordinary site updates, only for this URL or native config changes.
const config: CapacitorConfig = {
  appId: "com.neroutechnologyservices.neroufinder",
  appName: "Nerou Finder",
  webDir: "dist",
  server: {
    url: "https://nerou-finder.onrender.com",
    cleartext: false
  },
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: "automatic"
  }
};

export default config;
