import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

import {
  EXPECTED_ACCOUNT_ID,
  EVENT_RESET_DO_SIGNATURE_HEADER,
  approvalPayload,
  collectInventory,
  contextFromEnvironment,
  inventoryFingerprint,
  listNamespaces,
  listNamespaceObjects,
  purgeBatch,
  runApply,
  runPreview,
  runVerify,
  selectEventNamespaces,
  stableEmptyScans,
  stableJson,
} from './reset-event-durable-objects.mjs'

const ids = {
  EnrollmentSession: '1'.repeat(32),
  EventPlanningSession: '2'.repeat(32),
  ReviewSession: '3'.repeat(32),
}

const doToken = 'd'.repeat(32)
const testEvidenceDirs = []

after(async () => {
  await Promise.all(testEvidenceDirs.map(directory => rm(directory, { force: true, recursive: true })))
})

function namespace(className) {
  return {
    id: ids[className],
    class: className,
    name: className,
    script: 'app-ccalc',
    use_sqlite: true,
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function objectId(value) {
  return value.toString(16).padStart(64, '0')
}

async function createResetHarness(initialObjects = {}, { onPurge } = {}) {
  const evidenceDir = await mkdtemp(path.join(process.cwd(), '.alife-do-reset-test-'))
  testEvidenceDirs.push(evidenceDir)
  const state = {
    namespaces: [namespace('EnrollmentSession'), namespace('EventPlanningSession'), namespace('ReviewSession')],
    objects: new Map(),
    purgeCalls: [],
  }
  for (const className of Object.keys(ids)) {
    state.objects.set(className, new Map(
      (initialObjects[className] ?? []).map(object => [object.id, object.hasStoredData]),
    ))
  }

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input)
    if (url.pathname === '/api/internal/event-reset/status') {
      return json({
        ready: true,
        frozen: true,
        resetEpoch: 'epoch-1',
        schemaEpoch: '2.0.0',
        dataEpoch: 'epoch-1',
      })
    }
    if (url.pathname === '/api/internal/event-reset/durable-objects') {
      const expectedSignature = createHmac('sha256', doToken).update(init.body).digest('hex')
      assert.equal(init.headers.Authorization, undefined)
      assert.equal(init.headers[EVENT_RESET_DO_SIGNATURE_HEADER], expectedSignature)
      const body = JSON.parse(init.body)
      state.purgeCalls.push(structuredClone(body))
      const customResponse = await onPurge?.({ body, state })
      if (customResponse) return customResponse
      const objects = state.objects.get(body.className)
      for (const id of body.objectIds) {
        if (objects?.has(id)) objects.set(id, false)
      }
      return json({
        verified: true,
        operation: body.operation,
        resetRunId: body.resetRunId,
        resetEpoch: body.resetEpoch,
        schemaEpoch: body.schemaEpoch,
        dataEpoch: body.dataEpoch,
        workerScript: body.workerScript,
        className: body.className,
        namespace: body.namespace,
        namespaceId: body.namespaceId,
        approvedFingerprint: body.approvedFingerprint,
        batchIndex: body.batchIndex,
        batchHash: body.batchHash,
        requestedCount: body.objectIds.length,
        purgedCount: body.objectIds.length,
        failures: [],
      })
    }
    if (url.pathname.endsWith('/workers/durable_objects/namespaces')) {
      return json({
        success: true,
        result: structuredClone(state.namespaces),
        result_info: {
          count: state.namespaces.length,
          page: 1,
          total_count: state.namespaces.length,
          total_pages: state.namespaces.length === 0 ? 0 : 1,
        },
      })
    }
    if (url.pathname.endsWith('/objects')) {
      const namespaceId = url.pathname.split('/').at(-2)
      const target = state.namespaces.find(item => item.id === namespaceId)
      const objects = [...(state.objects.get(target?.class) ?? new Map()).entries()]
        .map(([id, hasStoredData]) => ({ id, hasStoredData }))
        .sort((left, right) => left.id.localeCompare(right.id))
      return json({
        success: true,
        result: objects,
        result_info: { count: objects.length, page: 1, total_count: objects.length },
      })
    }
    throw new Error(`Unexpected test request: ${url}`)
  }

  const context = {
    accountId: EXPECTED_ACCOUNT_ID,
    apiToken: 'cloudflare-api-token',
    apiBaseUrl: 'https://api.example.test/client/v4',
    speedUrl: 'https://speed.example.test',
    speedToken: 's'.repeat(32),
    doToken,
    purgeUrl: 'https://speed.example.test/api/internal/event-reset/durable-objects',
    evidenceDir,
    resetRunId: 'reset-1',
    resetEpoch: 'epoch-1',
    codeSha: 'c'.repeat(40),
    approvedFingerprint: '',
    stableScanDelayMs: 0,
    fetchImpl,
  }
  return { context, state }
}

