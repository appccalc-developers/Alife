import { createHash, createHmac, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export const EXPECTED_ACCOUNT_ID = 'a76a4cf2fe42e20167837ba5fce117d0'
export const EXPECTED_WORKER_SCRIPT = 'app-ccalc'
export const EXPECTED_SCHEMA_EPOCH = '2.0.0'
export const EXPECTED_CLASSES = Object.freeze([
  'EnrollmentSession',
  'EventPlanningSession',
  'ReviewSession',
])
export const EXPECTED_BINDINGS = Object.freeze({
  EnrollmentSession: 'ENROLLMENT_SESSIONS',
  EventPlanningSession: 'EVENT_SESSIONS',
  ReviewSession: 'REVIEW_SESSIONS',
})
export const MAX_PURGE_BATCH_SIZE = 50
export const EVENT_RESET_DO_SIGNATURE_HEADER = 'x-alife-event-reset-do-signature'

const DEFAULT_CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
const DEFAULT_PURGE_PATH = '/api/internal/event-reset/durable-objects'
const HEX_32 = /^[0-9a-f]{32}$/
const HEX_40 = /^[0-9a-f]{40}$/
const HEX_64 = /^[0-9a-f]{64}$/
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/
const NAMESPACE_PAGE_SIZE = 1000
const MAX_NAMESPACE_PAGES = 100
const OBJECT_PAGE_SIZE = 10_000
const MAX_OBJECT_PAGES = 10_000

function required(value, name) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw new Error(`${name} is required.`)
  return normalized
}

function normalizeUrl(value, name) {
  const url = new URL(required(value, name))
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && url.protocol === 'http:')) {
    throw new Error(`${name} must use HTTPS.`)
  }
  return url.toString().replace(/\/$/, '')
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
  }
  return value
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex')
}

async function readJsonResponse(response, operation) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`${operation} returned a non-JSON response (${response.status}).`)
  }
  if (!response.ok || payload?.success === false) {
    const code = Array.isArray(payload?.errors) && payload.errors[0]?.code
    throw new Error(`${operation} failed (${response.status}${code ? `, code ${code}` : ''}).`)
  }
  return payload
}

async function requestJson(url, options, operation, fetchImpl, retries = 3) {
  for (let attempt = 0; ; attempt += 1) {
    let response
    try {
      response = await fetchImpl(url, { ...options, signal: options.signal ?? AbortSignal.timeout(30_000) })
    } catch (error) {
      if (attempt >= retries) throw error
      await new Promise(resolve => setTimeout(resolve, Math.min(500 * (2 ** attempt), 4_000)))
      continue
    }
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, Math.min(500 * (2 ** attempt), 4_000)))
      continue
    }
    return await readJsonResponse(response, operation)
  }
}

function cloudflareHeaders(apiToken) {
  return { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }
}

export async function listNamespaces({ accountId, apiToken, apiBaseUrl = DEFAULT_CLOUDFLARE_API, fetchImpl = fetch }) {
  const namespaces = []
  let expectedTotalCount = null
  let expectedTotalPages
  for (let page = 1; page <= MAX_NAMESPACE_PAGES; page += 1) {
    const url = new URL(`${apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/workers/durable_objects/namespaces`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(NAMESPACE_PAGE_SIZE))
    const payload = await requestJson(url, { headers: cloudflareHeaders(apiToken) }, 'Durable Object namespace inventory', fetchImpl)
    if (!Array.isArray(payload.result)) throw new Error('Durable Object namespace inventory omitted its result array.')
    const info = payload.result_info
    const totalCount = Number(info?.total_count)
    const totalPages = info?.total_pages === undefined ? null : Number(info.total_pages)
    const responsePage = Number(info?.page)
    const count = Number(info?.count)
    if (!Number.isSafeInteger(totalCount) || totalCount < 0 ||
        (totalPages !== null && (!Number.isSafeInteger(totalPages) || totalPages < 0 || totalPages > MAX_NAMESPACE_PAGES ||
          (totalCount === 0) !== (totalPages === 0))) ||
        !Number.isSafeInteger(responsePage) || responsePage !== page ||
        (totalPages !== null && totalPages > 0 && responsePage > totalPages) ||
        !Number.isSafeInteger(count) || count !== payload.result.length) {
      throw new Error('Durable Object namespace inventory returned inconsistent pagination metadata.')
    }
    if (expectedTotalCount === null) expectedTotalCount = totalCount
    else if (expectedTotalCount !== totalCount) throw new Error('Durable Object namespace inventory total_count changed between pages.')
    if (expectedTotalPages === undefined) expectedTotalPages = totalPages
    else if (expectedTotalPages !== totalPages) throw new Error('Durable Object namespace inventory total_pages changed between pages.')
    namespaces.push(...payload.result)
    if (namespaces.length > totalCount) throw new Error('Durable Object namespace inventory exceeded total_count.')
    if (totalCount === 0) {
      if (page !== 1 || payload.result.length !== 0) {
        throw new Error('Durable Object namespace inventory returned an invalid empty page.')
      }
      return namespaces
    }
    if (namespaces.length === totalCount) {
      if (totalPages !== null && page !== totalPages) {
        throw new Error('Durable Object namespace inventory did not match total_pages.')
      }
      return namespaces
    }
    if (totalPages !== null && page >= totalPages) {
      throw new Error('Durable Object namespace inventory did not reach total_count.')
    }
    if (payload.result.length === 0) throw new Error('Durable Object namespace inventory ended before total_pages.')
  }
  throw new Error('Durable Object namespace inventory exceeded its pagination guard.')
}

