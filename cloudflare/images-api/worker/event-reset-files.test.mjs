import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import worker from './index.js';
import { eventResetManifestHash, eventResetRecoveryKey, eventResetRequestSignature } from './event-reset-files.js';

const sourceKey = 'private/event-registration/11111111111111111111111111111111/22222222222222222222222222222222/33333333333333333333333333333333.pdf';
const backupReference = '/subscriptions/000/resourceGroups/recovery/providers/Microsoft.Sql/servers/sql/databases/alife-reset-copy';
const targetResource = '/subscriptions/000/resourceGroups/prod/providers/Microsoft.Sql/servers/sql/databases/alife';
const approvedFingerprint = 'a'.repeat(64);
const resetRunId = 'run-2026-10-12';
const adminSecret = 'admin-bearer-secret-at-least-32-characters';
const signingSecret = 'normal-signing-secret-at-least-32-characters';
const finalizeSecret = 'finalize-bearer-secret-at-least-32-characters';
const finalizeSigningSecret = 'finalize-signing-secret-at-least-32-characters';

function object(key, body, customMetadata = undefined, httpMetadata = { contentType: 'application/pdf' }) {
  const value = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    key,
    body: value,
    size: value.byteLength,
    httpEtag: `"etag-${key}"`,
    customMetadata,
    httpMetadata,
    writeHttpMetadata(headers) {
      if (httpMetadata.contentType) headers.set('content-type', httpMetadata.contentType);
    },
  };
}

function bucket(objects, controls = {}) {
  return {
    async head(key) { return objects.get(key) ?? null; },
    async get(key) { return objects.get(key) ?? null; },
    async put(key, body, options = {}) {
      const value = new Uint8Array(await new Response(body).arrayBuffer());
      objects.set(key, object(key, value, options.customMetadata, options.httpMetadata));
    },
    async delete(key) {
      if ((controls.deleteFailures?.get(key) ?? 0) > 0) {
        controls.deleteFailures.set(key, controls.deleteFailures.get(key) - 1);
        throw new Error('injected exact-key deletion failure');
      }
      objects.delete(key);
    },
    async list() { return { objects: [], delimitedPrefixes: [], truncated: false }; },
  };
}

async function fixture(options = {}) {
  const originalHttpMetadata = {
    contentType: 'application/pdf',
    contentLanguage: 'zh-CN',
    contentDisposition: 'attachment; filename="consent.pdf"',
    contentEncoding: 'identity',
    cacheControl: 'private, no-store',
    cacheExpiry: new Date('2030-01-02T03:04:05.000Z'),
  };
  const originalCustomMetadata = { category: 'consent', owner: 'event', zeta: 'last' };
  const source = new Map([[sourceKey, object(sourceKey, '%PDF-event', originalCustomMetadata, originalHttpMetadata)]]);
  const recovery = new Map();
  const sourceObject = source.get(sourceKey);
  const file = { storageProvider: 'cloudflare-r2', bucketName: 'ccalc', objectKey: sourceKey, sizeBytes: sourceObject.size, eTag: sourceObject.httpEtag };
  const files = [{ ...file, recoveryKey: await eventResetRecoveryKey(resetRunId, file) }];
  const manifestHash = await eventResetManifestHash(files);
  const recoveryControls = options.recoveryControls ?? {};
  const env = {
    EVENT_RESET_FILE_ADMIN_SECRET: adminSecret,
    EVENT_RESET_FILE_SIGNING_SECRET: signingSecret,
    EVENT_RESET_FILE_FINALIZE_SECRET: finalizeSecret,
    EVENT_RESET_FILE_FINALIZE_SIGNING_SECRET: finalizeSigningSecret,
    EVENT_RESET_TARGET_RESOURCE: targetResource,
    RESET_SOURCE_BUCKET_NAME: 'ccalc',
    EVENT_RESET_RECOVERY_BUCKET_NAME: 'ccalc-event-reset-recovery',
    EVENT_RUNTIME_ENVIRONMENT: ' PrOdUcTiOn ',
    EVENT_SCHEMA_EPOCH: '2.0.0',
    EVENT_WRITE_MODE: 'FROZEN',
    EVENT_WRITE_FREEZE_EPOCH: 'reset-epoch-1',
    IMAGE_BUCKET: bucket(source),
    EVENT_RESET_RECOVERY_BUCKET: bucket(recovery, recoveryControls),
  };
  const baseInput = {
    operation: 'backup',
    resetRunId,
    manifestHash,
    backupReference,
    approvedFingerprint,
    resetEpoch: 'reset-epoch-1',
    schemaEpoch: '2.0.0',
    targetResource,
    files,
  };
  const call = async (operation, changes = {}) => {
    const input = { ...baseInput, operation, ...changes.body };
    const finalize = operation === 'finalize';
    const secret = changes.secret ?? (finalize ? finalizeSecret : adminSecret);
    const key = changes.signingSecret ?? (finalize ? finalizeSigningSecret : signingSecret);
    const signature = changes.signature ?? await eventResetRequestSignature(key, changes.signatureInput ?? input);
    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
      ...(!changes.omitSignature ? { 'x-alife-event-reset-signature': signature } : {}),
    };
    return worker.fetch(new Request('https://images.test/api/admin/event-reset/files', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    }), { ...env, ...changes.env });
  };
  const status = (changes = {}) => worker.fetch(new Request('https://images.test/api/admin/event-reset/status', {
    headers: { authorization: `Bearer ${changes.secret ?? adminSecret}` },
  }), { ...env, ...changes.env });
  return { source, recovery, files, manifestHash, baseInput, call, status, originalHttpMetadata, originalCustomMetadata, recoveryControls };
}

