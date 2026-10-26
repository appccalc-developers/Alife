import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const study = readFileSync(new URL('../src/views/BibleStudyView.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('BibleStudyView.tsx', study, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const effects: string[] = []
const visit = (node: ts.Node) => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.arguments[0].getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast)

// Execute the actual effect callback, not a second implementation of its rules.
// React scheduling/router and HTTP are controlled fixtures, not browser proof.
const runEffect = (index: number, bindings: Record<string, unknown>) => {
  const code = ts.transpileModule(`return (${effects[index]})()`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None },
  }).outputText
  return new Function(...Object.keys(bindings), code)(...Object.values(bindings)) as () => void
}
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const position = { book: 'JHN', chapter: 3, language: 'zh', zhVersion: '123', enVersion: '206', updatedUtc: '2026-10-07T01:00:00Z' }

const restoreFixture = (local: typeof position, initialSearch = '') => {
  const pending = deferred<typeof position | null>()
  const location = { search: initialSearch }
  const applied: URLSearchParams[] = []
  const writes: unknown[][] = []
  const uploads: unknown[] = []
  const ready: unknown[] = []
  const cleanup = runEffect(0, {
    auth: { me: { id: 'fictional-member-a' }, isGuest: false },
    searchParams: new URLSearchParams(initialSearch),
    setSearchParams: (value: URLSearchParams) => {
      applied.push(new URLSearchParams(value))
      // BrowserRouter replaces history before the pending HTTP response settles.
      location.search = `?${value}`
    },
    setRestoredReadingMemberId: (value: unknown) => { ready.push(value) },
    readSavedReadingPosition: () => local,
    normalizeReadingPosition: (value: unknown) => value,
    saveReadingPosition: (...values: unknown[]) => { writes.push(values) },
    bibleReadingProgressService: {
      get: () => pending.promise,
      save: (value: unknown) => { uploads.push(value); return Promise.resolve(value) },
    },
    window: { location },
  })
  return { pending, location, applied, writes, uploads, ready, cleanup }
}

test('a newer server position replaces the optimistic local restore after its URL change', async () => {
  const fixture = restoreFixture(position)
  assert.equal(new URLSearchParams(fixture.location.search).get('chapter'), '3')
  const remote = { ...position, book: 'ACT', chapter: 9, language: 'en', updatedUtc: '2026-10-08T01:00:00Z' }
  fixture.pending.resolve(remote)
  await settle()

  const current = new URLSearchParams(fixture.location.search)
  assert.equal(current.get('book'), 'ACT')
  assert.equal(current.get('chapter'), '9')
  assert.equal(current.get('lang'), 'en')
  assert.deepEqual(fixture.writes, [['fictional-member-a', remote]])
  assert.deepEqual(fixture.uploads, [], 'stale local progress must not be uploaded')
  assert.deepEqual(fixture.ready, ['fictional-member-a'])
  fixture.cleanup()
})

test('the optimistic local URL change still permits uploading newer local progress', async () => {
  for (const remote of [null, { ...position, updatedUtc: '2026-10-06T01:00:00Z' }]) {
    const fixture = restoreFixture(position)
    fixture.pending.resolve(remote)
    await settle()

    assert.equal(new URLSearchParams(fixture.location.search).get('chapter'), '3')
    assert.deepEqual(fixture.uploads, [position])
    assert.deepEqual(fixture.writes, [['fictional-member-a', position]])
    assert.deepEqual(fixture.ready, ['fictional-member-a'])
    fixture.cleanup()
  }
})

test('real navigation during restore wins over either an older or newer server position', async () => {
  for (const updatedUtc of ['2026-10-06T01:00:00Z', '2026-10-08T01:00:00Z']) {
    const fixture = restoreFixture(position)
    fixture.location.search = '?book=ROM&chapter=8&lang=en'
    fixture.pending.resolve({ ...position, book: 'ACT', chapter: 9, updatedUtc })
    await settle()

    assert.equal(fixture.location.search, '?book=ROM&chapter=8&lang=en')
    assert.equal(fixture.applied.length, 1, 'only the initial local restoration may navigate')
    assert.deepEqual(fixture.writes, [], 'restore must not overwrite the new reading choice')
    assert.deepEqual(fixture.uploads, [], 'restore must not upload the prior local choice')
    assert.deepEqual(fixture.ready, ['fictional-member-a'], 'normal saving resumes for the current URL')
    fixture.cleanup()
  }
})

