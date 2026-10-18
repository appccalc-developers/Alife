// Fictional browser/provider fixtures; no real Google account or production API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_QA_OUTPUT;
const albumId = '22222222-2222-2222-2222-222222222222';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGMQz44Sz45igFAAFxIDcXHULXQAAAAASUVORK5CYII=', 'base64');
const secondPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGM4UWFzosKGAUIBACvOBfFN/kCrAAAAAElFTkSuQmCC', 'base64');
const googleFixture = `
globalThis.google = {
 accounts: { oauth2: { initTokenClient: options => ({ requestAccessToken: () => queueMicrotask(() => options.callback({ access_token: 'fictional-ephemeral-token' })) }) } },
 picker: { Feature: { MULTISELECT_ENABLED: 'multi' }, DocsView: class { setMimeTypes() { return this } },
 PickerBuilder: class {
  setAppId() { return this } setDeveloperKey() { return this } setOAuthToken() { return this }
  setOrigin() { return this } setLocale() { return this } addView() { return this } enableFeature() { return this }
  setCallback(callback) { this.callback = callback; return this } build() { return this }
  setVisible() { queueMicrotask(() => this.callback({ action: 'picked', docs: [{ id: 'fictional-drive-photo', name: 'Drive photo.png', mimeType: 'image/png' }] })) }
 } }
}; globalThis.gapi = { load: (_, options) => options.callback() };
`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const mode of ['local', 'drive', 'changed', 'cancel', 'duplicates', 'invalid']) {
      const context = await browser.newContext({ viewport: { width: mode === 'drive' ? 1280 : 320, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      await context.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: googleFixture }));
      await context.route('https://apis.google.com/js/api.js', route => route.fulfill({ contentType: 'text/javascript', body: googleFixture }));
      await context.route('https://www.googleapis.com/drive/v3/files/**', route => {
        assert.equal(route.request().headers().authorization, 'Bearer fictional-ephemeral-token');
        return route.fulfill(route.request().url().includes('alt=media') ? { contentType: 'image/png', body: png } : { json: { name: 'Drive photo.png', mimeType: 'image/png', size: String(png.length), capabilities: { canDownload: true } } });
      });
      const uploads = []; let failed = false, firstRoute;
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/photo-upload')) {
          const body = route.request().postDataBuffer().toString('latin1');
          const id = /name="uploadId"\r\n\r\n([^\r]+)/.exec(body)?.[1]; uploads.push(id);
          if (mode === 'cancel' && uploads.length === 1) { firstRoute = route; return; }
          if (mode === 'local' && uploads.length === 2 && !failed) { failed = true; return route.fulfill({ status: 503, json: { message: 'Synthetic transfer failure' } }); }
          return route.fulfill({ json: { fileAssetId: id }, headers: { 'cache-control': 'private, no-store' } });
        }
        if (url.pathname === `/api/albums/${albumId}`) return route.fulfill({ json: {
          album: { id: albumId, visibility: mode === 'changed' ? 'groupVisible' : mode === 'drive' ? 'groupVisible' : 'public' }, canManage: mode !== 'changed', photos: [], children: [], breadcrumbs: [],
        } });
        return route.fulfill({ json: [] });
      });
      await page.goto(`${base}/tests/fixtures/albumImport.html?mode=${mode === 'drive' ? 'group' : 'public'}`);
      if (mode === 'drive') {
        await page.getByRole('button', { name: 'Open Drive fixture' }).click();
        await page.getByRole('button', { name: 'Choose photos', exact: true }).click();
        await page.getByRole('img', { name: 'Drive photo.png' }).waitFor();
      } else {
        await page.getByLabel('Fixture photos').setInputFiles([{ name: 'One.png', mimeType: 'image/png', buffer: png }, { name: 'Two.png', mimeType: 'image/png', buffer: mode === 'duplicates' ? png : mode === 'invalid' ? Buffer.from('not an image') : secondPng }]);
        await page.getByRole('img', { name: mode === 'duplicates' || mode === 'invalid' ? 'One.png' : 'Two.png' }).waitFor().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error; });
        if (mode === 'duplicates') assert.equal(await page.getByRole('img').count(), 1);
        if (mode === 'invalid') await page.getByRole('alert').filter({ hasText: 'Two.png' }).waitFor();
        await page.getByText('Public: anyone can view these photos after import.').waitFor();
      }
      assert.equal(uploads.length, 0, 'preview must not upload');
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      if (output) { fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, `album-import-${mode}-en.png`) }); }
      await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
      if (mode === 'cancel') {
        await page.waitForFunction(() => [...document.querySelectorAll('p')].some(p => p.textContent === 'Importing…'));
        await page.getByRole('button', { name: 'Cancel remaining' }).click();
        await firstRoute.fulfill({ json: { fileAssetId: uploads[0] } });
        await page.getByText('1 of 2 imported', { exact: true }).waitFor(); assert.equal(uploads.length, 1);
      } else if (mode === 'changed') {
        await page.getByRole('alert').filter({ hasText: 'Album access or visibility changed' }).waitFor();
        assert.equal(uploads.length, 0);
      } else if (mode === 'local') {
        await page.getByRole('button', { name: 'Retry failed photos' }).waitFor();
        await page.getByRole('button', { name: 'Retry failed photos' }).click();
        await page.getByText('2 of 2 imported', { exact: true }).waitFor();
        assert.equal(uploads.length, 3); assert.equal(uploads[1], uploads[2]); assert.notEqual(uploads[0], uploads[1]);
      } else { await page.getByText('1 of 1 imported', { exact: true }).waitFor(); assert.equal(uploads.length, 1); }
      // Language updates retain the panel's item identities and completion state.
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Switch language').click());
      await page.getByRole('heading', { name: mode === 'drive' ? '从 Google Drive 导入' : '导入照片' }).waitFor();
      if (output) await page.screenshot({ path: path.join(output, `album-import-${mode}-zh.png`) });
      assert.deepEqual(errors, []);
      results.push({ mode, uploads: uploads.length, previewRequiresConfirmation: true, languageSwitch: 'pass', consoleErrors: errors });
      await context.close();
    }
    // A delayed Google popup must leave a visible, cancellable application panel.
    const authContext = await browser.newContext({ viewport: { width: 320, height: 900 }, serviceWorkers: 'block' });
    const authPage = await authContext.newPage();
    const authErrors = []; const authUploads = [];
    authPage.on('pageerror', error => authErrors.push(error.message));
    const delayedGoogle = googleFixture
      .replace("requestAccessToken: () => queueMicrotask(() => options.callback({ access_token: 'fictional-ephemeral-token' }))", "requestAccessToken: () => { globalThis.releaseDriveToken = () => options.callback({ access_token: 'fictional-ephemeral-token' }); }")
      .replace('PickerBuilder: class {', 'PickerBuilder: class { constructor() { globalThis.fixturePickerCreated = true; }');
    assert.notEqual(delayedGoogle, googleFixture);
    await authContext.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: delayedGoogle }));
    await authContext.route('https://apis.google.com/js/api.js', route => route.fulfill({ contentType: 'text/javascript', body: delayedGoogle }));
    await authContext.route('**/api/**', route => { authUploads.push(route.request().method()); return route.fulfill({ json: [] }); });
    await authPage.goto(`${base}/tests/fixtures/albumImport.html?mode=group`);
    await authPage.getByRole('button', { name: 'Open Drive fixture' }).click();
    await authPage.getByRole('button', { name: 'Choose photos', exact: true }).click();
    const authDialog = authPage.getByRole('dialog', { name: 'Import from Google Drive' });
    await authDialog.getByRole('status').filter({ hasText: 'Continue in the Google sign-in window' }).waitFor();
    assert.equal(await authDialog.getByRole('button', { name: 'Close', exact: true }).last().isEnabled(), true);
    if (output) await authPage.screenshot({ path: path.join(output, 'album-import-authorization-en.png') });
    await authPage.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Switch language').click());
    await authPage.getByRole('heading', { name: '从 Google Drive 导入', exact: true }).waitFor();
    await authPage.getByRole('status').filter({ hasText: '请在 Google 登录窗口中继续' }).waitFor();
    if (output) await authPage.screenshot({ path: path.join(output, 'album-import-authorization-zh.png') });
    await authPage.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).last().click();
    await authPage.getByRole('dialog').waitFor({ state: 'hidden' });
    await authPage.evaluate(async () => { globalThis.releaseDriveToken(); await Promise.resolve(); await Promise.resolve(); });
    assert.equal(await authPage.evaluate(() => Boolean(globalThis.fixturePickerCreated)), false, 'closing must suppress a late Picker');
    assert.deepEqual(authUploads, []); assert.deepEqual(authErrors, []);
    results.push({ mode: 'authorization', uploads: 0, visibleWhileAuthorizing: true, cancellable: true, latePickerSuppressed: true, languageSwitch: 'pass', consoleErrors: authErrors });
    await authContext.close();
    if (output) fs.writeFileSync(path.join(output, 'album-import-browser.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
