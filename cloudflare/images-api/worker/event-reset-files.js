import { sameSecret } from './sunday-bulletins.js';

const ADMIN_PATH = '/api/admin/event-reset/files';
const STATUS_PATH = '/api/admin/event-reset/status';
const MAX_FILES = 250;
const MAX_KEY_LENGTH = 1024;
const MAX_REFERENCE_LENGTH = 2048;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const RESET_RUN_ID = /^[A-Za-z0-9._-]{1,128}$/;
const RESET_EPOCH = /^[A-Za-z0-9._:-]{1,256}$/;
const AZURE_SQL_RESOURCE_ID = /^\/subscriptions\/[^/\s]+\/resourceGroups\/[^/\s]+\/providers\/Microsoft\.Sql\/servers\/[^/\s]+\/databases\/[^/\s]+$/i;
const EVENT_SCHEMA_EPOCH = '2.0.0';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const compareOrdinal = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const sortObject = value => Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => compareOrdinal(left, right)));

const validBoundString = (value, maxLength = MAX_REFERENCE_LENGTH) => typeof value === 'string'
  && value.length > 0
  && value.length <= maxLength
  && value === value.trim()
  && !/[\u0000-\u001f\u007f]/.test(value);

const validExactKey = (value) => typeof value === 'string'
  && value.length > 0
  && value.length <= MAX_KEY_LENGTH
  && encoder.encode(value).byteLength <= MAX_KEY_LENGTH
  && !value.startsWith('/')
  && !value.endsWith('/')
  && !value.includes('\\')
  && !/[\u0000-\u001f\u007f]/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..');
const validSourceKey = value => validExactKey(value) && !value.startsWith('quarantine/');
const validRecoveryKey = value => validExactKey(value) && value.startsWith('quarantine/event-reset/');
const storageConfigured = env => Boolean(env.IMAGE_BUCKET && env.EVENT_RESET_RECOVERY_BUCKET &&
  validBoundString(env.RESET_SOURCE_BUCKET_NAME, 128) && validBoundString(env.EVENT_RESET_RECOVERY_BUCKET_NAME, 128) &&
  env.RESET_SOURCE_BUCKET_NAME !== env.EVENT_RESET_RECOVERY_BUCKET_NAME);

const bytes = async (body) => new Uint8Array(await new Response(body).arrayBuffer());
const sha256 = async (value) => {
  const input = typeof value === 'string' ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const eventResetSignaturePayload = (input) => JSON.stringify([
  input.operation,
  input.resetRunId,
  input.manifestHash,
  input.backupReference,
  input.approvedFingerprint,
  input.resetEpoch,
  input.schemaEpoch,
  input.targetResource,
]);

export const eventResetRequestSignature = async (secret, input) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(eventResetSignaturePayload(input)));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const storageBinding = input => ({
  resetRunId: input.resetRunId,
  manifestHash: input.manifestHash,
  backupReference: input.backupReference,
  approvedFingerprint: input.approvedFingerprint,
  resetEpoch: input.resetEpoch,
  schemaEpoch: input.schemaEpoch,
  targetResource: input.targetResource,
});
const storageBindingPayload = input => JSON.stringify(Object.values(storageBinding(input)));
// A later rollback must use a fresh, currently frozen epoch. The recovery
// object remains bound to the original epoch through the hashed sidecar, while
// this immutable binding lets that separately signed restore prove it belongs
// to the same reset, manifest, backup, schema, fingerprint, and target.
const recoveryBindingPayload = input => JSON.stringify([
  input.resetRunId,
  input.manifestHash,
  input.backupReference,
  input.approvedFingerprint,
  input.schemaEpoch,
  input.targetResource,
]);

const receipt = (input, verified, failures, status = 200) => Response.json({
  operation: input?.operation ?? 'unknown',
  resetRunId: input?.resetRunId ?? '',
  manifestHash: input?.manifestHash ?? '',
  approvedFingerprint: input?.approvedFingerprint ?? '',
  targetResource: input?.targetResource ?? '',
  resetEpoch: input?.resetEpoch ?? '',
  schemaEpoch: input?.schemaEpoch ?? '',
  verified,
  ...(input?.backupReference ? { backupReference: input.backupReference } : {}),
  failures,
}, {
  status,
  headers: { 'cache-control': 'private, no-store', 'content-type': 'application/json; charset=utf-8' },
});