test('a newer server restore preserves an explicit chapter and language from the entry URL', async () => {
  const fixture = restoreFixture(position, '?book=PSA&chapter=5&lang=en&enVersion=100&from=virtual-church-study-room')
  const remote = { ...position, book: 'ACT', chapter: 9, zhVersion: '456', updatedUtc: '2026-10-08T01:00:00Z' }
  fixture.pending.resolve(remote)
  await settle()

  const current = new URLSearchParams(fixture.location.search)
  assert.equal(current.get('book'), 'PSA')
  assert.equal(current.get('chapter'), '5')
  assert.equal(current.get('lang'), 'en')
  assert.equal(current.get('enVersion'), '100')
  assert.equal(current.get('from'), 'virtual-church-study-room')
  assert.equal(current.get('zhVersion'), '456', 'only absent preferences use the newer saved position')
  assert.deepEqual(fixture.uploads, [])
  fixture.cleanup()
})

test('late save completion cannot overwrite newer local progress after effect cleanup', async () => {
  const pending = deferred<typeof position>()
  const writes: unknown[][] = []
  let timer: (() => void) | undefined
  let cleared = false
  let signal: AbortSignal | undefined
  const cleanup = runEffect(1, {
    auth: { me: { id: 'fictional-member-a' }, isGuest: false },
    restoredReadingMemberId: 'fictional-member-a',
    book: 'JHN', chapter: 3, language: 'zh', searchParams: new URLSearchParams('zhVersion=123&enVersion=206'),
    saveReadingPosition: (...values: unknown[]) => { writes.push(values) },
    normalizeReadingPosition: (value: unknown) => value,
    bibleReadingProgressService: { save: (_value: unknown, requestSignal?: AbortSignal) => { signal = requestSignal; return pending.promise } },
    window: { setTimeout: (callback: () => void) => { timer = callback; return 1 }, clearTimeout: () => { cleared = true } },
  })
  assert.equal(writes.length, 1, 'optimistic local save remains available offline')
  timer!()
  cleanup()
  pending.resolve(position)
  await settle()
  assert.equal(writes.length, 1, 'disposed save must not write its late response')
  assert.equal(cleared, true)
  assert.equal(signal?.aborted, true, 'request is canceled on cleanup')
})

test('active save writes its response to the initiating member only', async () => {
  const pending = deferred<typeof position>()
  const writes: unknown[][] = []
  let timer: (() => void) | undefined
  const cleanup = runEffect(1, {
    auth: { me: { id: 'fictional-member-b' }, isGuest: false }, restoredReadingMemberId: 'fictional-member-b',
    book: 'ACT', chapter: 4, language: 'en', searchParams: new URLSearchParams(),
    saveReadingPosition: (...values: unknown[]) => { writes.push(values) }, normalizeReadingPosition: (value: unknown) => value,
    bibleReadingProgressService: { save: () => pending.promise },
    window: { setTimeout: (callback: () => void) => { timer = callback; return 1 }, clearTimeout: () => {} },
  })
  timer!()
  pending.resolve({ ...position, book: 'ACT', chapter: 4, language: 'en' })
  await settle()
  assert.equal(writes.length, 2)
  assert.deepEqual(writes.map((write) => write[0]), ['fictional-member-b', 'fictional-member-b'])
  cleanup()
})