function assertBoundReceipt(body, operation, manifestHash, expectedResetEpoch = 'reset-epoch-1') {
  assert.equal(body.operation, operation);
  assert.equal(body.resetRunId, resetRunId);
  assert.equal(body.manifestHash, manifestHash);
  assert.equal(body.backupReference, backupReference);
  assert.equal(body.approvedFingerprint, approvedFingerprint);
  assert.equal(body.targetResource, targetResource);
  assert.equal(body.resetEpoch, expectedResetEpoch);
  assert.equal(body.schemaEpoch, '2.0.0');
}

test('event reset status requires the exact production schema, target, and active freeze epoch', async () => {
  const f = await fixture();
  let response = await f.status();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ready: true,
    configurationValid: true,
    frozen: true,
    resetEpoch: 'reset-epoch-1',
    schemaEpoch: '2.0.0',
    targetResource,
  });
  for (const env of [
    { EVENT_SCHEMA_EPOCH: '1.3.0' },
    { EVENT_RUNTIME_ENVIRONMENT: 'staging' },
    { EVENT_WRITE_MODE: 'open' },
    { EVENT_RESET_TARGET_RESOURCE: '' },
    { EVENT_RESET_RECOVERY_BUCKET_NAME: 'ccalc' },
    { EVENT_RESET_RECOVERY_BUCKET: undefined },
    { EVENT_RESET_FILE_SIGNING_SECRET: undefined },
  ]) {
    response = await f.status({ env });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ready, false);
    assert.equal(body.configurationValid, env.EVENT_WRITE_MODE === 'open');
  }
  const sameBucket = await f.call('backup', { env: { EVENT_RESET_RECOVERY_BUCKET_NAME: 'ccalc' } });
  assert.equal(sameBucket.status, 503);
  assert.equal(f.recovery.size, 0);
});

