import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './index.js';
const group = '11111111-1111-1111-1111-111111111111', album = '22222222-2222-2222-2222-222222222222';
const legacy = `groups/${group}/albums/${album}/photo.png`, key = `private/${legacy}`;
const admin = 'test-admin-secret';
const call = (path, init = {}, env = {}) => worker.fetch(new Request(`https://images.fixture${path}`, init), env);

test('album admin route fails closed without its server secret; anonymous listing and mutation cannot access originals', async () => {
  const env = { FILE_ADMIN_BACKFILL_SECRET: admin, IMAGE_BUCKET: { list: async () => ({ objects: [{ key: legacy }], delimitedPrefixes: [`groups/${group}/albums/`] }) } };
  assert.equal((await call(`/api/admin/album-photos/${key}`, {}, env)).status, 403);
  assert.equal((await call(`/api/images/${legacy}`, { method: 'DELETE' }, env)).status, 404);
  assert.equal((await call(`/api/images/groups/${group}`, { method: 'DELETE' }, env)).status, 403);
  assert.equal((await call(`/api/images/${legacy}`, { method: 'POST' }, env)).status, 404);
  const listing = await (await call(`/api/images/list/groups/${group}`, {}, env)).json();
  assert.deepEqual(listing.media, []); assert.deepEqual(listing.folders, []);
});

test('legacy public URL delegates live authorization, forwards credentials and never reads R2 anonymously', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(init.headers.get('cookie') === 'session=member' ? 'allowed' : 'denied', { status: init.headers.get('cookie') === 'session=member' ? 200 : 403 });
  };
  try {
    const env = { ALBUM_API_BASE_URL: 'https://api.fixture' };
    for (const path of [`/${legacy}`, `/api/images/${legacy}`]) {
      const denied = await call(path, {}, env); assert.equal(denied.status, 403); assert.match(denied.headers.get('cache-control'), /no-store/);
      const allowed = await call(path, { headers: { cookie: 'session=member' } }, env); assert.equal(await allowed.text(), 'allowed');
    }
    assert.equal(calls[0].url.pathname, '/api/album-photo-objects');
    assert.equal(calls[0].url.searchParams.get('key'), legacy); assert.equal(calls[0].init.cf.cacheTtl, 0);
    const head = await call(`/${legacy}`, { method: 'HEAD', headers: { cookie: 'session=member' } }, env);
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
  } finally { globalThis.fetch = previous; }
});

test('server-only album object upload and read carry private no-store headers', async () => {
  let stored;
  const env = { FILE_ADMIN_BACKFILL_SECRET: admin, IMAGE_BUCKET: {
    put: async (k, body, metadata) => { stored = { k, metadata }; await new Response(body).arrayBuffer(); },
    get: async () => ({ body: 'image-bytes', httpMetadata: { contentType: 'image/png' } }),
  } };
  const headers = { 'x-alife-file-admin-secret': admin, 'content-type': 'image/png' };
  assert.equal((await call(`/api/admin/album-photos/${key}`, { method: 'PUT', headers, body: 'bounded' }, env)).status, 204);
  assert.equal(stored.k, key); assert.match(stored.metadata.httpMetadata.cacheControl, /no-store/);
  const read = await call(`/api/admin/album-photos/${key}`, { headers }, env);
  assert.equal(await read.text(), 'image-bytes'); assert.match(read.headers.get('cache-control'), /no-store/);
  assert.equal((await call(`/api/admin/album-photos/${legacy}`, { method: 'PUT', headers, body: 'x' }, env)).status, 400);
});
