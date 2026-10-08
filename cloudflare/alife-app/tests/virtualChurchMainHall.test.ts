import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { MAIN_HALL_CHAIR_APPEARANCE } from '../src/views/virtualChurchMainHallMaterials.ts'
import { MAIN_HALL_CAMERA, MAIN_HALL_CHAIR_PARTS, MAIN_HALL_CHAIR_REFERENCE, MAIN_HALL_CHAIR_ROW_LINKS, MAIN_HALL_CHAIRS, MAIN_HALL_DIMENSIONS, MAIN_HALL_REAR_ACOUSTIC_FIELD, MAIN_HALL_REFERENCE, MAIN_HALL_SIDE_WINDOW_BAYS, MAIN_HALL_STAGE_ACCESS, MAIN_HALL_STAGE_FRONT_DOORS, MAIN_HALL_STAGE_RECESS } from '../src/views/virtualChurchMainHallLayout.ts'

test('auditorium failure unmounts the Canvas and keeps explicit bounded recovery', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /\{!failed \? <HallCanvasBoundary/)
  assert.match(hall, /<\/HallCanvasBoundary> : null\}/)
  assert.match(hall, /virtualChurchShouldReportContextLoss\(gl\.domElement\.isConnected, pageRef\.current\?\.querySelector\('canvas'\) === gl\.domElement\)/)
  assert.match(hall, /contextLossInjections\.current < contextLossLimit/)
  assert.match(hall, /window\.clearTimeout\(contextLossTimer\.current\)/)
  assert.match(hall, /setFailed\(false\); setRevision\(value => value \+ 1\)/)
  assert.match(hall, /requestFrame\.current = null/)
  assert.match(hall, /touchInput\.current = \{ forward: 0, strafe: 0, turn: 0 \}/)
})

test('auditorium context counters are opt-in and observe release before suppressing detached-canvas recovery', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /const hallContextReleaseDiagnosticEnabled = new URLSearchParams\(window.location.search\)\s*\.get\('profile3dGpu'\) === 'release'/)
  assert.match(hall, /if \(!hallContextReleaseDiagnosticEnabled\) return/)
  assert.match(hall, /data-virtual-church-hall-context-release-diagnostic/)
  assert.match(hall, /current\.createdContexts\+\+; current\.activeContexts\+\+/)
  assert.match(hall, /current\.releasedContexts\+\+/)
  assert.match(hall, /current\.activeContexts = Math\.max\(0, current\.activeContexts - 1\)/)
  assert.match(hall, /current\.canvasConnectedAtRelease = gl\.domElement\.isConnected/)
  const listener = hall.slice(hall.indexOf("gl.domElement.addEventListener('webglcontextlost'"))
  assert.ok(listener.indexOf('updateHallContextReleaseDiagnostic') < listener.indexOf('virtualChurchShouldReportContextLoss'))
  assert.match(listener, /\}, \{ once: true \}\)/)
})

test('chair proportions follow the supplier reference instead of oversized placeholder blocks', () => {
  const reference = MAIN_HALL_CHAIR_REFERENCE
  const { seat, back, leg } = MAIN_HALL_CHAIR_PARTS
  assert.equal(reference.height, .88)
  assert.equal(reference.width, .545)
  assert.equal(reference.depth, .63)
  assert.equal(reference.seatHeight, .475)
  assert.ok(Math.abs(seat.y + seat.height / 2 - reference.seatHeight) < .0001)
  assert.ok(Math.abs(back.y + back.height / 2 - reference.height) < .0001)
  assert.ok(Math.abs(leg.y - leg.height / 2) < .0001)
  assert.ok(Math.abs(back.y - back.height / 2 - (reference.seatHeight + .015)) < .0001,
    'one continuous back cushion replaces the overlapping lower block')
  assert.ok(reference.width - seat.width < .03)
  const frontZ = seat.z - seat.depth / 2
  const rearZ = back.z + back.depth / 2
  assert.ok(Math.abs(rearZ - frontZ - reference.depth) < .02)
})

