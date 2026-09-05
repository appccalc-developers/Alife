import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from './index.js';

const key = 'private/sunday-bulletins/11111111-1111-1111-1111-111111111111/2026-09-06.pdf';
const base = 'https://files.test';
function fixture() {
  const objects = new Map();
  const env = {
    FILE_ADMIN_BACKFILL_SECRET: 'test-admin', FILE_ACCESS_SIGNING_SECRET: 'test-signing',
    IMAGE_BUCKET: {
      put: async (key, body) => objects.set(key, { body: new TextDecoder().decode(body) }),
      get: async key => objects.get(key), head: async key => objects.get(key),
      list: async () => ({ objects: [], delimitedPrefixes: ['private/', 'public/'] }),
      delete: async () => { throw new Error('Must not delete protected files'); },
    },
  };
  const dispatch = (path, options) => worker.fetch(new Request(`${base}${path}`, options), env);
  const upload = (body, secret = 'test-admin') => dispatch(`/api/admin/sunday-bulletins/${key}`, {
    method: 'PUT', headers: { 'content-type': 'application/pdf', 'x-alife-file-admin-secret': secret }, body,
  });
  const signedPath = (expires = Math.floor(Date.now() / 1000) + 290, signingKey = key) => {
    const sig = createHmac('sha256', env.FILE_ACCESS_SIGNING_SECRET).update(`${signingKey}\n${expires}`).digest('base64url');
    return `/api/private-files/${key}?exp=${expires}&sig=${sig}`;
  };
  return { objects, env, dispatch, upload, signedPath };
}

test('upload requires server secret and PDF signature; replacement uses the same object', async () => {
  const f = fixture();
  assert.equal((await f.upload('%PDF-original', 'wrong')).status, 403);
  assert.equal((await f.upload('not a pdf')).status, 400);
  assert.equal(f.objects.size, 0);
  assert.equal((await f.upload('%PDF-original')).status, 204);
  assert.equal((await f.upload('%PDF-replacement')).status, 204);
  assert.equal(f.objects.size, 1);
  const response = await f.dispatch(f.signedPath());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(await response.text(), '%PDF-replacement');
  assert.equal((await f.dispatch(f.signedPath(), { method: 'HEAD' })).status, 200);
});

test('unsigned, expired, forged and cross-key reads cannot access PDFs', async () => {
  const f = fixture();
  await f.upload('%PDF-original');
  for (const path of [`/api/private-files/${key}`, f.signedPath(1), f.signedPath(Math.floor(Date.now() / 1000) + 100, key + 'other'), f.signedPath() + 'tampered']) {
    const response = await f.dispatch(path);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('public aliases, listings, upload and parent deletion cannot reach bulletins', async () => {
  const f = fixture();
  await f.upload('%PDF-original');
  for (const path of [`/${key}`, `/api/images/${key}`, `/api/images/${encodeURIComponent(key)}`, '/api/images/list/private']) {
    assert.equal((await f.dispatch(path)).status, 404);
  }
  for (const path of ['private', 'private/sunday-bulletins', key]) {
    assert.equal((await f.dispatch(`/api/images/${path}`, { method: 'DELETE' })).status, 404);
    assert.equal((await f.dispatch(`/api/images/${path}`, { method: 'POST' })).status, 404);
  }
  const listing = await (await f.dispatch('/api/images/list')).json();
  assert.deepEqual(listing.folders.map(folder => folder.path), ['public/']);
  assert.equal(f.objects.size, 1);
});

test('oversize PDF is rejected without replacing existing content', async () => {
  const f = fixture();
  await f.upload('%PDF-original');
  assert.equal((await f.upload('%PDF-' + 'x'.repeat(20 * 1024 * 1024))).status, 413);
  assert.equal(f.objects.get(key).body, '%PDF-original');
});
