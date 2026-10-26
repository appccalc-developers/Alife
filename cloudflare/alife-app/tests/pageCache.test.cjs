const assert = require('node:assert/strict');
const test = require('node:test');
const { QueryClient } = require('@tanstack/react-query');
const { loadSource } = require('./helpers/loadSource.cjs');
const { HttpStatusError } = loadSource('src/db/httpError.ts');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const fixture = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let viewer = 'A', selected = 'page';
  const reads = [], removals = [];
  const data = { id: 'page', ownerGroupId: 'group', title: { en: 'Fixture', zh: '测试' }, sections: [], visibility: 'draft' };
  const active = { getViewerId: () => viewer, getAll: () => ({ pageId: selected }), setPage: id => { selected = id; } };
  const http = { get: async (path, options) => { reads.push({ path, options, viewer }); return { data: { ...data, readBy: viewer } }; }, delete: async () => {} };
  const persistent = { conditionalGet: async () => null, getCachedRecord: async () => undefined, removeCachedRecord: async key => removals.push(key), removeCachedRecords: async key => removals.push(key) };
  const cache = loadSource('src/db/collections/pageCollection.ts', {
    '../httpCache': persistent, '../queryClient': { queryClient: client, QUERY_STALE_TIME_MS: 30000 },
    '../../utils/pageDetail': { normalizePageDetail: x => x }, '../../services/http': { http },
    '../../services/activeEntityService': { activeEntityService: active }, '../httpError': { HttpStatusError },
  });
  const service = loadSource('src/services/pageService.ts', {
    './http': { http }, './activeEntityService': { activeEntityService: active },
    '../db/collections/groupCollection': { groupPagesQueryKey: id => ['groupPages', id] },
    '../db/collections/pageCollection': cache, '../db/httpCache': persistent, '../db/queryClient': { queryClient: client },
    '../utils/apiEnums': { normalizePageSummary: x => x }, '../utils/pageDetail': { normalizePageDetail: x => x },
    '../utils/localizedText': { toLocalizedText: x => x }, './churchLifeService': { invalidateChurchLifeQueries: () => client.invalidateQueries({ queryKey: ['church-life'] }) },
  }).pageService;
  return { cache, service, client, http, data, reads, removals, active, viewer: id => { viewer = id; } };
};

test('working-copy memory cache reuses one viewer and never serves another viewer or guest', async () => {
  const f = fixture();
  try {
    assert.equal((await f.cache.ensureFreshPageDetail('page', 'A')).readBy, 'A');
    await f.cache.ensureFreshPageDetail('page', 'A');
    assert.equal(f.reads.length, 1);
    f.viewer('B');
    assert.equal((await f.cache.ensureFreshPageDetail('page', 'B')).readBy, 'B');
    f.viewer('');
    f.http.get = async () => { throw new HttpStatusError('fixture', 401); };
    await assert.rejects(f.cache.ensureFreshPageDetail('page', ''), { status: 401 });
    assert.equal(f.client.getQueryData(f.cache.pageDetailQueryKey('page', '')), undefined);
    assert.equal(f.removals.length, 0, 'private reads do not access persistent cache');
  } finally { f.client.clear(); }
});

test('session reset cancels late working/review reads, removes every private viewer and preserves public data', async () => {
  const f = fixture(), pending = deferred();
  try {
    f.client.setQueryData(['publicPageDetail', 'published'], { id: 'published' });
    f.client.setQueryData(f.cache.pageDetailQueryKey('other', 'B'), f.data);
    f.client.setQueryData(f.cache.pageReviewCopyQueryKey('other', 'A'), f.data);
    f.http.get = async (path, options) => { f.reads.push({ path, options }); return pending.promise; };
    const result = f.cache.ensureFreshPageDetail('page', 'A').catch(error => error);
    const review = f.cache.fetchPageReviewCopy('page', 'A').catch(error => error);
    await f.cache.clearPrivatePageCaches();
    f.viewer('B'); pending.resolve({ data: f.data });
    assert.ok(await result instanceof Error);
    assert.equal((await review).name, 'AbortError');
    assert.ok(f.reads.every(read => read.options.signal.aborted));
    assert.equal(f.client.getQueryCache().findAll({ queryKey: ['pageDetail'] }).length, 0);
    assert.equal(f.client.getQueryCache().findAll({ queryKey: ['pagePublicationReviewCopy'] }).length, 0);
    assert.deepEqual(f.client.getQueryData(['publicPageDetail', 'published']), { id: 'published' });
    assert.deepEqual(f.removals, [['pageDetail'], ['pagePublicationReviewCopy']]);
  } finally { f.client.clear(); }
});