test('historical chair candidate keeps matte procedural upholstery in the existing seat batches', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const palette = [...MAIN_HALL_CHAIR_APPEARANCE.seatColors, ...MAIN_HALL_CHAIR_APPEARANCE.backColors].map(color => color.slice(1))
  assert.equal(palette.length, 6)
  for (const hex of palette) {
    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)
    assert.ok(red >= 110 && red <= 165 && green >= 40 && green <= 95 && blue > green && blue < red,
      'photo-informed wine stays subdued and readable, not near-black or saturated magenta; visual approval is separate')
  }
  assert.match(hall, /const seatPalette = MAIN_HALL_CHAIR_APPEARANCE.seatColors/)
  assert.match(hall, /const backPalette = MAIN_HALL_CHAIR_APPEARANCE.backColors/)
  assert.match(hall, /const chairFabricShader: MeshStandardMaterial\['onBeforeCompile'\]/)
  assert.match(hall, /roughness=\{roughness \?\? \(rounded \? \.93 : metalness > 0 \? \.48 : \.91\)\}/)
  assert.match(hall, /onBeforeCompile=\{rounded \? chairFabricShader : timber \? mainHallTimberShader : undefined\}/)
  assert.match(hall, /customProgramCacheKey=\{rounded \? chairFabricProgramKey : timber \? mainHallTimberProgramKey : undefined\}/)
  assert.doesNotMatch(hall, /TextureLoader|useLoader/)
})

test('photo-informed light direction reuses one key and one cached map without continuous rendering', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const keys = [...hall.matchAll(/<directionalLight\b[^>]*\/>/g)]
  assert.equal(keys.length, 1)
  assert.match(keys[0][0], /position=\{MAIN_HALL_DAYLIGHT_KEY_POSITION\}/)
  // Matches the retained 2026-10-06 light-balance candidate, also covered by
  // virtualChurchMainHallLighting.test.ts; do not revert the real scene here.
  assert.match(keys[0][0], /intensity=\{1\.65\}/)
  assert.match(keys[0][0], /castShadow/)
  assert.match(keys[0][0], /shadow-mapSize=\{\[mainHallShadowMapSize\(lowDetail\), mainHallShadowMapSize\(lowDetail\)\]\}/)
  assert.doesNotMatch(hall, /<(?:pointLight|spotLight|rectAreaLight)\b/)
  assert.match(hall, /<Canvas shadows="percentage" frameloop="demand"/)
})

test('chairs retain one ambient carpet-contact batch alongside bounded cached daylight shadows', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /name="main-hall-chair-contact" args=\{\[undefined, undefined, MAIN_HALL_CHAIRS\.length\]\}/)
  assert.match(hall, /replace\('#include <opaque_fragment>'/,
    'MeshBasicMaterial uses opaque_fragment; an obsolete output_fragment hook would leave hard-edged squares')
  assert.match(hall, /contactFade = 1\.0 - smoothstep\(0\.12, 0\.49, length\(vChairContact\)\)/)
  assert.match(hall, /<ChairContactShadows \/>/)
  assert.match(hall, /depthWrite=\{false\}/)
  assert.match(hall, /castShadow=\{castShadow\} receiveShadow=\{receiveShadow\}/)
  assert.match(hall, /emissive = false, name, geometryFactory, castShadow = false, receiveShadow = false/)
})

test('2017 carpet candidate uses one warm procedural floor with alternating tile grain', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const materials = readFileSync(new URL('../src/views/virtualChurchMainHallMaterials.ts', import.meta.url), 'utf8')
  assert.match(materials, /float tileTurn = mod\(cell\.x \+ cell\.y, 2\.0\)/)
  assert.match(materials, /float fibreAxis = mix\(local\.x \+ local\.y \* \.16, local\.y \+ local\.x \* \.16, tileTurn\)/)
  assert.match(hall, /color="#69655e" roughness=\{1\} onBeforeCompile=\{carpetShader\}/)
  assert.match(hall, /customProgramCacheKey=\{mainHallCarpetProgramKey\}/)
  assert.equal((hall.match(/<planeGeometry args=\{\[width, depth\]\} \/>/g) ?? []).length, 1)
  assert.doesNotMatch(hall, /TextureLoader|useLoader/)
})

test('2017 ceiling diffusers stay on the existing underside material without new geometry or assets', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  const materials = readFileSync(new URL('../src/views/virtualChurchMainHallMaterials.ts', import.meta.url), 'utf8')
  assert.match(hall, /const ceilingDiffuserShader: MeshStandardMaterial\['onBeforeCompile'\]/)
  assert.match(materials, /vHallCeilingUnder = step\(0\.5, -normal\.y\)/)
  assert.match(materials, /mod\(vHallCeilingXZ \+ vec2\(11\.2, 10\.0\), vec2\(5\.6, 5\.0\)\)/)
  assert.match(hall, /name="main-hall-ceiling"[^\n]*onBeforeCompile=\{ceilingDiffuserShader\}/)
  assert.match(hall, /customProgramCacheKey=\{\(\) => 'main-hall-ceiling-diffusers-v3'\}/)
  assert.equal((hall.match(/name="main-hall-ceiling"/g) ?? []).length, 1)
  assert.doesNotMatch(hall, /name="main-hall-ceiling-diffuser-mesh"|TextureLoader|useLoader/)
})