test('selectEventNamespaces accepts only the exact three app-ccalc SQLite classes', () => {
  const selected = selectEventNamespaces([
    namespace('ReviewSession'),
    { ...namespace('EventPlanningSession'), script: 'another-worker' },
    namespace('EnrollmentSession'),
    namespace('EventPlanningSession'),
  ])
  assert.deepEqual(selected.map(item => item.className), [
    'EnrollmentSession',
    'EventPlanningSession',
    'ReviewSession',
  ])
  assert.deepEqual(selected.map(item => item.namespace), [
    'ENROLLMENT_SESSIONS',
    'EVENT_SESSIONS',
    'REVIEW_SESSIONS',
  ])

  assert.throws(
    () => selectEventNamespaces([...selected.map(item => ({
      id: item.namespaceId,
      class: item.className,
      name: item.namespaceName,
      script: 'app-ccalc',
      use_sqlite: item.useSqlite,
    })), { id: '4'.repeat(32), class: 'UnrelatedSession', script: 'app-ccalc', use_sqlite: true }]),
    /exactly 3/,
  )
  assert.throws(
    () => selectEventNamespaces([
      namespace('EnrollmentSession'),
      { ...namespace('EventPlanningSession'), use_sqlite: false },
      namespace('ReviewSession'),
    ]),
    /SQLite/,
  )
})

test('context requires a dedicated Durable Object reset secret', () => {
  const env = {
    CLOUDFLARE_ACCOUNT_ID: EXPECTED_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: 'a'.repeat(20),
    EVENT_RESET_SPEED_URL: 'https://speed.example.test',
    EVENT_RESET_SPEED_TOKEN: 's'.repeat(32),
    EVENT_RESET_DO_TOKEN: doToken,
    EVENT_RESET_RUN_ID: 'reset-1',
    EVENT_RESET_FREEZE_EPOCH: 'epoch-1',
    EVENT_RESET_CODE_SHA: 'c'.repeat(40),
    EVENT_RESET_EVIDENCE_DIR: path.join(tmpdir(), 'alife-do-reset-context'),
  }
  const context = contextFromEnvironment(env, async () => json({}))
  assert.equal(context.doToken, doToken)
  assert.throws(
    () => contextFromEnvironment({ ...env, EVENT_RESET_DO_TOKEN: env.EVENT_RESET_SPEED_TOKEN }),
    /must differ/,
  )
  assert.throws(
    () => contextFromEnvironment({ ...env, EVENT_RESET_DO_TOKEN: 'short' }),
    /invalid length/,
  )
  assert.throws(
    () => contextFromEnvironment({ ...env, EVENT_RESET_DO_TOKEN: 'd'.repeat(4_097) }),
    /invalid length/,
  )
})