const normalizeFiles = (input, expectedBucket) => {
  if (!Array.isArray(input) || input.length > MAX_FILES || input.some(file => file?.disposition !== undefined && file.disposition !== 'delete-after-sql')) return null;
  const files = input.map(file => ({
    storageProvider: file?.storageProvider,
    bucketName: file?.bucketName,
    objectKey: file?.objectKey,
    recoveryKey: file?.recoveryKey,
    sizeBytes: file?.sizeBytes,
    eTag: file?.eTag ?? null,
  }));
  if (files.some(file => file.storageProvider !== 'cloudflare-r2' || file.bucketName !== expectedBucket ||
      !validSourceKey(file.objectKey) || !validRecoveryKey(file.recoveryKey) ||
      !validRecoveryKey(`${file.recoveryKey}.metadata.json`) ||
      !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0 ||
      !(file.eTag === null || typeof file.eTag === 'string' && file.eTag.length > 0 && file.eTag.length <= 512))) return null;
  const identities = files.map(file => `${file.storageProvider}\n${file.bucketName}\n${file.objectKey}`);
  if (new Set(identities).size !== identities.length) return null;
  return files.sort((left, right) => compareOrdinal(left.storageProvider, right.storageProvider) ||
    compareOrdinal(left.bucketName, right.bucketName) || compareOrdinal(left.objectKey, right.objectKey));
};

export const eventResetManifestHash = async (files) => sha256(JSON.stringify([...files]
  .sort((left, right) => compareOrdinal(left.storageProvider, right.storageProvider) ||
    compareOrdinal(left.bucketName, right.bucketName) || compareOrdinal(left.objectKey, right.objectKey))
  .map(file => [
    file.storageProvider,
    file.bucketName,
    file.objectKey,
    file.recoveryKey,
    file.sizeBytes,
    file.eTag ?? null,
  ])));

const identityHash = file => sha256(`${file.storageProvider}\n${file.bucketName}\n${file.objectKey}`);

export const eventResetRecoveryKey = async (resetRunId, file) => {
  const identity = await identityHash(file);
  const basename = file.objectKey.split('/').at(-1);
  return `quarantine/event-reset/${resetRunId}/${identity}/${basename}`;
};

const sidecarKey = file => `${file.recoveryKey}.metadata.json`;
const tombstoneKey = async (input, file) => `quarantine/event-reset-finalized/${input.resetRunId}/${await identityHash(file)}.json`;

const normalizeHttpMetadata = (value) => {
  const result = {};
  for (const key of ['contentType', 'contentLanguage', 'contentDisposition', 'contentEncoding', 'cacheControl']) {
    if (typeof value?.[key] === 'string') result[key] = value[key];
  }
  if (value?.cacheExpiry instanceof Date && !Number.isNaN(value.cacheExpiry.valueOf())) result.cacheExpiry = value.cacheExpiry.toISOString();
  else if (typeof value?.cacheExpiry === 'string' && !Number.isNaN(Date.parse(value.cacheExpiry))) result.cacheExpiry = new Date(value.cacheExpiry).toISOString();
  return result;
};

const restoreHttpMetadata = value => ({
  ...value,
  ...(value?.cacheExpiry ? { cacheExpiry: new Date(value.cacheExpiry) } : {}),
});

const normalizeCustomMetadata = value => sortObject(Object.fromEntries(Object.entries(value ?? {})
  .filter(([key, item]) => typeof key === 'string' && typeof item === 'string')));

const sidecarRecord = (input, file, source) => ({
  version: 2,
  binding: storageBinding(input),
  source: {
    storageProvider: file.storageProvider,
    bucketName: file.bucketName,
    objectKey: file.objectKey,
    sizeBytes: file.sizeBytes,
    eTag: file.eTag,
  },
  httpMetadata: normalizeHttpMetadata(source.httpMetadata),
  customMetadata: normalizeCustomMetadata(source.customMetadata),
});

const expectedRecoveryMetadata = async (input, file, sourceHash, sidecarHash) => ({
  eventResetVersion: '2',
  eventResetBindingHash: await sha256(recoveryBindingPayload(input)),
  sourceIdentityHash: await identityHash(file),
  sourceSize: String(file.sizeBytes),
  sourceEtagHash: await sha256(file.eTag ?? ''),
  sourceSha256: sourceHash,
  sidecarKeyHash: await sha256(sidecarKey(file)),
  sidecarSha256: sidecarHash,
});

