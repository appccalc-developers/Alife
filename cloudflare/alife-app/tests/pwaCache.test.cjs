const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { loadSource } = require('./helpers/loadSource.cjs');

test('API files always select NetworkOnly, while public resources retain their caches', () => {
  let options;
  const config = loadSource('vite.config.ts', {
    vite: { defineConfig: x => x, loadEnv: () => ({}) }, '@vitejs/plugin-react': { default: () => ({}) },
    'vite-plugin-pwa': { VitePWA: x => { options = x; return {}; } },
    'node:fs': require('node:fs'), 'node:path': require('node:path'), 'node:url': require('node:url'),
    './scripts/virtualChurchReviewFault': loadSource('scripts/virtualChurchReviewFault.ts'),
    './src/views/virtualChurchPwaContract': loadSource('src/views/virtualChurchPwaContract.ts'),
  }).default;
  config({ command: 'build', mode: 'production' });
  const origin = 'https://fixture.invalid';
  const match = (url, destination, mode) => {
    // Workbox serializes callbacks: verify they work without config closures.
    const context = { self: { location: { origin } }, input: { url: new URL(url, origin), request: { destination, mode } } };
    return options.workbox.runtimeCaching.find(rule => vm.runInNewContext(`(${rule.urlPattern.toString()})(input)`, context));
  };
  for (const url of ['/api/album-photos/fixture', '/images/groups/group/albums/album/photo.jpg', 'https://images.fixture/groups/group/albums/album/photo.jpg', '/images/groups%2Fgroup%2Falbums%2Falbum%2Fphoto.jpg', '/api/file-assets/fixture/registration-material', '/api/private-files/proof.png?exp=1&sig=fixture', '/images/api/private-files/private/proof.mp4', '/api/church-life/bulletins/fixture/open', 'https://other.invalid/api/private-files/proof.png']) {
    for (const destination of ['document', 'image', 'video', '']) assert.equal(match(url, destination, destination === 'document' ? 'navigate' : 'cors').handler, 'NetworkOnly');
  }
  assert.equal(match('/media/public-fixture.png', 'image', 'no-cors').handler, 'StaleWhileRevalidate');
  assert.equal(match('/media/public-fixture.mp4', 'video', 'no-cors').handler, 'CacheFirst');
  assert.equal(match('/', 'document', 'navigate').handler, 'NetworkFirst');
});

test('activation migration removes only the five legacy runtime caches', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../public/sw-runtime-cache-migration.js'), 'utf8');
  const deleted = [];
  const names = ['alife-video-cache', 'alife-app-cache', 'alife-image-cache', 'alife-external-image-cache', 'alife-runtime-cache', 'workbox-precache-fixture', 'another-app', 'alife-image-cache-v2'];
  let activate, completion;
  vm.runInNewContext(source, { URL, self: { addEventListener: (event, listener) => { assert.equal(event, 'activate'); activate = listener; } }, caches: { keys: async () => names, delete: async name => deleted.push(name), open: async () => ({ keys: async () => [] }) } });
  activate({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.deepEqual(deleted, names.slice(0, 5));
});

test('activation removes old album originals from v2 caches and preserves other assets', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../public/sw-runtime-cache-migration.js'), 'utf8');
  const deleted = []; let activate, completion;
  vm.runInNewContext(source, { URL, self: { addEventListener: (_, listener) => { activate = listener; } }, caches: {
    keys: async () => ['alife-image-cache-v2', 'unrelated-cache'],
    open: async name => { assert.equal(name, 'alife-image-cache-v2'); return {
      keys: async () => ['/images/groups/g/albums/a/photo.png', '/media/public.png', '/images/groups%2Fg%2Falbums%2Fa%2Fphoto.jpg'].map(p => ({ url: `https://fixture.invalid${p}` })),
      delete: async request => deleted.push(request.url),
    }; },
  } });
  activate({ waitUntil: promise => { completion = promise; } }); await completion;
  assert.equal(deleted.length, 2); assert.ok(deleted.every(url => !url.endsWith('public.png')));
});