test('collectInventory follows namespace pages and opaque object cursors', async () => {
  const objectA = 'a'.repeat(64)
  const objectB = 'b'.repeat(64)
  const calls = []
  const fetchImpl = async input => {
    const url = new URL(input)
    calls.push(url.toString())
    if (url.pathname.endsWith('/workers/durable_objects/namespaces')) {
      const page = Number(url.searchParams.get('page'))
      return page === 1
        ? json({ success: true, result: [namespace('EnrollmentSession'), namespace('EventPlanningSession')], result_info: { count: 2, page: 1, total_count: 3, total_pages: 2 } })
        : json({ success: true, result: [namespace('ReviewSession')], result_info: { count: 1, page: 2, total_count: 3, total_pages: 2 } })
    }
    const namespaceId = url.pathname.split('/').at(-2)
    if (namespaceId === ids.EnrollmentSession) {
      return url.searchParams.has('cursor')
        ? json({ success: true, result: [{ id: objectB, hasStoredData: false }], result_info: { count: 1, page: 2, total_count: 2 } })
        : json({ success: true, result: [{ id: objectA, hasStoredData: true }], result_info: { count: 1, page: 1, total_count: 2, cursor: 'opaque-next' } })
    }
    return json({ success: true, result: [], result_info: { count: 0, page: 1, total_count: 0 } })
  }

  const inventory = await collectInventory({
    accountId: EXPECTED_ACCOUNT_ID,
    apiToken: 'token',
    apiBaseUrl: 'https://api.example.test/client/v4',
    fetchImpl,
  })

  assert.equal(inventory.namespaceCount, 3)
  assert.equal(inventory.objectCount, 2)
  assert.equal(inventory.storedObjectCount, 1)
  assert.equal(inventory.namespaces[0].objects[0].id, objectA)
  assert.equal(inventory.namespaces[0].objects[1].id, objectB)
  assert.equal(calls.filter(value => value.includes('/objects')).length, 4)
})

test('collectInventory accepts current Cloudflare pagination without total_pages or total_count for objects', async () => {
  const calls = []
  const fetchImpl = async input => {
    const url = new URL(input)
    calls.push(url)
    if (url.pathname.endsWith('/workers/durable_objects/namespaces')) {
      return json({
        success: true,
        result: [namespace('EnrollmentSession'), namespace('EventPlanningSession'), namespace('ReviewSession')],
        result_info: { page: 1, count: 3, total_count: 3 },
      })
    }
    const namespaceId = url.pathname.split('/').at(-2)
    const object = namespaceId === ids.EventPlanningSession
      ? { id: objectId(1), hasStoredData: true }
      : { id: objectId(namespaceId === ids.EnrollmentSession ? 2 : 3), hasStoredData: false }
    return url.searchParams.has('cursor')
      ? json({ success: true, result: [], result_info: { count: 0 } })
      : json({ success: true, result: [object], result_info: { count: 1, cursor: 'opaque-last' } })
  }

  const inventory = await collectInventory({
    accountId: EXPECTED_ACCOUNT_ID,
    apiToken: 'token',
    apiBaseUrl: 'https://api.example.test/client/v4',
    fetchImpl,
  })

  assert.equal(inventory.namespaceCount, 3)
  assert.equal(inventory.objectCount, 3)
  assert.equal(inventory.storedObjectCount, 1)
  assert.equal(calls.filter(url => url.pathname.endsWith('/objects')).length, 6)
})

test('approval fingerprint includes every listed object identity and storage flag', () => {
  const context = {
    accountId: EXPECTED_ACCOUNT_ID,
    codeSha: 'c'.repeat(40),
    resetRunId: 'reset-1',
    resetEpoch: 'epoch-1',
  }
  const base = {
    accountId: EXPECTED_ACCOUNT_ID,
    workerScript: 'app-ccalc',
    namespaceCount: 3,
    objectCount: 2,
    storedObjectCount: 1,
    namespaces: [
      {
        className: 'EnrollmentSession',
        namespace: 'ENROLLMENT_SESSIONS',
        namespaceId: ids.EnrollmentSession,
        namespaceName: 'EnrollmentSession',
        useSqlite: true,
        objectCount: 2,
        storedObjectCount: 1,
        objects: [
          { id: 'a'.repeat(64), hasStoredData: true },
          { id: 'b'.repeat(64), hasStoredData: false },
        ],
      },
      ...['EventPlanningSession', 'ReviewSession'].map(className => ({
        className,
        namespace: className === 'EventPlanningSession' ? 'EVENT_SESSIONS' : 'REVIEW_SESSIONS',
        namespaceId: ids[className],
        namespaceName: className,
        useSqlite: true,
        objectCount: 0,
        storedObjectCount: 0,
        objects: [],
      })),
    ],
  }
  const withDifferentEmptyIdentity = structuredClone(base)
  withDifferentEmptyIdentity.namespaces[0].objects[1].id = 'd'.repeat(64)
  assert.notEqual(inventoryFingerprint(context, base), inventoryFingerprint(context, withDifferentEmptyIdentity))
  assert.match(inventoryFingerprint(context, base), /^[0-9a-f]{64}$/)
  assert.equal(stableJson(approvalPayload(context, base)), stableJson(approvalPayload(context, structuredClone(base))))
})

