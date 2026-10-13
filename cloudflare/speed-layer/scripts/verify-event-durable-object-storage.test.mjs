import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import {
  EVENT_RESET_DO_SIGNATURE_HEADER,
  EXPECTED_ACCOUNT_ID,
  EXPECTED_BINDINGS,
  EXPECTED_CLASSES,
  inventoryFingerprint,
  namespaceIdentityHash,
  sha256,
} from './reset-event-durable-objects.mjs'
import { verifyApprovedObjectsDirect } from './verify-event-durable-object-storage.mjs'

const doToken = 'd'.repeat(32)
const objectId = 'a'.repeat(64)
const context = {
  accountId: EXPECTED_ACCOUNT_ID,
  codeSha: 'c'.repeat(40),
  resetRunId: 'run-42',
  resetEpoch: 'epoch-42',
  speedUrl: 'https://speed.example.test',
  purgeUrl: 'https://speed.example.test/api/internal/event-reset/durable-objects',
  speedToken: 's'.repeat(32),
  doToken,
}
const inventory = {
  accountId: EXPECTED_ACCOUNT_ID,
  workerScript: 'app-ccalc',
  namespaceCount: 3,
  objectCount: 1,
  storedObjectCount: 1,
  namespaces: EXPECTED_CLASSES.map((className, index) => ({
    className,
    namespace: EXPECTED_BINDINGS[className],
    namespaceId: String(index + 1).repeat(32),
    namespaceName: className,
    useSqlite: true,
    objectCount: className === 'EventPlanningSession' ? 1 : 0,
    storedObjectCount: className === 'EventPlanningSession' ? 1 : 0,
    objects: className === 'EventPlanningSession' ? [{ id: objectId, hasStoredData: true }] : [],
  })),
}
const fingerprint = inventoryFingerprint(context, inventory)
const preview = {
  contract: 'alife.event-durable-object-reset.preview.v1',
  codeSha: context.codeSha,
  resetRunId: context.resetRunId,
  resetEpoch: context.resetEpoch,
  schemaEpoch: '2.0.0',
  dataEpoch: context.resetEpoch,
  fingerprint,
  approvedNamespaceIdentityHash: namespaceIdentityHash(inventory),
  inventory: { ...inventory, inventoryHash: sha256(inventory) },
}

test('direct empty verification checks approved objects through signed, read-only requests', async () => {
  const calls = []
  const result = await verifyApprovedObjectsDirect({
    ...context,
    approvedFingerprint: fingerprint,
    async fetchImpl(input, init) {
      const url = new URL(input)
      if (url.pathname.endsWith('/status')) {
        assert.equal(init.headers.Authorization, `Bearer ${context.speedToken}`)
        return Response.json({ ready: true, frozen: true, resetEpoch: context.resetEpoch, schemaEpoch: '2.0.0', dataEpoch: context.resetEpoch })
      }
      const body = JSON.parse(init.body)
      calls.push(body)
      assert.equal(body.operation, 'verify-empty')
      assert.deepEqual(body.objectIds, [objectId])
      assert.equal(init.headers[EVENT_RESET_DO_SIGNATURE_HEADER], createHmac('sha256', doToken).update(init.body).digest('hex'))
      return Response.json({ ...body, verified: true, requestedCount: 1, purgedCount: 0, emptyCount: 1, failures: [] })
    },
  }, preview)

  assert.equal(calls.length, 1)
  assert.equal(result.verified, true)
  assert.equal(result.approvedObjectCount, 1)
  assert.equal(result.verifiedEmptyCount, 1)
  assert.equal(result.batchCount, 1)
  assert.equal(JSON.stringify(result).includes(objectId), false)
})

test('direct empty verification fails closed on an incomplete per-object receipt', async () => {
  await assert.rejects(verifyApprovedObjectsDirect({
    ...context,
    approvedFingerprint: fingerprint,
    async fetchImpl(input, init) {
      const url = new URL(input)
      if (url.pathname.endsWith('/status')) {
        return Response.json({ ready: true, frozen: true, resetEpoch: context.resetEpoch, schemaEpoch: '2.0.0', dataEpoch: context.resetEpoch })
      }
      return Response.json({ ...JSON.parse(init.body), verified: true, requestedCount: 1, purgedCount: 0, emptyCount: 0, failures: [] })
    },
  }, preview), /incomplete receipt/)
})
