const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./helpers/loadSource.cjs');
const epoch = loadSource('../speed-layer/src/features/events/eventEpoch.ts');
const auth = loadSource('../speed-layer/src/middlewares/authCache.ts', { '../features/events/eventEpoch': epoch });
const api = loadSource('../speed-layer/src/middlewares/apiCache.ts', { '../features/events/eventEpoch': epoch, './authCache': auth });
const { proxyHandler } = loadSource('../speed-layer/src/middlewares/proxyHandler.ts', { './apiCache': api, './authCache': auth });

test('album API and legacy originals bypass all shared caches, including already populated entries', async () => {
  const original = global.caches; let touched = false;
  global.caches = { default: { match: async () => { touched = true; return new Response('stale private fixture'); } } };
  try {
    for (const path of ['/api/album-photos/id', '/api/album-photo-objects?key=fixture', '/images/groups/g/albums/a/photo.png', '/images/groups%2Fg%2Falbums%2Fa%2Fphoto.png']) {
      const request = new Request(`https://app.fixture${path}`);
      request.bypassEdgeCache = auth.shouldBypassEdgeCache(new URL(request.url).pathname);
      assert.equal(request.bypassEdgeCache, true);
      const response = await api.apiCacheMiddleware(request, {}, { waitUntil() {} }, async () => new Response('current authorization', { status: 403 }));
      assert.equal(response.status, 403); assert.match(response.headers.get('cache-control'), /no-store/);
    }
    assert.equal(touched, false);
    assert.equal(auth.shouldBypassEdgeCache('/images/media/public.png'), false);
  } finally { global.caches = original; }
});

test('private origin fetch bypasses CDN cache and preserves viewer credentials', async () => {
  const original = global.fetch; let seen;
  global.fetch = async (request, init) => { seen = { request, init }; return new Response('checked', { headers: { 'cache-control': 'private, no-store' } }); };
  try {
    const request = new Request('https://app.fixture/images/groups/g/albums/a/photo.png', { headers: { cookie: 'session=fixture' } });
    request.bypassEdgeCache = true;
    await proxyHandler.handle(request, { IMAGES_API_PROXY_TARGET: 'https://storage.fixture' }, {});
    assert.equal(seen.init.cf.cacheTtl, 0); assert.equal(seen.init.cf.cacheEverything, false);
    assert.equal(seen.request.headers.get('cookie'), 'session=fixture');
    assert.equal(new URL(seen.request.url).pathname, '/groups/g/albums/a/photo.png');
  } finally { global.fetch = original; }
});