test('stable empty scans allow cleared identities to disappear while namespace identities stay fixed', async () => {
  let eventObjectScan = 0
  const fetchImpl = async input => {
    const url = new URL(input)
    if (url.pathname.endsWith('/workers/durable_objects/namespaces')) {
      return json({
        success: true,
        result: [namespace('EnrollmentSession'), namespace('EventPlanningSession'), namespace('ReviewSession')],
        result_info: { count: 3, page: 1, total_count: 3, total_pages: 1 },
      })
    }
    const namespaceId = url.pathname.split('/').at(-2)
    if (namespaceId === ids.EventPlanningSession && eventObjectScan++ === 0) {
      return json({ success: true, result: [{ id: 'e'.repeat(64), hasStoredData: false }], result_info: { count: 1, page: 1, total_count: 1 } })
    }
    return json({ success: true, result: [], result_info: { count: 0, page: 1, total_count: 0 } })
  }
  const result = await stableEmptyScans({
    accountId: EXPECTED_ACCOUNT_ID,
    apiToken: 'token',
    apiBaseUrl: 'https://api.example.test/client/v4',
    codeSha: 'c'.repeat(40),
    resetRunId: 'reset-1',
    resetEpoch: 'epoch-1',
    fetchImpl,
  }, 0)

  assert.equal(result.first.storedObjectCount, 0)
  assert.equal(result.second.storedObjectCount, 0)
  assert.notEqual(result.firstScanHash, result.secondScanHash)
  assert.match(result.namespaceIdentityHash, /^[0-9a-f]{64}$/)
})

test('purge batch binds the exact reset epoch, namespace identity, and approved fingerprint', async () => {
  const objectIds = ['a'.repeat(64), 'b'.repeat(64)]
  const approvedFingerprint = 'f'.repeat(64)
  const namespaceTarget = {
    className: 'EventPlanningSession',
    namespace: 'EVENT_SESSIONS',
    namespaceId: ids.EventPlanningSession,
  }
  const context = {
    purgeUrl: 'https://speed.example.test/api/internal/event-reset/durable-objects',
    speedToken: 's'.repeat(32),
    doToken,
    resetRunId: 'reset-1',
    resetEpoch: 'epoch-1',
    fetchImpl: async (_input, init) => {
      const expectedSignature = createHmac('sha256', doToken).update(init.body).digest('hex')
      assert.equal(init.headers.Authorization, undefined)
      assert.equal(init.headers[EVENT_RESET_DO_SIGNATURE_HEADER], expectedSignature)
      const body = JSON.parse(init.body)
      assert.equal(body.dataEpoch, body.resetEpoch)
      assert.equal(body.namespace, namespaceTarget.namespace)
      assert.deepEqual(body.objectIds, objectIds)
      assert.equal(body.approvedFingerprint, approvedFingerprint)
      return json({
        verified: true,
        operation: body.operation,
        resetRunId: body.resetRunId,
        resetEpoch: body.resetEpoch,
        schemaEpoch: body.schemaEpoch,
        dataEpoch: body.dataEpoch,
        workerScript: body.workerScript,
        className: body.className,
        namespace: body.namespace,
        namespaceId: body.namespaceId,
        approvedFingerprint: body.approvedFingerprint,
        batchIndex: body.batchIndex,
        batchHash: body.batchHash,
        requestedCount: body.objectIds.length,
        purgedCount: body.objectIds.length,
        failures: [],
      })
    },
  }
  const receipt = await purgeBatch(context, namespaceTarget, objectIds, approvedFingerprint, 0)
  assert.equal(receipt.purgedCount, 2)
})

