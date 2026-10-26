const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./helpers/loadSource.cjs');
const policy = loadSource('src/services/albumImportPolicy.ts');
const drive = loadSource('src/services/googleDrivePhotoService.ts', { './albumImportPolicy': policy });

test('batch limits reject unsupported, oversized, empty and excessive selections', () => {
  const photo = { type: 'image/png', size: 1024 };
  assert.doesNotThrow(() => policy.validatePhotoBatch([photo]));
  for (const files of [[], Array(51).fill(photo), [{ ...photo, size: 21 * 1024 * 1024 }], [{ ...photo, type: 'image/svg+xml' }], Array(6).fill({ ...photo, size: 20 * 1024 * 1024 })])
    assert.throws(() => policy.validatePhotoBatch(files), policy.AlbumImportError);
});

test('Drive download uses selected file ID, metadata and authorized no-store reads, never picker URLs', async () => {
  const original = global.fetch; const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return url.includes('alt=media') ? new Response('photo') : Response.json({ name: 'photo.png', mimeType: 'image/png', size: '5', capabilities: { canDownload: true } });
  };
  try {
    const file = await drive.downloadDrivePhoto({ id: 'selected', name: 'old.png', mimeType: 'image/png', resourceKey: 'resource' }, 'ephemeral', new AbortController().signal);
    assert.equal(file.name, 'photo.png'); assert.equal(file.size, 5);
    assert.equal(calls.length, 2); assert.ok(calls.every(c => c.url.startsWith('https://www.googleapis.com/drive/v3/files/selected?')));
    assert.ok(calls.every(c => c.init.cache === 'no-store' && c.init.headers.Authorization === 'Bearer ephemeral'));
    assert.equal(calls[0].init.headers['X-Goog-Drive-Resource-Keys'], 'selected/resource');
  } finally { global.fetch = original; }
});

test('Drive download rejects expired access, missing permission and dishonest oversize streams', async () => {
  const original = global.fetch;
  const photo = { id: 'selected', name: 'x.png', mimeType: 'image/png' };
  try {
    for (const [status, code] of [[401, 'expired'], [403, 'unavailable'], [404, 'unavailable'], [429, 'unavailable']]) {
      global.fetch = async () => new Response('', { status });
      await assert.rejects(drive.downloadDrivePhoto(photo, 'ephemeral', new AbortController().signal), error => error.code === code);
    }
    global.fetch = async url => url.includes('alt=media') ? new Response(new Uint8Array(policy.MAX_PHOTO_BYTES + 1)) : Response.json({ name: 'x.png', mimeType: 'image/png', size: '1' });
    await assert.rejects(drive.downloadDrivePhoto(photo, 'ephemeral', new AbortController().signal), error => error.code === 'limit');
  } finally { global.fetch = original; }
});

test('browser decoder rejects malformed content and excessive image dimensions', async () => {
  const original = global.createImageBitmap;
  try {
    global.createImageBitmap = async () => { throw new Error('fixture'); };
    await assert.rejects(policy.validateDecodedPhoto(new File(['bad'], 'bad.png', { type: 'image/png' })), error => error.code === 'invalid');
    let closed = false;
    global.createImageBitmap = async () => ({ width: 10000, height: 10000, close: () => { closed = true; } });
    await assert.rejects(policy.validateDecodedPhoto(new File(['bad'], 'big.png', { type: 'image/png' })), error => error.code === 'invalid');
    assert.equal(closed, true);
  } finally { global.createImageBitmap = original; }
});

test('Picker requests per-file authorization, deduplicates selections and aborts after logout', async () => {
  const original = global.window;
  let tokenOptions, pickerCreated = 0, callback;
  class Picker {
    constructor() { pickerCreated++; }
    setAppId() { return this; } setDeveloperKey() { return this; } setOAuthToken() { return this; }
    setOrigin() { return this; } setLocale() { return this; } addView() { return this; } enableFeature() { return this; }
    setCallback(value) { callback = value; return this; } build() { return this; } setVisible() {}
  }
  global.window = { location: { origin: 'https://fixture.invalid' }, google: {
    accounts: { oauth2: { initTokenClient: options => { tokenOptions = options; return { requestAccessToken() {} }; } } },
    picker: { PickerBuilder: Picker, DocsView: class { setMimeTypes() { return this; } }, Feature: { MULTISELECT_ENABLED: 'multi' } },
  } };
  try {
    const controller = new AbortController();
    const aborted = drive.selectDrivePhotos('en', controller.signal);
    controller.abort(); await assert.rejects(aborted, error => error.code === 'authorization');
    tokenOptions.callback({ access_token: 'late-fixture-token' }); assert.equal(pickerCreated, 0);
    let opened = 0;
    const selected = drive.selectDrivePhotos('zh', new AbortController().signal, () => { opened++; });
    assert.equal(opened, 0, 'authorization alone must not hide the application panel');
    assert.equal(tokenOptions.scope, 'https://www.googleapis.com/auth/drive.file');
    assert.equal(tokenOptions.include_granted_scopes, false);
    tokenOptions.callback({ access_token: 'fictional-token' });
    assert.equal(opened, 1, 'hide the application panel only after opening Picker');
    callback({ action: 'picked', docs: [{ id: 'same' }, { id: 'same' }] });
    assert.equal((await selected).photos.length, 1);
    const denied = drive.selectDrivePhotos('en', new AbortController().signal);
    tokenOptions.callback({ error: 'access_denied' }); await assert.rejects(denied, error => error.code === 'authorization');
  } finally { global.window = original; }
});