test('2017 rear acoustic square field replaces central slats within the existing wall draw', () => {
  const field = MAIN_HALL_REAR_ACOUSTIC_FIELD
  assert.ok(field.halfWidth > 3.5 && field.halfWidth < MAIN_HALL_DIMENSIONS.width / 2 - 5)
  assert.ok(field.cellsPerMeter >= 3 && field.cellsPerMeter <= 5)
  const slats = Array.from({ length: 92 }, (_, index) => -10.47 + index * .23)
    .filter(x => Math.abs(x) > field.halfWidth + .06)
  assert.ok(slats.length > 40 && slats.length < 65, 'keep flanking timber without slats crossing the central field')
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /backSlats:[\s\S]*?\.filter\(\(\{ position \}\) => Math\.abs\(position\[0\]\) > MAIN_HALL_REAR_ACOUSTIC_FIELD\.halfWidth \+ \.06\)/)
  assert.match(hall, /name="main-hall-rear-acoustic-wall"[^\n]*onBeforeCompile=\{rearAcousticFieldShader\}/)
  assert.match(hall, /customProgramCacheKey=\{\(\) => 'main-hall-rear-acoustic-v1'\}/)
  assert.equal((hall.match(/name="main-hall-rear-acoustic-wall"/g) ?? []).length, 1)
  assert.doesNotMatch(hall, /TextureLoader|useLoader|name="main-hall-rear-acoustic-overlay"/)
})

test('2017 church-specific auditorium candidate has 360 distinct chairs, three blocks, and two walkable aisles', () => {
  assert.equal(MAIN_HALL_REFERENCE.year, 2017)
  assert.equal(MAIN_HALL_REFERENCE.suppliedChairs, 360)
  assert.equal(MAIN_HALL_CHAIRS.length, 360)
  assert.equal(new Set(MAIN_HALL_CHAIRS.map(chair => `${chair.x.toFixed(3)},${chair.z.toFixed(3)}`)).size, 360)
  for (const block of [0, 1, 2]) {
    const chairs = MAIN_HALL_CHAIRS.filter(chair => chair.block === block)
    assert.equal(chairs.length, 120)
    assert.equal(new Set(chairs.map(chair => chair.row)).size, 12)
    assert.equal(new Set(chairs.map(chair => chair.column)).size, 10)
  }
  const rearRow = MAIN_HALL_CHAIRS.filter(chair => chair.row === 0)
  const leftBlockEnd = Math.max(...rearRow.filter(chair => chair.block === 0).map(chair => chair.x))
  const middleBlockStart = Math.min(...rearRow.filter(chair => chair.block === 1).map(chair => chair.x))
  const middleBlockEnd = Math.max(...rearRow.filter(chair => chair.block === 1).map(chair => chair.x))
  const rightBlockStart = Math.min(...rearRow.filter(chair => chair.block === 2).map(chair => chair.x))
  assert.ok(middleBlockStart - leftBlockEnd > 1.1)
  assert.ok(rightBlockStart - middleBlockEnd > 1.1)
  for (const chair of MAIN_HALL_CHAIRS) {
    assert.ok(Math.abs(chair.x) + .27 < MAIN_HALL_DIMENSIONS.width / 2)
    assert.ok(chair.z < MAIN_HALL_DIMENSIONS.depth / 2 - .3)
    assert.ok(chair.z > MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2 + 1.4)
  }
})

test('slim metal chair links stay within rows and never span an aisle', () => {
  assert.equal(MAIN_HALL_CHAIR_ROW_LINKS.length, 3 * 12 * 9)
  for (const link of MAIN_HALL_CHAIR_ROW_LINKS) {
    const row = MAIN_HALL_CHAIRS.filter(chair => chair.block === link.block && chair.row === link.row)
    const neighbors = row.filter(chair => Math.abs(chair.x - link.x) < .3)
    assert.equal(neighbors.length, 2)
    assert.ok(link.width > 0 && link.width < .1)
    assert.equal(link.z, neighbors[0].z)
  }
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /main-hall-chair-linked-frames/)
  assert.match(hall, /MAIN_HALL_CHAIR_ROW_LINKS\.map/)
})

