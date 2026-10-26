import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as recoveryContract from '../src/app/routing/virtualChurchRouteRecoveryContract.ts'

const recoveryKey = 'alife:virtual-church:chunk-recovery-attempted'
const scenePaths = ['/virtual-church', '/virtual-church/study-room', '/virtual-church/main-hall']
const boundarySource = readFileSync(new URL('../src/app/routing/VirtualChurchRouteBoundary.tsx', import.meta.url), 'utf8')
const boundaryCode = ts.transpileModule(boundarySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function createVisit(path: string, storageAvailable = true) {
  const values = new Map([[recoveryKey, 'true']])
  const listeners = new Set<unknown>()
  const location = { href: `https://example.test${path}` }
  const historyState = { key: 'existing-router-entry' }
  const browser = {
    location,
    history: {
      state: historyState,
      replaceState(state: unknown, _title: string, href: string) {
        assert.equal(state, historyState, 'recovery cleanup preserves router state')
        location.href = href
      },
    },
    sessionStorage: {
      getItem(key: string) {
        if (!storageAvailable) throw new Error('Storage unavailable')
        return values.get(key) ?? null
      },
      removeItem(key: string) {
        if (!storageAvailable) throw new Error('Storage unavailable')
        values.delete(key)
      },
    },
    addEventListener(name: string, callback: unknown) { listeners.add(`${name}:${String(callback)}`) },
    removeEventListener(name: string, callback: unknown) { listeners.delete(`${name}:${String(callback)}`) },
  }
  const exports: Record<string, any> = {}
  const dependencies: Record<string, unknown> = {
    react: { Component: class {} },
    'react/jsx-runtime': {},
    '../../i18n/virtualChurchRecovery': {},
    './virtualChurchRouteRecoveryContract': recoveryContract,
  }
  runInNewContext(boundaryCode, {
    exports, window: browser, navigator: { onLine: true },
    require(name: string) {
      assert.ok(name in dependencies, `unexpected boundary dependency: ${name}`)
      return dependencies[name]
    },
  })
  return { Boundary: exports.default, browser, values, listeners }
}

test('all scene routes clean a recovered URL while retaining the guard for late imports', () => {
  for (const path of scenePaths) {
    const { Boundary, browser, values } = createVisit(`${path}?vcVisual=v3&vcRecovery=attempt#entrance`)
    new Boundary().componentDidMount()
    assert.equal(browser.location.href, `https://example.test${path}?vcVisual=v3#entrance`, path)
    assert.equal(values.get(recoveryKey), 'true', path)
    assert.equal(recoveryContract.virtualChurchRecoveryShouldStart({
      force: false, online: true, markerPresent: false, storageAttempted: values.has(recoveryKey),
    }), false, 'a later import failure in the recovered visit must not start a reload loop')
  }
})

test('a later fresh nested visit gets a new recovery attempt after leaving a recovered route', () => {
  for (const path of scenePaths.slice(1)) {
    const { Boundary, browser, values, listeners } = createVisit(`${path}?vcRecovery=attempt`)
    const recovered = new Boundary()
    recovered.componentDidMount()
    recovered.componentWillUnmount()
    assert.equal(listeners.size, 0, 'leaving removes online/offline listeners')
    assert.equal(values.get(recoveryKey), 'true', 'unmount must not weaken an in-flight reload guard')

    browser.location.href = `https://example.test${path}?vcVisual=v3`
    new Boundary().componentDidMount()
    assert.equal(values.has(recoveryKey), false, path)
    assert.equal(recoveryContract.virtualChurchRecoveryShouldStart({
      force: false, online: true,
      markerPresent: recoveryContract.virtualChurchRecoveryMarkerIsPresent(browser.location.href),
      storageAttempted: values.has(recoveryKey),
    }), true, 'the previous visit must not disable recovery for the rest of the session')
  }
})

test('StrictMode lifecycle rehearsal does not clear the recovered visit guard', () => {
  const { Boundary, browser, values, listeners } = createVisit('/virtual-church/main-hall?vcRecovery=attempt')
  const boundary = new Boundary()
  boundary.componentDidMount()
  boundary.componentWillUnmount()
  boundary.componentDidMount()
  assert.equal(browser.location.href, 'https://example.test/virtual-church/main-hall')
  assert.equal(values.get(recoveryKey), 'true')
  assert.equal(listeners.size, 2)
  boundary.componentWillUnmount()
  assert.equal(listeners.size, 0)
})

test('a boundary initially showing an import error resets only a fresh visit guard', () => {
  for (const recovering of [false, true]) {
    const { Boundary, browser, values } = createVisit(`/virtual-church/study-room${recovering ? '?vcRecovery=attempt' : ''}`)
    const boundary = new Boundary()
    const error = new Error('Failed to fetch dynamically imported module: /assets/VirtualChurchStudyRoom-stale.js')
    Object.assign(boundary.state, Boundary.getDerivedStateFromError(error))
    let attempted: boolean | undefined
    boundary.requestChunkRecovery = () => {
      attempted = recoveryContract.virtualChurchRecoveryShouldStart({
        force: false, online: true,
        markerPresent: recoveryContract.virtualChurchRecoveryMarkerIsPresent(browser.location.href),
        storageAttempted: values.has(recoveryKey),
      })
    }
    boundary.componentDidMount()
    boundary.componentDidCatch(error, { componentStack: '' })
    assert.equal(attempted, !recovering, 'a failed reload remains guarded; a later visit can recover')
  }
})

test('unavailable session storage preserves the URL guard on every scene route', () => {
  for (const path of scenePaths) {
    const { Boundary, browser } = createVisit(`${path}?vcVisual=v3&vcRecovery=attempt`, false)
    assert.doesNotThrow(() => new Boundary().componentDidMount())
    assert.equal(recoveryContract.virtualChurchRecoveryMarkerIsPresent(browser.location.href), true, path)
    assert.equal(recoveryContract.virtualChurchRecoveryShouldStart({
      force: false, online: true, markerPresent: true, storageAttempted: null,
    }), false)
  }
})
