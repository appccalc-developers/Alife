import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import {
  VIRTUAL_CHURCH_BUILDING_FOOTPRINT,
  VIRTUAL_CHURCH_AUXILIARY_BUILDING,
  VIRTUAL_CHURCH_WALKABLE_FOYER,
  VIRTUAL_CHURCH_FOYER_CIRCULATION,
  VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE,
  VIRTUAL_CHURCH_FOYER_GUARD_ROOM,
  VIRTUAL_CHURCH_FOYER_FAR_CABINET,
  VIRTUAL_CHURCH_FOYER_STAIR,
  VIRTUAL_CHURCH_FOYER_STAIR_END_PIER,
  VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS,
  VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_VIEW,
  VIRTUAL_CHURCH_MAIN_HALL_VIEW,
  virtualChurchMainHallComparisonYaw,
  VIRTUAL_CHURCH_SECONDARY_HALL_VIEW,
  virtualChurchPositionIsBlocked,
  virtualChurchPointInsidePolygon,
  virtualChurchPositionIsInsideFoyerInterior,
  virtualChurchPositionIsInsideWalkableFoyer,
  virtualChurchPositionToEntranceLocal,
  virtualChurchGroundHeightAt,
} from '../src/views/virtualChurchInteractionContract.ts'
import { CHURCH_DIMENSIONS, SCENE_LANDMARKS } from '../src/views/virtualChurchScene.ts'

const entranceStart = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[4]
const entranceEnd = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[5]
const entranceAngle = -Math.atan2(
  entranceEnd[1] - entranceStart[1],
  entranceEnd[0] - entranceStart[0],
)
const entranceMid: [number, number] = [
  (entranceStart[0] + entranceEnd[0]) / 2,
  (entranceStart[1] + entranceEnd[1]) / 2,
]

const entranceLocalToSource = (x: number, z: number): [number, number] => [
  entranceMid[0] + Math.cos(entranceAngle) * x + Math.sin(entranceAngle) * z,
  entranceMid[1] - Math.sin(entranceAngle) * x + Math.cos(entranceAngle) * z,
]

test('entrance review keeps two left door banks, the welcome table and one confirmed right double door', () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.equal(route.leftDoorBanks.length, 2)
  assert.equal(route.rightDoorBanks.length, 1)
  assert.ok(route.leftDoorBanks[0][1] < route.leftDoorBanks[1][0])
  assert.ok(route.leftDoorBanks[1][1] < route.welcomeTable.z)
  assert.ok(route.welcomeTable.z < route.rightDoorBanks[0][0])
  assert.ok(route.rightDoorBanks[0][1] < route.partitionEndZ)
  assert.ok(route.welcomeTable.x - route.welcomeTable.halfWidth > route.aisleLeftX)
  assert.ok(route.welcomeTable.x + route.welcomeTable.halfWidth < route.aisleRightX)
  assert.ok(route.welcomeTable.x < route.axisX - 2.3,
    'the photographed brochure table belongs beside the left frontage, not in the central walking axis')
})

test('compact guard room precedes the first main-hall door without blocking the entrance axis', async () => {
  const guard = VIRTUAL_CHURCH_FOYER_GUARD_ROOM
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.ok(guard.minX > route.aisleLeftX && guard.maxX < route.axisX - 2)
  assert.ok(guard.maxZ < route.leftDoorBanks[0][0])
  const [guardX, guardZ] = entranceLocalToSource((guard.minX + guard.maxX) / 2, (guard.maxZ + .18) / 2)
  assert.equal(virtualChurchPositionIsBlocked(guardX, guardZ, 0), true)
  const [axisX, axisZ] = entranceLocalToSource(route.axisX, .3)
  assert.equal(virtualChurchPositionIsBlocked(axisX, axisZ, 0), false)
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerGuardRoomShell: BoxInstance\[\]/)
  assert.match(source, /\.\.\.foyerGuardRoomDoor/)
  assert.match(source, /\.\.\.foyerGuardRoomFrames/)
  assert.match(source, /\.\.\.foyerGuardRoomGlass/)
  assert.match(source, /\.\.\.foyerGuardRoomHardware/)
})

test('foyer guide lands on the straight entrance axis inside the V3 shell', async () => {
  const { position, yaw, pitch } = VIRTUAL_CHURCH_FOYER_VIEW
  const local = virtualChurchPositionToEntranceLocal(position[0], position[2])
  const interior = VIRTUAL_CHURCH_WALKABLE_FOYER.interior
  assert.ok(local.x > interior.minX + .5 && local.x < interior.maxX - .5)
  assert.ok(local.z > interior.minZ + .5 && local.z < interior.maxZ - .5)
  assert.equal(virtualChurchPositionIsBlocked(position[0], position[2], position[1]), false)
  assert.equal(virtualChurchPositionIsInsideFoyerInterior(position[0], position[2]), true)
  const ahead = virtualChurchPositionToEntranceLocal(position[0] - Math.sin(yaw), position[2] - Math.cos(yaw))
  assert.ok(ahead.z > local.z + .99)
  assert.ok(Math.abs(ahead.x - local.x) < .01, 'the entry camera must face along the straight aisle')
  assert.ok(Math.abs(local.x - VIRTUAL_CHURCH_FOYER_CIRCULATION.axisX) < .01)
  assert.ok(pitch < 0 && pitch > -.8)
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyer: '门厅内景'/)
  assert.match(source, /foyer: 'Inside the foyer'/)
  assert.match(source, /左侧门卫室、两处主堂门和迎宾桌.*咖啡窗及相邻的深色双门/)
  assert.match(source, /a small guard room, two main-hall door banks and a brochure table on the left.*the cafe window and its charcoal double doors are on the right/)
  assert.match(source, /onFoyer=\{viewFoyer\}/)
  assert.match(source, /teleportRef.request\(VIRTUAL_CHURCH_FOYER_VIEW.position, VIRTUAL_CHURCH_FOYER_VIEW.yaw\)/)
  assert.match(source, /const returnToEntrance = \(\) => \{[^}]*cameraViewRef.current.pitch = \.24/)
})

test('photo-comparison camera stands by the entrance and faces both left doors and the welcome table', async () => {
  const { position, yaw } = VIRTUAL_CHURCH_MAIN_HALL_VIEW
  const local = virtualChurchPositionToEntranceLocal(position[0], position[2])
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.equal(virtualChurchPositionIsBlocked(position[0], position[2], position[1]), false)
  assert.ok(local.x > route.axisX + .7 && local.x < route.axisX + 1.3,
    'comparison camera must stay within the photographed entrance opening')
  assert.ok(local.z > VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minZ && local.z < 1,
    'comparison camera stands just inside the threshold')
  const forward = virtualChurchPositionToEntranceLocal(position[0] - Math.sin(yaw), position[2] - Math.cos(yaw))
  assert.ok(forward.x < local.x - .6, 'the comparison angle must keep the left sanctuary wall in view')
  assert.ok(forward.z > local.z, 'the comparison angle must still look into the foyer')
  // The supplied photo crops part of the near bank at the left edge. Keep
  // that bank recognizable, while the second pair and brochure table fit.
  const forwardBearing = Math.atan2(forward.x - local.x, forward.z - local.z)
  const horizontalHalfFov = Math.atan(Math.tan(63 * Math.PI / 360) * 814 / 640)
  for (const [start, end] of route.leftDoorBanks.slice(1)) {
    for (const z of [start, end]) {
      const doorBearing = Math.atan2(route.aisleLeftX - local.x, z - local.z)
      const offset = Math.atan2(Math.sin(doorBearing - forwardBearing), Math.cos(doorBearing - forwardBearing))
      assert.ok(Math.abs(offset) < horizontalHalfFov - .02, 'the second complete left door bank must fit in the photo-comparison frame')
    }
  }
  // The supplied photo deliberately crops most of the nearer double door;
  // its far leaf is enough to identify the second, separate entrance.
  const nearBankBearing = Math.atan2(route.aisleLeftX - local.x, route.leftDoorBanks[0][1] - local.z)
  const nearBankOffset = Math.atan2(Math.sin(nearBankBearing - forwardBearing), Math.cos(nearBankBearing - forwardBearing))
  assert.ok(Math.abs(nearBankOffset) < horizontalHalfFov - .02,
    'the far leaf of the near left door bank must remain recognizable at the cropped edge')
  for (const x of [route.welcomeTable.x - route.welcomeTable.halfWidth, route.welcomeTable.x + route.welcomeTable.halfWidth]) {
    const tableBearing = Math.atan2(x - local.x, route.welcomeTable.z - local.z)
    const tableOffset = Math.atan2(Math.sin(tableBearing - forwardBearing), Math.cos(tableBearing - forwardBearing))
    assert.ok(Math.abs(tableOffset) < horizontalHalfFov - .02, 'the whole welcome table must remain in the same frame')
  }
  const farGlazingBearing = Math.atan2(route.axisX - route.farGlazingHalfWidth - local.x, route.oppositeDoorZ - local.z)
  const farGlazingOffset = Math.atan2(Math.sin(farGlazingBearing - forwardBearing), Math.cos(farGlazingBearing - forwardBearing))
  assert.ok(Math.abs(farGlazingOffset) < horizontalHalfFov - .02,
    'the photo comparison should retain at least the near edge of the daylit exit')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /mainHallView: '正门看主堂方向'/)
  assert.match(source, /mainHallView: 'Entrance view toward main hall'/)
  assert.match(source, /\.\.\.\(v3 \? \[\{ icon: Eye, title: t\.mainHallView, detail: t\.mainHallViewDetail, action: onMainHallView \}\] : \[\]\),\s*\.\.\.\(v3 \? \[\{ icon: Building2, title: t\.mainHallInterior,[^\n]+\}\] : \[\]\),\s*\{ icon: Building2, title: t\.foyer/,
    'the photo-backed entrance view should precede the straight-ahead foyer view in the guide')
  assert.match(source, /const foyerWelcomeBannerZ = foyerRoute\.leftDoorBanks\[1\]\[1\] \+ \.43/)
  assert.match(source, /\.\.\.foyerWelcomeBanner,\s*\.\.\.foyerWelcomeTableDisplay/,
    'the banner and brochure display must be rendered with the welcome table')
  assert.match(source, /const foyerMainHallUpperWall: BoxInstance\[\] = \[[\s\S]*?3\.27[\s\S]*?6\.94 \+ 9\.81[\s\S]*?\]/,
    'the photographed muted upper wall must continue above the welcome bay')
  assert.doesNotMatch(source, /const foyerWelcomeTableDisplay: BoxInstance\[\] = \[[\s\S]*?color: foyerWelcomeBrochurePalette\[index\][\s\S]*?\]/,
    'upright brochure cards should not return as laptop-like blocks')
  assert.match(source, /onMainHallView=\{viewMainHall\}/)
  assert.match(source, /virtualChurchMainHallComparisonYaw\(window.innerWidth \/ Math.max\(1, window.innerHeight\)\)/)
})