const expectedSidecarMetadata = async (input, file, sidecarHash) => ({
  eventResetRecord: 'metadata-v2',
  eventResetBindingHash: await sha256(recoveryBindingPayload(input)),
  sourceIdentityHash: await identityHash(file),
  sidecarSha256: sidecarHash,
});

const sameMetadata = (actual, expected) => JSON.stringify(sortObject(actual)) === JSON.stringify(sortObject(expected));
const sourceMatchesManifest = (object, file) => object && object.size === file.sizeBytes && (!file.eTag || object.httpEtag === file.eTag);

const parseSidecar = (text, input, file) => {
  let record;
  try { record = JSON.parse(text); } catch { return null; }
  const storedResetEpoch = record?.binding?.resetEpoch;
  const expectedBinding = {
    ...storageBinding(input),
    resetEpoch: input.operation === 'restore' ? storedResetEpoch : input.resetEpoch,
  };
  if (record?.version !== 2 || !RESET_EPOCH.test(storedResetEpoch ?? '') ||
      JSON.stringify(record.binding) !== JSON.stringify(expectedBinding) ||
      JSON.stringify(record.source) !== JSON.stringify({
        storageProvider: file.storageProvider,
        bucketName: file.bucketName,
        objectKey: file.objectKey,
        sizeBytes: file.sizeBytes,
        eTag: file.eTag,
      }) || JSON.stringify(record.httpMetadata) !== JSON.stringify(normalizeHttpMetadata(record.httpMetadata)) ||
      JSON.stringify(record.customMetadata) !== JSON.stringify(normalizeCustomMetadata(record.customMetadata))) return null;
  return record;
};

async function readVerifiedRecovery(env, input, file) {
  const recovery = await env.EVENT_RESET_RECOVERY_BUCKET.get(file.recoveryKey);
  const sidecar = await env.EVENT_RESET_RECOVERY_BUCKET.get(sidecarKey(file));
  if (!recovery || !sidecar) return null;
  const [recoveryBytes, sidecarBytes] = await Promise.all([bytes(recovery.body), bytes(sidecar.body)]);
  const sidecarText = decoder.decode(sidecarBytes);
  const [sourceHash, sidecarHash] = await Promise.all([sha256(recoveryBytes), sha256(sidecarBytes)]);
  const record = parseSidecar(sidecarText, input, file);
  if (!record) return null;
  const [recoveryMetadata, sidecarMetadata] = await Promise.all([
    expectedRecoveryMetadata(input, file, sourceHash, sidecarHash),
    expectedSidecarMetadata(input, file, sidecarHash),
  ]);
  if (recovery.size !== file.sizeBytes || !sameMetadata(recovery.customMetadata, recoveryMetadata) ||
      !sameMetadata(sidecar.customMetadata, sidecarMetadata)) return null;
  return { recoveryBytes, record, sourceHash };
}