test('late restore cannot apply, upload or mark a disposed member as restored', async () => {
  const pending = deferred<typeof position | null>()
  const applied: unknown[] = []
  const uploads: unknown[] = []
  const ready: unknown[] = []
  let signal: AbortSignal | undefined
  const cleanup = runEffect(0, {
    auth: { me: { id: 'fictional-member-a' }, isGuest: false },
    searchParams: new URLSearchParams(), setSearchParams: (value: unknown) => { applied.push(value) },
    setRestoredReadingMemberId: (value: unknown) => { ready.push(value) },
    readSavedReadingPosition: () => null, normalizeReadingPosition: (value: unknown) => value,
    saveReadingPosition: () => { throw new Error('disposed restore wrote local data') },
    bibleReadingProgressService: {
      get: (requestSignal?: AbortSignal) => { signal = requestSignal; return pending.promise },
      save: (value: unknown) => { uploads.push(value); return Promise.resolve(position) },
    },
    window: { location: { search: '' } },
  })
  cleanup()
  pending.resolve(position)
  await settle()
  assert.deepEqual(applied, [])
  assert.deepEqual(uploads, [])
  assert.deepEqual(ready, [])
  assert.equal(signal?.aborted, true)
})

test('guests and unrestored member transitions never schedule progress writes', () => {
  for (const auth of [{ me: null, isGuest: true }, { me: { id: 'guest-id' }, isGuest: true }, { me: { id: 'fictional-member-b' }, isGuest: false }]) {
    runEffect(1, {
      auth, restoredReadingMemberId: 'fictional-member-a',
      saveReadingPosition: () => { throw new Error('unexpected guest/prior-viewer save') },
      window: { setTimeout: () => { throw new Error('unexpected timer') } },
    })
  }
})

test('disposed local-to-server restore upload cannot persist its late response', async () => {
  const pending = deferred<typeof position>()
  const writes: unknown[] = []
  const ready: unknown[] = []
  let uploadSignal: AbortSignal | undefined
  const cleanup = runEffect(0, {
    auth: { me: { id: 'fictional-member-a' }, isGuest: false },
    searchParams: new URLSearchParams('book=JHN&chapter=3&lang=zh&zhVersion=123&enVersion=206'),
    setSearchParams: () => {}, setRestoredReadingMemberId: (value: unknown) => { ready.push(value) },
    readSavedReadingPosition: () => position, normalizeReadingPosition: (value: unknown) => value,
    saveReadingPosition: (value: unknown) => { writes.push(value) },
    bibleReadingProgressService: {
      get: () => Promise.resolve(null),
      save: (_value: unknown, signal?: AbortSignal) => { uploadSignal = signal; return pending.promise },
    },
    window: { location: { search: '?book=JHN&chapter=3&lang=zh&zhVersion=123&enVersion=206' } },
  })
  await settle()
  assert.ok(uploadSignal, 'restore dispatched local progress with a cancellation signal')
  cleanup()
  pending.resolve(position)
  await settle()
  assert.equal(uploadSignal.aborted, true)
  assert.deepEqual(writes, [])
  assert.deepEqual(ready, [])
})

type ProgressService = {
  get: (signal?: AbortSignal) => Promise<unknown>
  save: (value: unknown, signal?: AbortSignal) => Promise<unknown>
}
const loadService = (http: unknown): ProgressService => {
  const source = readFileSync(new URL('../src/services/bibleReadingProgressService.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports: { bibleReadingProgressService?: ProgressService } = {}
  new Function('require', 'exports', code)((name: string) => {
    assert.equal(name, './http')
    return { http }
  }, exports)
  return exports.bibleReadingProgressService!
}

test('actual progress service forwards cancellation and preserves payload/404/error behavior', async () => {
  const request = new AbortController()
  const calls: unknown[][] = []
  const service = loadService({
    get: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ data: position }) },
    put: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ data: position }) },
  })
  assert.deepEqual(await service.get(request.signal), position)
  assert.deepEqual(await service.save(position, request.signal), position)
  assert.deepEqual(calls, [
    ['/api/me/bible-reading-progress', { signal: request.signal }],
    ['/api/me/bible-reading-progress', position, { signal: request.signal }],
  ])
  const absent = loadService({ get: () => Promise.reject({ status: 404 }) })
  assert.equal(await absent.get(), null)
  const aborted = new Error('fixture canceled request')
  const canceled = loadService({ get: () => Promise.reject(aborted) })
  await assert.rejects(canceled.get(request.signal), (error) => error === aborted)
})