test('wide photo-comparison framing faces into the foyer rather than across the metal facade', () => {
  const photoYaw = virtualChurchMainHallComparisonYaw(4 / 3)
  const landscapeYaw = virtualChurchMainHallComparisonYaw(844 / 390)
  assert.equal(photoYaw, VIRTUAL_CHURCH_MAIN_HALL_VIEW.yaw)
  assert.ok(landscapeYaw > photoYaw + .09 && landscapeYaw < photoYaw + .11)
  assert.equal(virtualChurchMainHallComparisonYaw(Number.NaN), photoYaw)
  const local = virtualChurchPositionToEntranceLocal(
    VIRTUAL_CHURCH_MAIN_HALL_VIEW.position[0], VIRTUAL_CHURCH_MAIN_HALL_VIEW.position[2],
  )
  const forward = virtualChurchPositionToEntranceLocal(
    VIRTUAL_CHURCH_MAIN_HALL_VIEW.position[0] - Math.sin(landscapeYaw),
    VIRTUAL_CHURCH_MAIN_HALL_VIEW.position[2] - Math.cos(landscapeYaw),
  )
  const bearing = Math.atan2(forward.x - local.x, forward.z - local.z)
  const halfFov = Math.atan(Math.tan(63 * Math.PI / 360) * 844 / 390)
  assert.ok(bearing - halfFov > -Math.PI / 2,
    'the left image edge must not look backward across the exterior front panel')
})

test('secondary-hall comparison camera sees the confirmed cafe-adjacent double doors', async () => {
  const { position, yaw } = VIRTUAL_CHURCH_SECONDARY_HALL_VIEW
  const local = virtualChurchPositionToEntranceLocal(position[0], position[2])
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.equal(virtualChurchPositionIsBlocked(position[0], position[2], position[1]), false)
  assert.equal(virtualChurchPositionIsInsideFoyerInterior(position[0], position[2]), true)
  assert.ok(local.z > route.leftDoorBanks[1][1] && local.z < route.rightDoorBanks[0][0])
  assert.ok(local.x < route.aisleRightX - 2, 'the view stays in the foyer, away from the right wall')
  const forward = virtualChurchPositionToEntranceLocal(position[0] - Math.sin(yaw), position[2] - Math.cos(yaw))
  const forwardBearing = Math.atan2(forward.x - local.x, forward.z - local.z)
  assert.ok(forward.x > local.x + .7, 'the view turns toward the right frontage')
  const horizontalHalfFov = Math.atan(Math.tan(63 * Math.PI / 360) * 814 / 640)
  for (const [start, end] of route.rightDoorBanks) {
    for (const z of [start, end]) {
      const doorBearing = Math.atan2(route.aisleRightX - local.x, z - local.z)
      const offset = Math.atan2(Math.sin(doorBearing - forwardBearing), Math.cos(doorBearing - forwardBearing))
      assert.ok(Math.abs(offset) < horizontalHalfFov - .02, 'the cafe-adjacent double doors fit in the review frame')
    }
  }
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /secondaryHallView: '副堂方向对照'/)
  assert.match(source, /secondaryHallView: 'Toward the secondary hall'/)
  assert.match(source, /onSecondaryHallView=\{viewSecondaryHall\}/)
  assert.match(source, /teleportRef.request\(VIRTUAL_CHURCH_SECONDARY_HALL_VIEW.position, VIRTUAL_CHURCH_SECONDARY_HALL_VIEW.yaw\)/)
})