async function backupFiles(env, files, input) {
  const failures = [];
  for (const file of files) {
    try {
      const source = await env.IMAGE_BUCKET.get(file.objectKey);
      if (!sourceMatchesManifest(source, file)) throw new Error('source is missing or its size/ETag changed');
      const sourceBytes = await bytes(source.body);
      const record = sidecarRecord(input, file, source);
      const sidecarBytes = encoder.encode(JSON.stringify(record));
      const [sourceHash, sidecarHash] = await Promise.all([sha256(sourceBytes), sha256(sidecarBytes)]);
      const [recoveryMetadata, sidecarMetadata] = await Promise.all([
        expectedRecoveryMetadata(input, file, sourceHash, sidecarHash),
        expectedSidecarMetadata(input, file, sidecarHash),
      ]);
      const existingRecovery = await env.EVENT_RESET_RECOVERY_BUCKET.head(file.recoveryKey);
      const existingSidecar = await env.EVENT_RESET_RECOVERY_BUCKET.get(sidecarKey(file));
      if (existingRecovery && !sameMetadata(existingRecovery.customMetadata, recoveryMetadata)) throw new Error('recovery object conflicts with this manifest');
      if (existingSidecar) {
        const existingBytes = await bytes(existingSidecar.body);
        if (await sha256(existingBytes) !== sidecarHash || !sameMetadata(existingSidecar.customMetadata, sidecarMetadata)) {
          throw new Error('recovery metadata sidecar conflicts with this manifest');
        }
      } else {
        await env.EVENT_RESET_RECOVERY_BUCKET.put(sidecarKey(file), sidecarBytes, {
          httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
          customMetadata: sidecarMetadata,
        });
      }
      if (!existingRecovery) await env.EVENT_RESET_RECOVERY_BUCKET.put(file.recoveryKey, sourceBytes, {
        httpMetadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' },
        customMetadata: recoveryMetadata,
      });
      if (!await readVerifiedRecovery(env, input, file)) throw new Error('recovery read-back verification failed');
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'backup failed'}`);
    }
  }
  return failures;
}

async function deleteFiles(env, files, input) {
  const failures = [];
  for (const file of files) {
    try {
      const verified = await readVerifiedRecovery(env, input, file);
      if (!verified) throw new Error('verified recovery object is missing');
      const source = await env.IMAGE_BUCKET.get(file.objectKey);
      if (source && (!sourceMatchesManifest(source, file) ||
          await sha256(await bytes(source.body)) !== verified.sourceHash ||
          !sourceMetadataMatches(source, verified.record))) {
        throw new Error('source body or metadata changed after backup');
      }
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'delete failed'}`);
    }
  }
  if (failures.length) return failures;
  for (const file of files) {
    try {
      if (await env.IMAGE_BUCKET.head(file.objectKey)) await env.IMAGE_BUCKET.delete(file.objectKey);
      if (await env.IMAGE_BUCKET.head(file.objectKey)) throw new Error('exact-key deletion did not complete');
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'delete failed'}`);
    }
  }
  return failures;
}

const sourceMetadataMatches = (source, record) => JSON.stringify(normalizeHttpMetadata(source.httpMetadata)) === JSON.stringify(record.httpMetadata)
  && JSON.stringify(normalizeCustomMetadata(source.customMetadata)) === JSON.stringify(record.customMetadata);

async function restoreFiles(env, files, input) {
  const failures = [];
  for (const file of files) {
    try {
      const verified = await readVerifiedRecovery(env, input, file);
      if (!verified) throw new Error('verified recovery object is missing');
      const existing = await env.IMAGE_BUCKET.get(file.objectKey);
      if (existing) {
        const existingHash = await sha256(await bytes(existing.body));
        if (existingHash !== verified.sourceHash || existing.size !== file.sizeBytes || !sourceMetadataMatches(existing, verified.record)) {
          throw new Error('source key conflicts with the verified recovery object');
        }
      } else {
        await env.IMAGE_BUCKET.put(file.objectKey, verified.recoveryBytes, {
          httpMetadata: restoreHttpMetadata(verified.record.httpMetadata),
          customMetadata: verified.record.customMetadata,
        });
      }
      const restored = await env.IMAGE_BUCKET.get(file.objectKey);
      if (!restored || restored.size !== file.sizeBytes || await sha256(await bytes(restored.body)) !== verified.sourceHash ||
          !sourceMetadataMatches(restored, verified.record)) throw new Error('restored source read-back verification failed');
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'restore failed'}`);
    }
  }
  return failures;
}

const tombstoneRecord = async (input, file, state) => ({
  version: 1,
  state,
  binding: storageBinding(input),
  sourceIdentityHash: await identityHash(file),
  recoveryKey: file.recoveryKey,
  sidecarKey: sidecarKey(file),
});

async function readTombstone(env, input, file, state) {
  const key = await tombstoneKey(input, file);
  const object = await env.EVENT_RESET_RECOVERY_BUCKET.get(key);
  if (!object) return false;
  const expected = JSON.stringify(await tombstoneRecord(input, file, state));
  const actual = decoder.decode(await bytes(object.body));
  const expectedMetadata = {
    eventResetRecord: `finalize-${state}-v1`,
    eventResetBindingHash: await sha256(storageBindingPayload(input)),
    sourceIdentityHash: await identityHash(file),
    tombstoneSha256: await sha256(expected),
  };
  return actual === expected && sameMetadata(object.customMetadata, expectedMetadata);
}

async function writeTombstone(env, input, file, state) {
  const key = await tombstoneKey(input, file);
  const body = JSON.stringify(await tombstoneRecord(input, file, state));
  await env.EVENT_RESET_RECOVERY_BUCKET.put(key, body, {
    httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
    customMetadata: {
      eventResetRecord: `finalize-${state}-v1`,
      eventResetBindingHash: await sha256(storageBindingPayload(input)),
      sourceIdentityHash: await identityHash(file),
      tombstoneSha256: await sha256(body),
    },
  });
  if (!await readTombstone(env, input, file, state)) throw new Error(`finalize ${state} tombstone read-back verification failed`);
}