export function selectEventNamespaces(namespaces) {
  const owned = namespaces.filter(namespace => namespace?.script === EXPECTED_WORKER_SCRIPT)
  if (owned.length !== EXPECTED_CLASSES.length) {
    throw new Error(`Expected exactly ${EXPECTED_CLASSES.length} ${EXPECTED_WORKER_SCRIPT} Durable Object namespaces; found ${owned.length}.`)
  }
  const byClass = new Map()
  for (const namespace of owned) {
    if (!EXPECTED_CLASSES.includes(namespace.class)) {
      throw new Error(`The ${EXPECTED_WORKER_SCRIPT} Worker owns an unexpected Durable Object class.`)
    }
    if (byClass.has(namespace.class)) throw new Error('A target Durable Object class has more than one namespace.')
    if (namespace.use_sqlite !== true) throw new Error('Every target Durable Object namespace must use SQLite storage.')
    if (typeof namespace.id !== 'string' || !HEX_32.test(namespace.id)) {
      throw new Error('A target Durable Object namespace has an invalid identifier.')
    }
    byClass.set(namespace.class, {
      className: namespace.class,
      namespace: EXPECTED_BINDINGS[namespace.class],
      namespaceId: namespace.id,
      namespaceName: typeof namespace.name === 'string' ? namespace.name : '',
      useSqlite: true,
    })
  }
  for (const className of EXPECTED_CLASSES) {
    if (!byClass.has(className)) throw new Error('A required Event Durable Object namespace is missing.')
  }
  return EXPECTED_CLASSES.map(className => byClass.get(className))
}

export async function listNamespaceObjects({ accountId, apiToken, namespaceId, apiBaseUrl = DEFAULT_CLOUDFLARE_API, fetchImpl = fetch }) {
  const objects = []
  const seenIds = new Set()
  const seenCursors = new Set()
  let cursor = ''
  let expectedTotalCount
  for (let pageIndex = 0; pageIndex < MAX_OBJECT_PAGES; pageIndex += 1) {
    const url = new URL(`${apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/workers/durable_objects/namespaces/${encodeURIComponent(namespaceId)}/objects`)
    url.searchParams.set('limit', String(OBJECT_PAGE_SIZE))
    if (cursor) url.searchParams.set('cursor', cursor)
    const payload = await requestJson(url, { headers: cloudflareHeaders(apiToken) }, 'Durable Object instance inventory', fetchImpl)
    if (!Array.isArray(payload.result)) throw new Error('Durable Object instance inventory omitted its result array.')
    const info = payload.result_info
    const totalCount = info?.total_count === undefined ? null : Number(info.total_count)
    const count = Number(info?.count)
    const responsePage = info?.page === undefined ? pageIndex + 1 : Number(info.page)
    if ((totalCount !== null && (!Number.isSafeInteger(totalCount) || totalCount < 0)) ||
        !Number.isSafeInteger(count) || count !== payload.result.length ||
        !Number.isSafeInteger(responsePage) || responsePage !== pageIndex + 1) {
      throw new Error('Durable Object instance inventory returned inconsistent pagination metadata.')
    }
    if (expectedTotalCount === undefined) expectedTotalCount = totalCount
    else if (expectedTotalCount !== totalCount) throw new Error('Durable Object instance inventory total_count changed between pages.')
    for (const object of payload.result) {
      if (typeof object?.id !== 'string' || !HEX_64.test(object.id)) {
        throw new Error('A Durable Object instance has an invalid identifier.')
      }
      if (typeof object.hasStoredData !== 'boolean') {
        throw new Error('A Durable Object instance omitted hasStoredData.')
      }
      if (seenIds.has(object.id)) throw new Error('Durable Object pagination returned a duplicate instance.')
      seenIds.add(object.id)
      objects.push({ id: object.id, hasStoredData: object.hasStoredData })
    }
    if (totalCount !== null && objects.length > totalCount) throw new Error('Durable Object instance inventory exceeded total_count.')
    if (payload.result.length === 0) {
      if (totalCount !== null && objects.length !== totalCount) {
        throw new Error('Durable Object instance inventory ended before total_count.')
      }
      objects.sort((left, right) => left.id.localeCompare(right.id))
      return objects
    }
    if (totalCount !== null && objects.length === totalCount) {
      objects.sort((left, right) => left.id.localeCompare(right.id))
      return objects
    }
    const nextCursor = payload.result_info?.cursor || payload.result_info?.cursors?.after || ''
    if (typeof nextCursor !== 'string' || seenCursors.has(nextCursor)) {
      throw new Error('Durable Object instance pagination returned an invalid or repeated cursor.')
    }
    if (!nextCursor) throw new Error('Durable Object instance inventory omitted the cursor before total_count.')
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }
  throw new Error('Durable Object instance inventory exceeded its pagination guard.')
}