test('both auditorium cameras stay inside the shell and face their intended ends', () => {
  const { width, depth } = MAIN_HALL_DIMENSIONS
  for (const camera of Object.values(MAIN_HALL_CAMERA)) {
    assert.ok(Math.abs(camera.position[0]) < width / 2)
    assert.ok(Math.abs(camera.position[2]) < depth / 2)
  }
  assert.ok(MAIN_HALL_CAMERA.entrance.target[2] < MAIN_HALL_CAMERA.entrance.position[2])
  assert.ok(Math.abs(MAIN_HALL_CAMERA.entrance.position[0]) < .3,
    'rear 2017-photo framing should show the three seating blocks and both aisles, not stand inside one aisle')
  assert.ok(MAIN_HALL_CAMERA.entrance.position[1] >= 1.65 && MAIN_HALL_CAMERA.entrance.position[1] <= 1.9,
    'rear photo review uses a standing viewpoint rather than an elevated overview')
  assert.ok(MAIN_HALL_CAMERA.entrance.fov >= 52 && MAIN_HALL_CAMERA.entrance.fov <= 58,
    'the stage keeps photographic emphasis without an extreme wide-angle lens')
  assert.ok(MAIN_HALL_CAMERA.stage.target[2] > MAIN_HALL_CAMERA.stage.position[2])
  const rearRowZ = Math.max(...MAIN_HALL_CHAIRS.map(chair => chair.z))
  const frontRowZ = Math.min(...MAIN_HALL_CHAIRS.map(chair => chair.z))
  const stageFrontZ = MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2
  assert.ok(MAIN_HALL_CAMERA.entrance.position[2] - rearRowZ > 2.5,
    'rear camera must not be wedged against the last row')
  assert.ok(frontRowZ - stageFrontZ > 2 && frontRowZ - stageFrontZ < 3.5,
    'leave a readable but not cavernous apron before the first row')
})

test('2017 photo-informed side glazing follows the opposing rear/front photo views', () => {
  assert.deepEqual(MAIN_HALL_SIDE_WINDOW_BAYS.map(bay => bay.side), [-1, 1])
  const [rear, stageSide] = MAIN_HALL_SIDE_WINDOW_BAYS
  assert.ok(rear.centerZ > 0 && stageSide.centerZ < 0)
  assert.ok(rear.length > stageSide.length)
  assert.ok(rear.panes > stageSide.panes)
  assert.ok(stageSide.centerZ + stageSide.length / 2 < MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2,
    'the shallow stage-side window should not move into the seating aisle')
  for (const bay of MAIN_HALL_SIDE_WINDOW_BAYS) {
    assert.ok(bay.bottomY > 1.5)
    assert.ok(bay.topY < 3.22, 'window must stay below the upper acoustic slats')
    assert.ok(bay.centerZ + bay.length / 2 < MAIN_HALL_DIMENSIONS.depth / 2 - .3)
    assert.ok(bay.centerZ - bay.length / 2 > -MAIN_HALL_DIMENSIONS.depth / 2 + .3)
  }
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /main-hall-window-glazing/)
  assert.match(hall, /<HallSideWindows \/>/)
  assert.match(hall, /main-hall-side-window-frames/)
  assert.doesNotMatch(hall, /TextureLoader|useLoader|<img|<image/)
})