test('photo-backed stair replaces a false room door without closing the far right passage', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION, stair = VIRTUAL_CHURCH_FOYER_STAIR
  assert.ok(stair.minX > route.axisX + route.farGlazingHalfWidth + .05,
    'the stair belongs beside, not over, the far glazing')
  assert.ok(stair.maxX < route.branchRightX && stair.maxZ < route.oppositeDoorZ)
  assert.ok(stair.minZ > route.branchDepthZ + .4, 'the cross passage stays open in front of the stair')
  const blocked = (x: number, z: number) => {
    const [worldX, worldZ] = entranceLocalToSource(x, z)
    return virtualChurchPositionIsBlocked(worldX, worldZ, .095)
  }
  const midX = (stair.minX + stair.maxX) / 2, midZ = (stair.minZ + stair.maxZ) / 2
  assert.equal(blocked(midX, midZ), true, 'the player cannot walk through the unfinished stair')
  assert.equal(blocked(midX, route.branchDepthZ), false)
  const pier = VIRTUAL_CHURCH_FOYER_STAIR_END_PIER
  assert.ok(pier.centerX - pier.halfWidth >= stair.maxX + .09)
  assert.equal(blocked(pier.centerX, pier.centerZ), true, 'the player cannot enter the visible stair-end pier')
  assert.equal(blocked(pier.centerX, route.branchDepthZ), false, 'the pier cannot close the cross passage')
  assert.equal(blocked(route.axisX, midZ), false, 'the straight route to the glazing remains open')
  assert.equal(blocked(route.axisX + 6.5, route.branchDepthZ), false, 'the right corridor remains connected')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerStairDarkwork/)
  assert.match(source, /vc:foyer-stair-undercroft/)
  assert.match(source, /result\.color\.set\('#464c4a'\)/,
    'the stair cheek stays charcoal below the pale photographed upper wall')
  assert.match(source, /foyerStairTreadDepth\], color: '#292d2d'/,
    'black treads remain distinct from the stair cheek')
  assert.match(source, /foyerStairDarkwork\.push\(\.\.\.Array\.from\(\{ length: 5 \}/,
    'small glass stand-offs reuse the existing stair instance batch')
  assert.match(source, /const x = foyerStair\.minX \+ \(index \+ \.5\) \* foyerStairRun/,
    'from the entry, the stair begins beside the glazing and rises toward the right wall')
  assert.match(source, /position: \[x, top - foyerStairRiser \/ 2, foyerStairMidZ\]/,
    'closed steps have full-height downhill risers rather than floating shelves')
  assert.match(source, /scale: \[foyerStairRun \+ \.008, foyerStairRiser, foyerStairTreadDepth\]/)
  assert.match(source, /const along = \(index \+ \.65\) \/ 5/,
    'glass fittings spread over the entire incline, not only its lower half')
  assert.match(source, /foyerStairSideShape\.lineTo\(foyerStair\.maxX, foyerStair\.rise \+ \.045\)/)
  assert.match(source, /foyerStairSideShape\.lineTo\(foyerStair\.minX, \.045\)/)
  assert.match(source, /foyerStairGlassShapes = Array\.from\(\{ length: 3 \}/)
  assert.match(source, /shape\.moveTo\(atX\(start\), start \* foyerStair\.rise \+ \.17\)/)
  assert.match(source, /shape\.lineTo\(atX\(end\), end \* foyerStair\.rise \+ \.17\)/)
  assert.match(source, /<shapeGeometry args=\{\[foyerStairGlassShapes\]\}/,
    'all glass panes share one geometry and transparent draw')
  assert.match(source, /foyerStairRailAngle = Math\.atan2\(foyerStair\.rise/)
  assert.match(source, /const foyerStairTreadFrontZ = foyerStair\.minZ - \.07/)
  assert.match(source, /const foyerStairTreadBackZ = foyerStair\.maxZ - \.07/)
  assert.ok(stair.minZ - .07 < stair.minZ - .035,
    'tread noses and dark risers must sit in front of the glass and opaque cheek')
  assert.ok(stair.minZ - .07 > route.branchDepthZ + .3,
    'visible tread noses cannot enter the cross passage')
  for (let index = 0; index < stair.steps; index++) {
    const treadTop = (index + 1) * stair.rise / stair.steps
    const treadX = stair.minX + (index + .5) * (stair.maxX - stair.minX) / stair.steps
    const cheekTopAtTreadCenter = .045 + (treadX - stair.minX) * stair.rise / (stair.maxX - stair.minX)
    assert.ok(treadTop - cheekTopAtTreadCenter > .04,
      'the opaque stair cheek stays below every tread rather than hiding the steps')
  }
  assert.match(source, /vc:foyer-stair-glass-balustrade/)
  assert.match(source, /<FoyerStair \/>/)
  assert.match(source, /const foyerStairBackWallStartX = VIRTUAL_CHURCH_FOYER_STAIR\.minX - \.1/)
  assert.match(source, /const foyerStairBackWallEndX = VIRTUAL_CHURCH_FOYER_STAIR\.maxX \+ \.1/)
  assert.match(source, /\.\.\.foyerStairBackWall\.map\(item => \(\{ \.\.\.item, color: '#aaa7a1' \}\)\)/,
    'the upper stair backing stays pale like the photograph; the corridor wall stays separate')
  assert.match(source, /foyerStairEndPier: BoxInstance\[\] = \[\{[\s\S]*?VIRTUAL_CHURCH_FOYER_STAIR_END_PIER\.centerX[\s\S]*?VIRTUAL_CHURCH_FOYER_STAIR_END_PIER\.halfWidth \* 2/,
    'the photographed dark pier uses the same footprint as its collision boundary')
  assert.match(source, /\.\.\.foyerStairEndPier\.map\(item => \(\{ \.\.\.item, color: '#343b3b' \}\)\)/,
    'the stair pier reuses the existing dark architecture draw')
  assert.ok(stair.minX - .1 >= route.axisX + route.farGlazingHalfWidth - .001,
    'the stair backing cannot cover the opposite glazed exit')
  assert.ok(stair.maxX + .1 < route.branchRightX,
    'the pale right-corridor backing remains beyond the stair')
  assert.doesNotMatch(source, /branchRoomDoorCenters = \[[^\]]*foyerRoute\.axisX \+ 5\.5/)
})

test('photographed stair planters share small collision footprints and stay inside the foyer detail LOD', async () => {
  const stair = VIRTUAL_CHURCH_FOYER_STAIR
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.equal(VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS.length, 2)
  for (const planter of VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS) {
    const [worldX, worldZ] = entranceLocalToSource(planter.centerX, planter.centerZ)
    assert.equal(virtualChurchPositionIsBlocked(worldX, worldZ, .095), true)
    assert.ok(planter.radius <= .35 && planter.centerZ >= route.branchDepthZ,
      'the pots stay modest and beyond the cross passage')
    assert.ok(planter.centerX > route.axisX + route.farGlazingHalfWidth,
      'the central glazed exit remains clear')
  }
  assert.ok(VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS[0].centerX < stair.maxX)
  assert.ok(VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS[1].centerX > stair.maxX)
  const [routeX, routeZ] = entranceLocalToSource(route.axisX + 6.5, route.branchDepthZ)
  assert.equal(virtualChurchPositionIsBlocked(routeX, routeZ, .095), false,
    'the right branch remains passable beside the planters')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const planterComponent = source.slice(source.indexOf('const FoyerStairPlanters ='), source.indexOf('const FoyerCafeEquipment ='))
  assert.equal((planterComponent.match(/<instancedMesh\b/g) ?? []).length, 2)
  assert.equal((planterComponent.match(/<mesh\b/g) ?? []).length, 1,
    'the merged pots, instanced stems and leaves should use only three shared draw batches')
  assert.match(source, /const FoyerCirculationLayer =[\s\S]*?<FoyerStairPlanters \/>/)
  assert.match(source, /group\.visible = prepared && virtualChurchShouldRenderFoyerDetail\(/,
    'the indoor plant batches must remain excluded from the full street Low view')
})

test('photo-confirmed service-adjacent doors are dark without assigning that finish to unverified rooms', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const frontage = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE
  assert.ok(frontage.endZ < route.rightDoorBanks[0][0], 'the service window precedes the photographed dark door bank')
  assert.ok(frontage.startZ > -.52 && frontage.endZ < 6.4,
    'the enlarged service opening stays inside the existing right-hand wall')
  assert.ok(frontage.endZ - frontage.startZ >= 3 * (route.rightDoorBanks[0][1] - route.rightDoorBanks[0][0]),
    'photo 08 reads as a long service window, several times the adjacent double-door width')
  assert.ok(frontage.sillY >= .85 && frontage.sillY <= 1.15,
    'the dark plinth should be lower than the adjacent door, as in photo 08')
  assert.ok(frontage.headY - frontage.sillY >= 1.85,
    'the service window should read as a tall glazed opening, not a short slot')
  assert.ok(frontage.visibleDepth > 1 && frontage.visibleDepth < route.branchRightX - route.aisleRightX,
    'the cut-through recess must stay inside the right-hand shell')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /'#464b4a'/)
  assert.match(source, /'#d5d9d3'/,
    'the photographed cafe-adjacent vision lights should stay bright')
  assert.match(source, /const foyerPerimeterColumns: BoxInstance\[\] = \[6\.7, 10\.05\]\.map\([\s\S]*?position: \[foyerRoute\.aisleLeftX, 2\.93, z\]/,
    'photo-backed full-height columns stay on the main-hall side')
  assert.match(source, /foyerServiceDoorBayStartZ = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE\.endZ/)
  assert.match(source, /foyerServiceDoorBayEndZ = foyerRoute\.rightDoorBanks\[0\]\[1\] \+ \.17/,
    'the continuous dark finish stops just after the confirmed right-side bank')
  assert.match(source, /scale: \[\.025, 2\.96, foyerServiceDoorBayEndZ - foyerServiceDoorBayStartZ\]/,
    'the thin service-adjacent frontage covers the pale gap between window and door')
  assert.match(source, /\.\.\.foyerServiceAdjacentDoorBay\.map\(item => \(\{ \.\.\.item, color: '#303536' \}\)\)/)
  assert.match(source, /foyerServiceVisibleDepth = VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE\.visibleDepth/)
  assert.match(source, /foyerServiceGlassWidth = foyerServiceOpening\.endZ - foyerServiceOpening\.startZ/)
  assert.match(source, /foyerServiceWallWidth = foyerServiceWallEndZ - foyerServiceWallStartZ/)
  assert.match(source, /scale: \[\.08, foyerServiceOpening\.sillY, foyerServiceWallWidth\]/,
    'the dark plinth must span the enlarged opening and its solid piers')
  assert.match(source, /scale: \[\.04, foyerServiceGlassHeight, foyerServiceGlassWidth\]/,
    'the shallow recess must follow the same window width')
  assert.match(source, /scale: \[1\.08, \.07, foyerServiceGlassWidth - \.04\]/,
    'the counter must continue across the longer window')
  assert.match(source, /foyerServiceSurround: BoxInstance\[\]/)
  assert.match(source, /\.\.\.foyerServiceSurround\.map\(item => \(\{ \.\.\.item, color: '#bab6b0' \}\)\)/,
    'the photographed warm-grey cafe upper wall is not the bright kitchen recess')
  assert.match(source, /Math\.abs\(x - foyerRoute\.aisleRightX\) < \.2 && z <= foyerRoute\.partitionEndZ\) return '#bab6b0'/,
    'the right-door wall uses the cafe-side muted finish without changing its openings')
  assert.match(source, /foyerServiceCounter: BoxInstance\[\]/)
  assert.match(source, /foyerServiceBackHatch: BoxInstance\[\]/)
  assert.match(source, /\.\.\.foyerServiceBackHatch/,
    'the photographed rear pass-through should reuse the existing dark architecture batch')
  assert.match(source, /foyerServiceBackHatch: BoxInstance\[\] = \[[\s\S]*?color: '#a8a8a2'[\s\S]*?color: '#d8d3c6'/,
    'the rear pass-through reads as pale joinery, not two dark monitors')
  assert.match(source, /foyerServiceRecess\.map\(\(item, index\) => \(\{ \.\.\.item, color: index === 0 \? '#d4c7b6' : '#eee9df' \}\)\)/)
  assert.match(source, /vc:foyer-service-equipment/)
  assert.match(source, /foyerServiceEquipment: FoyerCafeEquipmentPart\[\] = \[[\s\S]*?sillY \+ \.75, 3\.43[\s\S]*?sillY \+ \.16, 3\.43[\s\S]*?sillY \+ \.26, 3\.43 \+ offset/,
    'one merged equipment batch retains the espresso lid, drip tray and group handles')
  assert.ok(3.34 - 2.54 / 2 > frontage.startZ && 3.34 + 2.54 / 2 < frontage.endZ,
    'the shallow rear elevation must remain within the photographed service opening')
  assert.ok(frontage.visibleDepth - .084 > .5 && frontage.visibleDepth - .045 < frontage.visibleDepth,
    'the rear elevation and its trim stay behind the counter within the existing recess')
  assert.match(source, /foyerServiceGlassHeight = foyerServiceOpening\.headY - foyerServiceOpening\.sillY/)
  assert.match(source, /foyerServiceGlassMidY = \(foyerServiceOpening\.headY \+ foyerServiceOpening\.sillY\) \/ 2/)
  assert.match(source, /foyerGlazingPanels: BoxInstance\[\] = \[\s*\.\.\.foyerBackDoors,[\s\S]*?foyerServiceGlassHeight - \.08,[\s\S]*?foyerServiceOpening\.endZ - foyerServiceOpening\.startZ - \.08/,
    'the photographed service glass shares the existing translucent glazing batch')
  assert.doesNotMatch(source, /name="vc:foyer-service-glazing"/,
    'the service glass must not add a separate transparent draw call')
  assert.match(source, /foyerServiceCounterY = foyerServiceOpening\.sillY \+ \.08/)
  assert.match(source, /foyerServiceCounter\.map\(item => \(\{ \.\.\.item, color: item\.color \?\? '#a38b70' \}\)\)/,
    'the pale photo-backed cabinet and worktop colours must survive instancing')
  assert.match(source, /visualVersion === 'v3' \? prepareVirtualChurchFoyerPassage\(result\) : null/)
  assert.equal(route.rightDoorBanks.length, 1)
})

test('left branch has a traversable corridor with two side-room fronts and a closed end door', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.ok(route.axisX - route.farGlazingHalfWidth - route.branchLeftX > 11,
    'the photo-backed left branch must not end just past the turn')
  assert.ok(route.oppositeDoorZ - route.leftBranchOpeningStartZ < 2.5,
    'the side corridor must keep the compact width seen in photo 01')
  assert.ok(route.leftBranchDepthZ > route.leftBranchOpeningStartZ + .5
    && route.leftBranchDepthZ < route.oppositeDoorZ - .5)
  assert.equal(route.leftBranchRoomDoors.length, 2)
  assert.ok(route.leftBranchRoomDoors[0] < route.leftBranchRoomDoors[1])
  assert.ok(route.leftBranchRoomDoors.every(x => x > route.branchLeftX + 1 && x < route.axisX - route.farGlazingHalfWidth - 1))
  for (let x = route.branchLeftX + .45; x < route.axisX - route.farGlazingHalfWidth; x += .8) {
    const [sourceX, sourceZ] = entranceLocalToSource(x, route.leftBranchDepthZ)
    assert.equal(virtualChurchPositionIsBlocked(sourceX, sourceZ, .095), false, `left corridor at x=${x} stays walkable`)
  }
  const [outsideX, outsideZ] = entranceLocalToSource(route.branchLeftX - .3, route.leftBranchDepthZ)
  assert.equal(virtualChurchPositionIsBlocked(outsideX, outsideZ, .095), true, 'the closed end wall remains a player boundary')
  const [frontWallX, frontWallZ] = entranceLocalToSource(route.branchLeftX + 2, route.branchWallZ)
  assert.equal(virtualChurchPositionIsBlocked(frontWallX, frontWallZ, .095), true,
    'the narrowed corridor front wall must block the player')
  const [seamX, seamZ] = entranceLocalToSource(route.aisleLeftX, (route.partitionEndZ + route.leftBranchOpeningStartZ) / 2)
  assert.equal(virtualChurchPositionIsBlocked(seamX, seamZ, .095), true,
    'the old foyer partition must join the new corridor front without an outdoor gap')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerLeftBranchEndDoor: BoxInstance\[\]/)
  assert.match(source, /foyerLeftBranchEndFrames: BoxInstance\[\]/)
  assert.match(source, /foyerLeftBranchEndHandle: BoxInstance\[\]/)
})

test('photo-backed warm corridor doors stay scoped to the left branch', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /index < foyerRoute\.leftBranchRoomDoors\.length \? '#b5a68e' : '#d9d4c8'/)
  assert.match(source, /foyerLeftBranchEndDoor\.map\(item => \(\{ \.\.\.item, color: '#b5a68e' \}\)\)/)
  assert.match(source, /index < foyerRoute\.leftBranchRoomDoors\.length \* 3 \? '#aa9b83' : '#7e817d'/)
  assert.match(source, /foyerContinuationCeiling\.map\(item => \(\{ \.\.\.item, color: '#f3efe6' \}\)\)/)
})

test('photo 01 corridor wall wash stays a single texture-free left-branch draw', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const wash = source.match(/const FoyerLeftCorridorWallWash = \(\) => \{[\s\S]*?\n\}/)?.[0]
  assert.ok(wash)
  assert.match(wash, /new MeshBasicMaterial\(\{ color: '#fff1d2', transparent: true, opacity: \.26, depthWrite: false \}\)/)
  assert.match(wash, /<mesh name="vc:foyer-left-corridor-wall-wash"/)
  assert.match(wash, /foyerRoute\.leftBranchOpeningStartZ \+ \.084/)
  assert.doesNotMatch(wash, /<(?:pointLight|spotLight)|TextureLoader|\.map\s*=/)
  assert.match(source, /<FoyerLuminaires \/>\s*<FoyerLeftCorridorWallWash \/>/)
})

test('photo 01 corridor doors show short lever hardware in front of the closed slabs', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('VirtualChurchView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declarations = ast.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
  const evaluate = (name: string, variables: Record<string, unknown>) => {
    const declaration = declarations.find(item => item.name.getText(ast) === name)
    assert.ok(declaration?.initializer)
    const code = ts.transpileModule(`const ${name} = ${declaration.initializer.getText(ast)}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText
    return new Function(...Object.keys(variables), `${code}; return ${name}`)(...Object.values(variables)) as Array<{
      position: [number, number, number]; scale: [number, number, number]
    }>
  }
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const centers = [...route.leftBranchRoomDoors, ...route.rightBranchRoomDoors]
  const doorZ = (x: number) => x > route.aisleRightX ? route.rightBranchRoomDoorZ : route.oppositeDoorZ
  const sideHardware = evaluate('foyerBranchRoomHandles', {
    branchRoomDoorCenters: centers, branchRoomDoorZ: doorZ,
  })
  assert.equal(sideHardware.length, centers.length * 3, 'each closed side door has a plate, stem and horizontal lever')
  for (const [index, center] of centers.entries()) {
    const [plate, stem, lever] = sideHardware.slice(index * 3, index * 3 + 3)
    assert.ok(plate.position[2] + plate.scale[2] / 2 < doorZ(center) + .1025,
      'the hardware must project toward the corridor beyond the slab face')
    assert.ok(stem.position[2] + stem.scale[2] / 2 < doorZ(center) + .1025)
    assert.ok(lever.position[2] + lever.scale[2] / 2 < doorZ(center) + .1025)
    assert.ok(lever.scale[0] >= .16 && lever.scale[1] <= .035,
      'the lever reads as a short horizontal handle, not the old thin vertical pin')
  }
  const endHardware = evaluate('foyerLeftBranchEndHandle', {
    foyerRoute: route, leftBranchEndDoorZ: (route.leftBranchOpeningStartZ + 13.42) / 2,
  })
  assert.equal(endHardware.length, 3)
  assert.ok(endHardware.every(item => item.position[0] - item.scale[0] / 2 > route.branchLeftX + .0425),
    'the end-door hardware must project into the corridor beyond its slab face')
  assert.ok(endHardware[2].scale[2] >= .16 && endHardware[2].scale[1] <= .035)
})

test('photo 01 courtyard window precedes the left corridor doors without opening a new room', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const window = route.leftBranchCourtyardWindow
  assert.ok(window.centerX - window.width / 2 > route.leftBranchRoomDoors[1] + .58,
    'the window follows the side-room doors when walking back toward the foyer')
  assert.ok(window.centerX + window.width / 2 < route.aisleLeftX,
    'the window stays within the side corridor rather than spanning the foyer')
  assert.ok(window.sillY <= .1 && window.headY < 2.8,
    'photo 01 window reads as a nearly full-height opening under the low ceiling')
  const guide = virtualChurchPositionToEntranceLocal(VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[0], VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[2])
  assert.ok(guide.x > window.centerX && guide.x < route.aisleLeftX)
  assert.ok(guide.z > route.leftBranchOpeningStartZ && guide.z < route.oppositeDoorZ)
  const yaw = VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.yaw
  const forward = virtualChurchPositionToEntranceLocal(
    VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[0] - Math.sin(yaw),
    VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[2] - Math.cos(yaw),
  )
  const forwardBearing = Math.atan2(forward.x - guide.x, forward.z - guide.z)
  const horizontalHalfFov = Math.atan(Math.tan(63 * Math.PI / 360) * 814 / 640)
  for (const [x, z] of [[window.centerX, route.oppositeDoorZ], [route.branchLeftX, route.leftBranchDepthZ]]) {
    const bearing = Math.atan2(x - guide.x, z - guide.z)
    const offset = Math.atan2(Math.sin(bearing - forwardBearing), Math.cos(bearing - forwardBearing))
    assert.ok(Math.abs(offset) < horizontalHalfFov - .02,
      'the courtyard window and closed end door should share the desktop review frame')
  }
  const [worldX, worldZ] = entranceLocalToSource(window.centerX, route.oppositeDoorZ + .3)
  assert.equal(virtualChurchPositionIsBlocked(worldX, worldZ, .095), true, 'the courtyard backdrop is not a walkable room')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const photo = await readFile(new URL('../public/virtual-church-assets/v3/foyer-courtyard-reference-01.jpg', import.meta.url))
  assert.equal(photo[0], 0xff); assert.equal(photo[1], 0xd8)
  assert.ok(photo.length < 120_000)
  assert.match(source, /cropped\.repeat\.set\(415 \/ 1280, 460 \/ 960\)/,
    'the window crop should include the photographed lower planting, not just the blank wall')
  assert.match(source, /leftBranchWindow\.headY \+ 5\.86/)
  assert.match(source, /position: \[leftBranchWindow\.centerX, \(leftBranchWindow\.sillY \+ leftBranchWindow\.headY\) \/ 2, 13\.285\]/,
    'the courtyard glazing keeps the photographed central dark mullion')
  assert.match(source, /foyerLeftBranchSafety: BoxInstance\[\] = \[/)
  assert.match(source, /\.\.\.foyerLeftBranchSafety,/,
    'the photographed far-end fire equipment is included in the shared foyer batch')
  assert.match(source, /<FoyerSideCourtyardPhoto \/>/)
  assert.match(source, /junctionDetail: '看靠门厅的庭院窗/)
  assert.match(source, /junctionDetail: 'See the near courtyard window/)
})

test('right branch is a walkable corridor with two closed room fronts inside the existing shell', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.ok(route.branchRightX - route.aisleRightX > 3.5)
  assert.ok(route.rightBranchRoomDoorZ - route.branchOpeningStartZ < 2,
    'the lateral right branch should read as a corridor, not a square room')
  assert.equal(route.rightBranchRoomDoors.length, 2)
  assert.ok(route.rightBranchRoomDoors[1] - route.rightBranchRoomDoors[0] > 1.8)
  for (const x of route.rightBranchRoomDoors) {
    assert.ok(x > route.aisleRightX + .58 && x < route.branchRightX - .58)
  }
  for (const z of [route.branchOpeningStartZ + .55, route.branchDepthZ, route.rightBranchRoomDoorZ - .3]) {
    for (const x of [route.aisleRightX + .55, (route.aisleRightX + route.branchRightX) / 2, route.branchRightX - .55]) {
      const [worldX, worldZ] = entranceLocalToSource(x, z)
      assert.equal(virtualChurchPointInsidePolygon(VIRTUAL_CHURCH_BUILDING_FOOTPRINT, worldX, worldZ), true)
      assert.equal(virtualChurchPositionIsBlocked(worldX, worldZ, .095), false)
      assert.equal(virtualChurchPositionIsBlocked(worldX, worldZ, .095, 'v2'), true)
    }
  }
  const [behindX, behindZ] = entranceLocalToSource((route.aisleRightX + route.branchRightX) / 2, route.rightBranchRoomDoorZ + .2)
  assert.equal(virtualChurchPositionIsBlocked(behindX, behindZ, .095), true,
    'closed room fronts must not allow walking through the new corridor wall')
  const guide = virtualChurchPositionToEntranceLocal(VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW.position[0], VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW.position[2])
  assert.ok(guide.x < route.aisleRightX - .4 && guide.x > route.aisleRightX - 1.2,
    'the guide should frame the short corridor from the open foyer, away from its first door')
  assert.ok(guide.z > route.branchOpeningStartZ && guide.z < route.rightBranchRoomDoorZ)
  const view = VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW
  assert.equal(virtualChurchPositionIsBlocked(view.position[0], view.position[2], view.position[1]), false)
  const forward = virtualChurchPositionToEntranceLocal(view.position[0] - Math.sin(view.yaw), view.position[2] - Math.cos(view.yaw))
  assert.ok(forward.x - guide.x > .7, 'right branch guide must look along the corridor, not squarely into the doors')
  assert.ok(forward.z > guide.z, 'right branch guide keeps both room fronts in the frame')
  const forwardBearing = Math.atan2(forward.x - guide.x, forward.z - guide.z)
  const horizontalHalfFov = Math.atan(Math.tan(63 * Math.PI / 360) * 814 / 640)
  for (const doorX of route.rightBranchRoomDoors) {
    const doorBearing = Math.atan2(doorX - guide.x, route.rightBranchRoomDoorZ - guide.z)
    const offset = Math.atan2(Math.sin(doorBearing - forwardBearing), Math.cos(doorBearing - forwardBearing))
    assert.ok(Math.abs(offset) < horizontalHalfFov - .03, 'both right-side room doors stay visible at review width')
  }
  assert.ok(Math.hypot(route.rightBranchRoomDoors[0] - guide.x, route.rightBranchRoomDoorZ - guide.z) > 2,
    'the first unmeasured room door must not fill the comparison view')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerRoute\.aisleRightX \+ \.18, foyerRoute\.branchRightX, foyerRoute\.branchOpeningStartZ/)
  assert.match(source, /foyerBranchRoomDoors: BoxInstance\[\] = branchRoomDoorCenters\.map/)
  assert.match(source, /branchRoomDoorZ\(x\)/)
  assert.match(source, /foyerBranchCeilingLights: BoxInstance\[\] = \[/)
})

test('far glazing keeps the photographed cabinet and wall cross instead of an invented adjacent door', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const cabinet = VIRTUAL_CHURCH_FOYER_FAR_CABINET
  assert.ok(route.farGlazingHalfWidth * 2 > cabinet.halfWidth * 2 * 1.9,
    'photo 04 shows a substantially wider glazing bank than the cabinet')
  assert.ok(cabinet.centerX + cabinet.halfWidth < route.axisX - route.farGlazingHalfWidth - .05,
    'the widened glazing must leave a wall pier beside the cabinet')
  assert.ok(cabinet.centerZ > route.branchDepthZ)
  assert.ok(cabinet.centerX - cabinet.halfWidth >= route.aisleLeftX - .001,
    'the far-foyer cabinet must not project into the compact side corridor')
  const [cabinetX, cabinetZ] = entranceLocalToSource(cabinet.centerX, cabinet.centerZ)
  assert.equal(virtualChurchPositionIsBlocked(cabinetX, cabinetZ, .095), true)
  const [passageX, passageZ] = entranceLocalToSource(cabinet.centerX, route.branchDepthZ)
  assert.equal(virtualChurchPositionIsBlocked(passageX, passageZ, .095), false)
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const foyerFarCabinetWoodwork: BoxInstance\[\]/)
  assert.match(source, /const foyerFarWallCross: BoxInstance\[\]/)
  const cross = source.slice(source.indexOf('const foyerFarWallCross:'), source.indexOf('const farGlazingPanelWidth'))
  const crossScales = [...cross.matchAll(/scale: \[([\d.]+), ([\d.]+), [\d.]+\]/g)].map(match => [Number(match[1]), Number(match[2])])
  const crossHeights = [...cross.matchAll(/position: \[foyerRoute\.axisX, ([\d.]+),/g)].map(match => Number(match[1]))
  assert.equal(crossScales.length, 2)
  assert.equal(crossHeights.length, 2)
  assert.ok(crossScales[0][1] > crossScales[1][0] * 1.35,
    'photo 03 reveals a long lower stem behind the flags, not a squat wide cross')
  const armFraction = (crossHeights[0] + crossScales[0][1] / 2 - crossHeights[1]) / crossScales[0][1]
  assert.ok(armFraction > .20 && armFraction < .38,
    'photo 03 places the arm in the upper portion of the stem')
  assert.ok(crossHeights[0] - crossScales[0][1] / 2 > 2.45 + .4,
    'the lower stem still clears the existing glazed exit header')
  assert.match(source, /const foyerFarCrossWall: BoxInstance\[\] = \[/)
  assert.match(source, /\.\.\.foyerFarCrossWall\.map\(item => \(\{ \.\.\.item, color: '#85817b' \}\)\)/,
    'the photographed cross wall stays a distinct warm grey behind the dark timber cross')
  assert.doesNotMatch(source.slice(source.indexOf('const foyerPaleArchitecture:'), source.indexOf('const foyerDarkArchitecture:')), /foyerFarCrossWall/,
    'the cross wall should not be recolored back to the generic pale corridor material')
  assert.doesNotMatch(source, /branchRoomDoorCenters = \[[^\]]*foyerRoute\.axisX - 5\.0/)
})

test('the far foyer glazing uses the supplied site photo as a bounded scenic view', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const photo = await readFile(new URL('../public/virtual-church-assets/v3/foyer-courtyard-reference-04.jpg', import.meta.url))
  assert.equal(photo[0], 0xff); assert.equal(photo[1], 0xd8)
  assert.ok(photo.length > 50_000 && photo.length < 250_000, 'one bounded reference photo, not a full-resolution scene dump')
  assert.match(source, /cropped\.offset\.set\(420 \/ 1280, \(960 - 714\) \/ 960\)/)
  assert.match(source, /cropped\.repeat\.set\(410 \/ 1280, 194 \/ 960\)/)
  assert.match(source, /<planeGeometry args=\{\[farGlazingHalfWidth \* 2 - \.07, 2\.43\]\} \/>/)
  assert.match(source, /farGlazingPanelWidth = farGlazingHalfWidth \/ 2/)
  assert.match(source, /foyerBackDoors: BoxInstance\[\] = \[\s*\.\.\.\[-1\.5, -\.5, \.5, 1\.5\]\.map/,
    'fixed side lights must flank the two central door leaves')
  assert.match(source, /foyerBackDoorFrames: BoxInstance\[\] = \[\s*\.\.\.\[-2, -1, 0, 1, 2\]\.map/,
    'four glazed panels need five aligned vertical mullions')
  assert.match(source, /<FoyerCourtyardPhoto \/>/)
  assert.match(source, /foyerGlazingPanels\} color="#e4f2ef" basic opacity=\{\.12\}/)
  assert.doesNotMatch(source, /foyerCourtyardBrickCourses|FoyerCourtyardPlanting/)
  assert.match(source, /visualVersion === 'v3' && heroAssetReady \? \([\s\S]*?<FoyerDetailLayer showFlags=\{showFoyerFlags\} onReady=\{setFoyerPrepared\} \/>/)
  assert.match(source, /const FoyerDetailLayer =[\s\S]*?<FoyerCirculationLayer loadCourtyardPhotos=\{loadCourtyardPhotos\} onFloorReady=\{setFloorPrepared\} \/>/)
})

test('the foyer opens as architecture first while preserving the event flag toggle', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const \[showFoyerFlags, setShowFoyerFlags\] = useState\(false\)/)
  assert.match(source, /\{showFlags \? <FoyerFlagLayer \/> : null\}/)
  assert.match(source, /onToggleFoyerFlags=\{\(\) => setShowFoyerFlags\(value => !value\)\}/)
})

test('V3 keeps the photographed entry volume open and branches beyond the sanctuary frontages', async () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  assert.ok(route.aisleLeftX < route.axisX && route.axisX < route.aisleRightX)
  assert.ok(route.partitionEndZ < route.branchDepthZ && route.branchDepthZ < route.oppositeDoorZ)
  assert.equal(route.leftDoorBanks.length, 2)
  assert.equal(route.rightDoorBanks.length, 1)
  assert.ok(route.leftDoorBanks[1][0] - route.leftDoorBanks[0][1] >= .55,
    'the photographed left entrances need a visible wall pier between their dark bays')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerMainHallWallStrips: BoxInstance\[\] = \[/)
  assert.match(source, /foyerMainHallThresholdRecess: BoxInstance\[\] = foyerRoute\.leftDoorBanks\.flatMap/)
  assert.match(source, /foyerLeftDoorSoffit\.map\(item => \(\{ \.\.\.item, color: '#69716e' \}\)\)/)
  assert.match(source, /foyerLeftDoorSoffitFascia\.map\(item => \(\{ \.\.\.item, color: '#d1cec6' \}\)\)/,
    'the photographed light-facing fascia must stay distinct from the shaded soffit')
  assert.match(source, /foyerLeftDoorDivider\.map\(item => \(\{ \.\.\.item, color: '#cbc7bd' \}\)\)/)
  assert.match(source, /foyerMainHallTimberFrontage: BoxInstance\[\] = \[\{[\s\S]*?position: \[foyerRoute\.aisleLeftX \+ \.23, 1\.36, \(6\.7 \+ 10\.05\) \/ 2\]/,
    'photo-backed timber belongs between the two left-side charcoal piers')
  assert.match(source, /\.\.\.foyerMainHallTimberFrontage,\s*\.\.\.foyerMainHallTimberJoints,/,
    'the timber finish reuses the existing woodwork batch')
  assert.ok(route.leftDoorBanks[1][1] < route.rightDoorBanks[0][0], 'the left pair is seen before the later right pair')
  assert.ok(route.welcomeTable.halfWidth < .9 && route.welcomeTable.halfDepth < .4,
    'the brochure table should stay a small movable furnishing, not dominate the foyer')
  assert.ok(route.welcomeTable.z - route.welcomeTable.halfDepth >= route.leftDoorBanks[1][1], 'the welcome table should follow both left door banks')
  assert.ok(route.welcomeTable.z + route.welcomeTable.halfDepth <= route.rightDoorBanks[0][0], 'the welcome table should precede the later right door banks')
  const blockedAt = (x: number, z: number, version: 'v2' | 'v3' = 'v3') => {
    const [worldX, worldZ] = entranceLocalToSource(x, z)
    return virtualChurchPositionIsBlocked(worldX, worldZ, 0, version)
  }
  for (let z = .95; z <= route.branchDepthZ; z += .15) {
    assert.equal(blockedAt(route.axisX, z), false, `the main aisle must stay walkable at z=${z.toFixed(2)}`)
  }
  for (let x = route.branchLeftX + .6; x < route.branchRightX - .6; x += .2) {
    assert.equal(blockedAt(x, route.branchDepthZ), false, `the T junction must stay walkable at x=${x.toFixed(2)}`)
  }
  // Sample the same continuous route against the ground contract as well as
  // collision. A branch can be unblocked yet still make the avatar sink.
  for (const [start, end, fixed, alongZ] of [
    [.95, route.branchDepthZ, route.axisX, true],
    [route.branchLeftX + .6, route.branchRightX - .6, route.branchDepthZ, false],
  ] as const) {
    for (let distance = start; distance <= end; distance += .25) {
      const [worldX, worldZ] = entranceLocalToSource(alongZ ? fixed : distance, alongZ ? distance : fixed)
      assert.equal(virtualChurchPositionIsBlocked(worldX, worldZ, .095, 'v3'), false,
        `the foyer route must stay clear at ${distance.toFixed(2)}`)
      assert.ok(Math.abs(virtualChurchGroundHeightAt(worldX, worldZ, .095, 0, 'v3') - .095) < .005,
        `the foyer route must stay level at ${distance.toFixed(2)}`)
    }
  }
  assert.ok(route.aisleRightX - route.aisleLeftX > 12, 'do not recreate the rejected narrow tunnel')
  for (const sideX of [route.aisleLeftX + 1, route.aisleRightX - 1]) {
    assert.equal(blockedAt(sideX, 2.4), false, 'the photographed entrance must remain open')
  }
  assert.equal(blockedAt(route.aisleLeftX, 8.8), true)
  assert.equal(blockedAt(route.aisleRightX, 8.8), true)
  assert.equal(blockedAt(route.welcomeTable.x, route.welcomeTable.z), true)
  assert.equal(blockedAt(route.axisX, route.welcomeTable.z), false, 'the welcome table must not seal the walking axis')
  assert.equal(blockedAt(route.aisleLeftX - .55, route.branchWallZ), true,
    'the compact left corridor begins beyond its ordinary-height front wall')
  assert.equal(blockedAt(route.aisleRightX + .55, route.branchWallZ), false,
    'the right corridor keeps an open connection from the foyer')
  for (const sideX of [route.aisleLeftX - .55, route.aisleRightX + .55]) {
    assert.equal(blockedAt(sideX, route.branchDepthZ), false)
  }
  assert.equal(blockedAt(route.axisX, route.branchWallZ), false, 'the straight route must enter the T junction')
  assert.equal(blockedAt(route.axisX - 8.3, route.branchWallZ), true,
    'the photographed narrow left passage must not permit walking through its front wall')
  assert.equal(blockedAt(route.aisleRightX + .55, route.branchWallZ), false,
    'the right branch opening stays connected to the far foyer')
  for (const doorX of [route.axisX - 8.3, route.aisleRightX + .55]) {
    assert.equal(blockedAt(doorX, route.branchDepthZ), false, 'both side branches must remain walkable')
  }
  for (const sideX of [route.branchLeftX + .6, route.branchRightX - .6]) {
    assert.equal(blockedAt(sideX, route.branchDepthZ), false)
    assert.equal(blockedAt(sideX, route.branchDepthZ, 'v2'), true)
    const [worldX, worldZ] = entranceLocalToSource(sideX, route.branchDepthZ)
    assert.ok(virtualChurchGroundHeightAt(worldX, worldZ, .095, 0, 'v3') >= .095)
  }
  assert.equal(virtualChurchPositionIsBlocked(
    VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[0],
    VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW.position[2], 0,
  ), false)
  for (const [view, side] of [
    [VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW, -1],
    [VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW, 1],
  ] as const) {
    const local = virtualChurchPositionToEntranceLocal(view.position[0], view.position[2])
    assert.ok(side === -1 ? local.x < route.aisleLeftX - .2 : local.x < route.aisleRightX - .4,
      'left guide is inside its corridor; right guide frames both doors from the open foyer')
    assert.ok(local.z > route.branchOpeningStartZ + .15 && local.z < route.oppositeDoorZ)
    assert.equal(virtualChurchPositionIsBlocked(view.position[0], view.position[2], 0), false)
  }
})

test('the photographed main-hall door lintel stays shallow and meets the high wall', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const soffit = source.match(/const foyerLeftDoorSoffit: BoxInstance\[\] = \[\{[\s\S]*?position: \[foyerRoute\.aisleLeftX \+ ([\d.]+), ([\d.]+),[\s\S]*?scale: \[([\d.]+), ([\d.]+),/)
  const wall = source.match(/const foyerMainHallUpperWall: BoxInstance\[\] = \[\s*\{[\s\S]*?position: \[foyerRoute\.aisleLeftX \+ [\d.]+, ([\d.]+),[\s\S]*?scale: \[\.018, ([\d.]+),/)
  assert.ok(soffit && wall)
  const [, offset, height, depth, thickness] = soffit.map(Number)
  const [, wallCenterY, wallHeight] = wall.map(Number)
  assert.ok(depth <= .5, 'the lintel must not project as a deep canopy into the open foyer')
  assert.ok(Math.abs(offset * 2 - depth) < .001, 'the lintel should begin flush at the door frontage')
  assert.ok(Math.abs(height + thickness / 2 - (wallCenterY - wallHeight / 2)) < .001,
    'the high wall finish should meet the shallow lintel without a floating gap')
})

test('photographed main-hall and cafe doors have loop pulls, with motion confined to the main hall', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('VirtualChurchView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declaration = ast.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(item => item.name.getText(ast) === 'foyerDoorPulls')
  assert.ok(declaration?.initializer)
  const code = ts.transpileModule(`const foyerDoorPulls = ${declaration.initializer.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2023 },
  }).outputText
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const foyerDoorBanks = [
    ...route.leftDoorBanks.map(([start, end]) => ({ x: route.aisleLeftX, side: 1, start, end })),
    ...route.rightDoorBanks.map(([start, end]) => ({ x: route.aisleRightX, side: -1, start, end })),
  ]
  const pulls: Array<{ position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number]; color?: string; mainHallDoor?: { bank: number } }> =
    new Function('foyerDoorBanks', 'foyerRoute', `${code}; return foyerDoorPulls`)(foyerDoorBanks, route)
  assert.equal(pulls.length, 48, 'photos 09 and 08 show four left loops and two cafe-side loops')
  const left = pulls.slice(0, 32), right = pulls.slice(32)
  assert.equal(left.filter(item => item.scale[1] === .42).length, 8)
  assert.equal(left.filter(item => item.scale[1] === .09 && item.rotation?.[0]).length, 16)
  assert.equal(left.filter(item => item.scale[0] === .075).length, 8)
  assert.ok(left.every(item => item.color === '#4d5350'))
  assert.equal(right.filter(item => item.scale[1] === .42).length, 4)
  assert.equal(right.filter(item => item.scale[1] === .09 && item.rotation?.[0]).length, 8)
  assert.ok(right.every(item => item.color === '#4d5350'))
  assert.ok(left.every(item => item.mainHallDoor && item.mainHallDoor.bank < route.leftDoorBanks.length))
  assert.ok(right.every(item => item.mainHallDoor === undefined),
    'the cafe hardware must stay fixed when a main-hall door opens')
  assert.match(source, /foyerDoorPulls\.map\(item => \(\{ \.\.\.item, color: item\.color \?\? '#5c6260' \}\)\)/)
  assert.match(source, /color: index < foyerLeftDoorLeafCount \? '#97978f'\s*: '#464b4a'/)
  assert.match(source, /color: index < foyerLeftDoorLeafCount \? '#293330'/)
})