test('bearer authorization cannot authorize an unsigned or differently signed manifest', async () => {
  const f = await fixture();
  assert.equal((await f.call('backup', { secret: 'x'.repeat(40) })).status, 403);
  assert.equal((await f.call('backup', { omitSignature: true })).status, 403);
  assert.equal((await f.call('backup', { signature: '0'.repeat(64) })).status, 403);
  const signedInput = { ...f.baseInput };
  const response = await f.call('backup', {
    body: { backupReference: `${backupReference}-forged` },
    signatureInput: signedInput,
  });
  assert.equal(response.status, 403);
  assert.equal((await f.call('backup', { env: { EVENT_RESET_FILE_SIGNING_SECRET: adminSecret }, signingSecret: adminSecret })).status, 403);
  assert.equal((await f.status({ env: { EVENT_RESET_FILE_SIGNING_SECRET: adminSecret } })).status, 503);
  assert.equal(f.recovery.size, 0);
});

test('Worker signer uses the canonical eight-field payload', async () => {
  const f = await fixture();
  const canonical = JSON.stringify([
    f.baseInput.operation,
    f.baseInput.resetRunId,
    f.baseInput.manifestHash,
    f.baseInput.backupReference,
    f.baseInput.approvedFingerprint,
    f.baseInput.resetEpoch,
    f.baseInput.schemaEpoch,
    f.baseInput.targetResource,
  ]);
  const expected = createHmac('sha256', signingSecret).update(canonical).digest('hex');
  assert.equal(await eventResetRequestSignature(signingSecret, f.baseInput), expected);
  assert.equal(await eventResetRequestSignature(signingSecret, { ...f.baseInput, ignored: 'not signed' }), expected);
});

test('event reset validates the signed schema, target, epoch, and exact manifest', async () => {
  const f = await fixture();
  for (const body of [
    { resetEpoch: 'other-epoch' },
    { schemaEpoch: '1.3.0' },
    { targetResource: `${targetResource}-other` },
  ]) {
    const response = await f.call('backup', { body });
    assert.equal(response.status, body.schemaEpoch === '1.3.0' ? 400 : 409);
  }
  let response = await f.call('backup', { body: { manifestHash: '0'.repeat(64) } });
  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).failures, ['Manifest hash mismatch.']);
  const controlCharacter = [{ ...f.files[0], objectKey: 'private/event-registration/control\u0001.pdf' }];
  response = await f.call('backup', {
    body: { files: controlCharacter, manifestHash: await eventResetManifestHash(controlCharacter) },
  });
  assert.equal(response.status, 400);
  const utf8Oversized = [{ ...f.files[0], objectKey: `private/${'水'.repeat(400)}.pdf` }];
  assert.ok(utf8Oversized[0].objectKey.length < 1024);
  assert.ok(new TextEncoder().encode(utf8Oversized[0].objectKey).byteLength > 1024);
  response = await f.call('backup', { body: { files: utf8Oversized, manifestHash: await eventResetManifestHash(utf8Oversized) } });
  assert.equal(response.status, 400);
  const utf8RecoveryOversized = [{
    ...f.files[0],
    recoveryKey: `quarantine/event-reset/${resetRunId}/${'水'.repeat(400)}.pdf`,
  }];
  assert.ok(utf8RecoveryOversized[0].recoveryKey.length < 1024);
  assert.ok(new TextEncoder().encode(utf8RecoveryOversized[0].recoveryKey).byteLength > 1024);
  response = await f.call('backup', {
    body: { files: utf8RecoveryOversized, manifestHash: await eventResetManifestHash(utf8RecoveryOversized) },
  });
  assert.equal(response.status, 400);
  const sidecarOversizedFile = {
    ...f.files[0],
    objectKey: `private/${'a'.repeat(910)}.pdf`,
  };
  sidecarOversizedFile.recoveryKey = await eventResetRecoveryKey(resetRunId, sidecarOversizedFile);
  assert.ok(new TextEncoder().encode(sidecarOversizedFile.recoveryKey).byteLength <= 1024);
  assert.ok(new TextEncoder().encode(`${sidecarOversizedFile.recoveryKey}.metadata.json`).byteLength > 1024);
  response = await f.call('backup', {
    body: { files: [sidecarOversizedFile], manifestHash: await eventResetManifestHash([sidecarOversizedFile]) },
  });
  assert.equal(response.status, 400);
  const oversized = Array.from({ length: 251 }, (_, index) => ({ ...f.files[0], objectKey: `private/event-registration/${index}.pdf` }));
  response = await f.call('backup', { body: { files: oversized, manifestHash: await eventResetManifestHash(oversized) } });
  assert.equal(response.status, 400);
  assert.equal(f.recovery.size, 0);
});

