import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const scenePath = resolve(appRoot, 'src', 'views', 'virtualChurchScene.ts')
const interactionPath = resolve(appRoot, 'src', 'views', 'virtualChurchInteractionContract.ts')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const outputRoot = resolve(
  repoRoot,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-parking-layout',
)
const outputSvg = resolve(outputRoot, 'parking-layout-review.svg')
const outputReport = resolve(outputRoot, 'parking-layout-review.json')

const [sceneSource, interactionSource, viewSource] = await Promise.all([
  readFile(scenePath, 'utf8'),
  readFile(interactionPath, 'utf8'),
  readFile(viewPath, 'utf8'),
])

const requiredViewFragments = [
  'const MAIN_CARPARK: Array<[number, number]> = [[-31, 10], [-40, 7], [-48, -3], [-50, -25], [-39, -42], [-24, -52], [4, -49], [19, -26], [4, -22], [-7, -14], [-16, -3], [-24, 10]]',
  '<ClosedVehicleGate left={[-38.2, 4.5]} right={[-33.6, 8.3]} visualVersion={visualVersion} fenceSegments={visualVersion === \'v3\' ? SITE_FENCE_SEGMENTS : undefined} />',
  "useAutomaticDoor('vehicle', [midX, midZ], 7, progress => {",
  'createAutomaticVehicleGateAndFenceMatrixWriter(fenceParts, gateParts, leafParts, length, gateWorldMatrix)',
  '<ParkingRowsField rows={PARKING_ROWS} accessible={{',
  'const side = CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE[',
  'const depthOffset = side * (row.bayDepth / 2 - 0.58)',
  '<InstancedBoxSet items={parkingWheelStops}',
]
for (const fragment of requiredViewFragments) {
  if (!(fragment.startsWith('const MAIN_CARPARK:') ? sceneSource : viewSource).includes(fragment)) {
    throw new Error(`Parking review lost runtime source fragment ${JSON.stringify(fragment)}`)
  }
}
for (const removedPhysicalFragment of [
  'EntranceWelcomeBoard',
  'WELCOME_BOARD_CONTRACT',
  'approachBoardSupports',
  'heroPlanterLocalXs',
  'entrancePlanterBoxes',
  'islandTrees',
  'CARPARK_SPINE_GARDEN',
]) {
  if (viewSource.includes(removedPhysicalFragment)) {
    throw new Error(`Removed physical entrance object returned: ${removedPhysicalFragment}`)
  }
}