test('photo-backed main-hall leaves and jambs remain pale while cafe-side doors stay charcoal in the same batches', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('foyer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const initializer = (name: string) => {
    let result = ''
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer!.getText(ast)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    assert.ok(result, `existing ${name} declaration`)
    return result
  }
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const doorCount = (route.leftDoorBanks.length + route.rightDoorBanks.length) * 2
  const leaves = Array.from({length: doorCount}, (_, index) => ({
    position: [index, 1.16, index], scale: [.045, 2.32, .8],
    mainHallDoor: index < route.leftDoorBanks.length * 2 ? {bank: Math.floor(index / 2), leaf: index % 2 ? 1 : -1} : undefined,
  }))
  const code = ts.transpileModule(`return ${initializer('foyerDoorLeaves')}`, {compilerOptions: {target: ts.ScriptTarget.ES2023}}).outputText
  const result = new Function('foyerSanctuaryDoors', 'foyerLeftDoorLeafCount', code)(leaves, route.leftDoorBanks.length * 2)
  assert.equal(result.length, doorCount)
  for (let i = 0; i < result.length; i++) {
    assert.equal(result[i].color, i < route.leftDoorBanks.length * 2 ? '#97978f' : '#464b4a')
    assert.equal(result[i].position, leaves[i].position)
    assert.equal(result[i].scale, leaves[i].scale)
    assert.equal(result[i].mainHallDoor, leaves[i].mainHallDoor, 'hinge metadata must remain unchanged')
  }
  assert.match(initializer('foyerAllDoorFrames'), /foyerDoorFrames\.map\(\(item, index\) => \(\{ \.\.\.item,\s*color: index < foyerRoute.leftDoorBanks.length \* 4 \? '#c4c1b7' : '#303a3a'/)
  const circulation = source.slice(source.indexOf('const FoyerCirculationLayer ='), source.indexOf('const FoyerDetailLayer ='))
  assert.equal((circulation.match(/name="vc:foyer-door-leaves"/g) ?? []).length, 1)
  assert.equal((circulation.match(/name="vc:foyer-door-frames"/g) ?? []).length, 1)
  assert.doesNotMatch(circulation, /pointLight|spotLight|directionalLight|new Texture/)
})

test('the automatic entrance opens onto one continuous walkable foyer', () => {
  const door = VIRTUAL_CHURCH_WALKABLE_FOYER.doorway
  const interior = VIRTUAL_CHURCH_WALKABLE_FOYER.interior
  const doorX = (door.minX + door.maxX) / 2
  const samples = [
    entranceLocalToSource(doorX, -0.2),
    entranceLocalToSource(doorX, 0.3),
    entranceLocalToSource(doorX, 2.8),
    entranceLocalToSource((interior.minX + interior.maxX) / 2, 5.7),
  ]

  for (const [x, z] of samples) {
    assert.equal(virtualChurchPositionIsInsideWalkableFoyer(x, z), true)
    assert.equal(virtualChurchPositionIsBlocked(x, z, 0), false)
  }

  const approach = SCENE_LANDMARKS.entranceApproachPoint
  const localApproach = virtualChurchPositionToEntranceLocal(approach[0], approach[2])
  assert.ok(localApproach.x > door.minX && localApproach.x < door.maxX)
  assert.ok(localApproach.z < door.maxZ)
  assert.equal(virtualChurchPositionIsBlocked(approach[0], approach[2], approach[1]), false)
})

test('solid facade and foyer shell remain blocked outside the door and room', () => {
  const door = VIRTUAL_CHURCH_WALKABLE_FOYER.doorway
  const interior = VIRTUAL_CHURCH_WALKABLE_FOYER.interior
  const besideDoor = entranceLocalToSource(door.maxX + 0.7, 0.05)
  const behindFoyer = entranceLocalToSource(
    (interior.minX + interior.maxX) / 2,
    interior.maxZ + 0.5,
  )

  assert.equal(virtualChurchPositionIsInsideWalkableFoyer(...besideDoor), false)
  assert.equal(virtualChurchPositionIsBlocked(besideDoor[0], besideDoor[1], 0), true)
  assert.equal(virtualChurchPositionIsInsideWalkableFoyer(...behindFoyer), false)
  assert.equal(virtualChurchPositionIsBlocked(behindFoyer[0], behindFoyer[1], 0), true)
})

test('third-person camera shares the foyer opening and shortens only after crossing inside', async () => {
  const door = VIRTUAL_CHURCH_WALKABLE_FOYER.doorway
  const interior = VIRTUAL_CHURCH_WALKABLE_FOYER.interior
  const doorX = (door.minX + door.maxX) / 2
  const exteriorDoorway = entranceLocalToSource(doorX, -0.2)
  const enclosedFoyer = entranceLocalToSource(doorX, interior.minZ + 0.5)
  assert.equal(virtualChurchPositionIsInsideFoyerInterior(...exteriorDoorway), false)
  assert.equal(virtualChurchPositionIsInsideFoyerInterior(...enclosedFoyer), true)

  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const branchPlayer = entranceLocalToSource(route.axisX - 5.5, route.branchDepthZ)
  const tableObstacle = entranceLocalToSource(route.welcomeTable.x, route.welcomeTable.z)
  const clearAxis = entranceLocalToSource(route.axisX, route.branchWallZ)
  const clearRight = entranceLocalToSource(route.axisX + 5.5, route.branchWallZ)
  assert.equal(virtualChurchPositionIsInsideFoyerInterior(...branchPlayer), true)
  assert.equal(virtualChurchPositionIsInsideWalkableFoyer(...tableObstacle), true)
  assert.equal(virtualChurchPositionIsBlocked(tableObstacle[0], tableObstacle[1], 0), true,
    'the welcome table is inside the walkable envelope but must stop the camera boom')
  assert.equal(virtualChurchPositionIsBlocked(clearAxis[0], clearAxis[1], 0), false)
  assert.equal(virtualChurchPositionIsBlocked(clearRight[0], clearRight[1], 0), false)

  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /if \(virtualChurchPositionIsInsideWalkableFoyer\(x, z, config3D\.visualVersion\)\) return false/)
  assert.match(source, /const THIRD_PERSON_FOYER_CAMERA_DISTANCE = 3\.25/)
  assert.match(source, /const cameraDistance = virtualChurchPositionIsInsideFoyerInterior\(/)
  assert.match(source, /\? THIRD_PERSON_FOYER_CAMERA_DISTANCE\s*: THIRD_PERSON_CAMERA_DISTANCE/)
  assert.match(source, /Math\.sin\(yaw\) \* cameraDistance/)
  assert.match(source, /Math\.cos\(yaw\) \* cameraDistance/)
  assert.match(source, /cameraStartsInV3Foyer && isBlocked\(sampleX, sampleZ, 0, 'v3'\)/)
})

test('real entrance collision keeps the follow heading and lowers a shortened boom', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const cameraCode = source.slice(source.indexOf('const CAMERA_ENTRANCE_START ='), source.indexOf('const TerrainSurface ='))
  const code = ts.transpileModule(cameraCode, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText
  const variables = {
    BUILDING_FOOTPRINT: VIRTUAL_CHURCH_BUILDING_FOOTPRINT,
    AUXILIARY_BUILDING: VIRTUAL_CHURCH_AUXILIARY_BUILDING,
    config3D: { visualVersion: 'v3' },
    CHURCH_DIMENSIONS,
    pointInsidePolygon: virtualChurchPointInsidePolygon,
    virtualChurchPositionIsInsideWalkableFoyer,
    virtualChurchPositionIsInsideFoyerInterior,
    isBlocked: virtualChurchPositionIsBlocked,
    MathUtils: { lerp: (a: number, b: number, t: number) => a + (b - a) * t },
  }
  const constrain = new Function(...Object.keys(variables), `${code}; return constrainThirdPersonCamera`)(...Object.values(variables))
  let shortened = 0
  // Include both doorway edges, the exterior approach and the first metres inside,
  // with a turned heading that would previously trigger the facade-slide search.
  for (const offset of [-.7, 0, .7]) for (let z = -3.4; z < 3; z += .1) {
    const [x, sourceZ] = entranceLocalToSource(VIRTUAL_CHURCH_FOYER_CIRCULATION.axisX + offset, z)
    if (!virtualChurchPositionIsInsideWalkableFoyer(x, sourceZ)) continue
    for (const turn of [-.4, 0, .4]) {
      const yaw = VIRTUAL_CHURCH_FOYER_VIEW.yaw + turn
      const distance = virtualChurchPositionIsInsideFoyerInterior(x, sourceZ) ? 3.25 : 6.2
      const boomX = Math.sin(yaw) * distance
      const boomZ = Math.cos(yaw) * distance
      const desired = { x: x + boomX, y: 2.725, z: -(sourceZ + boomZ) }
      constrain(desired, { x, y: .095, z: sourceZ }, true)
      const dx = desired.x - x
      const dz = -desired.z - sourceZ
      const cameraDepth = virtualChurchPositionToEntranceLocal(desired.x, -desired.z).z
      if (Math.min(z, cameraDepth) <= .45 && Math.max(z, cameraDepth) >= -3.1) {
        assert.ok(desired.y <= CHURCH_DIMENSIONS.entranceDoorHeight - .25 + 1e-8,
          'the camera and near plane must clear the real 2.35m entrance soffit')
      }
      assert.ok(Math.abs(dx * boomZ - dz * boomX) < 1e-8, 'doorway collision must not rotate the boom')
      const fraction = Math.hypot(dx, dz) / distance
      if (fraction < .95) {
        shortened++
        assert.ok(desired.y < 2.725, 'a shortened boom must lower toward eye height')
        assert.ok(desired.y >= 1.495 - 1e-8)
      }
    }
  }
  assert.ok(shortened > 0, 'exercise real door-jamb collisions, not only clear paths')
})

test('only the two V3 main-hall thresholds extend the walkable foyer through the left wall', () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  for (const [start, end] of route.leftDoorBanks) {
    for (let offset = .25; offset >= -.35; offset -= .05) {
      const [x, z] = entranceLocalToSource(route.aisleLeftX + offset, (start + end) / 2)
      assert.equal(virtualChurchPositionIsInsideWalkableFoyer(x, z, 'v3'), true)
      assert.equal(virtualChurchPositionIsBlocked(x, z, 0, 'v3'), false,
        `the full approach to the door must be clear at x offset ${offset.toFixed(2)}`)
      if (offset < 0) {
        assert.equal(virtualChurchPositionIsInsideWalkableFoyer(x, z, 'v2'), false)
        assert.equal(virtualChurchPositionIsBlocked(x, z, 0, 'v2'), true)
      }
    }
  }
  for (const localZ of [route.leftDoorBanks[0][0] - .2, (route.leftDoorBanks[0][1] + route.leftDoorBanks[1][0]) / 2, route.leftDoorBanks[1][1] + .2]) {
    const [x, z] = entranceLocalToSource(route.aisleLeftX - .25, localZ)
    assert.equal(virtualChurchPositionIsInsideWalkableFoyer(x, z, 'v3'), false)
    assert.equal(virtualChurchPositionIsBlocked(x, z, 0, 'v3'), true)
  }
})
