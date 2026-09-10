import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

test('group file cleanup requires the admin secret and deletes only one exact object', async () => {
  const groupId = '11111111-1111-1111-1111-111111111111';
  const keys = new Set(['groups/11111111-1111-1111-1111-111111111111/photo.png', 'groups/11111111-1111-1111-1111-111111111111/photo.png/other.png']);
  const env = { FILE_ADMIN_BACKFILL_SECRET: 'secret', R2_BUCKET_NAME: 'bucket', IMAGE_BUCKET: {
    delete: async key => { assert.equal(typeof key, 'string'); keys.delete(key); },
  } };
  const call = (secret, objectKey, bucketName = 'bucket') => worker.fetch(new Request('https://images.test/api/admin/file-objects/delete', {
    method: 'POST', headers: { 'x-alife-file-admin-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, bucketName, groupId }),
  }), env);
  assert.equal((await call('bad', 'groups/11111111-1111-1111-1111-111111111111/photo.png')).status, 403);
  assert.equal((await call('secret', 'group/')).status, 400);
  assert.equal((await call('secret', 'groups/11111111-1111-1111-1111-111111111111/photo.png', 'wrong-bucket')).status, 400);
  const response = await call('secret', 'groups/11111111-1111-1111-1111-111111111111/photo.png');
  assert.equal(response.status, 204);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual([...keys], ['groups/11111111-1111-1111-1111-111111111111/photo.png/other.png']);
  assert.equal((await call('secret', 'groups/11111111-1111-1111-1111-111111111111/photo.png')).status, 204);
  assert.deepEqual([...keys], ['groups/11111111-1111-1111-1111-111111111111/photo.png/other.png']);
});