test('object inventory fails closed on incomplete cursor and changing pagination metadata', async () => {
  const base = {
    accountId: EXPECTED_ACCOUNT_ID,
    apiToken: 'token',
    namespaceId: ids.EventPlanningSession,
    apiBaseUrl: 'https://api.example.test/client/v4',
  }
  await assert.rejects(
    listNamespaceObjects({
      ...base,
      fetchImpl: async () => json({
        success: true,
        result: [{ id: objectId(1), hasStoredData: true }],
        result_info: { count: 1, page: 1, total_count: 2 },
      }),
    }),
    /omitted the cursor/,
  )

  await assert.rejects(
    listNamespaceObjects({
      ...base,
      fetchImpl: async () => json({
        success: true,
        result: [{ id: objectId(1), hasStoredData: true }],
        result_info: { count: 1 },
      }),
    }),
    /omitted the cursor/,
  )

  let page = 0
  await assert.rejects(
    listNamespaceObjects({
      ...base,
      fetchImpl: async () => {
        page += 1
        return page === 1
          ? json({
              success: true,
              result: [{ id: objectId(1), hasStoredData: true }],
              result_info: { count: 1, page: 1, total_count: 2, cursor: 'next' },
            })
          : json({
              success: true,
              result: [{ id: objectId(2), hasStoredData: true }],
              result_info: { count: 1, page: 2, total_count: 3 },
            })
      },
    }),
    /total_count changed/,
  )

  await assert.rejects(
    listNamespaceObjects({
      ...base,
      fetchImpl: async () => json({
        success: true,
        result: [],
        result_info: { count: 0, page: 2, total_count: 0 },
      }),
    }),
    /inconsistent pagination metadata/,
  )
})

test('namespace inventory fails closed when total_pages changes', async () => {
  let page = 0
  await assert.rejects(
    listNamespaces({
      accountId: EXPECTED_ACCOUNT_ID,
      apiToken: 'token',
      apiBaseUrl: 'https://api.example.test/client/v4',
      fetchImpl: async () => {
        page += 1
        return page === 1
          ? json({
              success: true,
              result: [namespace('EnrollmentSession')],
              result_info: { count: 1, page: 1, total_count: 3, total_pages: 3 },
            })
          : json({
              success: true,
              result: [namespace('EventPlanningSession'), namespace('ReviewSession')],
              result_info: { count: 2, page: 2, total_count: 3, total_pages: 2 },
            })
      },
    }),
    /total_pages changed/,
  )
})

test('preview, apply, and verify require the approved namespace identities', async () => {
  const { context, state } = await createResetHarness()
  const reviewNamespace = state.namespaces.pop()
  await assert.rejects(runPreview(context), /Expected exactly 3/)

  state.namespaces.push(reviewNamespace, {
    id: '4'.repeat(32),
    class: 'UnexpectedSession',
    name: 'UnexpectedSession',
    script: 'app-ccalc',
    use_sqlite: true,
  })
  await assert.rejects(runPreview(context), /Expected exactly 3/)

  state.namespaces.pop()
  const preview = await runPreview(context)
  context.approvedFingerprint = preview.fingerprint
  const planningNamespace = state.namespaces.find(item => item.class === 'EventPlanningSession')
  planningNamespace.id = '9'.repeat(32)
  await assert.rejects(runApply(context), /namespace identity no longer matches/)

  planningNamespace.id = ids.EventPlanningSession
  await runApply(context)
  state.namespaces.push({
    id: '4'.repeat(32),
    class: 'UnexpectedSession',
    name: 'UnexpectedSession',
    script: 'app-ccalc',
    use_sqlite: true,
  })
  await assert.rejects(runVerify(context), /Expected exactly 3/)
})

test('apply rejects any live object identity absent from the approved preview', async () => {
  const { context, state } = await createResetHarness({
    EventPlanningSession: [{ id: objectId(1), hasStoredData: true }],
  })
  const preview = await runPreview(context)
  context.approvedFingerprint = preview.fingerprint
  state.objects.get('EventPlanningSession').set(objectId(2), false)

  await assert.rejects(runApply(context), /unapproved Durable Object identity/)
  assert.equal(state.purgeCalls.length, 0)
})

