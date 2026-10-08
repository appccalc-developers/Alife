import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  virtualChurchChunkLoadFailed,
  virtualChurchRecoveryShouldStart,
} from '../src/app/routing/virtualChurchRouteRecoveryContract.ts'

test('recognizes scene-owned dynamic import failures without mistaking asset or WebGL errors', () => {
  assert.equal(virtualChurchChunkLoadFailed(new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/VirtualChurchSurroundingFacades-old.js')), true)
  assert.equal(virtualChurchChunkLoadFailed(new Error('ChunkLoadError: loading chunk 42 failed')), true)
  assert.equal(virtualChurchChunkLoadFailed('error loading dynamically imported module'), true)
  assert.equal(virtualChurchChunkLoadFailed(new Error('404 character GLB')), false)
  assert.equal(virtualChurchChunkLoadFailed(new Error('WebGL context lost')), false)
})

test('recovers Vite preload failures only for the church-owned hashed stylesheets', () => {
  for (const file of ['VirtualChurchView-Bs9fcKYv.css', 'virtualChurchMainHallBudget-ewZIKxte.css']) {
    const message = `Unable to preload CSS for /assets/${file}`
    assert.equal(virtualChurchChunkLoadFailed(new Error(message)), true, file)
    assert.equal(virtualChurchChunkLoadFailed(message), true, file)
  }
  for (const message of [
    'Unable to preload CSS for /assets/BibleStudyView-K7cjSXU7.css',
    'Unable to preload CSS for /assets/index-CnGIoEZW.css',
    'Unable to preload CSS for /assets/VirtualChurchViewExtra-old.css',
    'Unable to preload CSS for /assets/VirtualChurchView-old.js',
    'Unable to preload CSS for /virtual-church-assets/VirtualChurchView-old.css',
    '404 character GLB',
    'WebGL context lost',
    '401 Unauthorized',
  ]) {
    assert.equal(virtualChurchChunkLoadFailed(new Error(message)), false, message)
  }
})

test('one automatic clean reload is guarded by both URL marker and session state', () => {
  assert.equal(virtualChurchRecoveryShouldStart({ force: false, markerPresent: false, storageAttempted: false, online: true }), true)
  assert.equal(virtualChurchRecoveryShouldStart({ force: false, markerPresent: true, storageAttempted: false, online: true }), false)
  assert.equal(virtualChurchRecoveryShouldStart({ force: false, markerPresent: false, storageAttempted: true, online: true }), false)
  assert.equal(virtualChurchRecoveryShouldStart({ force: false, markerPresent: true, storageAttempted: null, online: true }), false)
  assert.equal(virtualChurchRecoveryShouldStart({ force: true, markerPresent: true, storageAttempted: true, online: true }), true)
  assert.equal(virtualChurchRecoveryShouldStart({ force: false, markerPresent: false, storageAttempted: false, online: false }), false)
  assert.equal(virtualChurchRecoveryShouldStart({ force: true, markerPresent: true, storageAttempted: true, online: false }), false,
    'manual retry must not evict the offline shell and cached pages')
})

test('scene errors use the same cache recovery as route errors, without clearing its guard during recovery entry', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const routes = readFileSync(new URL('../src/app/routing/AppRoutes.tsx', import.meta.url), 'utf8')
  const boundary = readFileSync(new URL('../src/app/routing/VirtualChurchRouteBoundary.tsx', import.meta.url), 'utf8')

  assert.match(view, /if \(virtualChurchChunkLoadFailed\(error\)\) void recoverVirtualChurchChunkOnce\(\)/)
  assert.match(view, /sceneRuntimeError && virtualChurchChunkLoadFailed\(sceneRuntimeError\)[\s\S]*?recoverVirtualChurchChunkOnce\(true\)/)
  assert.match(routes, /if \(cleanUrl !== null\) \{[\s\S]*?\} else \{[\s\S]*?removeItem\(VIRTUAL_CHURCH_CHUNK_RECOVERY_KEY\)/)
  assert.match(boundary, /export const recoverVirtualChurchChunkOnce = \(force = false\)/)
  assert.match(boundary, /online: navigator\.onLine !== false/)
  assert.match(boundary, /现有缓存已保留/)
  assert.match(view, /chunkOfflineBody: '当前离线/)
  assert.match(view, /window\.addEventListener\('online', updateConnectionState\)/)
})
