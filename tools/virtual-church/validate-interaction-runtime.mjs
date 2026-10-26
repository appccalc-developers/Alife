import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const scenePath = resolve(appRoot, 'src', 'views', 'virtualChurchScene.ts')
const interactionPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchInteractionContract.ts',
)
const routesPath = resolve(
  appRoot,
  'src',
  'app',
  'routing',
  'AppRoutes.tsx',
)

const [viewSource, sceneSource, interactionSource, routesSource] =
  await Promise.all([
    readFile(viewPath, 'utf8'),
    readFile(scenePath, 'utf8'),
    readFile(interactionPath, 'utf8'),
    readFile(routesPath, 'utf8'),
  ])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) {
    errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
  }
}

const transpiledModuleUrl = (source, fileName, sceneUrl) => {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
    fileName,
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
    throw new Error(`Unable to transpile ${fileName}:\n${formatted}`)
  }
  const resolvedOutput = sceneUrl
    ? transpiled.outputText.replace(/(['"])\.\/virtualChurchScene\.ts\1/g, JSON.stringify(sceneUrl))
    : transpiled.outputText
  return `data:text/javascript;base64,${Buffer.from(resolvedOutput).toString('base64')}`
}

// The interaction module imports the scene; reuse its transpiled URL so this
// validator also works on Node 20 without a TypeScript loader.
const sceneUrl = transpiledModuleUrl(sceneSource, scenePath)
const [scene, interaction] = await Promise.all([
  import(sceneUrl),
  import(transpiledModuleUrl(interactionSource, interactionPath, sceneUrl)),
])

const hashJson = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const geometryHashes = {
  building: hashJson(interaction.VIRTUAL_CHURCH_BUILDING_FOOTPRINT),
  auxiliary: hashJson(interaction.VIRTUAL_CHURCH_AUXILIARY_BUILDING),
  // Only the source identity and polygon can change collision. Address,
  // facade references and tones are traceability/visual metadata and must not
  // make a reviewed physical envelope appear to have moved.
  surroundings: hashJson(interaction.VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map(
    ({ sourceWayId, footprint }) => ({ sourceWayId, footprint }),
  )),
  surroundingRoadExtension: hashJson({
    road: scene.VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION,
    footpaths: scene.VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS,
    source: scene.VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE,
  }),
  platforms: hashJson(interaction.VIRTUAL_CHURCH_PLATFORMS),
  playerBounds: hashJson(interaction.VIRTUAL_CHURCH_PLAYER_BOUNDS),
}
const expectedGeometryHashes = {
  building: '406445d0cc2126fe2fbf2616dd237e3c860390adaa1583130f43639803cfd457',
  auxiliary: 'd605867a0786316f836844072c6e10938185b4fc982a1a4624545f8836173186',
  // The projected hash guards collision footprints and their OSM association,
  // not address labels or visual-only facade evidence.
  surroundings: 'b6b638b0c818f9863f068bb70b25c474c1fc935006e99a6a0b0683a93fd578a6',
  surroundingRoadExtension: '72ac3b7c7c172436187c8a049a32c2f4b5593fc770e3a5ac8eacb440a2b3622e',
  platforms: '472e0479dc6ede3360aeb1febacd11859fb7b28f2ddfa6918d80791869baa96a',
  playerBounds: 'c06961c176224f2e54be06920dfb26651bd3ebf35e4be1a8c3b86e2233dfe3a8',
}
if (JSON.stringify(geometryHashes) !== JSON.stringify(expectedGeometryHashes)) {
  errors.push(
    `collision geometry changed without review: ${JSON.stringify(geometryHashes)}`,
  )
}

const safeLandmarks = [
  'playerStart',
  'roadGate',
  'culvert',
  'entrance',
  'entranceApproachPoint',
  'parkingPreview',
  'streetFrontPreview',
  'surroundingsPreview',
]
for (const landmark of safeLandmarks) {
  const position = scene.SCENE_LANDMARKS[landmark]
  if (!interaction.virtualChurchPositionIsWithinPlayerBounds(position)) {
    errors.push(`${landmark}: guide/player landmark falls outside player bounds`)
  }
  if (
    interaction.virtualChurchPositionIsBlocked(
      position[0],
      position[2],
      position[1],
    )
  ) {
    errors.push(`${landmark}: guide/player landmark is inside collision geometry`)
  }
}

const expectedParkingRows = [
  { id: 'entry-north', start: [-32.77, 9.41], bays: 2, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'reference' },
  { id: 'entry-south', start: [-23.88, 0.61], bays: 5, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'reference' },
  { id: 'entry-gate-right', start: [-40.08, 2.02], bays: 6, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'provisional', layoutAuthority: 'user-confirmed-overhead-view' },
  { id: 'spine-building-side', start: [-22.65, -19.75], bays: 8, bayWidth: 2.5, bayDepth: 4.6, angle: -0.78, confidence: 'reference' },
  { id: 'spine-boundary-side', start: [-26.81, -23.92], bays: 8, bayWidth: 2.5, bayDepth: 4.6, angle: -0.78, confidence: 'reference' },
  { id: 'south-west-boundary', start: [-41.9, -26.1], bays: 10, bayWidth: 2.5, bayDepth: 5, angle: -0.78, confidence: 'reference' },
]
if (JSON.stringify(scene.PARKING_ROWS) !== JSON.stringify(expectedParkingRows)) {
  errors.push('parking rows changed without site-layout review')
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
    errors.push(`removed physical entrance object returned: ${removedPhysicalFragment}`)
  }
}
if (!viewSource.includes('<InstancedBoxSet items={parkingWheelStops}')) {
  errors.push('central parking wheel stops are no longer rendered directly')
}

const entryLeft = scene.PARKING_ROWS.find((row) => row.id === 'entry-north')
const entryRight = scene.PARKING_ROWS.find((row) => row.id === 'entry-gate-right')
let entranceDriveAisleWidth
let entryRightCornersInsideMainCarpark = false
if (!entryLeft || !entryRight) {
  errors.push('both left and right entrance parking rows must remain present')
} else {
  if (entryRight.layoutAuthority !== 'user-confirmed-overhead-view') {
    errors.push('right-of-gate six-bay relationship must retain user-confirmed overhead authority')
  }
  const ux = Math.cos(entryLeft.angle)
  const uz = Math.sin(entryLeft.angle)
  const vx = -uz
  const vz = ux
  const dx = entryRight.start[0] - entryLeft.start[0]
  const dz = entryRight.start[1] - entryLeft.start[1]
  const alongOffset = dx * ux + dz * uz
  const acrossOffset = dx * vx + dz * vz
  entranceDriveAisleWidth = Math.abs(acrossOffset)
    - entryLeft.bayDepth / 2
    - entryRight.bayDepth / 2
  if (
    Math.abs(alongOffset) > 0.01
    || Math.abs(entranceDriveAisleWidth - scene.SCENE_SCALE.driveAisleWidth) > 0.01
  ) {
    errors.push(
      `right-of-gate parking must preserve the aligned ${scene.SCENE_SCALE.driveAisleWidth} m entrance drive aisle`,
    )
  }

  const mainCarpark = [
    [-31, 10], [-40, 7], [-48, -3], [-50, -25], [-39, -42], [-24, -52],
    [4, -49], [19, -26], [4, -22], [-7, -14], [-16, -3], [-24, 10],
  ]
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
  const entryRightCorners = [0, entryRight.bays * entryRight.bayWidth]
    .flatMap((along) =>
      [-entryRight.bayDepth / 2, entryRight.bayDepth / 2].map((across) => [
        entryRight.start[0] + ux * along + vx * across,
        entryRight.start[1] + uz * along + vz * across,
      ]))
  entryRightCornersInsideMainCarpark = entryRightCorners.every((corner) =>
    pointInsidePolygon(corner, mainCarpark))
  if (!entryRightCornersInsideMainCarpark) {
    errors.push('right-of-gate parking crosses the main carpark boundary')
  }
}

const wheelStopSides = scene.CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE
if (
  JSON.stringify(wheelStopSides)
  !== JSON.stringify({
    'spine-building-side': -1,
    'spine-boundary-side': 1,
  })
) {
  errors.push('central parking wheel-stop offsets must remain on the inner pedestrian-spine side')
}
const buildingSideRow = scene.PARKING_ROWS.find(
  (row) => row.id === 'spine-building-side',
)
const boundarySideRow = scene.PARKING_ROWS.find(
  (row) => row.id === 'spine-boundary-side',
)
let centralParkingSpineGap
let entryRightToCentralDriveAisleWidth
if (!buildingSideRow || !boundarySideRow) {
  errors.push('both central pedestrian-spine parking rows must remain present')
} else {
  const vx = -Math.sin(buildingSideRow.angle)
  const vz = Math.cos(buildingSideRow.angle)
  const towardsBoundary = [
    boundarySideRow.start[0] - buildingSideRow.start[0],
    boundarySideRow.start[1] - buildingSideRow.start[1],
  ]
  const buildingStopDirection = [
    vx * wheelStopSides['spine-building-side'],
    vz * wheelStopSides['spine-building-side'],
  ]
  const boundaryStopDirection = [
    vx * wheelStopSides['spine-boundary-side'],
    vz * wheelStopSides['spine-boundary-side'],
  ]
  if (
    buildingStopDirection[0] * towardsBoundary[0]
      + buildingStopDirection[1] * towardsBoundary[1] <= 0
    || boundaryStopDirection[0] * -towardsBoundary[0]
      + boundaryStopDirection[1] * -towardsBoundary[1] <= 0
  ) {
    errors.push('central parking wheel stops point away from the pedestrian spine')
  }
  const centreSeparation = Math.abs(
    towardsBoundary[0] * vx + towardsBoundary[1] * vz,
  )
  centralParkingSpineGap = centreSeparation
    - buildingSideRow.bayDepth / 2
    - boundarySideRow.bayDepth / 2
  if (Math.abs(centralParkingSpineGap - 1.3) > 0.02) {
    errors.push(
      `central parking rows must retain the 1.3 m pedestrian-spine gap; received ${centralParkingSpineGap}`,
    )
  }
  if (entryRight) {
    const ux = Math.cos(entryRight.angle)
    const uz = Math.sin(entryRight.angle)
    const dx = buildingSideRow.start[0] - entryRight.start[0]
    const dz = buildingSideRow.start[1] - entryRight.start[1]
    entryRightToCentralDriveAisleWidth = dx * ux + dz * uz
      - entryRight.bays * entryRight.bayWidth
    if (
      entryRightToCentralDriveAisleWidth
      < scene.SCENE_SCALE.driveAisleWidth
    ) {
      errors.push(
        `right-of-gate and central parking must remain separated by a vehicle cross-aisle of at least ${scene.SCENE_SCALE.driveAisleWidth} m`,
      )
    }
  }
}

if (
  // (0, 0) is now inside the V3 far-left corridor; probe the solid main wing.
  !interaction.virtualChurchPositionIsBlocked(-10, 0, 0)
  || !interaction.virtualChurchPositionIsBlocked(-45, -10, 0)
) {
  errors.push('main and auxiliary building collision probes must remain blocked')
}
if (
  interaction.VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.length !== 8
  || interaction.VIRTUAL_CHURCH_SURROUNDING_SOURCE.scope !== 'exterior-only'
  || interaction.VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.some((building) => (
    building.hasInterior
    || building.horizontalConfidence !== 'osm-footprint'
    || building.verticalConfidence !== 'aerial-estimate'
  ))
) {
  errors.push('surrounding buildings must remain eight traceable exterior-only shells')
}
if (
  scene.VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE.roadWayId !== '243729471'
  || scene.VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE.footwayWayIds.length !== 2
  || scene.VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS.length !== 2
) {
  errors.push('north-east The Runway continuation must remain tied to its OSM road and footways')
}
if (
  interaction.virtualChurchShouldRenderSurroundingFacadeDetails(false, false)
  || interaction.virtualChurchShouldRenderSurroundingFacadeDetails(false, true)
  || interaction.virtualChurchShouldRenderSurroundingFacadeDetails(true, true)
  || !interaction.virtualChurchShouldRenderSurroundingFacadeDetails(true, false)
) {
  errors.push('surrounding facade detail must remain deferred on mobile and before site assets are ready')
}
if (
  !interaction.virtualChurchPositionIsBlocked(25, -30, 0)
  || !interaction.virtualChurchPositionIsBlocked(-63, 42, 0)
) {
  errors.push('surrounding buildings inside player bounds must remain solid')
}
if (
  !interaction.virtualChurchPositionIsNearEntrance(
    scene.SCENE_LANDMARKS.entranceApproachPoint,
    scene.SCENE_LANDMARKS.entrance,
  )
) {
  errors.push('entrance guide arrival must remain inside the study trigger')
}
if (
  interaction.virtualChurchPositionIsNearEntrance(
    scene.SCENE_LANDMARKS.playerStart,
    scene.SCENE_LANDMARKS.entrance,
  )
) {
  errors.push('player spawn must not trigger the entrance before exploration')
}
const expectedInsideFenceSpawn = [-30.6, 0, 0.3]
if (scene.SCENE_LANDMARKS.playerStart.some(
  (coordinate, index) => Math.abs(coordinate - expectedInsideFenceSpawn[index]) > 0.001,
)) {
  errors.push(
    `player spawn must preserve the reviewed inside-fence opening composition: ${JSON.stringify(scene.SCENE_LANDMARKS.playerStart)}`,
  )
}

const entrancePlatformHeight = interaction.virtualChurchGroundHeightAt(
  scene.SCENE_LANDMARKS.entranceApproachPoint[0],
  scene.SCENE_LANDMARKS.entranceApproachPoint[2],
  0,
  0,
)
const culvertPlatformHeight = interaction.virtualChurchGroundHeightAt(
  scene.SCENE_LANDMARKS.culvert[0],
  scene.SCENE_LANDMARKS.culvert[2],
  0,
  0,
)
if (entrancePlatformHeight !== 0.08 || culvertPlatformHeight !== 0.06) {
  errors.push(
    `walkable platform heights changed: entrance=${entrancePlatformHeight}, culvert=${culvertPlatformHeight}`,
  )
}

const viewAst = ts.createSourceFile(
  viewPath,
  viewSource,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
)
const copyPath = resolve(appRoot, 'src', 'i18n', 'virtualChurch.ts')
const copyAst = ts.createSourceFile(copyPath, await readFile(copyPath, 'utf8'), ts.ScriptTarget.ESNext, true)
requireSource(viewSource, "virtualChurchCopy as copy", 'Imported bilingual catalogue')
let copyDeclaration
const findCopy = (node) => {
  if (
    ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name)
    && node.name.text === 'virtualChurchCopy'
  ) {
    copyDeclaration = node
  }
  ts.forEachChild(node, findCopy)
}
findCopy(copyAst)
const unwrapExpression = (expression) => {
  let current = expression
  while (
    current
    && (
      ts.isAsExpression(current)
      || ts.isSatisfiesExpression(current)
      || ts.isParenthesizedExpression(current)
    )
  ) {
    current = current.expression
  }
  return current
}
const copyObject = unwrapExpression(copyDeclaration?.initializer)
const languageObjects = new Map()
if (copyObject && ts.isObjectLiteralExpression(copyObject)) {
  for (const property of copyObject.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const language = property.name.getText(copyAst).replaceAll(/['"]/gu, '')
    const value = unwrapExpression(property.initializer)
    if (ts.isObjectLiteralExpression(value)) languageObjects.set(language, value)
  }
}
if (
  languageObjects.size !== 2
  || !languageObjects.has('zh')
  || !languageObjects.has('en')
) {
  errors.push('copy contract must contain exactly zh and en dictionaries')
}
const languageKeys = {}
for (const [language, dictionary] of languageObjects) {
  const keys = []
  for (const property of dictionary.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const key = property.name.getText(copyAst).replaceAll(/['"]/gu, '')
    const value = unwrapExpression(property.initializer)
    keys.push(key)
    if (!ts.isStringLiteralLike(value) || value.text.trim().length === 0) {
      errors.push(`${language}.${key}: copy value must be a non-empty literal`)
    }
  }
  languageKeys[language] = keys
}
if (
  JSON.stringify(languageKeys.zh) !== JSON.stringify(languageKeys.en)
  || (languageKeys.zh?.length ?? 0) < 40
) {
  errors.push('Chinese and English dictionaries must have identical complete key order')
}

const navigationRoutes = ['/study', '/sermons', '/events']
for (const route of navigationRoutes) {
  requireSource(
    routesSource,
    `path="${route}"`,
    `Application route ${route}`,
  )
  requireSource(
    viewSource,
    `onNavigate('${route}')`,
    `Guide destination ${route}`,
  )
}
requireSource(
  routesSource,
  'path="/virtual-church"',
  'Virtual Church route',
)
for (const protectedView of ['<BibleStudyView />', '<VirtualChurchRouteEntry />']) {
  const viewIndex = routesSource.indexOf(protectedView)
  const memberStart = routesSource.lastIndexOf('<MemberRoute>', viewIndex)
  const memberEnd = routesSource.indexOf('</MemberRoute>', viewIndex)
  if (viewIndex < 0 || memberStart < 0 || memberEnd < viewIndex) {
    errors.push(`${protectedView} must remain inside MemberRoute`)
  }
}

for (const fragment of [
  "const modes: Array<{ id: CameraMode; label: string; icon: typeof Eye }> = [",
  "{ id: 'first', label: labels.first, icon: Eye }",
  "{ id: 'follow', label: labels.follow, icon: Camera }",
  "{ id: 'showcase', label: labels.showcase, icon: UserRound }",
  'teleportRef.request(SCENE_LANDMARKS.entranceApproachPoint, SCENE_LANDMARKS.entranceApproachYaw)',
  "cameraModeRef.current = 'follow'",
  "setCameraMode('follow')",
  'teleportRef.request(SCENE_LANDMARKS.parkingPreview, SCENE_LANDMARKS.parkingPreviewYaw)',
  'teleportRef.request(SCENE_LANDMARKS.streetFrontPreview, SCENE_LANDMARKS.streetFrontPreviewYaw)',
  'teleportRef.request(SCENE_LANDMARKS.surroundingsPreview, SCENE_LANDMARKS.surroundingsPreviewYaw)',
  'virtualChurchPositionIsNearEntrance(',
  'VIRTUAL_CHURCH_PLAYER_BOUNDS.x[0]',
  'VIRTUAL_CHURCH_PLAYER_BOUNDS.z[1]',
  'const side = CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE[',
  'const depthOffset = side * (row.bayDepth / 2 - 0.58)',
  'detailed={virtualChurchShouldRenderSurroundingFacadeDetails(',
  "const t = copy[auth.language === 'zh' ? 'zh' : 'en']",
  "onClick={() => void auth.updateLanguage(auth.language === 'en' ? 'zh' : 'en')}",
  "aria-label={auth.language === 'zh' ? virtualChurchText.label.zh : virtualChurchText.label.en}",
]) {
  requireSource(viewSource, fragment, 'Virtual Church interaction wiring')
}
if (!/const returnToEntrance = \(\) => \{\s*cameraModeRef\.current = 'follow'\s*setCameraMode\('follow'\)\s*cameraViewRef\.current\.pitch = \.24\s*teleportRef\.request\(SCENE_LANDMARKS\.entranceApproachPoint, SCENE_LANDMARKS\.entranceApproachYaw\)/u.test(viewSource)) {
  errors.push('Returning from a guide preview to the entrance must restore the follow camera and its pitch before teleporting')
}
const cameraConstraintCalls =
  (viewSource.match(/constrainThirdPersonCamera\(/gu) ?? []).length
if (cameraConstraintCalls !== 3) {
  errors.push(
    `expected initial/desired/current third-person camera constraints, received ${cameraConstraintCalls}`,
  )
}
for (const fragment of [
  'const CAMERA_BOOM_SLIDE_OFFSETS = [',
  'const churchCameraBoomSafeFraction = (',
  'allowFacadeSlide: boolean',
  'const INITIAL_FOLLOW_CAMERA_POSITION = new Vector3(...INITIAL_FOLLOW_CAMERA.position)',
  'constrainThirdPersonCamera(\n  INITIAL_FOLLOW_CAMERA_POSITION,\n  new Vector3(...PLAYER_START),\n  true,\n)',
  'constrainThirdPersonCamera(desiredCamera, player.position, true)',
  'constrainThirdPersonCamera(camera.position, player.position, false)',
  'bestSafeT - 0.12 / boomLength',
]) {
  requireSource(viewSource, fragment, 'Third-person camera occlusion recovery')
}
const languageReads = (viewSource.match(/auth\.language/gu) ?? []).length
const assetContractIndex = viewSource.indexOf('const HERO_READY_ASSETS =')
const viewComponentIndex = viewSource.indexOf('const VirtualChurchView = (')
if (
  languageReads !== 5
  || !viewSource.includes('<VirtualChurchGatheringsDialog language={auth.language}')
  || assetContractIndex < 0
  || viewComponentIndex < 0
  || assetContractIndex > viewComponentIndex
) {
  errors.push(
    'language selection must only choose copy, the in-scene switch and homepage timetable locale; shared 3D asset contracts must remain module-scoped',
  )
}
const loaderDependsOnCopy = []
const visitLoaders = (node) => {
  if (
    ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === 'useLoader'
    && node.arguments.some((argument) => /\b(?:t|copy|auth\.language)\b/u.test(
      argument.getText(viewAst),
    ))
  ) {
    loaderDependsOnCopy.push(node.getText(viewAst))
  }
  ts.forEachChild(node, visitLoaders)
}
visitLoaders(viewAst)
if (loaderDependsOnCopy.length > 0) {
  errors.push(
    `language copy must not select 3D loader URLs: ${JSON.stringify(loaderDependsOnCopy)}`,
  )
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church interaction validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  geometryHashes,
  safeLandmarks,
  reviewedInsideFenceSpawn: scene.SCENE_LANDMARKS.playerStart,
  entranceTriggerRadiusMetres:
    interaction.VIRTUAL_CHURCH_ENTRANCE_TRIGGER_RADIUS_METRES,
  walkablePlatformHeightsMetres: {
    entrance: entrancePlatformHeight,
    culvert: culvertPlatformHeight,
  },
  parkingLayout: {
    rows: scene.PARKING_ROWS.map(({ id, bays }) => ({ id, bays })),
    entranceDriveAisleWidthMetres: entranceDriveAisleWidth,
    entryRightCornersInsideMainCarpark,
    entryRightLayoutAuthority: entryRight?.layoutAuthority ?? null,
    entryRightToCentralDriveAisleWidthMetres:
      entryRightToCentralDriveAisleWidth,
    centralParkingSpineGapMetres: centralParkingSpineGap,
    wheelStopInnerEdgeSetbackMetres: 0.58,
    centralWheelStopsFacePedestrianSpine: true,
    centralCrossAisleHasNoTreeOrPlantingIsland: true,
    entranceHasNoPhysicalPlantersOrWelcomeBoards: true,
  },
  surroundingBuildings: {
    count: interaction.VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.length,
    sourceWays: interaction.VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map(
      ({ sourceWayId }) => sourceWayId,
    ),
    scope: interaction.VIRTUAL_CHURCH_SURROUNDING_SOURCE.scope,
    mobileFacadeDetailDeferred: true,
  },
  cameraModes: ['first', 'follow', 'showcase'],
  guideRoutes: navigationRoutes,
  memberProtectedRoutes: ['/study', '/virtual-church'],
  bilingualCopyKeys: languageKeys.zh.length,
  languageSwitchReloads3DAssets: false,
  passed: true,
}, null, 2))
