import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

// Offline support when installed to the home screen (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Hand the worker the files this page loaded, so they're cached on the first visit.
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => new URL(u).origin === location.origin);
        reg.active?.postMessage({ type: 'cache', urls });
      })
      .catch(() => {
        // Unsupported context (e.g. a sandboxed preview): the app still works online.
      });
  });
}
