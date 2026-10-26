// Test the generated production SW against a local synthetic API/file server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const dist = process.env.ALIFE_PWA_DIST;
if (!dist) throw new Error('ALIFE_PWA_DIST must point to the current production build');
const root = path.resolve(dist);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGMQz44Sz45igFAAFxIDcXHULXQAAAAASUVORK5CYII=', 'base64');
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/cache-test') { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); return res.end('<!doctype html><title>PWA synthetic cache regression</title>'); }
  const api = /^\/(?:images\/)?api\//.test(pathname) || /(?:^|\/)groups\/[^/]+\/albums\//.test(pathname);
  if (api) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (pathname.endsWith('.png')) { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
    if (!pathname.endsWith('.mp4')) { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><p>Private document fixture</p>'); }
  }
  if (pathname === '/media/public-cache-fixture.png') { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
  const file = api ? path.join(root, 'media/homepage-hero.mp4') : path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('Missing fixture asset'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Content-Length', fs.statSync(file).size);
  // Full 200 responses allow Workbox's range plugin to cache and replay video.
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto(origin + '/cache-test');
    await page.evaluate(async () => {
      for (const name of ['alife-video-cache', 'alife-app-cache', 'alife-image-cache', 'alife-external-image-cache', 'alife-runtime-cache', 'another-app-fixture']) {
        await (await caches.open(name)).put('/api/private-old-fixture', new Response('synthetic old private response'));
      }
      await (await caches.open('alife-image-cache-v2')).put('/images/groups/g/albums/a/old.png', new Response('old private album fixture'));
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      for (const name of ['alife-video-cache', 'alife-app-cache', 'alife-image-cache', 'alife-external-image-cache', 'alife-runtime-cache']) {
        if (names.includes(name) && await (await caches.open(name)).match('/api/private-old-fixture')) return false;
      }
      return true;
    });
    const activated = await page.evaluate(() => caches.keys());
    assert.ok(activated.includes('another-app-fixture'));
    assert.ok(activated.some(name => name.includes('precache')));
    // The separate 3D activation listener may reopen an empty legacy shell cache
    // from its earlier snapshot. Its contents, rather than its name, are the invariant.
    for (const name of ['alife-video-cache', 'alife-app-cache', 'alife-image-cache', 'alife-external-image-cache', 'alife-runtime-cache']) {
      if (activated.includes(name)) assert.equal(await page.evaluate(async name => (await (await caches.open(name)).keys()).length, name), 0, `${name} must contain no legacy entries`);
    }
    assert.equal(await page.evaluate(async () => Boolean(await (await caches.open('alife-image-cache-v2')).match('/images/groups/g/albums/a/old.png'))), false);
    const imagePaths = ['/api/private-image-fixture.png', '/images/api/private-image-fixture.png', '/api/album-photos/fixture.png', '/images/groups/g/albums/a/photo.png', '/media/public-cache-fixture.png'];
    for (const src of imagePaths) await page.evaluate(src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = reject; image.src = src; document.body.append(image);
    }), src);
    for (const src of ['/api/private-video-fixture.mp4', '/images/api/private-video-fixture.mp4', '/media/homepage-hero.mp4']) await page.evaluate(src => new Promise((resolve, reject) => {
      const video = document.createElement('video'); video.preload = 'auto'; video.muted = true; video.onloadeddata = () => resolve(video.duration); video.onerror = () => reject(new Error('Video fixture failed')); video.src = src; document.body.append(video);
    }), src);
    const documentPage = await context.newPage();
    await documentPage.goto(origin + '/api/private-document-fixture');
    await documentPage.goto(origin + '/images/api/private-document-fixture');
    await page.waitForFunction(async () => Boolean(await (await caches.open('alife-video-cache-v2')).match('/media/homepage-hero.mp4')));
    const apiEntries = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith('alife-') && !name.includes('precache')) continue;
        for (const request of await (await caches.open(name)).keys()) if (/^\/(?:images\/)?api(?:\/|$)/.test(new URL(request.url).pathname) || /(?:^|\/)groups\/[^/]+\/albums\//.test(new URL(request.url).pathname)) urls.push(request.url);
      }
      return urls;
    });
    assert.deepEqual(apiEntries, []);
    await context.setOffline(true);
    const privatePaths = ['/api/album-photos/fixture.png', '/images/groups/g/albums/a/photo.png', '/api/private-image-fixture.png', '/images/api/private-image-fixture.png', '/api/private-video-fixture.mp4', '/images/api/private-video-fixture.mp4', '/api/private-document-fixture', '/images/api/private-document-fixture'];
    const offline = await page.evaluate(async paths => Promise.all(paths.map(async url => {
      try { await fetch(url); return { url, replayed: true }; } catch { return { url, replayed: false }; }
    })), privatePaths);
    assert.ok(offline.every(result => !result.replayed));
    await page.evaluate(() => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = '/media/public-cache-fixture.png'; document.body.append(image);
    }));
    await page.evaluate(() => new Promise((resolve, reject) => {
      const video = document.createElement('video'); video.preload = 'auto'; video.onloadeddata = resolve; video.onerror = () => reject(new Error('Offline public video unavailable')); video.src = '/media/homepage-hero.mp4'; document.body.append(video);
    }));
    const result = { generatedServiceWorker: 'pass', migration: 'pass', privateImageVideoDocumentNotCached: 'pass', privateOfflineReplayBlocked: 'pass', publicImageVideoOffline: 'pass', offline };
    if (process.env.ALIFE_QA_OUTPUT) { fs.mkdirSync(process.env.ALIFE_QA_OUTPUT, { recursive: true }); fs.writeFileSync(path.join(process.env.ALIFE_QA_OUTPUT, 'pwa-cache-browser.json'), JSON.stringify(result, null, 2)); }
    console.log(JSON.stringify(result));
    await context.close();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
