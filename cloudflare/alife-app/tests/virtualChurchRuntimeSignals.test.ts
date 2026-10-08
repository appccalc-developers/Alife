import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from '../node_modules/typescript/lib/typescript.js'
import {
  markVirtualChurchRenderedAssetReady,
  beginVirtualChurchCharacterRetry,
  readVirtualChurchFallbackSignals,
  beginVirtualChurchCharacterDiagnosticScope,
  VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE as characterAsset,
  VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE as characterResource,
  VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE as characterFallback,
  VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE as churchFallback,
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE as characterReady,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE as churchReady,
} from '../src/views/virtualChurchRuntimeSignals.ts'
import { virtualChurchPlayerInputEnabled, virtualChurchRuntimeStatus } from '../src/views/virtualChurchStatusContract.ts'
import { virtualChurchDeferredCanStart } from '../src/views/virtualChurchLoadingContract.ts'
import { createVirtualChurchContinuousSubmissionSampler, VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS } from '../src/views/virtualChurchInputDiagnostic.ts'

test('V3 movement follows both rendered assets and dialogs, without blocking compatibility exploration or changing V2 loading', () => {
  for (const entranceReady of [false, true]) for (const characterReady of [false, true]) {
    const status = virtualChurchRuntimeStatus({ enabled: true, visualVersion: 'v3', entranceReady,
      characterReady, churchFallback: false, characterFallback: false })
    assert.equal(virtualChurchPlayerInputEnabled('v3', true, status, false), entranceReady && characterReady)
  }
  for (const status of ['idle', 'loading', 'ready', 'degraded'] as const) {
    assert.equal(virtualChurchPlayerInputEnabled('v3', false, status, false), false)
    assert.equal(virtualChurchPlayerInputEnabled('v3', true, status, true), false)
  }
  assert.equal(virtualChurchPlayerInputEnabled('v3', true, 'degraded', false), true)
  assert.equal(virtualChurchPlayerInputEnabled('v2', true, 'loading', false), true)
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const playerControlsEnabled = virtualChurchPlayerInputEnabled\(\s*config3D.visualVersion, interactive3DEnabled, runtimeStatus, dialogOpen/)
  const diagnostic = source.split('const applyDiagnosticInput =')[0].split('useEffect(() => {').at(-1)!
  assert.match(diagnostic, /\|\| !playerControlsEnabled/)
  assert.match(source, /\}, \[characterReview, playerControlsEnabled\]\)/)
  assert.match(source, /cameraMode !== 'showcase' && playerControlsEnabled \? \(/)
})

