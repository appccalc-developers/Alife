const assert = require('node:assert/strict');
const test = require('node:test');
const { loadSource } = require('./helpers/loadSource.cjs');
const { HttpStatusError } = loadSource('src/db/httpError.ts');
const fixture = () => {
  const records = new Map();
  const idb = { createStore: () => ({}), get: async key => records.get(key), set: async (key, value) => records.set(key, value), keys: async () => [...records.keys()], delMany: async keys => keys.forEach(key => records.delete(key)), clear: async () => records.clear() };
  const cache = loadSource('src/db/httpCache.ts', {
    './httpError': { HttpStatusError }, '../stores/cacheDiagnosticStore': { cacheDiagnosticStore: { isOfflineSimulated: () => false, recordDiagnostic: () => {} } }, 'idb-keyval': idb,
  });
  return { cache, records, idb };
};

test('prefix removal deletes legacy and viewer variants without deleting other pages or public lists', async () => {
  const { cache, records } = fixture();
  for (const key of [['pageDetail', 'page'], ['pageDetail', 'page', 'viewer', 'A'], ['pageDetail', 'page', 'viewer', 'B'], ['pageDetail', 'other'], ['publicPages']]) records.set(JSON.stringify(key), {});
  await cache.removeCachedRecords(['pageDetail', 'page']);
  assert.deepEqual([...records.keys()], [JSON.stringify(['pageDetail', 'other']), JSON.stringify(['publicPages'])]);
});

test('invalidation aborts a delayed response and prevents persistent refill even if transport ignores abort', async () => {
  const { cache, records } = fixture();
  const original = global.fetch;
  let deliver, started;
  const ready = new Promise(resolve => { started = resolve; });
  global.fetch = async () => { started(); return new Promise(resolve => { deliver = resolve; }); };
  try {
    const pending = cache.conditionalGet({ queryKey: ['publicPageDetail', 'page'], path: '/api/pages/public/page' }).catch(error => error);
    await ready;
    await cache.removeCachedRecords(['publicPageDetail', 'page']);
    deliver(new Response(JSON.stringify({ id: 'page' }), { headers: { ETag: 'old' } }));
    assert.equal((await pending).name, 'AbortError');
    assert.equal(records.size, 0);
    global.fetch = async () => new Response(JSON.stringify({ id: 'fresh' }), { headers: { ETag: 'fresh' } });
    assert.equal((await cache.conditionalGet({ queryKey: ['publicPageDetail', 'page'], path: '/api/pages/public/page' })).id, 'fresh');
  } finally { global.fetch = original; }
});

test('invalidation waits for an already-started IDB write and removes its record afterwards', async () => {
  const { cache, records, idb } = fixture();
  const original = global.fetch;
  let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  idb.set = async (key, value) => { started(); await new Promise(resolve => { finish = resolve; }); records.set(key, value); };
  global.fetch = async () => new Response('{"id":"page"}', { headers: { ETag: 'old' } });
  try {
    const read = cache.conditionalGet({ queryKey: ['publicPageDetail', 'page'], path: '/api/pages/public/page' }).catch(error => error);
    await ready;
    const removal = cache.removeCachedRecords(['publicPageDetail', 'page']);
    finish(); await removal;
    assert.equal((await read).name, 'AbortError');
    assert.equal(records.size, 0);
  } finally { global.fetch = original; }
});
