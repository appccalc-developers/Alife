import { createHmac } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

import {
  EVENT_RESET_DO_SIGNATURE_HEADER,
  EXPECTED_SCHEMA_EPOCH,
  EXPECTED_WORKER_SCRIPT,
  MAX_PURGE_BATCH_SIZE,
  contextFromEnvironment,
  sha256,
  validateApprovedPreview,
} from './reset-event-durable-objects.mjs'

const EVIDENCE_FILE = 'durable-objects-direct-empty-verify.json'

async function readResponse(response, operation) {
  let body
  try { body = await response.json() }
  catch { throw new Error(`${operation} returned an invalid response (${response.status}).`) }
  if (!response.ok) throw new Error(`${operation} failed (${response.status}).`)
  return body
}

export async function verifyApprovedObjectsDirect(context, preview) {
  const approved = validateApprovedPreview(context, preview, context.approvedFingerprint)
  const status = await readResponse(await context.fetchImpl(`${context.speedUrl}/api/internal/event-reset/status`, {
    headers: { Authorization: `Bearer ${context.speedToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  }), 'Speed Layer freeze status')
  if (status.ready !== true || status.frozen !== true || status.resetEpoch !== context.resetEpoch ||
      status.schemaEpoch !== EXPECTED_SCHEMA_EPOCH || status.dataEpoch !== context.resetEpoch) {
    throw new Error('The Speed Layer is not frozen at the approved Event reset epoch.')
  }

  const receipts = []
  let batchIndex = 0
  let verifiedEmptyCount = 0
  for (const namespace of approved.inventory.namespaces) {
    const ids = namespace.objects.map(object => object.id)
    for (let offset = 0; offset < ids.length; offset += MAX_PURGE_BATCH_SIZE) {
      const objectIds = ids.slice(offset, offset + MAX_PURGE_BATCH_SIZE)
      const body = {
        operation: 'verify-empty',
        resetRunId: context.resetRunId,
        resetEpoch: context.resetEpoch,
        schemaEpoch: EXPECTED_SCHEMA_EPOCH,
        dataEpoch: context.resetEpoch,
        workerScript: EXPECTED_WORKER_SCRIPT,
        className: namespace.className,
        namespace: namespace.namespace,
        namespaceId: namespace.namespaceId,
        approvedFingerprint: approved.fingerprint,
        batchIndex,
        batchHash: sha256(objectIds),
        objectIds,
      }
      const rawBody = JSON.stringify(body)
      const signature = createHmac('sha256', context.doToken).update(rawBody).digest('hex')
      const receipt = await readResponse(await context.fetchImpl(context.purgeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          [EVENT_RESET_DO_SIGNATURE_HEADER]: signature,
        },
        body: rawBody,
        signal: AbortSignal.timeout(30_000),
      }), `Direct Durable Object empty verification batch ${batchIndex}`)
      if (receipt.verified !== true || receipt.operation !== 'verify-empty' ||
          receipt.resetRunId !== body.resetRunId || receipt.resetEpoch !== body.resetEpoch ||
          receipt.schemaEpoch !== body.schemaEpoch || receipt.dataEpoch !== body.dataEpoch ||
          receipt.workerScript !== body.workerScript || receipt.className !== body.className ||
          receipt.namespace !== body.namespace || receipt.namespaceId !== body.namespaceId ||
          receipt.approvedFingerprint !== body.approvedFingerprint || receipt.batchIndex !== batchIndex ||
          receipt.batchHash !== body.batchHash || receipt.requestedCount !== objectIds.length ||
          receipt.emptyCount !== objectIds.length || receipt.purgedCount !== 0 ||
          !Array.isArray(receipt.failures) || receipt.failures.length !== 0) {
        throw new Error(`Direct Durable Object empty verification batch ${batchIndex} returned an incomplete receipt.`)
      }
      receipts.push({
        className: namespace.className,
        namespaceId: namespace.namespaceId,
        batchIndex,
        batchHash: body.batchHash,
        emptyCount: receipt.emptyCount,
        receiptHash: sha256(receipt),
      })
      verifiedEmptyCount += receipt.emptyCount
      batchIndex += 1
    }
  }
  if (verifiedEmptyCount !== approved.inventory.objectCount) {
    throw new Error('Direct Durable Object empty verification omitted an approved object.')
  }
  return {
    contract: 'alife.event-durable-object-reset.direct-empty-verify.v1',
    generatedAtUtc: new Date().toISOString(),
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    approvedFingerprint: approved.fingerprint,
    approvedNamespaceIdentityHash: approved.namespaceIdentityHash,
    approvedObjectCount: approved.inventory.objectCount,
    verifiedEmptyCount,
    batchCount: receipts.length,
    receiptHash: sha256(receipts),
    receipts,
    verified: true,
  }
}

async function main() {
  const context = contextFromEnvironment()
  const preview = JSON.parse(await readFile(path.join(context.evidenceDir, 'durable-objects-preview.json'), 'utf8'))
  const evidence = await verifyApprovedObjectsDirect(context, preview)
  await writeFile(path.join(context.evidenceDir, EVIDENCE_FILE), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  console.log(`Direct Event Durable Object storage verification: empty=${evidence.verifiedEmptyCount} batches=${evidence.batchCount} evidence=${EVIDENCE_FILE}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Direct Durable Object empty verification failed.'}\n`)
    process.exitCode = 1
  })
}