test('2017 stage-front door pair faces the audience without adding a walkable exit or draw batch', () => {
  const room = MAIN_HALL_DIMENSIONS
  assert.deepEqual(MAIN_HALL_STAGE_FRONT_DOORS.map(door => door.centerX), [-10.25, 10.25])
  for (const door of MAIN_HALL_STAGE_FRONT_DOORS) {
    assert.ok(door.bottomY < .2 && door.topY > 2.3 && door.topY < room.height / 2)
    assert.ok(Math.abs(door.centerX) - door.width / 2 > MAIN_HALL_STAGE_RECESS.wingX + MAIN_HALL_STAGE_RECESS.wingWidth / 2 - .1)
    assert.ok(Math.abs(door.centerX) + door.width / 2 < room.width / 2 - .3)
    assert.ok(door.faceZ > -room.depth / 2 && door.faceZ < MAIN_HALL_STAGE_RECESS.faceZ + .1)
  }
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /sideWindowPanes: Placement\[\] = \[/)
  assert.match(hall, /MAIN_HALL_STAGE_FRONT_DOORS\.flatMap/)
  assert.match(hall, /sideWindowFrames\.push\(/)
  assert.match(hall, /stageRecessDark: Placement\[\] = \[/)
  assert.equal((hall.match(/name="main-hall-stage-door-panes"/g) ?? []).length, 1)
  assert.equal((hall.match(/name="main-hall-side-window-frames"/g) ?? []).length, 1)
  assert.doesNotMatch(hall, /MAIN_HALL_STAGE_SIDE_GLAZED_DOOR|name="main-hall-stage-side-door"|TextureLoader|useLoader/)
})

test('2017 stage recess remains inside the old-photo candidate without changing the seating or walkable apron', () => {
  const recess = MAIN_HALL_STAGE_RECESS
  const room = MAIN_HALL_DIMENSIONS
  assert.equal(recess.bottomY, room.stageHeight)
  assert.ok(recess.width + 2 * recess.sidePierWidth < room.stageWidth)
  assert.ok(recess.bottomY + recess.height + .35 < room.height)
  assert.ok(recess.faceZ < room.stageZ - room.stageDepth / 2,
    'the recessed backdrop must stay behind the stage, not cover instruments or seats')
  assert.ok(recess.wingX + recess.wingWidth / 2 < room.width / 2)
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /main-hall-stage-recess/)
  assert.match(hall, /main-hall-stage-wings-and-reveals/)
})

test('stage wall wash stays a single local visual pass without extra lights or photo assets', () => {
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /name="main-hall-stage-wall-wash" position=\{\[0, stageRecessCentreY, stageRecess\.faceZ \+ \.04\]\}/)
  assert.match(hall, /onBeforeCompile=\{stageWallWashShader\}/)
  assert.match(hall, /transparent opacity=\{\.48\} depthWrite=\{false\}/)
  assert.equal((hall.match(/<mesh name="main-hall-stage-wall-wash"/g) ?? []).length, 1)
  assert.doesNotMatch(hall, /<spotLight|TextureLoader|useLoader/)
})

test('photo-informed shallow stage approaches have slim rails without closing the aisles', () => {
  const access = MAIN_HALL_STAGE_ACCESS
  const stageFront = MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2
  const nearestSeat = Math.min(...MAIN_HALL_CHAIRS.map(chair => chair.z))
  assert.equal(access.stairCentersX.length, 2)
  assert.ok(access.stairCentersX[0] < 0 && access.stairCentersX[1] > 0)
  assert.ok(access.railBackZ >= stageFront && access.railFrontZ > access.railBackZ)
  assert.ok(access.railFrontZ < nearestSeat - 1.5)
  assert.ok(access.railFrontTopY > .8 && access.railBackTopY > access.railFrontTopY)
  assert.ok(access.railBackTopY < MAIN_HALL_DIMENSIONS.height)
  for (const centerX of access.stairCentersX) {
    assert.ok(Math.abs(centerX) + access.railOffsetX < MAIN_HALL_DIMENSIONS.width / 2)
  }
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(hall, /main-hall-stage-handrails/)
  assert.match(hall, /stageAccess\.stairCentersX\.map/)
})

test('local guest V3 guide opens an original-geometry review, not a remote photo texture or V2 replacement', () => {
  const routes = readFileSync(new URL('../src/app/routing/AppRoutes.tsx', import.meta.url), 'utf8')
  const church = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const hall = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url), 'utf8')
  assert.match(routes, /path="\/virtual-church\/main-hall" element=\{<VirtualChurchPreviewRoute><VirtualChurchRouteBoundary><VirtualChurchMainHallView/)
  assert.match(church, /\.\.\.\(v3 \? \[\{ icon: Building2, title: t\.mainHallInterior, detail: t\.mainHallInteriorDetail, action: \(\) => onNavigate\('\/virtual-church\/main-hall'\)/)
  assert.match(church, /mainHallInterior: '主堂内部 · 2017 参考'/)
  assert.match(church, /mainHallInterior: 'Main auditorium · 2017 reference'/)
  assert.match(hall, /MAIN_HALL_CHAIRS/)
  assert.match(hall, /not a record of the 2026 interior/)
  assert.doesNotMatch(hall, /TextureLoader|useLoader|<img|<image/)
})
