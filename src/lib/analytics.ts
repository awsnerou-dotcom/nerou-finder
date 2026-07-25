/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function initGA() {
  const metaEnv = (import.meta as any).env;
  const measurementId = (metaEnv && metaEnv.VITE_GA_MEASUREMENT_ID) || "G-DEMO123456";
  const hasConsent = localStorage.getItem("cookie_consent_analytics") === "true";
  
  if (!hasConsent) {
    console.log("[Analytics] Consent not granted. GA initialization skipped.");
    return;
  }

  if ((window as any).gtag_initialized) {
    console.log("[Analytics] GA already initialized.");
    return;
  }

  console.log(`[Analytics] Initializing GA4 with ID: ${measurementId}`);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', '${measurementId}', { 'anonymize_ip': true });
  `;
  document.head.appendChild(script2);
  (window as any).gtag_initialized = true;
}

export function trackEvent(action: string, category: string, label?: string, value?: number) {
  const hasConsent = localStorage.getItem("cookie_consent_analytics") === "true";
  if (!hasConsent) {
    console.log(`[Analytics Blocked] Event: "${action}", Category: "${category}", Label: "${label || 'none'}"`);
    return;
  }
  
  const gtag = (window as any).gtag;
  if (gtag) {
    gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
    console.log(`[Analytics Fired] Event: "${action}", Category: "${category}", Label: "${label || 'none'}"`);
  } else {
    console.log(`[Analytics Queue] Event: "${action}", Category: "${category}", Label: "${label || 'none'}"`);
  }
}

export function trackPageView(path: string) {
  const hasConsent = localStorage.getItem("cookie_consent_analytics") === "true";
  if (!hasConsent) {
    console.log(`[Analytics Blocked] PageView: "${path}"`);
    return;
  }
  
  const gtag = (window as any).gtag;
  if (gtag) {
    gtag("event", "page_view", {
      page_path: path,
    });
    console.log(`[Analytics Fired] PageView: "${path}"`);
  } else {
    console.log(`[Analytics Queue] PageView: "${path}"`);
  }
}