export async function collectInventory(options) {
  const namespaces = selectEventNamespaces(await listNamespaces(options))
  const inventories = []
  for (const namespace of namespaces) {
    const objects = await listNamespaceObjects({ ...options, namespaceId: namespace.namespaceId })
    inventories.push({
      ...namespace,
      objectCount: objects.length,
      storedObjectCount: objects.filter(object => object.hasStoredData).length,
      objects,
    })
  }
  return {
    accountId: options.accountId,
    workerScript: EXPECTED_WORKER_SCRIPT,
    namespaceCount: inventories.length,
    objectCount: inventories.reduce((sum, namespace) => sum + namespace.objectCount, 0),
    storedObjectCount: inventories.reduce((sum, namespace) => sum + namespace.storedObjectCount, 0),
    namespaces: inventories,
  }
}

export function approvalPayload(context, inventory) {
  return {
    contract: 'alife.event-durable-object-reset.v1',
    accountId: context.accountId,
    workerScript: EXPECTED_WORKER_SCRIPT,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    dataEpoch: context.resetEpoch,
    namespaces: inventory.namespaces.map(namespace => ({
      className: namespace.className,
      namespace: namespace.namespace,
      namespaceId: namespace.namespaceId,
      useSqlite: namespace.useSqlite,
      objects: namespace.objects.map(object => ({ id: object.id, hasStoredData: object.hasStoredData })),
    })),
  }
}

export function inventoryFingerprint(context, inventory) {
  return sha256(approvalPayload(context, inventory))
}

function evidenceInventory(inventory) {
  return {
    ...inventory,
    inventoryHash: sha256(inventory),
  }
}

function inventoryWithoutHash(inventory) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new Error('Durable Object evidence omitted its inventory.')
  }
  const { inventoryHash: _inventoryHash, ...value } = inventory
  return value
}

function validateInventory(inventory, expectedAccountId) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) ||
      inventory.accountId !== expectedAccountId || inventory.workerScript !== EXPECTED_WORKER_SCRIPT ||
      !Array.isArray(inventory.namespaces) || inventory.namespaces.length !== EXPECTED_CLASSES.length) {
    throw new Error('Durable Object inventory does not describe the exact protected target.')
  }

  const classes = new Set()
  let objectCount = 0
  let storedObjectCount = 0
  for (let index = 0; index < inventory.namespaces.length; index += 1) {
    const namespace = inventory.namespaces[index]
    const expectedClass = EXPECTED_CLASSES[index]
    if (!namespace || typeof namespace !== 'object' || namespace.className !== expectedClass ||
        namespace.namespace !== EXPECTED_BINDINGS[expectedClass] || !HEX_32.test(namespace.namespaceId ?? '') ||
        namespace.useSqlite !== true || classes.has(namespace.className) || !Array.isArray(namespace.objects)) {
      throw new Error('Durable Object inventory namespace identity is missing, reordered, or invalid.')
    }
    classes.add(namespace.className)

    const ids = new Set()
    let previousId = ''
    for (const object of namespace.objects) {
      if (!object || typeof object !== 'object' || !HEX_64.test(object.id ?? '') ||
          typeof object.hasStoredData !== 'boolean' || ids.has(object.id) ||
          previousId && previousId.localeCompare(object.id) >= 0) {
        throw new Error('Durable Object inventory contains an invalid, duplicate, or unsorted object identity.')
      }
      ids.add(object.id)
      previousId = object.id
      objectCount += 1
      if (object.hasStoredData) storedObjectCount += 1
    }
    if (namespace.objectCount !== namespace.objects.length ||
        namespace.storedObjectCount !== namespace.objects.filter(object => object.hasStoredData).length) {
      throw new Error('Durable Object inventory namespace counts are inconsistent.')
    }
  }

  if (inventory.namespaceCount !== inventory.namespaces.length ||
      inventory.objectCount !== objectCount || inventory.storedObjectCount !== storedObjectCount) {
    throw new Error('Durable Object inventory aggregate counts are inconsistent.')
  }
  return inventory
}

