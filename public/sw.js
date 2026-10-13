// Offline support for the installed app. The app is static and keeps all data
// in localStorage, so caching the shell and its files is enough to run offline.
// - The page shell (index.html) is network-first, so new deploys arrive; only a
//   real HTML response for the shell replaces the offline copy.
// - Built files under assets/ have hashed names: cache-first, and the page sends
//   the list it loaded so they are cached on the very first visit.
// - Other files (manifest, icons) are served from cache and refreshed in the background.
const VERSION = 'v4';
const CACHE = `trait-trainer-${VERSION}`;
const SCOPE = new URL('./', self.registration.scope).pathname;
const ASSETS = `${SCOPE}assets/`;
// Static files don't really vary by request headers; some servers still send
// "Vary: Origin", which would stop module scripts (sent with Origin) matching.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './manifest.webmanifest', './icon.svg', './icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trait-trainer-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page posts the same-origin files it loaded: cache any that are missing,
// and drop built files from older deploys that this page no longer uses.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try {
      return new URL(u).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  const current = new Set(urls.map((u) => new URL(u).pathname));
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(urls.map((u) => cache.match(u, MATCH).then((hit) => hit || cache.add(u).catch(() => undefined))));
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter((req) => {
            const path = new URL(req.url).pathname;
            return path.startsWith(ASSETS) && !path.endsWith('.woff2') && !current.has(path);
          })
          .map((req) => cache.delete(req)),
      );
    }),
  );
});

function isShell(url) {
  return url.pathname === SCOPE || url.pathname === `${SCOPE}index.html`;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const html = (res.headers.get('content-type') || '').includes('text/html');
          if (res.ok && html && isShell(url)) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('./', copy)));
          }
          return res;
        })
        .catch(() => caches.match('./', MATCH)),
    );
    return;
  }

  if (url.pathname.startsWith(ASSETS)) {
    event.respondWith(
      caches.match(req, MATCH).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(caches.open(CACHE).then((cache) => cache.put(req, copy)));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else: cached copy first, refreshed in the background.
  event.respondWith(
    caches.match(req, MATCH).then((hit) => {
      const update = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      if (hit) {
        event.waitUntil(update);
        return hit;
      }
      return update;
    }),
  );
});