async function finalizeFiles(env, files, input) {
  const failures = [];
  for (const file of files) {
    try {
      if (await readTombstone(env, input, file, 'finalized')) {
        if (await env.EVENT_RESET_RECOVERY_BUCKET.head(file.recoveryKey) || await env.EVENT_RESET_RECOVERY_BUCKET.head(sidecarKey(file))) {
          throw new Error('finalized tombstone conflicts with remaining recovery content');
        }
        continue;
      }
      if (!await readTombstone(env, input, file, 'prepared')) {
        if (!await readVerifiedRecovery(env, input, file)) throw new Error('verified recovery object is missing');
        await writeTombstone(env, input, file, 'prepared');
      } else if (await env.EVENT_RESET_RECOVERY_BUCKET.head(file.recoveryKey) && !await readVerifiedRecovery(env, input, file)) {
        throw new Error('prepared tombstone has conflicting recovery content');
      }
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'finalize failed'}`);
    }
  }
  if (failures.length) return failures;
  for (const file of files) {
    try {
      if (await readTombstone(env, input, file, 'finalized')) continue;
      if (await env.EVENT_RESET_RECOVERY_BUCKET.head(file.recoveryKey)) await env.EVENT_RESET_RECOVERY_BUCKET.delete(file.recoveryKey);
      if (await env.EVENT_RESET_RECOVERY_BUCKET.head(sidecarKey(file))) await env.EVENT_RESET_RECOVERY_BUCKET.delete(sidecarKey(file));
      if (await env.EVENT_RESET_RECOVERY_BUCKET.head(file.recoveryKey) || await env.EVENT_RESET_RECOVERY_BUCKET.head(sidecarKey(file))) {
        throw new Error('exact recovery-key deletion did not complete');
      }
      await writeTombstone(env, input, file, 'finalized');
    } catch (error) {
      failures.push(`${file.storageProvider}/${file.bucketName}/${file.objectKey}: ${error instanceof Error ? error.message : 'finalize failed'}`);
    }
  }
  return failures;
}

const configuredForOperation = (env, input) => {
  const production = env.EVENT_RUNTIME_ENVIRONMENT?.trim().toLowerCase() === 'production';
  const schemaEpoch = env.EVENT_SCHEMA_EPOCH?.trim();
  const targetResource = env.EVENT_RESET_TARGET_RESOURCE?.trim();
  const mode = env.EVENT_WRITE_MODE?.trim().toLowerCase();
  if (!production || schemaEpoch !== EVENT_SCHEMA_EPOCH || input.schemaEpoch !== EVENT_SCHEMA_EPOCH ||
      !targetResource || input.targetResource !== targetResource || !['open', 'frozen'].includes(mode)) return false;
  if (input.operation === 'finalize') return true;
  const configuredEpoch = env.EVENT_WRITE_FREEZE_EPOCH?.trim();
  return mode === 'frozen' && Boolean(configuredEpoch) && input.resetEpoch === configuredEpoch;
};

const validInput = input => ['backup', 'delete', 'restore', 'finalize'].includes(input?.operation)
  && RESET_RUN_ID.test(input?.resetRunId ?? '')
  && HEX_SHA256.test(input?.manifestHash ?? '')
  && HEX_SHA256.test(input?.approvedFingerprint ?? '')
  && RESET_EPOCH.test(input?.resetEpoch ?? '')
  && input?.schemaEpoch === EVENT_SCHEMA_EPOCH
  && validBoundString(input?.backupReference, 512)
  && AZURE_SQL_RESOURCE_ID.test(input.backupReference)
  && validBoundString(input?.targetResource)
  && AZURE_SQL_RESOURCE_ID.test(input.targetResource)
  && input.backupReference.toLowerCase() !== input.targetResource.toLowerCase();

async function distinctResetSecrets(env) {
  const secrets = [
    env.EVENT_RESET_FILE_ADMIN_SECRET,
    env.EVENT_RESET_FILE_SIGNING_SECRET,
    env.EVENT_RESET_FILE_FINALIZE_SECRET,
    env.EVENT_RESET_FILE_FINALIZE_SIGNING_SECRET,
  ];
  if (secrets.some(secret => !validBoundString(secret, 4096) || secret.length < 32)) return false;
  for (let left = 0; left < secrets.length; left += 1) {
    for (let right = left + 1; right < secrets.length; right += 1) {
      if (await sameSecret(secrets[left], secrets[right])) return false;
    }
  }
  return true;
}

async function authorized(request, env, input) {
  const finalize = input?.operation === 'finalize';
  const bearerSecret = finalize ? env.EVENT_RESET_FILE_FINALIZE_SECRET : env.EVENT_RESET_FILE_ADMIN_SECRET;
  const signingSecret = finalize ? env.EVENT_RESET_FILE_FINALIZE_SIGNING_SECRET : env.EVENT_RESET_FILE_SIGNING_SECRET;
  if (!await distinctResetSecrets(env)) return false;
  const bearer = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const signature = request.headers.get('x-alife-event-reset-signature') ?? '';
  if (!HEX_SHA256.test(signature) || !await sameSecret(bearer, bearerSecret)) return false;
  return sameSecret(signature, await eventResetRequestSignature(signingSecret, input));
}

export async function handleEventResetFiles(request, env) {
  const path = new URL(request.url).pathname;
  if (path !== ADMIN_PATH && path !== STATUS_PATH) return null;
  if (path === STATUS_PATH) {
    const bearer = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
    if (!env.EVENT_RESET_FILE_ADMIN_SECRET || !await sameSecret(bearer, env.EVENT_RESET_FILE_ADMIN_SECRET)) {
      return Response.json({ ready: false, configurationValid: false, frozen: false, resetEpoch: null, schemaEpoch: null }, { status: 403, headers: { 'cache-control': 'private, no-store' } });
    }
    if (request.method !== 'GET') return Response.json({ ready: false, configurationValid: false, frozen: false, resetEpoch: null, schemaEpoch: null }, { status: 405, headers: { 'cache-control': 'private, no-store' } });
    const schemaEpoch = env.EVENT_SCHEMA_EPOCH?.trim() || null;
    const resetEpoch = env.EVENT_WRITE_FREEZE_EPOCH?.trim() || null;
    const targetResource = env.EVENT_RESET_TARGET_RESOURCE?.trim() || null;
    const mode = env.EVENT_WRITE_MODE?.trim().toLowerCase();
    const production = env.EVENT_RUNTIME_ENVIRONMENT?.trim().toLowerCase() === 'production';
    const separatedAuth = await distinctResetSecrets(env);
    const configured = Boolean(production && schemaEpoch === EVENT_SCHEMA_EPOCH && ['open', 'frozen'].includes(mode ?? '') &&
      storageConfigured(env) && targetResource && separatedAuth);
    const frozen = configured && mode === 'frozen' && Boolean(resetEpoch);
    return Response.json({ ready: frozen, configurationValid: configured, frozen, resetEpoch, schemaEpoch, targetResource }, {
      status: frozen ? 200 : 503,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
  if (request.method !== 'POST') return receipt(null, false, ['Method not allowed.'], 405);
  let input;
  try { input = await request.json(); } catch { return receipt(null, false, ['Invalid JSON.'], 400); }
  if (!await authorized(request, env, input)) return receipt(input, false, ['Forbidden.'], 403);
  if (!validInput(input)) return receipt(input, false, ['Invalid reset request context.'], 400);
  if (!storageConfigured(env)) {
    return receipt(input, false, ['Event reset storage is not configured.'], 503);
  }
  if (!configuredForOperation(env, input)) {
    const message = input.operation === 'finalize'
      ? 'Event reset finalization requires the matching production 2.0 target context.'
      : 'Event reset file operations require the matching production 2.0 freeze epoch and target context.';
    return receipt(input, false, [message], 409);
  }
  const files = normalizeFiles(input.files, env.RESET_SOURCE_BUCKET_NAME);
  if (!files) return receipt(input, false, ['Invalid, duplicate, or oversized exact-key file manifest.'], 400);
  for (const file of files) {
    if (file.recoveryKey !== await eventResetRecoveryKey(input.resetRunId, file)) {
      return receipt(input, false, ['Recovery key mismatch.'], 400);
    }
  }
  if (await eventResetManifestHash(files) !== input.manifestHash) return receipt(input, false, ['Manifest hash mismatch.'], 400);
  const failures = input.operation === 'backup'
    ? await backupFiles(env, files, input)
    : input.operation === 'delete'
      ? await deleteFiles(env, files, input)
      : input.operation === 'restore'
        ? await restoreFiles(env, files, input)
        : await finalizeFiles(env, files, input);
  return receipt(input, failures.length === 0, failures, failures.length ? 409 : 200);
}