const transpiledScene = ts.transpileModule(sceneSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: scenePath,
  reportDiagnostics: true,
})
if ((transpiledScene.diagnostics ?? []).length > 0) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(
    transpiledScene.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  ))
}
// Keep dependent imports on the transpiled module; Node 20 cannot load the
// original .ts file URL without a loader.
const sceneUrl = `data:text/javascript;base64,${Buffer.from(transpiledScene.outputText).toString('base64')}`
const scene = await import(sceneUrl)
const transpiledInteraction = ts.transpileModule(interactionSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: interactionPath,
  reportDiagnostics: true,
})
if ((transpiledInteraction.diagnostics ?? []).length > 0) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(
    transpiledInteraction.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  ))
}
const interaction = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledInteraction.outputText.replace(
    /(['"])\.\/virtualChurchScene\.ts\1/g, JSON.stringify(sceneUrl),
  )).toString('base64')}`
)

const MAIN_CARPARK = [
  [-31, 10], [-40, 7], [-48, -3], [-50, -25], [-39, -42], [-24, -52],
  [4, -49], [19, -26], [4, -22], [-7, -14], [-16, -3], [-24, 10],
]
const CHURCH_FOOTPRINT = interaction.VIRTUAL_CHURCH_BUILDING_FOOTPRINT
const MAIN_ENTRANCE_LANDMARK = [
  scene.SCENE_LANDMARKS.entrance[0],
  scene.SCENE_LANDMARKS.entrance[2],
]
const MAIN_ENTRANCE_APPROACH = [
  scene.SCENE_LANDMARKS.entranceApproachPoint[0],
  scene.SCENE_LANDMARKS.entranceApproachPoint[2],
]
const MAIN_ENTRANCE_TRIGGER_RADIUS = interaction.VIRTUAL_CHURCH_ENTRANCE_TRIGGER_RADIUS_METRES
const GATE_LEFT = [-38.2, 4.5]
const GATE_RIGHT = [-33.6, 8.3]
const FENCE_APPROACH = [
  [[-52, -7], GATE_LEFT],
  [GATE_RIGHT, [-27.33, 13.45]],
]

const rowsById = new Map(scene.PARKING_ROWS.map((row) => [row.id, row]))
const entryLeft = rowsById.get('entry-north')
const entryRight = rowsById.get('entry-gate-right')
const spineBuilding = rowsById.get('spine-building-side')
const spineBoundary = rowsById.get('spine-boundary-side')
if (
  scene.PARKING_ROWS.length !== 6
  || !entryLeft
  || !entryRight
  || !spineBuilding
  || !spineBoundary
  || entryRight.bays !== 6
  || entryRight.confidence !== 'provisional'
  || entryRight.layoutAuthority !== 'user-confirmed-overhead-view'
  || CHURCH_FOOTPRINT.length !== 16
  || MAIN_ENTRANCE_TRIGGER_RADIUS !== 6
) {
  throw new Error('Parking review requires the user-confirmed six-bay gate-right relationship with a separately provisional exact stripe origin.')
}

const basis = (angle) => ({
  u: [Math.cos(angle), Math.sin(angle)],
  v: [-Math.sin(angle), Math.cos(angle)],
})
const add = (point, vector, scale) => [
  point[0] + vector[0] * scale,
  point[1] + vector[1] * scale,
]
const dot = (left, right) => left[0] * right[0] + left[1] * right[1]
const subtract = (left, right) => [left[0] - right[0], left[1] - right[1]]
const rowCorners = (row) => {
  const { u, v } = basis(row.angle)
  const end = add(row.start, u, row.bays * row.bayWidth)
  return [
    add(row.start, v, -row.bayDepth / 2),
    add(end, v, -row.bayDepth / 2),
    add(end, v, row.bayDepth / 2),
    add(row.start, v, row.bayDepth / 2),
  ]
}
const pointInsidePolygon = ([x, z], polygon) => {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const [x1, z1] = polygon[index]
    const [x2, z2] = polygon[previous]
    if (
      (z1 > z) !== (z2 > z)
      && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1
    ) {
      inside = !inside
    }
  }
  return inside
}

const { u: entryU, v: entryV } = basis(entryRight.angle)
const entranceAcross = Math.abs(dot(
  subtract(entryRight.start, entryLeft.start),
  entryV,
))
const entranceDriveAisleWidth = entranceAcross
  - entryLeft.bayDepth / 2
  - entryRight.bayDepth / 2
const entryRightToCentralDriveAisleWidth = dot(
  subtract(spineBuilding.start, entryRight.start),
  entryU,
) - entryRight.bays * entryRight.bayWidth
const centralAcross = Math.abs(dot(
  subtract(spineBoundary.start, spineBuilding.start),
  basis(spineBuilding.angle).v,
))
const centralSpineGap = centralAcross
  - spineBuilding.bayDepth / 2
  - spineBoundary.bayDepth / 2
const entryRightCornersInsideMainCarpark = rowCorners(entryRight)
  .every((corner) => pointInsidePolygon(corner, MAIN_CARPARK))
const wheelStopSides = scene.CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE
const entranceApproachDistanceToLandmark = Math.hypot(
  MAIN_ENTRANCE_APPROACH[0] - MAIN_ENTRANCE_LANDMARK[0],
  MAIN_ENTRANCE_APPROACH[1] - MAIN_ENTRANCE_LANDMARK[1],
)

if (
  Math.abs(entranceDriveAisleWidth - scene.SCENE_SCALE.driveAisleWidth) > 0.01
  || entryRightToCentralDriveAisleWidth < scene.SCENE_SCALE.driveAisleWidth
  || Math.abs(centralSpineGap - 1.3) > 0.02
  || !entryRightCornersInsideMainCarpark
  || wheelStopSides['spine-building-side'] !== -1
  || wheelStopSides['spine-boundary-side'] !== 1
  || entranceApproachDistanceToLandmark > 0.5
) {
  throw new Error('Parking layout geometry no longer satisfies the reviewed entrance, lane, and wheel-stop contract.')
}

const WIDTH = 1200
const HEIGHT = 800
const SCALE = 10
const MIN_X = -53
const MAX_Z = 14
const OFFSET_X = 60
const OFFSET_Y = 70
const screen = ([x, z]) => [
  OFFSET_X + (x - MIN_X) * SCALE,
  OFFSET_Y + (MAX_Z - z) * SCALE,
]
const points = (items) => items
  .map((point) => screen(point).map((value) => value.toFixed(2)).join(','))
  .join(' ')
const midpoint = (left, right) => [
  (left[0] + right[0]) / 2,
  (left[1] + right[1]) / 2,
]
const format = (value) => value.toFixed(3)
const text = (position, value, attributes = '') => {
  const [x, y] = screen(position)
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" ${attributes}>${value}</text>`
}
const line = (start, end, attributes = '') => {
  const [x1, y1] = screen(start)
  const [x2, y2] = screen(end)
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${attributes}/>`
}
const dimension = (start, end, label, labelOffset = [0, 0]) => {
  const centre = add(midpoint(start, end), labelOffset, 1)
  return [
    line(start, end, 'class="dimension" marker-start="url(#arrow)" marker-end="url(#arrow)"'),
    text(centre, label, 'class="dimension-label" text-anchor="middle"'),
  ].join('\n')
}

const rowColours = {
  'entry-north': '#dbe7ee',
  'entry-south': '#dbe7ee',
  'entry-gate-right': '#e9bd59',
  'spine-building-side': '#84b7aa',
  'spine-boundary-side': '#84b7aa',
  'south-west-boundary': '#b9c6cc',
}
const rowLabels = {
  'entry-north': '入口左侧普通位',
  'entry-south': '入口左侧普通位',
  'entry-gate-right': '栅栏右侧 · 俯视确认 6 位',
  'spine-building-side': '中央建筑侧 · 8 位',
  'spine-boundary-side': '中央边界侧 · 8 位',
  'south-west-boundary': '西南边界 · 10 位',
}

const rowSvg = scene.PARKING_ROWS.map((row) => {
  const { u } = basis(row.angle)
  const end = add(row.start, u, row.bays * row.bayWidth)
  const centre = midpoint(row.start, end)
  const stripes = Array.from({ length: row.bays + 1 }, (_, index) => {
    const stripeCentre = add(row.start, u, index * row.bayWidth)
    const { v } = basis(row.angle)
    return line(
      add(stripeCentre, v, -row.bayDepth / 2),
      add(stripeCentre, v, row.bayDepth / 2),
      'class="parking-stripe"',
    )
  }).join('\n')
  return [
    `<polygon points="${points(rowCorners(row))}" fill="${rowColours[row.id]}" class="parking-row"/>`,
    stripes,
    text(
      add(centre, basis(row.angle).v, row.bayDepth / 2 + 0.7),
      rowLabels[row.id],
      'class="row-label" text-anchor="middle"',
    ),
  ].join('\n')
}).join('\n')

const accessible = scene.ACCESSIBLE_PARKING_PAIR
const accessibleBasis = basis(accessible.angle)
const accessibleWidth = accessible.bayWidth * 2 + accessible.aisleWidth
const accessibleEnd = add(accessible.start, accessibleBasis.u, accessibleWidth)
const accessibleCorners = [
  add(accessible.start, accessibleBasis.v, -accessible.bayDepth / 2),
  add(accessibleEnd, accessibleBasis.v, -accessible.bayDepth / 2),
  add(accessibleEnd, accessibleBasis.v, accessible.bayDepth / 2),
  add(accessible.start, accessibleBasis.v, accessible.bayDepth / 2),
]
const accessibleStripes = [
  0,
  accessible.bayWidth,
  accessible.bayWidth + accessible.aisleWidth,
  accessibleWidth,
].map((offset) => {
  const centre = add(accessible.start, accessibleBasis.u, offset)
  return line(
    add(centre, accessibleBasis.v, -accessible.bayDepth / 2),
    add(centre, accessibleBasis.v, accessible.bayDepth / 2),
    'class="accessible-stripe"',
  )
}).join('\n')

const wheelStopSvg = [spineBuilding, spineBoundary].flatMap((row) => {
  const { u, v } = basis(row.angle)
  const side = wheelStopSides[row.id]
  const depthOffset = side * (row.bayDepth / 2 - 0.58)
  return Array.from({ length: row.bays }, (_, index) => {
    const bayCentre = add(row.start, u, row.bayWidth * (index + 0.5))
    const stopCentre = add(bayCentre, v, depthOffset)
    return line(
      add(stopCentre, u, -1.55 / 2),
      add(stopCentre, u, 1.55 / 2),
      'class="wheel-stop"',
    )
  })
}).join('\n')

const entranceMeasureAlong = 1.25
const entranceLeftInner = add(
  add(entryLeft.start, entryU, entranceMeasureAlong),
  entryV,
  -entryLeft.bayDepth / 2,
)
const entranceRightInner = add(
  add(entryRight.start, entryU, entranceMeasureAlong),
  entryV,
  entryRight.bayDepth / 2,
)
const entryRightEnd = add(
  entryRight.start,
  entryU,
  entryRight.bays * entryRight.bayWidth,
)
const crossAisleMeasureV = -1.4
const crossAisleStart = add(entryRightEnd, entryV, crossAisleMeasureV)
const crossAisleEnd = add(
  crossAisleStart,
  entryU,
  entryRightToCentralDriveAisleWidth,
)
const spineMeasureAlong = 1.25
const spineBuildingInner = add(
  add(spineBuilding.start, entryU, spineMeasureAlong),
  entryV,
  -spineBuilding.bayDepth / 2,
)
const spineBoundaryInner = add(
  add(spineBoundary.start, entryU, spineMeasureAlong),
  entryV,
  spineBoundary.bayDepth / 2,
)
const [entranceScreenX, entranceScreenY] = screen(MAIN_ENTRANCE_LANDMARK)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0b84c"/>
    </marker>
    <style>
      text { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
      .site { fill: #303938; stroke: #53605d; stroke-width: 2; }
      .church-footprint { fill: #d7d0c2; stroke: #756b5c; stroke-width: 2.5; }
      .main-entrance { stroke: #ce742d; stroke-width: 8; stroke-linecap: round; }
      .entrance-trigger { fill: #f2c867; fill-opacity: 0.12; stroke: #ce742d; stroke-width: 2; stroke-dasharray: 7 5; }
      .fence { stroke: #141b1a; stroke-width: 5; stroke-linecap: round; }
      .gate { stroke: #df8a3b; stroke-width: 7; stroke-linecap: round; }
      .parking-row { fill-opacity: 0.18; stroke: #dce4df; stroke-width: 1.4; }
      .parking-stripe { stroke: #f4f0dc; stroke-width: 2.2; }
      .accessible-stripe { stroke: #f1cf52; stroke-width: 2.8; }
      .wheel-stop { stroke: #e4e0d2; stroke-width: 5; stroke-linecap: round; }
      .row-label { fill: #15211e; font-size: 13px; font-weight: 700; paint-order: stroke; stroke: #fffaf0; stroke-width: 4px; }
      .dimension { stroke: #f0b84c; stroke-width: 2.5; stroke-dasharray: 6 4; }
      .dimension-label { fill: #ffe3a4; font-size: 15px; font-weight: 800; paint-order: stroke; stroke: #17211f; stroke-width: 5px; }
      .small { fill: #d8e2dd; font-size: 13px; }
      .legend-title { fill: #f7e4b6; font-size: 18px; font-weight: 800; }
      .legend { fill: #d8e2dd; font-size: 14px; }
    </style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f4efe4"/>
  <text x="60" y="35" fill="#17211f" font-size="23" font-weight="800">Gate A 停车场现场关系校准 · 运行时俯视</text>
  <text x="60" y="57" fill="#52645f" font-size="13">北向上 · 单位：米 · 教堂资产未改变 · 黄色右排关系已确认，精确起点 provisional</text>
  <polygon points="${points(MAIN_CARPARK)}" class="site"/>
  <polygon points="${points(CHURCH_FOOTPRINT)}" class="church-footprint"/>
  <circle cx="${entranceScreenX.toFixed(2)}" cy="${entranceScreenY.toFixed(2)}" r="${(MAIN_ENTRANCE_TRIGGER_RADIUS * SCALE).toFixed(2)}" class="entrance-trigger"/>
  <circle cx="${entranceScreenX.toFixed(2)}" cy="${entranceScreenY.toFixed(2)}" r="5" fill="#ce742d"/>
  ${text([-1.5, -27.5], '教堂主入口导览点 · 6 m DOM 信息触发区', 'class="row-label" text-anchor="middle"')}
  ${line(MAIN_ENTRANCE_LANDMARK, [-1.5, -26.8], 'stroke="#ce742d" stroke-width="2" stroke-dasharray="4 3"')}
  ${FENCE_APPROACH.map(([start, end]) => line(start, end, 'class="fence"')).join('\n')}
  ${line(GATE_LEFT, GATE_RIGHT, 'class="gate"')}
  ${text(midpoint(GATE_LEFT, GATE_RIGHT), '车辆栅栏', 'class="row-label" text-anchor="middle"')}
  ${rowSvg}
  <polygon points="${points(accessibleCorners)}" fill="#f1cf52" fill-opacity="0.15" stroke="#f1cf52" stroke-width="1.5"/>
  ${accessibleStripes}
  ${text(add(midpoint(accessible.start, accessibleEnd), accessibleBasis.v, accessible.bayDepth / 2 + 0.7), '无障碍车位与通道', 'class="row-label" text-anchor="middle"')}
  ${wheelStopSvg}
  ${dimension(entranceLeftInner, entranceRightInner, `入口纵向车道 ${format(entranceDriveAisleWidth)} m`, entryU)}
  ${dimension(crossAisleStart, crossAisleEnd, `独立横向车道 ${format(entryRightToCentralDriveAisleWidth)} m`, entryV)}
  ${dimension(spineBuildingInner, spineBoundaryInner, `中央步行间隙 ${format(centralSpineGap)} m`, entryU)}
  ${line([-42.5, 12.5], [-34.8, 3.5], 'stroke="#58a58e" stroke-width="3" marker-end="url(#arrow)"')}
  ${text([-42.5, 12.5], '从 The Runway 进入', 'class="row-label"')}
  <g transform="translate(850 90)">
    <rect x="0" y="0" width="310" height="510" rx="18" fill="#17211f"/>
    <text x="24" y="42" class="legend-title">校准结论</text>
    <text x="24" y="82" class="legend">• 栅栏右侧：俯视关系确认 6 位</text>
    <text x="24" y="110" class="legend">• 与中央车排不连续</text>
    <text x="24" y="138" class="legend">• 横向车道：${format(entryRightToCentralDriveAisleWidth)} m</text>
    <text x="24" y="166" class="legend">• 入口车道：${format(entranceDriveAisleWidth)} m</text>
    <text x="24" y="194" class="legend">• 中央轮挡朝步行分隔带</text>
    <text x="24" y="222" class="legend">• 轮挡距里端：0.580 m</text>
    <text x="24" y="250" class="legend">• 中间车道无树、花坛或欢迎牌</text>
    <text x="24" y="274" class="legend">• 正门净空：无任何实体布置</text>
    <line x1="24" y1="294" x2="286" y2="294" stroke="#52645f"/>
    <text x="24" y="326" class="legend-title">证据边界</text>
    <text x="24" y="360" class="legend">右侧六位、车排断开、轮挡在里侧，</text>
    <text x="24" y="384" class="legend">中间无树且正门无花坛/欢迎牌。</text>
    <text x="24" y="420" class="legend">车位关系以俯视图为准；精确起点</text>
    <text x="24" y="444" class="legend">仍等待测绘图进一步校准。</text>
    <text x="24" y="486" fill="#f0b84c" font-size="14" font-weight="800">不修改教堂 / 不接美化候选</text>
  </g>
  <text x="850" y="640" fill="#52645f" font-size="13">浅色短粗线：中央轮挡</text>
  <text x="850" y="664" fill="#52645f" font-size="13">黄色虚线箭头：实测净距</text>
  <text x="850" y="688" fill="#52645f" font-size="13">橙色线：车辆栅栏</text>
</svg>
`

await mkdir(outputRoot, { recursive: true })
await writeFile(outputSvg, svg, 'utf8')
const svgSha256 = createHash('sha256').update(svg).digest('hex')
const report = {
  schemaVersion: 3,
  status: 'layout-calibration-review',
  source: {
    scene: 'cloudflare/alife-app/src/views/virtualChurchScene.ts',
    interaction: 'cloudflare/alife-app/src/views/virtualChurchInteractionContract.ts',
    view: 'cloudflare/alife-app/src/views/VirtualChurchView.tsx',
    runtimeFragmentsMatched: true,
  },
  referenceAuthority: {
    layoutRelationships: 'user-confirmed-overhead-view',
    officialAerial: {
      role: 'orientation-and-address-review-only',
      controlPointRegistered: false,
      maySetExactRuntimeStripeCoordinates: false,
    },
    surveyedSitePlanAvailable: false,
    runtimeCoordinateStatus: 'relative-layout-validated-exact-origin-provisional',
  },
  parkingRows: scene.PARKING_ROWS.map((row) => ({
    id: row.id,
    bays: row.bays,
    confidence: row.confidence,
    layoutAuthority: row.layoutAuthority ?? null,
  })),
  measurementsMetres: {
    entranceDriveAisleWidth,
    entryRightToCentralDriveAisleWidth,
    centralSpineGap,
    wheelStopInnerEdgeSetback: 0.58,
    entranceTriggerRadius: MAIN_ENTRANCE_TRIGGER_RADIUS,
    entranceApproachDistanceToLandmark,
  },
  assertions: {
    churchFootprintIncludedForOrientation: true,
    mainEntranceLandmarkIncludedForOrientation: true,
    entryRightCornersInsideMainCarpark,
    entryRightRelationshipUserConfirmed:
      entryRight.layoutAuthority === 'user-confirmed-overhead-view',
    entryRightSeparatedFromCentralParking: true,
    centralWheelStopsFacePedestrianSpine: true,
    centralCrossAisleHasNoPlantingIsland: true,
    entranceHasNoPhysicalPlantersOrWelcomeBoards: true,
    entranceTriggerIsDomInformationOnly: true,
    exactCoordinateClaimsRequireRegisteredControlPoints: true,
    churchAssetChanged: false,
  },
  limitations: [
    'The six-bay gate-right count, separated cross-aisle, and removed entrance/aisle adornments follow the user-directed overhead layout.',
    'The current CCC aerial crop is not control-point registered to the runtime scene and does not independently reproduce the user-confirmed parking relationship, so it cannot override that relationship.',
    'The exact stripe start remains provisional until a surveyed site plan confirms it.',
    'This north-up plan is a coordinate audit, not a browser perspective or PBR render.',
  ],
  output: {
    svg: '.tmp/virtual-church-art-direction/gate-a-parking-layout/parking-layout-review.svg',
    svgSha256,
    width: WIDTH,
    height: HEIGHT,
  },
  passed: true,
}
await writeFile(outputReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
