import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from './index.js';

const key = `private/event-registration/${'1'.repeat(32)}/${'2'.repeat(32)}/${'3'.repeat(32)}.pdf`;
function fixture() {
  const objects = new Map();
  const env = { FILE_ADMIN_BACKFILL_SECRET: 'test-admin', FILE_ACCESS_SIGNING_SECRET: 'test-signing', IMAGE_BUCKET: {
    put: async (key, body) => objects.set(key, { body }), get: async key => objects.get(key),
    head: async key => objects.get(key), list: async () => ({ objects: [], delimitedPrefixes: ['private/', 'public/'] }),
    delete: async () => { throw new Error('Private material must not be deleted through the image API'); },
  } };
  const dispatch = (path, options) => worker.fetch(new Request(`https://files.test${path}`, options), env);
  return { env, objects, dispatch };
}
test('registration materials require the application secret for upload and every read', async () => {
  const f = fixture(), route = `/api/admin/event-registration/${key}`;
  assert.equal((await f.dispatch(route, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: '%PDF-test' })).status, 403);
  const headers = { 'content-type': 'application/pdf', 'x-alife-file-admin-secret': 'test-admin' };
  assert.equal((await f.dispatch(route, { method: 'PUT', headers, body: 'wrong format' })).status, 400);
  assert.equal((await f.dispatch(route, { method: 'PUT', headers, body: '%PDF-test' })).status, 204);
  assert.equal((await f.dispatch(route)).status, 403);
  const response = await f.dispatch(route, { headers });
  assert.equal(response.status, 200); assert.equal(await response.text(), '%PDF-test');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-disposition'), 'attachment');
  const exp = Math.floor(Date.now() / 1000) + 60;
  const sig = createHmac('sha256', f.env.FILE_ACCESS_SIGNING_SECRET).update(`${key}\n${exp}`).digest('base64url');
  assert.equal((await f.dispatch(`/api/private-files/${key}?exp=${exp}&sig=${sig}`)).status, 403);
});
test('public aliases, listings, image writes and generic deletion cannot bypass material access', async () => {
  const f = fixture();
  for (const path of [`/${key}`, `/api/images/${key}`, `/api/images/${encodeURIComponent(key)}`, '/api/images/list/private']) {
    assert.equal((await f.dispatch(path)).status, 404);
  }
  for (const path of ['private', 'private/event-registration', key]) {
    for (const method of ['DELETE', 'POST']) assert.equal((await f.dispatch(`/api/images/${path}`, { method })).status, 404);
  }
});
