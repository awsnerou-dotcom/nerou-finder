import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CurrencyProvider } from './currencyContext.tsx';
import { applyStoredThemeOnBoot } from './lib/theme.js';

// Must run before the first paint, outside React - applying the stored theme preference only
// after React mounts would flash the wrong theme (light) for a frame on every load for users
// who've chosen dark.
applyStoredThemeOnBoot();

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
