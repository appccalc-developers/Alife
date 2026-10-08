import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const hookPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchAccessibility.ts',
)
const contractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchAccessibilityContract.ts',
)
const globalStylePath = resolve(appRoot, 'src', 'styles', 'global.css')
const normalizeSource = (source) => source.replace(/\r\n?/gu, '\n')

const [viewSource, hookSource, contractSource, globalStyleSource, controlsSource] = await Promise.all([
  readFile(viewPath, 'utf8').then(normalizeSource),
  readFile(hookPath, 'utf8').then(normalizeSource),
  readFile(contractPath, 'utf8').then(normalizeSource),
  readFile(globalStylePath, 'utf8').then(normalizeSource),
  readFile(resolve(appRoot, 'src', 'views', 'virtualChurchTourControls.css'), 'utf8').then(normalizeSource),
])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

const transpiled = ts.transpileModule(contractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: contractPath,
  reportDiagnostics: true,
})
if ((transpiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiled.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile accessibility contract:\n${formatted}`)
}
const contractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const contract = await import(contractUrl)

// Execute the page-level hook with a minimal DOM fixture. Modal-local hiding
// alone misses the main app shell because Virtual Church is portalled to body.
const hookCode = ts.transpileModule(hookSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  fileName: hookPath,
}).outputText
const pageIsolationCases = []
for (const initialHidden of [null, 'false', 'true']) {
  const doc = { activeElement: null }
  class Element {
    children = []
    parentElement = null
    inert = false
    isConnected = true
    attributes = new Map()
    getAttribute(name) { return this.attributes.get(name) ?? null }
    setAttribute(name, value) { this.attributes.set(name, value) }
    removeAttribute(name) { this.attributes.delete(name) }
    contains(node) { return node === this || this.children.some(child => child.contains(node)) }
    focus() { doc.activeElement = this }
  }
  const shell = new Element()
  const trigger = new Element()
  const page = new Element()
  const preHidden = new Element()
  const body = new Element()
  shell.children = [trigger]
  trigger.parentElement = shell
  body.children = [shell, page, preHidden]
  body.children.forEach(child => { child.parentElement = body })
  if (initialHidden !== null) shell.setAttribute('aria-hidden', initialHidden)
  preHidden.inert = true
  preHidden.setAttribute('aria-hidden', 'true')
  doc.activeElement = trigger
  const effects = []
  const exports = {}
  new Function('exports', 'require', 'document', 'HTMLElement', hookCode)(
    exports,
    name => name === 'react'
      ? { useRef: () => ({ current: page }), useEffect: effect => effects.push(effect) }
      : contract,
    doc,
    Element,
  )
  if (typeof exports.useVirtualChurchPageIsolation !== 'function') {
    errors.push('full-screen portal must isolate the main app shell for its entire lifetime')
    break
  }
  exports.useVirtualChurchPageIsolation()
  const activate = effects[0]
  for (let replay = 0; replay < 2; replay++) {
    const cleanup = activate()
    if (!shell.inert || shell.getAttribute('aria-hidden') !== 'true'
      || page.inert || page.getAttribute('aria-hidden') !== null || doc.activeElement !== page) {
      errors.push('page isolation must hide only background siblings and move focus into the scene')
    }
    cleanup()
    if (shell.inert || shell.getAttribute('aria-hidden') !== initialHidden
      || !preHidden.inert || preHidden.getAttribute('aria-hidden') !== 'true'
      || doc.activeElement !== trigger) {
      errors.push('page isolation cleanup must restore exact background attributes and focus after StrictMode replay')
    }
  }
  pageIsolationCases.push({ initialHidden, effectReplays: 2 })
}

const expectedFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')
if (
  contract.VIRTUAL_CHURCH_DIALOG_FOCUSABLE_SELECTOR !==
  expectedFocusableSelector
) {
  errors.push('dialog focusable selector changed without review')
}
const tabCases = [
  { count: 0, current: -1, backwards: false, expected: null },
  { count: 3, current: -1, backwards: false, expected: 0 },
  { count: 3, current: -1, backwards: true, expected: 2 },
  { count: 3, current: 0, backwards: true, expected: 2 },
  { count: 3, current: 2, backwards: false, expected: 0 },
  { count: 3, current: 1, backwards: false, expected: null },
  { count: 3, current: 1, backwards: true, expected: null },
]
for (const testCase of tabCases) {
  const actual = contract.virtualChurchDialogTabDestination(
    testCase.count,
    testCase.current,
    testCase.backwards,
  )
  if (actual !== testCase.expected) {
    errors.push(
      `tab wrap ${JSON.stringify(testCase)} returned ${JSON.stringify(actual)}`,
    )
  }
}

for (const fragment of [
  'const previousFocus = document.activeElement instanceof HTMLElement',
  "dialog.querySelector<HTMLElement>('[data-autofocus]')",
  "if (event.key === 'Escape')",
  "if (event.key !== 'Tab') return",
  'event.stopPropagation()',
  'event.shiftKey',
  "dialog.addEventListener('keydown', onKeyDown)",
  "dialog.removeEventListener('keydown', onKeyDown)",
  'element.inert = true',
  "element.setAttribute('aria-hidden', 'true')",
  'element.inert = inert',
  'if (previousFocus?.isConnected) previousFocus.focus()',
]) {
  requireSource(hookSource, fragment, 'Dialog focus hook')
}

const count = (source, expression) => (source.match(expression) ?? []).length
const expectedViewCounts = [
  { label: 'dialog roles', expression: /\srole="dialog"/gu, expected: 3 },
  { label: 'modal semantics', expression: /aria-modal="true"/gu, expected: 3 },
  { label: 'Escape shortcuts', expression: /aria-keyshortcuts="Escape"/gu, expected: 3 },
  { label: 'dialog labels', expression: /aria-labelledby="virtual-church-/gu, expected: 3 },
  { label: 'dialog focus hooks', expression: /useVirtualChurchDialogFocus\(/gu, expected: 3 },
  { label: 'focus targets', expression: /data-autofocus/gu, expected: 3 },
  { label: 'scroll boundaries', expression: /overflow-y-auto overscroll-contain/gu, expected: 3 },
  { label: 'drawer backdrop close guards', expression: /event\.target === event\.currentTarget/gu, expected: 2 },
]
requireSource(viewSource, 'const pageRef = useVirtualChurchPageIsolation()', 'Full-screen page isolation')
requireSource(
  viewSource,
  '<div ref={pageRef} tabIndex={-1} role="main" aria-label={t.churchName} className="virtual-church-ui',
  'Full-screen page isolation and bilingual main landmark',
)
requireSource(viewSource, 'aria-label={t.back}', 'Mobile return navigation')
for (const item of expectedViewCounts) {
  const actual = count(viewSource, item.expression)
  if (actual !== item.expected) {
    errors.push(`${item.label}: expected ${item.expected}, received ${actual}`)
  }
}

for (const fragment of [
  'const dialogOpen = showGuide',
  'const playerControlsEnabled = virtualChurchPlayerInputEnabled(',
  'config3D.visualVersion, interactive3DEnabled, runtimeStatus, dialogOpen,',
  'if (!playerControlsEnabled || interactiveTarget) return',
  "'button, a, input, select, textarea, [contenteditable=\"true\"], [role=\"dialog\"]'",
  'movementRef.current.keyboardX = 0',
  'movementRef.current.keyboardZ = 0',
  'movementRef.current.sprint = false',
  'setShowCharacters(false)\n    setShowGuide(true)',
  'setShowGuide(false)\n    setShowCharacters(true)',
  'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
  'max-h-[calc(100dvh-2rem)]',
  "gateATouchLayout ? 'h-11 min-w-11' : 'h-10'",
  "gateATouchLayout={config3D.visualVersion === 'v3'}",
  "config3D.visualVersion === 'v3' && cameraMode !== 'showcase'",
  'bottom-[calc(env(safe-area-inset-bottom)+10.5rem)] desktop:bottom-6',
  'bottom-[max(7rem,env(safe-area-inset-bottom))] sm:bottom-6',
]) {
  requireSource(viewSource, fragment, 'Virtual Church dialog wiring')
}
for (const fragment of [
  'data-vc-visual={config3D.visualVersion}',
  'vc-topbar', 'vc-camera-switcher', 'vc-touch-controls', 'vc-accuracy-note',
  'vc-portrait-hint pointer-events-none',
  "landscapeHint: '横屏游览，视野更开阔；竖屏也可继续'",
  "landscapeHint: 'Turn for a wider view, or keep exploring upright'",
  "&& runtimeStatus === 'ready'\n        && !dialogOpen\n        && !nearEntranceInfoVisible",
]) {
  requireSource(viewSource, fragment, 'V3 landscape layout wiring')
}
for (const fragment of [
  '@media (orientation: landscape) and (max-width: 1023px) and (max-height: 600px)',
  '@media (max-width: 1023px)',
  '.virtual-church-ui .vc-portrait-hint {\n  display: none;',
  '@media (orientation: portrait) and (max-width: 767px)',
  '.virtual-church-ui[data-vc-visual="v3"] .vc-portrait-hint {\n    display: flex;',
  '.virtual-church-ui[data-vc-visual="v3"] .vc-camera-switcher {\n    bottom: max(1rem, env(safe-area-inset-bottom));',
  'padding-left: max(1rem, env(safe-area-inset-left));',
  'padding-right: max(1rem, env(safe-area-inset-right));',
  '.virtual-church-ui[data-vc-visual="v3"] .vc-accuracy-note {\n    display: none;',
]) {
  requireSource(globalStyleSource, fragment, 'V3 short-landscape layout contract')
}
for (const fragment of [
  "nearEntranceInfoTitle: '欢迎 · WELCOME'",
  "nearEntranceInfoDetail: '周日聚会 · SUNDAY GATHERING'",
  "nearEntranceInfoTitle: 'WELCOME · 欢迎'",
  "nearEntranceInfoDetail: 'SUNDAY GATHERING · 周日聚会'",
  'const nearEntranceInfoVisible =',
  '{nearEntranceInfoVisible ? (',
  '&& !nearEntranceInfoVisible',
  'visualSuppressed={nearEntranceInfoVisible || nearMainHallInfoVisible}',
  'gateASafeArea={config3D.visualVersion === \'v3\'}',
  '!visualSuppressed && (status === \'loading\' || status === \'degraded\')',
  "'top-[calc(env(safe-area-inset-top)+6rem)] sm:top-24'",
  ": 'top-24'",
  'vc-tour-callout vc-edge-action pointer-events-auto absolute z-20',
  'className="inline-flex min-h-11 items-center justify-center gap-2',
  'aria-label={t.nearEntranceInfoTitle}',
  'aria-live="polite"',
  'aria-atomic="true"',
  'role="status"',
  "onClick={() => navigateFromChurch('/events')}",
  "if (path === '/events') { setShowGuide(false); setShowGatherings(true); return }",
  "cameraMode !== 'showcase'",
  '!dialogOpen',
]) {
  requireSource(viewSource, fragment, 'Near-entrance information accessibility')
}
if (!/<div\s+aria-atomic="true"\s+aria-live="polite"\s+className="sr-only"\s+role="status"\s*>\s*\{nearEntranceInfoVisible[\s\S]*?t\.nearEntranceInfoTitle[\s\S]*?t\.nearEntranceInfoDetail/u.test(viewSource)) {
  errors.push('near-entrance announcement must use a persistent atomic polite live region')
}
for (const fragment of [
  '.virtual-church-ui[data-vc-visual="v3"] .vc-edge-action {',
  'top: calc(env(safe-area-inset-top) + 4.75rem);',
  'right: max(.75rem, env(safe-area-inset-right));',
  'min-height: 44px;',
]) {
  requireSource(controlsSource, fragment, 'Compact entrance action safe-area and touch target')
}
for (const fragment of [
  '.virtual-church-ui {',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  '"Noto Sans SC"',
  'Arial,',
  'sans-serif;',
]) {
  requireSource(globalStyleSource, fragment, 'Virtual Church system font fallback')
}
requireSource(
  viewSource,
  'className="virtual-church-ui fixed inset-0',
  'Virtual Church system font fallback',
)

if (
  !/<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">[\s\S]*?<\/div>\s*\{!visualSuppressed && \(status === 'loading' \|\| status === 'degraded'\)/u
    .test(viewSource)
) {
  errors.push(
    'runtime status live region must remain available when its visual pill is hidden',
  )
}

const viewAst = ts.createSourceFile(
  viewPath,
  viewSource,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
)
const dialogLabelIds = new Set([
  'virtual-church-guide-title',
  'virtual-church-character-title',
  'virtual-church-welcome-title',
])
const renderedIds = new Set()
const labelledByIds = new Set()
const visit = (node) => {
  const attributes = ts.isJsxOpeningElement(node)
    ? node.attributes.properties
    : ts.isJsxSelfClosingElement(node)
      ? node.attributes.properties
      : null
  if (attributes) {
    for (const attribute of attributes) {
      if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue
      const name = attribute.name.getText(viewAst)
      if (!ts.isStringLiteral(attribute.initializer)) continue
      if (name === 'id') renderedIds.add(attribute.initializer.text)
      if (name === 'aria-labelledby') {
        labelledByIds.add(attribute.initializer.text)
      }
    }
  }
  ts.forEachChild(node, visit)
}
visit(viewAst)
for (const id of dialogLabelIds) {
  if (!renderedIds.has(id) || !labelledByIds.has(id)) {
    errors.push(`dialog label ${id} must exist and be referenced`)
  }
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church accessibility validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  dialogs: ['welcome', 'guide', 'character'],
  semantics: {
    roleDialog: true,
    ariaModal: true,
    labelled: true,
    escapeShortcut: true,
  },
  focus: {
    initialFocus: true,
    tabWrapCases: tabCases.length,
    restoreTriggerFocus: true,
    backgroundInertAndAriaHidden: true,
    pageIsolationCases,
  },
  inputIsolation: {
    movementPausedWhileDialogOpen: true,
    interactiveControlsDoNotTrigger3DShortcuts: true,
  },
  mobile: {
    iconOnlyBackButtonNamed: true,
    scrollBoundaries: 3,
    safeAreaPadding: true,
    welcomeDynamicViewportLimit: true,
    gateAPortraitCameraSwitcherBottomClearanceRem: 10.5,
    gateAShortLandscapeCameraSwitcherBottomClearanceRem: 1,
    gateAShortLandscapeUsesSideSafeAreas: true,
    gateAPortraitHintBilingualAndNonBlocking: true,
    gateACameraModeMinimumTargetPixels: 44,
    gateAShowcaseUsesUnobstructedBaselinePosition: true,
    v2CameraSwitcherLayoutPreserved: true,
  },
  nearEntranceInformation: {
    bilingual: true,
    politeStatusAnnouncement: true,
    persistentAtomicLiveRegion: true,
    labelledContainer: true,
    keyboardAccessibleEventsAction: true,
    hiddenDuringModalDialogs: true,
    hiddenInShowcase: true,
    mutuallyExclusiveWithControlsHint: true,
    mutuallyExclusiveWithVisualRuntimeStatus: true,
    topSafeAreaAware: true,
    actionMinimumHeightPixels: 44,
  },
  fontFallback: {
    sceneScoped: true,
    latinSystemFallback: true,
    simplifiedChineseSystemFallback: true,
  },
  runtimeStatus: {
    liveRegionPreservedWhenVisualStatusHidden: true,
    gateATopSafeAreaAware: true,
    v2TopPositionPreserved: true,
  },
  passed: true,
}, null, 2))