export function namespaceIdentity(inventory) {
  return inventory.namespaces.map(namespace => ({
    className: namespace.className,
    namespace: namespace.namespace,
    namespaceId: namespace.namespaceId,
    useSqlite: namespace.useSqlite,
  }))
}

export function namespaceIdentityHash(inventory) {
  return sha256(namespaceIdentity(inventory))
}

export function validateApprovedPreview(context, preview, approvedFingerprint = preview?.fingerprint) {
  if (preview?.contract !== 'alife.event-durable-object-reset.preview.v1' ||
      preview?.codeSha !== context.codeSha || preview?.resetRunId !== context.resetRunId ||
      preview?.resetEpoch !== context.resetEpoch || preview?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH ||
      preview?.dataEpoch !== context.resetEpoch || !HEX_64.test(approvedFingerprint ?? '') ||
      preview?.fingerprint !== approvedFingerprint) {
    throw new Error('The approved Durable Object preview evidence does not match this reset run.')
  }
  const inventory = inventoryWithoutHash(preview.inventory)
  validateInventory(inventory, context.accountId)
  if (!HEX_64.test(preview.inventory.inventoryHash ?? '') || preview.inventory.inventoryHash !== sha256(inventory)) {
    throw new Error('The approved Durable Object preview inventory hash is invalid.')
  }
  if (inventoryFingerprint(context, inventory) !== approvedFingerprint) {
    throw new Error('The approved Durable Object preview fingerprint does not match its manifest.')
  }
  const identityHash = namespaceIdentityHash(inventory)
  if (preview.approvedNamespaceIdentityHash !== identityHash) {
    throw new Error('The approved Durable Object namespace identity hash is invalid.')
  }
  return { inventory, fingerprint: approvedFingerprint, namespaceIdentityHash: identityHash }
}

export function reconcileApprovedInventory(approvedInventory, currentInventory, { requireEmpty = false } = {}) {
  validateInventory(approvedInventory, approvedInventory.accountId)
  validateInventory(currentInventory, approvedInventory.accountId)
  const approvedIdentityHash = namespaceIdentityHash(approvedInventory)
  if (namespaceIdentityHash(currentInventory) !== approvedIdentityHash) {
    throw new Error('The live Durable Object namespace identity no longer matches the approved preview.')
  }

  const pending = []
  let alreadyEmptyCount = 0
  let disappearedCount = 0
  for (let index = 0; index < approvedInventory.namespaces.length; index += 1) {
    const approvedNamespace = approvedInventory.namespaces[index]
    const currentNamespace = currentInventory.namespaces[index]
    const approvedIds = new Set(approvedNamespace.objects.map(object => object.id))
    const currentIds = new Set()
    for (const object of currentNamespace.objects) {
      if (!approvedIds.has(object.id)) {
        throw new Error(`The live ${currentNamespace.className} namespace contains an unapproved Durable Object identity.`)
      }
      currentIds.add(object.id)
      if (object.hasStoredData) {
        pending.push({
          className: currentNamespace.className,
          namespace: currentNamespace.namespace,
          namespaceId: currentNamespace.namespaceId,
          objectId: object.id,
        })
      } else {
        alreadyEmptyCount += 1
      }
    }
    disappearedCount += approvedNamespace.objects.filter(object => !currentIds.has(object.id)).length
  }
  if (requireEmpty && pending.length > 0) throw new Error('Durable Object storage remains after the purge.')
  return {
    approvedNamespaceIdentityHash: approvedIdentityHash,
    approvedObjectCount: approvedInventory.objectCount,
    currentObjectCount: currentInventory.objectCount,
    pending,
    pendingStoredCount: pending.length,
    alreadyEmptyCount,
    disappearedCount,
  }
}