test('actual keyboard handlers reject covered input, enable after readiness, and discard held keys and queued actions on cleanup/blur', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const body = source.split('const previousOverflow = document.body.style.overflow')[1]
    .split('}, [dialogOpen, playerControlsEnabled])')[0]
  assert.ok(body.includes('const onKeyDown'), 'exercise the actual effect, not a duplicate handler')
  const script = ts.transpileModule(`const previousOverflow = document.body.style.overflow${body}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  for (const controlsEnabled of [false, true]) {
    const listeners = new Map<string, (event?: unknown) => void>()
    const movementRef = { current: { keyboardX: 0, keyboardZ: 0, sprint: false, jumpQueued: false, gestureQueued: false } }
    const fakeWindow = { addEventListener: (key: string, fn: (event?: unknown) => void) => listeners.set(key, fn),
      removeEventListener: (key: string) => listeners.delete(key), setTimeout: () => 1, clearTimeout: () => {} }
    const fakeDocument = { body: { style: { overflow: 'auto' } }, visibilityState: 'visible',
      addEventListener: () => {}, removeEventListener: () => {} }
    class FakeElement { closest() { return null } }
    const cleanup = new Function('window', 'document', 'movementRef', 'requestFrameRef', 'setShowControlsHint',
      'playerControlsEnabled', 'dialogOpen', 'Element', 'config3D', 'cameraModeRef', script)(
      fakeWindow, fakeDocument, movementRef, { current: () => {} }, () => {}, controlsEnabled, false,
      FakeElement, { visualVersion: 'v3' }, { current: 'follow' },
    ) as () => void
    const press = (key: string) => listeners.get('keydown')!({ key, target: new FakeElement(), repeat: false, preventDefault() {} })
    press('w'); press('Shift'); press(' '); press('g')
    assert.deepEqual(movementRef.current, { keyboardX: 0, keyboardZ: controlsEnabled ? -1 : 0,
      sprint: controlsEnabled, jumpQueued: controlsEnabled, gestureQueued: controlsEnabled })
    listeners.get('blur')!()
    press('d')
    assert.equal(movementRef.current.keyboardZ, 0, 'blur discarded the old W key')
    assert.equal(movementRef.current.sprint, false, 'blur discarded Shift')
    cleanup()
    assert.deepEqual(movementRef.current, { keyboardX: 0, keyboardZ: 0, sprint: false, jumpQueued: false, gestureQueued: false })
    assert.equal(fakeDocument.body.style.overflow, 'auto')
    assert.equal(listeners.size, 0)
  }
})

test('continuous cadence covers all real input phases and retains long gaps instead of restarting', () => {
  const sampler = createVirtualChurchContinuousSubmissionSampler()
  let now = 1000, elapsed = 0
  for (const segment of VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS) {
    sampler.observe(now, true, segment.phase, elapsed, true)
    now += segment.durationMs; elapsed += segment.durationMs
  }
  const report = sampler.observe(now, true, 'complete', null, true)!
  assert.equal(report.coversWholeSequence, true)
  assert.equal(report.status, 'complete')
  assert.equal(report.uninterrupted, false, 'one observation per long segment is not smooth motion')
  assert.ok(report.maximumGapMs >= 2300)
  assert.ok(report.interruptions > 0)
  assert.equal(report.durationMs, elapsed)
  assert.equal(sampler.observe(now + 20, true, 'idle', 0, true), null, 'completion never resets to green')
})

test('complete contiguous sequence passes, while prefix loss, hidden/clock failures, missing assets and overflow cannot', () => {
  const run = (failure = '') => {
    const sampler = createVirtualChurchContinuousSubmissionSampler()
    let now = 1000, elapsed = 0
    for (const segment of VIRTUAL_CHURCH_CONTINUOUS_DIAGNOSTIC_SEGMENTS) {
      for (let time = 0; time < segment.durationMs; time += 20) {
        if (failure === 'clock' && elapsed === 0) sampler.observe(NaN, true, segment.phase, 0, true)
        sampler.observe(now, failure !== 'hidden', segment.phase, failure === 'prefix' ? elapsed + 100 : elapsed, failure !== 'assets')
        now += 20; elapsed += 20
      }
    }
    return sampler.observe(now, true, 'complete', null, true)!
  }
  assert.equal(run().uninterrupted, true)
  for (const failure of ['prefix', 'hidden', 'clock', 'assets']) assert.equal(run(failure).uninterrupted, false)
  const overflow = createVirtualChurchContinuousSubmissionSampler()
  for (let i = 0; i < 5000; i++) overflow.observe(i, true, 'idle', i, true)
  assert.equal(overflow.observe(5001, true, 'complete', null, true)!.overflow, true)
  const partial = createVirtualChurchContinuousSubmissionSampler()
  partial.observe(100, true, 'walk-to-run', 4000, true)
  assert.equal(partial.observe(120, true, 'complete', null, true)!.coversWholeSequence, false)
})

test('whole-sequence hook is opt-in, passive, frame-deduplicated and removed on exit', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  const hook = source.split('const VirtualChurchContinuousTimingProbe =')[1].split('// Mounted only')[0]
  assert.match(source, /params.has\('profile3d'\) && params.get\('profile3dInput'\) === 'continuous' && visualVersion === 'v3'/)
  assert.match(hook, /observedEpoch === epoch.current/)
  assert.match(hook, /args\[2\] !== camera/)
  assert.match(hook, /scene.onAfterRender === hook/)
  assert.match(hook, /removeAttribute\(VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE\)/)
  assert.doesNotMatch(hook, /invalidate\(|requestAnimationFrame\(|setTimeout\(|setInterval\(/)
  const signals = readFileSync(new URL('../src/views/virtualChurchRuntimeSignals.ts', import.meta.url), 'utf8')
  assert.match(signals.split('VIRTUAL_CHURCH_TRANSIENT_ATTRIBUTES =')[1], /VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE/)
})

test('V3 deferred effects wait for both current rendered assets, while V2 retains its church-only gate', () => {
  assert.equal(virtualChurchDeferredCanStart(null, null, 100, true), false)
  assert.equal(virtualChurchDeferredCanStart('110', null, 100, true), false)
  assert.equal(virtualChurchDeferredCanStart('110', '95', 100, true), false)
  assert.equal(virtualChurchDeferredCanStart('110', '120', 100, true), true)
  assert.equal(virtualChurchDeferredCanStart('110', null, 100, false), true)
  assert.equal(virtualChurchDeferredCanStart('95', '120', 100, true), false)
})

test('V3 post-processing alone uses the two-asset deferred gate', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /attributeFilter: requireCharacterReady\s*\? \[VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE\]/)
  assert.match(source, /const postProcessingReady = useDeferredAfterHero\(\s*250,\s*true,\s*performanceCfg.postProcessing,\s*config3D.visualVersion === 'v3'/)
  assert.match(source, /const detailedSiteAssetsReady = useDeferredAfterHero\(\s*virtualChurchDeferredDelayMs\('siteDetails', perfConfig.isMobile\),\s*true,\s*\)/)
})

const fixture = () => {
  const values = new Map([[characterFallback, 'true'], [churchFallback, 'true']])
  return {
    getAttribute: (name: string) => values.get(name) ?? null,
    setAttribute: (name: string, value: string) => { values.set(name, value) },
    removeAttribute: (name: string) => { values.delete(name) },
  }
}

test('deferred character diagnostic writes cannot survive Canvas exit', async () => {
  const root = fixture()
  const scope = beginVirtualChurchCharacterDiagnosticScope(root)
  const publish = () => scope.write((target) => {
    target.setAttribute(characterAsset, '/character.glb')
    target.setAttribute(characterResource, 'active')
  })
  publish()
  assert.equal(root.getAttribute(characterResource), 'active')
  queueMicrotask(publish)
  scope.dispose()
  scope.dispose()
  await Promise.resolve()
  assert.equal(root.getAttribute(characterAsset), null)
  assert.equal(root.getAttribute(characterResource), null)
})

test('replacing a Canvas makes old writes and disposal harmless, including StrictMode replay', async () => {
  const root = fixture()
  const old = beginVirtualChurchCharacterDiagnosticScope(root)
  const current = beginVirtualChurchCharacterDiagnosticScope(root)
  current.write((target) => target.setAttribute(characterResource, 'current'))
  queueMicrotask(() => old.write((target) => target.setAttribute(characterResource, 'stale')))
  old.dispose()
  await Promise.resolve()
  assert.equal(root.getAttribute(characterResource), 'current')
  current.dispose()
  const replay = beginVirtualChurchCharacterDiagnosticScope(root)
  replay.write((target) => target.setAttribute(characterResource, 'replay'))
  current.dispose()
  assert.equal(root.getAttribute(characterResource), 'replay')
  replay.dispose()
  assert.equal(root.getAttribute(characterResource), null)
})

test('diagnostic ownership is root-local and disposal preserves unrelated runtime and application data', () => {
  const root = fixture()
  const otherRoot = fixture()
  root.setAttribute(churchReady, '100')
  root.setAttribute('data-application-test', 'keep')
  const scope = beginVirtualChurchCharacterDiagnosticScope(root)
  const other = beginVirtualChurchCharacterDiagnosticScope(otherRoot)
  other.write((target) => target.setAttribute(characterResource, 'other'))
  scope.dispose()
  assert.equal(otherRoot.getAttribute(characterResource), 'other')
  assert.equal(root.getAttribute(churchReady), '100')
  assert.equal(root.getAttribute(churchFallback), 'true')
  assert.equal(root.getAttribute('data-application-test'), 'keep')
  other.dispose()
})

test('the live view owns character diagnostics only while its current Canvas session is enabled', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /virtualChurchCharacterDiagnosticScope\?\.write\(\(root\) =>/)
  assert.match(source, /if \(!interactive3DEnabled \|\| !profile3DEnabled\) return\s+const scope = beginVirtualChurchCharacterDiagnosticScope\(\)/)
  assert.match(source, /scope\.dispose\(\)\s+if \(virtualChurchCharacterDiagnosticScope === scope\) virtualChurchCharacterDiagnosticScope = null/)
  assert.match(source, /\}, \[interactive3DEnabled, canvasSessionKey\]\)/)
})

for (const first of [characterReady, churchReady]) {
  test(`recovery ${first}: clear only rendered asset failure, keep unrelated degradation`, () => {
    const root = fixture()
    const status = () => {
      const fallback = readVirtualChurchFallbackSignals(root)
      return virtualChurchRuntimeStatus({ enabled: true, visualVersion: 'v3', entranceReady: true,
        characterReady: true, churchFallback: fallback.church, characterFallback: fallback.character })
    }
    assert.equal(status(), 'degraded')
    markVirtualChurchRenderedAssetReady(first, 123.45, root)
    assert.equal(root.getAttribute(first), '123.5')
    assert.deepEqual(readVirtualChurchFallbackSignals(root), {
      character: first !== characterReady, church: first !== churchReady,
    })
    assert.equal(status(), 'degraded')
    markVirtualChurchRenderedAssetReady(first === characterReady ? churchReady : characterReady, 150, root)
    assert.equal(status(), 'ready')
  })
}

test('invalid readiness cannot clear a real failure', () => {
  const root = fixture()
  for (const time of [NaN, Infinity, -1]) assert.throws(() => markVirtualChurchRenderedAssetReady(characterReady, time, root))
  assert.deepEqual(readVirtualChurchFallbackSignals(root), { character: true, church: true })
})

test('character retry is explicit, single-flight, and leaves church failure/readiness intact', () => {
  const root = fixture()
  root.setAttribute(churchReady, '50')
  assert.equal(beginVirtualChurchCharacterRetry(root), false, 'cannot retry while still loading')
  root.setAttribute(characterReady, '60')
  assert.equal(beginVirtualChurchCharacterRetry(root), true)
  assert.equal(root.getAttribute(characterReady), null)
  assert.equal(root.getAttribute(churchReady), '50')
  assert.deepEqual(readVirtualChurchFallbackSignals(root), { character: true, church: true })
  assert.equal(beginVirtualChurchCharacterRetry(root), false, 'double activation must not remount twice')
  // The error boundary makes another attempt available if the network is still down.
  root.setAttribute(characterReady, '70')
  assert.equal(beginVirtualChurchCharacterRetry(root), true)
  markVirtualChurchRenderedAssetReady(characterReady, 90, root)
  assert.equal(beginVirtualChurchCharacterRetry(root), false, 'a healthy character must not reload')
  assert.equal(root.getAttribute(churchFallback), 'true')
})

test('retry only remounts the failed V2 or V3 character boundary and exposes a bilingual keyboard-operable control', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /<GateAHeroAssetBoundary\s+key=\{`\$\{gateAAssetPath\}:\$\{characterRetryRevision\}`\}/)
  assert.match(source, /<LegacyCharacterAssetBoundary\s+key=\{`\$\{characterId\}:\$\{characterRetryRevision\}`\}/)
  assert.equal((source.match(/characterRetryRevision=\{characterRetryRevision\}/g) ?? []).length, 2)
  const callback = source.slice(source.indexOf('const retryCharacter = useCallback'), source.indexOf('}, [pageRef])', source.indexOf('const retryCharacter = useCallback')))
  assert.match(callback, /if \(!beginVirtualChurchCharacterRetry\(\)\) return/)
  assert.match(callback, /setCharacterRetryRevision/)
  assert.match(callback, /focus\(\{ preventScroll: true \}\)/)
  assert.doesNotMatch(callback, /setCanvasSessionKey|clearVirtualChurchRuntimeSignals|teleport|reload\(/)
  assert.match(source, /retryCharacter: '重新加载角色'/)
  assert.match(source, /retryCharacter: 'Reload character'/)
  assert.match(source, /type="button"\s+onClick=\{onRetryCharacter\}\s+disabled=\{characterRetryPending\}/)
  assert.match(source, /characterRetryPending=\{characterFallback && !characterReady\}/)
  assert.match(source, /onRetryCharacter=\{characterFallback \? retryCharacter : undefined\}/)
  assert.match(source, /showControlsHint\s*&& !nearEntranceInfoVisible\s*&& !nearMainHallInfoVisible\s*&& runtimeStatus === 'ready'/)
  assert.match(source, /showCameraHint && runtimeStatus === 'ready'/)
})

test('success clearing is wired inside the rendered-frame gate, not fallback or mount', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const hook = source.slice(source.indexOf('const useVirtualChurchRenderedAssetSignal'), source.indexOf('const LoadedChurchHeroAsset'))
  assert.equal((hook.match(/markVirtualChurchRenderedAssetReady\(/g) ?? []).length, 1)
  assert.match(hook, /if \(!pendingRef.current \|\| gl.getContext\(\).isContextLost\(\)\) return/)
  assert.match(hook, /if \(virtualChurchAssetHasRendered\([\s\S]*document.visibilityState === 'visible',[\s\S]*\)\) \{\s*pendingRef.current = false\s*markVirtualChurchRenderedAssetReady\(attribute, window.performance.now\(\)\)/)
})

test('neither visual version shows a stand-in person, while both wait for a posed and dressed character', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const avatar = source.slice(source.indexOf('const DeferredPlayerAvatar ='), source.indexOf('const LandingDust ='))
  assert.doesNotMatch(source, /GateAFemaleHeroAvatar/)
  assert.match(avatar, /<GateAHeroAssetBoundary[\s\S]*fallback=\{null\}/)
  assert.match(avatar, /<OptionalSharedMotionBoundary motionPath=\{motionPath\} fallback=\{standardHero\}>/)
  assert.match(avatar, /: standardHero\}/)
  assert.match(avatar, /<Suspense fallback=\{null\}>[\s\S]*<GateASharedMotionReviewHero[\s\S]*fallback=\{null\}/)
  assert.match(avatar, /if \(!loadDetailedAvatar\) return null/)
  assert.match(avatar, /<LegacyCharacterAssetBoundary[\s\S]*<Suspense fallback=\{null\}>/)
  assert.doesNotMatch(source, /ProceduralPlayerAvatar|using procedural fallback/)
  const legacyBoundary = source.slice(source.indexOf('class LegacyCharacterAssetBoundary'), source.indexOf('const AnimatedPlayerAvatar ='))
  assert.match(legacyBoundary, /return this\.state\.failed \? null : this\.props\.children/)
  assert.match(avatar, /<Suspense fallback=\{null\}>\s*<AnimatedPlayerAvatar/)
  const legacy = source.slice(source.indexOf('const AnimatedPlayerAvatar ='), source.indexOf('const DeferredPlayerAvatar ='))
  assert.match(legacy, /const avatarReady = poseReady && appearanceReady/)
  assert.match(legacy, /useVirtualChurchRenderedAssetSignal\(model, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady\)/)
  assert.match(legacy, /mixer\.update\(0\)\s*setPoseReady\(true\)/)
  assert.match(legacy, /visible=\{avatarReady\}/)
  assert.match(source, /loading3D: '正在准备教堂与角色…'/)
  assert.match(source, /loading3D: 'Preparing the church and character…'/)
  assert.match(source, /slowLoading3D: '完整角色仍在加载；不会先显示简化替身。'/)
  assert.match(source, /slowLoading3D: 'The full character is still loading; no stand-in will appear.'/)
  const indicator = source.slice(source.indexOf('const VirtualChurchRuntimeStatusIndicator ='), source.indexOf('const virtualChurchRuntimeErrorMessage ='))
  assert.match(indicator, /if \(status !== 'loading' \|\| !gateASafeArea\) return/)
  assert.match(indicator, /window\.setTimeout\(\(\) => setSlowLoading\(true\), 8_000\)/)
  assert.match(indicator, /return \(\) => window\.clearTimeout\(timer\)/)
  assert.match(indicator, /slowLoading && gateASafeArea \? t\.slowLoading3D : t\.loading3D/)
  assert.match(source, /characterUnavailable3D: '角色暂时无法显示；可以重新加载角色'/)
  assert.match(source, /characterUnavailable3D: 'The character is temporarily unavailable; reload it to try again'/)
  assert.match(source, /onRetryCharacter \? t\.characterUnavailable3D : t\.degraded3D/)
})

test('an unavailable optional motion review retains the actual character model', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const boundary = source.slice(source.indexOf('class OptionalSharedMotionBoundary'), source.indexOf('class GateAHeroAssetBoundary'))
  assert.match(boundary, /clearFailedGltfAsset\(this\.props\.motionPath\)/)
  assert.match(boundary, /return this\.state\.failed \? this\.props\.fallback : this\.props\.children/)
  assert.doesNotMatch(boundary, /VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE/)
  assert.doesNotMatch(boundary, /VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE/)
})

test('V2 waits for its character before reporting readiness, including a hidden failed asset', () => {
  const signals = {
    enabled: true, visualVersion: 'v2' as const, entranceReady: true,
    characterReady: false, churchFallback: false, characterFallback: false,
  }
  assert.equal(virtualChurchRuntimeStatus(signals), 'loading')
  assert.equal(virtualChurchRuntimeStatus({ ...signals, characterReady: true }), 'ready')
  assert.equal(virtualChurchRuntimeStatus({ ...signals, characterReady: true, characterFallback: true }), 'degraded')
})