test('event reset treats glob characters as exact R2 key characters', async () => {
  const f = await fixture();
  const objectKey = 'private/event-registration/question?star*[1].pdf';
  const sourceObject = object(objectKey, '%PDF-exact-glob');
  f.source.clear();
  f.source.set(objectKey, sourceObject);
  const file = {
    storageProvider: 'cloudflare-r2',
    bucketName: 'ccalc',
    objectKey,
    recoveryKey: await eventResetRecoveryKey(resetRunId, {
      storageProvider: 'cloudflare-r2',
      bucketName: 'ccalc',
      objectKey,
    }),
    sizeBytes: sourceObject.size,
    eTag: sourceObject.httpEtag,
  };
  const manifestHash = await eventResetManifestHash([file]);

  const response = await f.call('backup', { body: { files: [file], manifestHash } });

  assert.equal(response.status, 200);
  assertBoundReceipt(await response.json(), 'backup', manifestHash);
  assert.equal(f.recovery.has(file.recoveryKey), true);
});

test('backup, delete, and exact-key restore preserve and verify HTTP and custom metadata', async () => {
  const f = await fixture();
  let response = await f.call('backup');
  assert.equal(response.status, 200);
  let body = await response.json();
  assertBoundReceipt(body, 'backup', f.manifestHash);
  assert.equal(body.verified, true);
  assert.deepEqual(body.failures, []);
  assert.equal(f.recovery.size, 2);
  assert.equal((await f.call('backup')).status, 200);

  response = await f.call('delete');
  assert.equal(response.status, 200);
  body = await response.json();
  assertBoundReceipt(body, 'delete', f.manifestHash);
  assert.equal(f.source.has(sourceKey), false);
  assert.equal((await f.call('delete')).status, 200);

  const rollbackContext = { body: { resetEpoch: 'rollback-epoch-2' }, env: { EVENT_WRITE_FREEZE_EPOCH: 'rollback-epoch-2' } };
  response = await f.call('restore', rollbackContext);
  assert.equal(response.status, 200);
  body = await response.json();
  assertBoundReceipt(body, 'restore', f.manifestHash, 'rollback-epoch-2');
  const restored = f.source.get(sourceKey);
  assert.deepEqual(restored.customMetadata, f.originalCustomMetadata);
  assert.deepEqual(restored.httpMetadata, f.originalHttpMetadata);
  assert.equal((await f.call('restore', rollbackContext)).status, 200);

  f.source.set(sourceKey, object(sourceKey, '%PDF-conflict', f.originalCustomMetadata, f.originalHttpMetadata));
  response = await f.call('restore', rollbackContext);
  assert.equal(response.status, 409);
  assert.match((await response.json()).failures[0], /conflicts/);
});

test('delete fails closed when the source or verified recovery changes', async () => {
  const f = await fixture();
  assert.equal((await f.call('backup')).status, 200);
  const sidecar = [...f.recovery.keys()].find(key => key.endsWith('.metadata.json'));
  f.recovery.delete(sidecar);
  let response = await f.call('delete');
  assert.equal(response.status, 409);
  assert.equal(f.source.has(sourceKey), true);

  const second = await fixture();
  assert.equal((await second.call('backup')).status, 200);
  const recoveryObject = second.recovery.get(second.files[0].recoveryKey);
  recoveryObject.customMetadata.eventResetBindingHash = '0'.repeat(64);
  response = await second.call('delete');
  assert.equal(response.status, 409);
  assert.equal(second.source.has(sourceKey), true);

  const third = await fixture();
  assert.equal((await third.call('backup')).status, 200);
  const changedSidecarKey = [...third.recovery.keys()].find(key => key.endsWith('.metadata.json'));
  const changedSidecar = third.recovery.get(changedSidecarKey);
  third.recovery.set(changedSidecarKey, object(
    changedSidecarKey,
    '{"tampered":true}',
    changedSidecar.customMetadata,
    changedSidecar.httpMetadata,
  ));
  response = await third.call('delete');
  assert.equal(response.status, 409);
  assert.equal(third.source.has(sourceKey), true);

  const fourth = await fixture();
  assert.equal((await fourth.call('backup')).status, 200);
  fourth.source.set(sourceKey, object(sourceKey, '%PDF-other', fourth.originalCustomMetadata, fourth.originalHttpMetadata));
  response = await fourth.call('delete');
  assert.equal(response.status, 409);
  assert.match((await response.json()).failures[0], /source body or metadata changed/);
  assert.equal(fourth.source.has(sourceKey), true);
});