async function assertFrozen(context) {
  const payload = await requestJson(
    `${context.speedUrl}/api/internal/event-reset/status`,
    { headers: { Authorization: `Bearer ${context.speedToken}`, Accept: 'application/json' } },
    'Speed Layer freeze status',
    context.fetchImpl,
  )
  if (payload?.ready !== true || payload?.frozen !== true || payload?.resetEpoch !== context.resetEpoch ||
      payload?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH || payload?.dataEpoch !== context.resetEpoch) {
    throw new Error('The Speed Layer is not frozen at the exact approved Event reset epoch.')
  }
  return {
    ready: true,
    frozen: true,
    resetEpoch: payload.resetEpoch,
    schemaEpoch: payload.schemaEpoch,
    dataEpoch: payload.dataEpoch,
  }
}

function chunks(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

export async function purgeBatch(context, namespace, objectIds, approvedFingerprint, batchIndex) {
  const body = {
    operation: 'purge',
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    workerScript: EXPECTED_WORKER_SCRIPT,
    className: namespace.className,
    namespace: namespace.namespace,
    namespaceId: namespace.namespaceId,
    approvedFingerprint,
    batchIndex,
    batchHash: sha256(objectIds),
    objectIds,
  }
  const rawBody = JSON.stringify(body)
  const signature = createHmac('sha256', context.doToken).update(rawBody).digest('hex')
  const payload = await requestJson(
    context.purgeUrl,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [EVENT_RESET_DO_SIGNATURE_HEADER]: signature,
      },
      body: rawBody,
    },
    'Durable Object purge batch',
    context.fetchImpl,
  )
  if (payload?.verified !== true || payload?.operation !== 'purge' || payload?.resetRunId !== context.resetRunId ||
      payload?.resetEpoch !== context.resetEpoch || payload?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH ||
      payload?.dataEpoch !== context.resetEpoch ||
      payload?.workerScript !== EXPECTED_WORKER_SCRIPT || payload?.className !== namespace.className ||
      payload?.namespace !== namespace.namespace ||
      payload?.namespaceId !== namespace.namespaceId || payload?.batchHash !== body.batchHash ||
      payload?.approvedFingerprint !== approvedFingerprint || payload?.batchIndex !== batchIndex ||
      payload?.requestedCount !== objectIds.length || payload?.purgedCount !== objectIds.length ||
      !Array.isArray(payload?.failures) || payload.failures.length !== 0) {
    throw new Error('The Durable Object purge endpoint returned an invalid or incomplete receipt.')
  }
  return { ...payload, objectIds: [...objectIds] }
}

async function wait(milliseconds) {
  if (milliseconds > 0) await new Promise(resolve => setTimeout(resolve, milliseconds))
}

export async function stableEmptyScans(context, delayMs = 5_000, approvedInventory = null) {
  const first = await collectInventory(context)
  if (approvedInventory) reconcileApprovedInventory(approvedInventory, first, { requireEmpty: true })
  else if (first.storedObjectCount !== 0) throw new Error('Durable Object storage remains after the purge.')
  await wait(delayMs)
  const second = await collectInventory(context)
  if (approvedInventory) reconcileApprovedInventory(approvedInventory, second, { requireEmpty: true })
  else if (second.storedObjectCount !== 0) throw new Error('Durable Object storage reappeared after the purge.')
  const firstNamespaceHash = namespaceIdentityHash(first)
  const secondNamespaceHash = namespaceIdentityHash(second)
  if (firstNamespaceHash !== secondNamespaceHash) throw new Error('The target Durable Object namespace identities changed between empty scans.')
  return {
    first,
    second,
    firstScanHash: sha256(first),
    secondScanHash: sha256(second),
    namespaceIdentityHash: firstNamespaceHash,
  }
}