test('late mutation results cannot cache under the current viewer', () => {
  const f = fixture();
  try {
    f.viewer('B'); f.cache.setPageDetailCache(f.data, 'A');
    assert.equal(f.client.getQueryCache().getAll().length, 0);
  } finally { f.client.clear(); }
});

test('a mutation from a previous session cannot refill cache after signing back into the same account', async () => {
  const f = fixture();
  try {
    const generation = f.cache.getPrivatePageCacheGeneration();
    await f.cache.clearPrivatePageCaches();
    f.cache.setPageDetailCache(f.data, 'A', generation);
    assert.equal(f.client.getQueryCache().getAll().length, 0);
  } finally { f.client.clear(); }
});

test('successful deletion removes all page copies, aborts reads, invalidates lists and clears selection', async () => {
  const f = fixture(), pending = deferred();
  try {
    for (const key of [f.cache.pageDetailQueryKey('page', 'A'), f.cache.pageDetailQueryKey('page', 'B'), ['pageDetail', 'page'], f.cache.pageReviewCopyQueryKey('page', 'B'), ['publicPageDetail', 'page']]) f.client.setQueryData(key, f.data);
    for (const key of [['groupPages', 'group'], ['publicPages'], ['church-life', 'A']]) f.client.setQueryData(key, []);
    f.client.setQueryData(['groupPages', 'group'], [f.data, { ...f.data, id: 'other' }]);
    f.client.setQueryData(['publicPages'], [f.data]);
    f.client.setQueryData(['church-life', 'B', 'pages', 'all'], { items: [f.data], groups: [] });
    f.http.get = () => pending.promise;
    const read = f.cache.fetchPageDetail('page', 'A').catch(error => error);
    await f.service.deletePage('page', 'group');
    pending.resolve({ data: f.data });
    assert.equal((await read).name, 'AbortError');
    assert.equal(f.active.getAll().pageId, '');
    assert.equal(f.cache.getFreshPageDetail('page', 'A'), null);
    await assert.rejects(f.cache.ensureFreshPageDetail('page', 'B'), { status: 404 });
    assert.equal(await f.cache.getCachedPublicPageDetailRecord('page'), undefined);
    assert.equal(f.client.getQueryData(['publicPageDetail', 'page']), undefined);
    assert.equal(f.client.getQueryCache().findAll({ queryKey: ['pagePublicationReviewCopy', 'page'] }).length, 0);
    for (const key of [['groupPages', 'group'], ['publicPages'], ['church-life', 'A']]) assert.equal(f.client.getQueryState(key).isInvalidated, true);
    assert.deepEqual(f.client.getQueryData(['groupPages', 'group']).map(page => page.id), ['other']);
    assert.deepEqual(f.client.getQueryData(['publicPages']), []);
    assert.deepEqual(f.client.getQueryData(['church-life', 'B', 'pages', 'all']).items, []);
    assert.ok(f.removals.some(key => JSON.stringify(key) === JSON.stringify(['pageDetail', 'page'])));
  } finally { f.client.clear(); }
});

test('failed deletion leaves caches and active selection intact', async () => {
  const f = fixture();
  try {
    f.cache.setPageDetailCache(f.data, 'A');
    f.http.delete = async () => { throw new Error('Denied'); };
    await assert.rejects(f.service.deletePage('page', 'group'), /Denied/);
    assert.equal(f.cache.getFreshPageDetail('page', 'A').id, 'page');
    assert.equal(f.active.getAll().pageId, 'page');
    assert.equal(f.removals.length, 0);
  } finally { f.client.clear(); }
});
