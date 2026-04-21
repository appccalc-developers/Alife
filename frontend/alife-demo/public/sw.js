// Alife Church – Service Worker
// Provides offline caching with a network-first strategy for API calls,
// HTML/JS/CSS, and a cache-first strategy for images/fonts.

const CACHE_NAME = 'alife-cache-v1';

// Static assets to pre-cache during install.
// The Vite build output hashes file names, so we cache the shell entry points
// and let the runtime caching handle hashed chunks.
const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ─────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_URLS))
  );
  // Activate the new SW immediately instead of waiting for all tabs to close.
  // This is acceptable here because the cache-first strategy still serves
  // previously-cached assets; only newly-fetched resources use the updated SW.
  self.skipWaiting();
});

// ── Activate ────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Remove old caches when a new SW version activates.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// ── Fetch ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for API calls – always try the network, fall back to cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  const { destination } = request;

  // Network-first for app shell/document/script/style.
  if (
    request.mode === 'navigate' ||
    destination === 'document' ||
    destination === 'script' ||
    destination === 'style'
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for media assets.
  if (destination === 'image' || destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default to network-first for everything else.
  event.respondWith(networkFirst(request));
});

// ── Strategies ──────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && (request.method === 'GET' && (request.destination === 'image' || request.destination === 'font'))) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // For navigation requests, return the cached app shell so the SPA
    // can render its own offline / 404 UI.
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/');
      if (fallback) {
        return fallback;
      }
    }
    // Return an empty response appropriate for the request type.
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
