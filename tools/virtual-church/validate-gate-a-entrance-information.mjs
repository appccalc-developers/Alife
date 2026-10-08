import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..', '..')
const appRoot = path.join(repositoryRoot, 'cloudflare', 'alife-app')
const viewPath = path.join(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const scenePath = path.join(appRoot, 'src', 'views', 'virtualChurchScene.ts')
const interactionPath = path.join(
  appRoot,
  'src',
  'views',
  'virtualChurchInteractionContract.ts',
)

const [viewSource, sceneSource, interactionSource, controlsSource] = await Promise.all([
  readFile(viewPath, 'utf8'),
  readFile(scenePath, 'utf8'),
  readFile(interactionPath, 'utf8'),
  readFile(path.join(appRoot, 'src', 'views', 'virtualChurchTourControls.css'), 'utf8'),
])

for (const removedPhysicalFragment of [
  'virtualChurchWelcomeBoardContract',
  'EntranceWelcomeBoard',
  'WELCOME_BOARD_CONTRACT',
  'PHYSICAL_WELCOME_BOARDS_ENABLED',
  'approachBoardSupports',
  'heroPlanterLocalXs',
  'entrancePlanterBoxes',
  'islandTrees',
  'CARPARK_SPINE_GARDEN',
  'entranceWelcomePoint',
  'entranceWelcomeYaw',
  'welcoming landscape',
  'bilingual wayfinding',
  '迎宾绿化',
  '双语导视',
]) {
  assert.ok(
    !viewSource.includes(removedPhysicalFragment)
      && !sceneSource.includes(removedPhysicalFragment),
    `Removed or misleading physical entrance concept returned: ${removedPhysicalFragment}`,
  )
}

for (const fragment of [
  "nearEntranceInfoTitle: '欢迎 · WELCOME'",
  "nearEntranceInfoDetail: '周日聚会 · SUNDAY GATHERING'",
  "nearEntranceInfoTitle: 'WELCOME · 欢迎'",
  "nearEntranceInfoDetail: 'SUNDAY GATHERING · 周日聚会'",
  "entranceDetail: '回到正门前的发光入口点'",
  "parkingDetail: '看清教会名称、十字架与正立面'",
  "streetFrontDetail: '对照十字架、格栅、围栏与排水浅沟'",
  "entranceDetail: 'Return to the glowing point by the main doors'",
  "parkingDetail: 'See the church name, cross, and street-facing facade'",
  "streetFrontDetail: 'Inspect the cross, fins, fence, and drainage swale'",
  'const nearEntranceInfoVisible =',
  "config3D.visualVersion === 'v3'",
  '&& nearEntrance',
  "&& cameraMode !== 'showcase'",
  '&& !dialogOpen',
  '{nearEntranceInfoVisible ? (',
  '&& !nearEntranceInfoVisible',
  'visualSuppressed={nearEntranceInfoVisible || nearMainHallInfoVisible}',
  'vc-tour-callout vc-edge-action pointer-events-auto absolute z-20',
  'className="inline-flex min-h-11 items-center justify-center gap-2',
  'aria-label={t.nearEntranceInfoTitle}',
  'aria-live="polite"',
  'aria-atomic="true"',
  'role="status"',
  "onClick={() => navigateFromChurch('/events')}",
  "if (path === '/events') { setShowGuide(false); setShowGatherings(true); return }",
]) {
  assert.ok(
    viewSource.includes(fragment),
    `Missing near-entrance information contract: ${fragment}`,
  )
}

for (const fragment of [
  'entranceApproachPoint: [-10.30, 0, -13.40]',
  'entranceApproachYaw: -2.26',
  'no physical planter, flowerbed, welcome board, or freestanding sign',
]) {
  assert.ok(
    sceneSource.includes(fragment),
    `Missing clear-entrance scene contract: ${fragment}`,
  )
}

assert.match(
  viewSource,
  /const nearEntranceInfoVisible =\s*config3D\.visualVersion === 'v3'\s*&& nearEntrance\s*&& cameraMode === 'follow'\s*&& !dialogOpen/,
  'Near-entrance information must remain isolated to visible V3 play modes.',
)
assert.match(
  viewSource,
  /\{showControlsHint\s*&& !nearEntranceInfoVisible\s*&& !nearMainHallInfoVisible\s*&& runtimeStatus === 'ready'/,
  'The first-use controls hint must not occupy the entrance-information position.',
)
assert.match(
  viewSource,
  /<div\s+aria-atomic="true"\s+aria-live="polite"\s+className="sr-only"\s+role="status"\s*>\s*\{nearEntranceInfoVisible[\s\S]*?t\.nearEntranceInfoTitle[\s\S]*?t\.nearEntranceInfoDetail/u,
  'Near-entrance information must update a persistent atomic polite live region.',
)
assert.match(
  interactionSource,
  /VIRTUAL_CHURCH_ENTRANCE_TRIGGER_RADIUS_METRES = 6/,
)

const entranceActions = viewSource.slice(
  viewSource.indexOf('{nearEntranceInfoVisible ? ('),
  viewSource.indexOf('<div className="vc-topbar'),
)
assert.equal((entranceActions.match(/vc-edge-action/gu) ?? []).length, 2)
assert.doesNotMatch(entranceActions, /left-1\/2|translate-x|w-\[calc\(100vw/u,
  'Entrance and main-hall actions must not block the central view.')
assert.match(entranceActions, /<div className="sr-only">/u,
  'Welcome wording stays available to assistive technology without a visible banner.')
assert.match(controlsSource,
  /\.virtual-church-ui\[data-vc-visual="v3"\] \.vc-edge-action\s*\{[^}]*top: calc\(env\(safe-area-inset-top\) \+ 4\.75rem\);[^}]*right: max\(\.75rem, env\(safe-area-inset-right\)\);/u)
assert.match(controlsSource, /\.vc-edge-action button\s*\{[^}]*min-height: 44px;/u)

const report = {
  schemaVersion: 1,
  physicalEntranceObjects: {
    welcomeBoardsRendered: false,
    welcomeBoardSupportsRendered: false,
    planterBoxesRendered: false,
    centralDriveAisleTreeRendered: false,
    centralDriveAislePlantingIslandRendered: false,
    entranceLandmarkUsesPhysicalObjectSemantics: false,
  },
  nearEntranceInformation: {
    bilingual: true,
    accessibleDomStatus: true,
    persistentAtomicLiveRegion: true,
    entranceRadiusMetres: 6,
    eventsRoute: '/events',
    hiddenInShowcase: true,
    hiddenBehindDialogs: true,
    mutuallyExclusiveWithControlsHint: true,
    mutuallyExclusiveWithVisualRuntimeStatus: true,
    topSafeAreaAware: true,
    actionMinimumHeightPixels: 44,
    compactEdgeActions: true,
    centralBannerRendered: false,
  },
  churchGeometryChanged: false,
  passed: true,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