test('finalize uses separate credentials, works after unfreeze, and is idempotent', async () => {
  const f = await fixture();
  assert.equal((await f.call('backup')).status, 200);
  assert.equal((await f.call('finalize', { secret: adminSecret, signingSecret })).status, 403);
  assert.equal((await f.call('finalize', { env: { EVENT_RUNTIME_ENVIRONMENT: 'staging' } })).status, 409);
  assert.equal((await f.call('finalize', { env: { EVENT_SCHEMA_EPOCH: '1.3.0' } })).status, 409);
  assert.equal((await f.call('finalize', { env: { EVENT_RESET_TARGET_RESOURCE: `${targetResource}-other` } })).status, 409);
  assert.equal((await f.call('finalize', { env: { EVENT_WRITE_MODE: '' } })).status, 409);
  assert.equal((await f.call('finalize', {
    body: { resetEpoch: 'different-reset-epoch' },
    env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' },
  })).status, 409);
  let response = await f.call('finalize', { env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' } });
  assert.equal(response.status, 200);
  let body = await response.json();
  assertBoundReceipt(body, 'finalize', f.manifestHash);
  assert.equal(body.verified, true);
  assert.equal([...f.recovery.keys()].filter(key => key.startsWith('quarantine/event-reset/')).length, 0);
  assert.equal([...f.recovery.keys()].filter(key => key.startsWith('quarantine/event-reset-finalized/')).length, 1);
  response = await f.call('finalize', { env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verified, true);
});

test('finalize safely resumes after a partial exact-key deletion', async () => {
  const deleteFailures = new Map();
  const f = await fixture({ recoveryControls: { deleteFailures } });
  assert.equal((await f.call('backup')).status, 200);
  const sidecar = `${f.files[0].recoveryKey}.metadata.json`;
  deleteFailures.set(sidecar, 1);
  let response = await f.call('finalize', { env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' } });
  assert.equal(response.status, 409);
  assert.equal(f.recovery.has(f.files[0].recoveryKey), false);
  assert.equal(f.recovery.has(sidecar), true);
  response = await f.call('finalize', { env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' } });
  assert.equal(response.status, 200);
  assert.equal(f.recovery.has(sidecar), false);
  assert.equal((await f.call('finalize', { env: { EVENT_WRITE_MODE: 'open', EVENT_WRITE_FREEZE_EPOCH: '' } })).status, 200);
});

test('generic and public reads never expose private or quarantine objects', async () => {
  const f = await fixture();
  const quarantineKey = 'quarantine/event-reset/test/secret.pdf';
  f.source.set(quarantineKey, object(quarantineKey, 'secret'));
  const env = { IMAGE_BUCKET: bucket(f.source) };
  for (const key of [sourceKey, quarantineKey]) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await worker.fetch(new Request(`https://images.test/${key}`, { method }), env)).status, 404);
      assert.equal((await worker.fetch(new Request(`https://images.test/api/images/${key}`, { method }), env)).status, 404);
    }
  }
  assert.equal((await worker.fetch(new Request('https://images.test/api/images/list/private'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://images.test/api/images/list/quarantine'), env)).status, 404);
});