test('apply checkpoints completed batches, resumes a partial purge, and remains idempotent', async () => {
  let failSecondBatch = true
  const objects = Array.from({ length: 52 }, (_, index) => ({
    id: objectId(index + 1),
    hasStoredData: true,
  }))
  const { context, state } = await createResetHarness(
    { EventPlanningSession: objects },
    {
      onPurge: async ({ body, state: mutableState }) => {
        if (failSecondBatch && body.batchIndex === 1) {
          failSecondBatch = false
          mutableState.objects.get(body.className).set(body.objectIds[0], false)
          return json({ success: false, errors: [{ code: 1099 }] }, 409)
        }
        return null
      },
    },
  )
  const preview = await runPreview(context)
  context.approvedFingerprint = preview.fingerprint

  await assert.rejects(runApply(context), /Durable Object purge batch failed/)
  const partialCheckpoint = JSON.parse(await readFile(
    path.join(context.evidenceDir, 'durable-objects-purge-receipts.json'),
    'utf8',
  ))
  assert.equal(partialCheckpoint.receiptCount, 1)
  assert.equal(partialCheckpoint.receipts[0].objectIds.length, 50)

  const resumed = await runApply(context)
  assert.equal(resumed.verified, true)
  assert.equal(resumed.requestedObjectCount, 52)
  assert.equal(resumed.pendingStoredObjectCountBeforeApply, 1)
  assert.equal(resumed.alreadyEmptyObjectCountBeforeApply, 51)
  assert.equal(resumed.purgedThisRunObjectCount, 1)
  assert.equal(resumed.batchCount, 2)
  assert.deepEqual(state.purgeCalls.map(call => call.objectIds.length), [50, 2, 1])

  const finalCheckpoint = JSON.parse(await readFile(
    path.join(context.evidenceDir, 'durable-objects-purge-receipts.json'),
    'utf8',
  ))
  assert.equal(finalCheckpoint.receiptCount, 2)
  assert.equal(finalCheckpoint.receipts[1].batchIndex, 1)
  assert.deepEqual(finalCheckpoint.receipts[1].objectIds, [objectId(52)])

  const purgeCallsAfterResume = state.purgeCalls.length
  const repeatedApply = await runApply(context)
  assert.equal(repeatedApply.verified, true)
  assert.equal(repeatedApply.purgedThisRunObjectCount, 0)
  assert.equal(repeatedApply.batchCount, 2)
  assert.equal(state.purgeCalls.length, purgeCallsAfterResume)

  const approvedFingerprint = context.approvedFingerprint
  context.approvedFingerprint = 'f'.repeat(64)
  await assert.rejects(runVerify(context), /does not match this reset run/)
  context.approvedFingerprint = approvedFingerprint
  const firstVerify = await runVerify(context)
  const secondVerify = await runVerify(context)
  assert.equal(firstVerify.verified, true)
  assert.equal(secondVerify.verified, true)
  assert.equal(state.purgeCalls.length, purgeCallsAfterResume)
})

test('apply accepts approved identities that are already empty or disappeared, and verify rejects later additions', async () => {
  const { context, state } = await createResetHarness({
    EnrollmentSession: [
      { id: objectId(1), hasStoredData: true },
      { id: objectId(2), hasStoredData: true },
      { id: objectId(3), hasStoredData: true },
    ],
  })
  const preview = await runPreview(context)
  context.approvedFingerprint = preview.fingerprint
  state.objects.get('EnrollmentSession').set(objectId(1), false)
  state.objects.get('EnrollmentSession').delete(objectId(2))

  const apply = await runApply(context)
  assert.equal(apply.requestedObjectCount, 3)
  assert.equal(apply.pendingStoredObjectCountBeforeApply, 1)
  assert.equal(apply.alreadyEmptyObjectCountBeforeApply, 1)
  assert.equal(apply.disappearedObjectCountBeforeApply, 1)
  assert.deepEqual(state.purgeCalls.map(call => call.objectIds), [[objectId(3)]])

  await runVerify(context)
  state.objects.get('EnrollmentSession').set(objectId(4), false)
  await assert.rejects(runVerify(context), /unapproved Durable Object identity/)
})