async function writeEvidence(context, filename, payload) {
  await mkdir(context.evidenceDir, { recursive: true })
  const targetPath = path.join(context.evidenceDir, filename)
  const temporaryPath = path.join(context.evidenceDir, `.${filename}.${process.pid}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporaryPath, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8' })
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporaryPath, targetPath)
  } catch (error) {
    if (handle) await handle.close().catch(() => {})
    await rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }
}

async function readEvidence(context, filename) {
  return JSON.parse(await readFile(path.join(context.evidenceDir, filename), 'utf8'))
}

async function readEvidenceIfPresent(context, filename) {
  try {
    return await readEvidence(context, filename)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null
    throw error
  }
}

function validateReceiptCheckpoint(context, checkpoint, approved) {
  if (checkpoint?.contract !== 'alife.event-durable-object-reset.receipts.v1' ||
      checkpoint?.codeSha !== context.codeSha || checkpoint?.resetRunId !== context.resetRunId ||
      checkpoint?.resetEpoch !== context.resetEpoch || checkpoint?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH ||
      checkpoint?.dataEpoch !== context.resetEpoch || checkpoint?.approvedFingerprint !== approved.fingerprint ||
      checkpoint?.approvedNamespaceIdentityHash !== approved.namespaceIdentityHash ||
      !Array.isArray(checkpoint?.receipts) || checkpoint.receiptCount !== checkpoint.receipts.length ||
      checkpoint.receiptHash !== sha256(checkpoint.receipts)) {
    throw new Error('The Durable Object purge checkpoint is invalid or belongs to another reset run.')
  }

  const approvedNamespaces = new Map(approved.inventory.namespaces.map(namespace => [namespace.className, namespace]))
  for (let index = 0; index < checkpoint.receipts.length; index += 1) {
    const receipt = checkpoint.receipts[index]
    const namespace = approvedNamespaces.get(receipt?.className)
    const objectIds = receipt?.objectIds
    if (!namespace || receipt?.verified !== true || receipt?.operation !== 'purge' ||
        receipt?.resetRunId !== context.resetRunId || receipt?.resetEpoch !== context.resetEpoch ||
        receipt?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH || receipt?.dataEpoch !== context.resetEpoch ||
        receipt?.workerScript !== EXPECTED_WORKER_SCRIPT || receipt?.namespace !== namespace.namespace ||
        receipt?.namespaceId !== namespace.namespaceId || receipt?.approvedFingerprint !== approved.fingerprint ||
        receipt?.batchIndex !== index || !Array.isArray(objectIds) || objectIds.length === 0 ||
        objectIds.length > MAX_PURGE_BATCH_SIZE || new Set(objectIds).size !== objectIds.length ||
        objectIds.some(id => !HEX_64.test(id) || !namespace.objects.some(object => object.id === id)) ||
        receipt?.batchHash !== sha256(objectIds) || receipt?.requestedCount !== objectIds.length ||
        receipt?.purgedCount !== objectIds.length || !Array.isArray(receipt?.failures) || receipt.failures.length !== 0) {
      throw new Error('A Durable Object purge checkpoint receipt is invalid or outside the approved manifest.')
    }
  }
  return checkpoint.receipts
}

async function readReceiptCheckpoint(context, approved) {
  const checkpoint = await readEvidenceIfPresent(context, 'durable-objects-purge-receipts.json')
  return checkpoint ? [...validateReceiptCheckpoint(context, checkpoint, approved)] : []
}

async function writeReceiptCheckpoint(context, approved, receipts) {
  const checkpoint = {
    contract: 'alife.event-durable-object-reset.receipts.v1',
    generatedAtUtc: new Date().toISOString(),
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    approvedFingerprint: approved.fingerprint,
    approvedNamespaceIdentityHash: approved.namespaceIdentityHash,
    receiptCount: receipts.length,
    receiptHash: sha256(receipts),
    receipts,
  }
  await writeEvidence(context, 'durable-objects-purge-receipts.json', checkpoint)
  return checkpoint
}

function validateEmptyScanEvidence(context, evidence, approved, expectedHash) {
  const inventory = inventoryWithoutHash(evidence)
  validateInventory(inventory, context.accountId)
  if (evidence?.inventoryHash !== sha256(inventory) || sha256(inventory) !== expectedHash) {
    throw new Error('The Durable Object empty-scan evidence hash is invalid.')
  }
  reconcileApprovedInventory(approved.inventory, inventory, { requireEmpty: true })
  return inventory
}

export async function runPreview(context) {
  const freeze = await assertFrozen(context)
  const inventory = await collectInventory(context)
  validateInventory(inventory, context.accountId)
  const fingerprint = inventoryFingerprint(context, inventory)
  const approvedNamespaceIdentityHash = namespaceIdentityHash(inventory)
  const evidence = {
    contract: 'alife.event-durable-object-reset.preview.v1',
    generatedAtUtc: new Date().toISOString(),
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    freeze,
    fingerprint,
    approvedNamespaceIdentityHash,
    inventory: evidenceInventory(inventory),
  }
  await writeEvidence(context, 'durable-objects-preview.json', evidence)
  console.log(`Event Durable Object preview: namespaces=${inventory.namespaceCount} objects=${inventory.objectCount} stored=${inventory.storedObjectCount} fingerprint=${fingerprint}`)
  return evidence
}

export async function runApply(context) {
  const approvedFingerprint = required(context.approvedFingerprint, 'EVENT_RESET_DO_APPROVED_FINGERPRINT')
  if (!HEX_64.test(approvedFingerprint)) throw new Error('EVENT_RESET_DO_APPROVED_FINGERPRINT must be a lowercase SHA-256 hash.')
  const preview = await readEvidence(context, 'durable-objects-preview.json')
  const approved = validateApprovedPreview(context, preview, approvedFingerprint)
  const freezeBefore = await assertFrozen(context)
  const inventory = await collectInventory(context)
  const reconciliation = reconcileApprovedInventory(approved.inventory, inventory)
  const receipts = await readReceiptCheckpoint(context, approved)
  let checkpoint = await writeReceiptCheckpoint(context, approved, receipts)
  let batchIndex = receipts.length
  let purgedThisRunObjectCount = 0
  for (const namespace of inventory.namespaces) {
    const objectIds = namespace.objects.filter(object => object.hasStoredData).map(object => object.id)
    for (const batch of chunks(objectIds, MAX_PURGE_BATCH_SIZE)) {
      await assertFrozen(context)
      const receipt = await purgeBatch(context, namespace, batch, approvedFingerprint, batchIndex)
      receipts.push(receipt)
      checkpoint = await writeReceiptCheckpoint(context, approved, receipts)
      purgedThisRunObjectCount += batch.length
      batchIndex += 1
    }
  }
  const scans = await stableEmptyScans(context, context.stableScanDelayMs, approved.inventory)
  const freezeAfter = await assertFrozen(context)
  const evidence = {
    contract: 'alife.event-durable-object-reset.apply.v1',
    generatedAtUtc: new Date().toISOString(),
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    approvedFingerprint,
    approvedNamespaceIdentityHash: approved.namespaceIdentityHash,
    freezeBefore,
    freezeAfter,
    requestedObjectCount: approved.inventory.objectCount,
    pendingStoredObjectCountBeforeApply: reconciliation.pendingStoredCount,
    alreadyEmptyObjectCountBeforeApply: reconciliation.alreadyEmptyCount,
    disappearedObjectCountBeforeApply: reconciliation.disappearedCount,
    purgedThisRunObjectCount,
    batchCount: receipts.length,
    receiptHash: checkpoint.receiptHash,
    firstEmptyScan: evidenceInventory(scans.first),
    secondEmptyScan: evidenceInventory(scans.second),
    firstEmptyScanHash: scans.firstScanHash,
    secondEmptyScanHash: scans.secondScanHash,
    namespaceIdentityHash: scans.namespaceIdentityHash,
    verified: true,
  }
  await writeEvidence(context, 'durable-objects-apply.json', evidence)
  console.log(`Event Durable Object apply: approved=${approved.inventory.objectCount} purgedThisRun=${purgedThisRunObjectCount} batches=${receipts.length} emptyScanHashes=${scans.firstScanHash},${scans.secondScanHash}`)
  return evidence
}

export async function runVerify(context) {
  const approvedFingerprint = required(context.approvedFingerprint, 'EVENT_RESET_DO_APPROVED_FINGERPRINT')
  if (!HEX_64.test(approvedFingerprint)) throw new Error('EVENT_RESET_DO_APPROVED_FINGERPRINT must be a lowercase SHA-256 hash.')
  const preview = await readEvidence(context, 'durable-objects-preview.json')
  const approved = validateApprovedPreview(context, preview, approvedFingerprint)
  const apply = await readEvidence(context, 'durable-objects-apply.json')
  const receipts = await readReceiptCheckpoint(context, approved)
  if (apply?.contract !== 'alife.event-durable-object-reset.apply.v1' ||
      apply?.approvedFingerprint !== approved.fingerprint ||
      apply?.approvedNamespaceIdentityHash !== approved.namespaceIdentityHash ||
      apply?.resetRunId !== context.resetRunId || apply?.resetEpoch !== context.resetEpoch ||
      apply?.schemaEpoch !== EXPECTED_SCHEMA_EPOCH || apply?.dataEpoch !== context.resetEpoch ||
      apply?.codeSha !== context.codeSha || apply?.verified !== true ||
      apply?.requestedObjectCount !== approved.inventory.objectCount ||
      apply?.batchCount !== receipts.length || apply?.receiptHash !== sha256(receipts) ||
      apply?.namespaceIdentityHash !== approved.namespaceIdentityHash) {
    throw new Error('The Durable Object preview/apply evidence is incomplete or belongs to another reset run.')
  }
  validateEmptyScanEvidence(context, apply.firstEmptyScan, approved, apply.firstEmptyScanHash)
  validateEmptyScanEvidence(context, apply.secondEmptyScan, approved, apply.secondEmptyScanHash)
  const freeze = await assertFrozen(context)
  const scans = await stableEmptyScans(context, context.stableScanDelayMs, approved.inventory)
  const evidence = {
    contract: 'alife.event-durable-object-reset.verify.v1',
    generatedAtUtc: new Date().toISOString(),
    codeSha: context.codeSha,
    resetRunId: context.resetRunId,
    resetEpoch: context.resetEpoch,
    schemaEpoch: EXPECTED_SCHEMA_EPOCH,
    dataEpoch: context.resetEpoch,
    approvedFingerprint: approved.fingerprint,
    approvedNamespaceIdentityHash: approved.namespaceIdentityHash,
    freeze,
    firstEmptyScan: evidenceInventory(scans.first),
    secondEmptyScan: evidenceInventory(scans.second),
    firstEmptyScanHash: scans.firstScanHash,
    secondEmptyScanHash: scans.secondScanHash,
    namespaceIdentityHash: scans.namespaceIdentityHash,
    verified: true,
  }
  await writeEvidence(context, 'durable-objects-verify.json', evidence)
  console.log(`Event Durable Object verify: stored=0 scans=2 emptyScanHashes=${scans.firstScanHash},${scans.secondScanHash}`)
  return evidence
}

export function contextFromEnvironment(env = process.env, fetchImpl = fetch) {
  const accountId = required(env.CLOUDFLARE_ACCOUNT_ID, 'CLOUDFLARE_ACCOUNT_ID')
  if (accountId !== EXPECTED_ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID is not the protected app-ccalc account.')
  const apiToken = required(env.CLOUDFLARE_API_TOKEN, 'CLOUDFLARE_API_TOKEN')
  const speedToken = required(env.EVENT_RESET_SPEED_TOKEN, 'EVENT_RESET_SPEED_TOKEN')
  const doToken = required(env.EVENT_RESET_DO_TOKEN, 'EVENT_RESET_DO_TOKEN')
  if (apiToken.length < 20 || speedToken.length < 32 || doToken.length < 32 || doToken.length > 4_096) {
    throw new Error('Protected reset credentials are missing or have an invalid length.')
  }
  if (doToken === speedToken) throw new Error('EVENT_RESET_DO_TOKEN must differ from EVENT_RESET_SPEED_TOKEN.')
  const resetRunId = required(env.EVENT_RESET_RUN_ID, 'EVENT_RESET_RUN_ID')
  const resetEpoch = required(env.EVENT_RESET_FREEZE_EPOCH, 'EVENT_RESET_FREEZE_EPOCH')
  const codeSha = required(env.EVENT_RESET_CODE_SHA, 'EVENT_RESET_CODE_SHA')
  if (!SAFE_ID.test(resetRunId) || !SAFE_ID.test(resetEpoch) || !HEX_40.test(codeSha)) {
    throw new Error('The reset run id, freeze epoch, or code SHA is invalid.')
  }
  const speedUrl = normalizeUrl(env.EVENT_RESET_SPEED_URL, 'EVENT_RESET_SPEED_URL')
  return {
    accountId,
    apiToken,
    apiBaseUrl: normalizeUrl(env.CLOUDFLARE_API_BASE_URL ?? DEFAULT_CLOUDFLARE_API, 'CLOUDFLARE_API_BASE_URL'),
    speedUrl,
    speedToken,
    doToken,
    purgeUrl: normalizeUrl(env.EVENT_RESET_DO_PURGE_URL ?? `${speedUrl}${DEFAULT_PURGE_PATH}`, 'EVENT_RESET_DO_PURGE_URL'),
    evidenceDir: path.resolve(required(env.EVENT_RESET_EVIDENCE_DIR, 'EVENT_RESET_EVIDENCE_DIR')),
    resetRunId,
    resetEpoch,
    codeSha,
    approvedFingerprint: env.EVENT_RESET_DO_APPROVED_FINGERPRINT?.trim() ?? '',
    stableScanDelayMs: Number(env.EVENT_RESET_DO_STABLE_SCAN_DELAY_MS ?? 5_000),
    fetchImpl,
  }
}

async function main() {
  const operation = process.argv[2]
  const context = contextFromEnvironment()
  if (!Number.isInteger(context.stableScanDelayMs) || context.stableScanDelayMs < 1_000 || context.stableScanDelayMs > 30_000) {
    throw new Error('EVENT_RESET_DO_STABLE_SCAN_DELAY_MS must be between 1000 and 30000 milliseconds.')
  }
  if (operation === 'preview') await runPreview(context)
  else if (operation === 'apply') await runApply(context)
  else if (operation === 'verify') await runVerify(context)
  else throw new Error('Usage: node reset-event-durable-objects.mjs <preview|apply|verify>')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Durable Object reset failed.'}\n`)
    process.exitCode = 1
  })
}
