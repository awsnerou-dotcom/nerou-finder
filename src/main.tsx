import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';
import { CurrencyProvider } from './currencyContext.tsx';
import { applyStoredThemeOnBoot } from './lib/theme.js';

// Must run before the first paint, outside React - applying the stored theme preference only
// after React mounts would flash the wrong theme (light) for a frame on every load for users
// who've chosen dark.
applyStoredThemeOnBoot();

// Browser-side error monitoring: dormant unless VITE_SENTRY_DSN is set at build time (same
// activate-on-env-var pattern as the server's SENTRY_DSN in server.ts) - catches React render
// crashes and unhandled promise rejections that never reach the backend at all.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrencyProvider>
      <App />
    </CurrencyProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
