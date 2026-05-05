// Alife Church service worker.
// Offline shell + API runtime cache + resilient sync invalidation.

const CACHE_NAME = 'alife-cache-v2';
const VERSION_DB_NAME = 'alife-sync';
const VERSION_STORE = 'versions';
const API_UPDATE_CHANNEL = 'api-updates';

const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  const { destination } = request;
  if (
    request.mode === 'navigate' ||
    destination === 'document' ||
    destination === 'script' ||
    destination === 'style'
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (destination === 'image' || destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener('message', (event) => {
  const message = event.data || {};

  if (message.type === 'SYNC_CHECK' && Array.isArray(message.keys)) {
    event.waitUntil(checkVersions(message.keys));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET' && (request.destination === 'image' || request.destination === 'font')) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/');
      if (fallback) {
        return fallback;
      }
    }

    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
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

async function handlePush(event) {
  const update = readPushPayload(event);
  if (!update || update.type !== 'ENTITY_UPDATED') {
    return;
  }

  await applyEntityUpdate(update);
}

function readPushPayload(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

async function applyEntityUpdate(update) {
  if (update.apiPath) {
    await refreshApiPath(update.apiPath);
  }

  if (Array.isArray(update.versionKeys) && Number.isFinite(update.version)) {
    await setVersions(update.versionKeys, update.version);
  }

  broadcastUpdate(update);
}

async function refreshApiPath(apiPath) {
  const request = new Request(new URL(apiPath, self.location.origin).toString(), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  const response = await fetch(request);
  if (!response.ok) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function checkVersions(keys) {
  const uniqueKeys = [...new Set(keys.filter((key) => typeof key === 'string' && key.length > 0))];
  if (uniqueKeys.length === 0) {
    return;
  }

  const response = await fetch(`/api/sync/versions?keys=${encodeURIComponent(uniqueKeys.join(','))}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return;
  }

  const payload = await response.json();
  const remoteVersions = payload.versions || payload.Versions || {};
  const changedKeys = [];

  for (const [key, remoteVersion] of Object.entries(remoteVersions)) {
    const version = Number(remoteVersion);
    if (!Number.isFinite(version)) {
      continue;
    }

    const localVersion = await getVersion(key);
    if (version > localVersion) {
      changedKeys.push(key);
      await setVersions([key], version);
    }
  }

  if (changedKeys.length > 0) {
    broadcastUpdate({
      type: 'ENTITY_UPDATED',
      entityType: 'version-check',
      entityId: changedKeys.join(','),
      versionKeys: changedKeys,
      version: Date.now(),
    });
  }
}

function broadcastUpdate(update) {
  const message = {
    ...update,
    receivedAt: new Date().toISOString(),
  };

  if ('BroadcastChannel' in self) {
    const channel = new BroadcastChannel(API_UPDATE_CHANNEL);
    channel.postMessage(message);
    channel.close();
  }

  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ channel: API_UPDATE_CHANNEL, ...message });
    }
  });
}

async function getVersion(key) {
  const db = await openVersionDb();
  return new Promise((resolve) => {
    const transaction = db.transaction(VERSION_STORE, 'readonly');
    const request = transaction.objectStore(VERSION_STORE).get(key);
    request.onsuccess = () => resolve(Number(request.result?.version || 0));
    request.onerror = () => resolve(0);
  });
}

async function setVersions(keys, version) {
  const db = await openVersionDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(VERSION_STORE, 'readwrite');
    const store = transaction.objectStore(VERSION_STORE);
    for (const key of keys) {
      store.put({ key, version });
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function openVersionDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VERSION_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VERSION_STORE)) {
        db.createObjectStore(VERSION_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
