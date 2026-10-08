import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { Color, MathUtils, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { ALIFE_SCENE, ALIFE_V3_ENVIRONMENT_TREATMENT, ALIFE_V3_SCENE_TREATMENT } from '../src/views/alifeVisualTheme.ts'
import {
  VIRTUAL_CHURCH_AUXILIARY_BUILDING,
  VIRTUAL_CHURCH_BUILDING_FOOTPRINT,
  VIRTUAL_CHURCH_PLAYER_BOUNDS,
  VIRTUAL_CHURCH_SURROUNDING_BUILDINGS,
  VIRTUAL_CHURCH_SURROUNDING_SOURCE,
  virtualChurchPointInsidePolygon,
  virtualChurchPositionIsBlocked,
  virtualChurchShouldRenderSurroundingFacadeDetails,
} from '../src/views/virtualChurchInteractionContract.ts'
import {
  virtualChurchFacadePointAt,
  virtualChurchOfficeRibbonPanels,
  createVirtualChurchMobileSurroundings,
  virtualChurchSurroundingFacadeFrame,
  virtualChurchSurroundingFacadeUsesLoadingPad,
  virtualChurchSurroundingHardstandStrips,
  virtualChurchSurroundingPerimeterFrames,
  virtualChurchSurroundingRoofBandSegments,
  virtualChurchSurroundingStructure,
} from '../src/views/virtualChurchSurroundingFacadeGeometry.ts'
import {
  SCENE_LANDMARKS,
  VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE,
  VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS,
  VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT,
  VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS,
  VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS,
  VIRTUAL_CHURCH_SURROUNDING_TREES,
  VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION,
  VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS,
} from '../src/views/virtualChurchScene.ts'

type Point = [number, number]

test('V3 haze preserves the near scene and middle-distance contrast, then hides the far clip', async () => {
  const fog = ALIFE_V3_SCENE_TREATMENT.scene.fog
  // Three's linear Fog mixes with smoothstep of view-space depth, not radial distance.
  const amount = (depth: number) => MathUtils.smoothstep(depth, fog.near, fog.far)
  for (const depth of [0, 5, 15, 30, 50, 65]) assert.equal(amount(depth), 0)
  for (const depth of [90, 100, 120, 140]) {
    const previous = MathUtils.smoothstep(depth, 65, 145)
    assert.ok(amount(depth) < previous - .1, `retain more building contrast at depth ${depth}`)
  }
  assert.ok(amount(120) < .4 && amount(140) < .75)
  assert.equal(amount(175), 1); assert.equal(amount(190), 1)
  assert.deepEqual(ALIFE_SCENE.fog, { color: '#c58e62', near: 50, far: 130 }, 'V2 stays frozen')
  assert.equal(fog.color, '#c8d8d5', 'no near-scene colour/sky change')
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const camera = source.match(/camera=\{\{ position: INITIAL_FOLLOW_CAMERA_POSITION\.toArray\(\), fov: 47, near: 0\.1, far: (\d+)/)
  assert.ok(camera, 'main canvas camera must keep an explicit far clipping plane')
  const clip = Number(camera[1])
  assert.ok(clip - fog.far >= 10, 'fully opaque fog before geometry reaches the camera clipping plane')
  assert.match(source, /<fog attach="fog" args=\{\[sceneTreatment.fog.color, sceneTreatment.fog.near, sceneTreatment.fog.far\]\}/)
})

const orientation = (a: Point, b: Point, c: Point) => (
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
)

const segmentsProperlyIntersect = (a: Point, b: Point, c: Point, d: Point) => {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  return abC * abD < 0 && cdA * cdB < 0
}

const polygonsOverlap = (a: Point[], b: Point[]) => (
  a.some(([x, z]) => virtualChurchPointInsidePolygon(b, x, z))
  || b.some(([x, z]) => virtualChurchPointInsidePolygon(a, x, z))
  || a.some((start, index) => {
    const end = a[(index + 1) % a.length]
    return b.some((otherStart, otherIndex) => (
      segmentsProperlyIntersect(
        start,
        end,
        otherStart,
        b[(otherIndex + 1) % b.length],
      )
    ))
  })
)

test('neighbour pavement preserves church parking and opens onto the existing road', async () => {
  assert.deepEqual(VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS.map(p => p.sourceWayId), [
    '1547522212', '1547753361', '1547753368', '1547753373', '1547753378',
  ])
  const source = await readFile(new URL('../src/views/virtualChurchScene.ts', import.meta.url), 'utf8')
  const approvedGround = ['MAIN_CARPARK', 'ENTRANCE_DRIVEWAY'].map(name => {
    const match = source.match(new RegExp(`const ${name}: Array<\\[number, number\\]> = (\\[.*\\])`))
    assert.ok(match, name)
    return JSON.parse(match[1]) as Point[]
  })
  for (const surface of [...VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS, VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT.points]) {
    assert.ok(surface.every(p => p.every(Number.isFinite)))
    for (const protectedArea of [...approvedGround, VIRTUAL_CHURCH_BUILDING_FOOTPRINT, VIRTUAL_CHURCH_AUXILIARY_BUILDING]) {
      assert.equal(polygonsOverlap(surface, protectedArea), false, 'neighbour paving must not repaint church land')
    }
    for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
      assert.equal(polygonsOverlap(surface, building.footprint), false, building.id)
    }
  }
  const originalRoad = JSON.parse(source.match(/const THE_RUNWAY: Array<\[number, number\]> = (\[.*\])/)![1]) as Point[]
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS.length, 4)
  for (const access of VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS) {
    assert.ok(access.sourceWayIds.length >= 1)
    assert.equal(access.widthConfidence, 'aerial-estimate')
    assert.ok(access.width >= 3 && access.width <= 5)
    const [x, z] = access.centreline[0]
    assert.ok([originalRoad, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION].some(road => virtualChurchPointInsidePolygon(road, x, z)))
    if (access.sourceWayIds[0] !== '1547753372') {
      const [endX, endZ] = access.centreline.at(-1)!
      assert.ok(VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS.some(({ points }) => virtualChurchPointInsidePolygon(points, endX, endZ)), 'forecourt driveway reaches pavement')
    }
  }
})

test('117 side parking connects to The Runway via its mapped driveway without paving the office-front lawn', () => {
  const access = VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS.find(a => a.sourceWayIds.includes('651089715'))!
  assert.ok(access)
  assert.deepEqual(access.centreline, [[81.26, 123.5], [76.51, 129.41], [71.95, 135.05], [71.53, 135.55]])
  const parking = VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS.find(p => p.sourceWayId === '1547753373')!
  assert.ok(virtualChurchPointInsidePolygon(parking.points, ...access.centreline.at(-1)!))
  for (let segment = 1; segment < access.centreline.length; segment++) {
    const a = access.centreline[segment - 1], b = access.centreline[segment]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    for (const t of [.01, .25, .5, .75, .99]) for (const side of [-.45, 0, .45]) {
      const x = a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) / length * access.width * side
      const z = a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) / length * access.width * side
      assert.ok(VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS.some(p => virtualChurchPointInsidePolygon(p, x, z)), 'continuous paved lane, not disconnected islands')
    }
  }
  const building = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(b => b.address === '117 The Runway')!
  const front = virtualChurchSurroundingFacadeFrame(building)!
  for (const t of [.3, .5, .7]) for (const outset of [2, 4, 6]) {
    const p = virtualChurchFacadePointAt(front, t, outset)
    assert.equal(VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS.some(polygon => virtualChurchPointInsidePolygon(polygon, ...p)), false)
  }
})

test('surrounding context is traceable, exterior-only and horizontally authoritative', () => {
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_SOURCE.aerialYear, 2025)
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_SOURCE.scope, 'exterior-only')
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.length, 8)
  assert.equal(new Set(VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map(({ sourceWayId }) => sourceWayId)).size, 8)
  assert.deepEqual(
    VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(({ address }) => address).map(({ sourceWayId, address, addressEvidence }) => ({ sourceWayId, address, addressEvidence })),
    [
      { sourceWayId: '897328722', address: '124 Hayton Road', addressEvidence: 'osm-way-tag' },
      { sourceWayId: '420431718', address: '115 The Runway', addressEvidence: 'osm-way-tag' },
      { sourceWayId: '1170948387', address: '5 Stark Drive', addressEvidence: 'osm-way-tag' },
      { sourceWayId: '1170948415', address: '117 The Runway', addressEvidence: 'property-listing' },
    ],
  )

  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    assert.equal(building.hasInterior, false)
    assert.equal(building.horizontalConfidence, 'osm-footprint')
    assert.equal(building.verticalConfidence, 'aerial-estimate')
    assert.ok(building.footprint.length >= 6)
    assert.ok(building.height >= 6 && building.height <= 10)
    if (building.featureEdge) {
      const [startIndex, endIndex] = building.featureEdge
      assert.ok(startIndex >= 0 && startIndex < building.footprint.length)
      assert.ok(endIndex >= 0 && endIndex < building.footprint.length)
      assert.notEqual(startIndex, endIndex)
    }
  }
})

test('mapped surrounding trunks stay clear of buildings, carriageways and church parking', async () => {
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_TREES.length, 16)
  assert.equal(new Set(VIRTUAL_CHURCH_SURROUNDING_TREES.map(t => t.sourceNodeId)).size, 16)
  const source = await readFile(new URL('../src/views/virtualChurchScene.ts', import.meta.url), 'utf8')
  const protectedAreas = ['THE_RUNWAY', 'STARK_DRIVE_NORTH', 'STARK_DRIVE_SERVICE', 'MAIN_CARPARK', 'ENTRANCE_DRIVEWAY'].map(name => {
    const match = source.match(new RegExp(`const ${name}: Array<\\[number, number\\]> = (\\[.*\\])`))
    assert.ok(match, name)
    return JSON.parse(match[1]) as Point[]
  })
  protectedAreas.push(VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, VIRTUAL_CHURCH_BUILDING_FOOTPRINT,
    VIRTUAL_CHURCH_AUXILIARY_BUILDING, ...VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map(b => b.footprint))
  for (const tree of VIRTUAL_CHURCH_SURROUNDING_TREES) {
    const [x, z] = tree.point
    // Sample the trunk base, not the canopy: a street tree may overhang a verge.
    for (const [dx, dz] of [[0, 0], [.18, 0], [-.18, 0], [0, .18], [0, -.18]]) {
      assert.ok(protectedAreas.every(area => !virtualChurchPointInsidePolygon(area, x + dx, z + dz)), tree.sourceNodeId)
    }
  }
})

test('northern horizon shells use traceable OSM footprints inside the visible fog transition', () => {
  const horizonBuildings = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(({ id }) => (
    id === 'north-stark-drive-warehouse' || id === 'far-north-industrial-complex'
  ))
  assert.deepEqual(
    horizonBuildings.map(({ sourceWayId }) => sourceWayId),
    ['1170948387', '1170948415'],
  )
  for (const building of horizonBuildings) {
    assert.equal(building.detail, 'silhouette')
    assert.equal(building.hasInterior, false)
    const nearestVertexDistance = Math.min(...building.footprint.map(([x, z]) => Math.hypot(x, z)))
    assert.ok(nearestVertexDistance >= 110 && nearestVertexDistance < 145, building.id)
  }
  assert.equal(horizonBuildings[0].feature, 'wall-rhythm')
  assert.equal(horizonBuildings[1].feature, 'ribbon-office')
})

test('124 Hayton Road uses the photo-backed office frontage without inventing an interior', () => {
  const skellerup = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ sourceWayId }) => sourceWayId === '897328722',
  )
  assert.ok(skellerup)
  assert.equal(skellerup.id, 'east-logistics-warehouse')
  assert.equal(skellerup.detail, 'near')
  assert.equal(skellerup.feature, 'office-glazing')
  assert.equal(skellerup.address, '124 Hayton Road')
  assert.equal(skellerup.featureEvidence, 'project-photo')
  assert.deepEqual(skellerup.featureEdge, [1, 2])
  assert.equal(skellerup.hasInterior, false)

  const frame = virtualChurchSurroundingFacadeFrame(skellerup)
  assert.ok(frame)
  assert.ok(frame.length >= 35 && frame.length <= 40)
  const exterior = virtualChurchFacadePointAt(frame, 0.5, 0.25)
  assert.equal(
    virtualChurchPointInsidePolygon(skellerup.footprint, exterior[0], exterior[1]),
    false,
  )
})

test('117 The Runway keeps its photographed south office readable inside the fog transition', () => {
  const runway = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ sourceWayId }) => sourceWayId === '1170948415',
  )
  assert.ok(runway)
  assert.equal(runway.address, '117 The Runway')
  assert.equal(runway.detail, 'silhouette')
  assert.equal(runway.feature, 'ribbon-office')
  assert.deepEqual(runway.featureEdge, [14, 15])
  assert.equal(runway.featureBayCount, 6)
  assert.equal(runway.featureEvidence, 'property-listing-photo')
  assert.match(runway.featureReference!, /117-the-runway-wigram/)
  assert.equal(runway.hasInterior, false)

  const frame = virtualChurchSurroundingFacadeFrame(runway)
  assert.ok(frame)
  assert.ok(frame.length >= 19 && frame.length <= 21)
  assert.ok(frame.outward[1] < -0.7)
  const midpointDistance = Math.hypot(
    (frame.start[0] + frame.end[0]) / 2,
    (frame.start[1] + frame.end[1]) / 2,
  )
  assert.ok(midpointDistance >= 110 && midpointDistance < 145)
  const exterior = virtualChurchFacadePointAt(frame, 0.5, 0.25)
  assert.equal(
    virtualChurchPointInsidePolygon(runway.footprint, exterior[0], exterior[1]),
    false,
  )
})

test('the mapped north-east road extension reaches 117 The Runway without repainting its footprint', () => {
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE.roadWayId, '243729471')
  assert.deepEqual(
    VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE.footwayWayIds,
    ['1294946704', '1294946668'],
  )
  assert.equal(VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE.footpathWidthMetres, 1.8)
  assert.equal(VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS.length, 2)
  assert.ok(VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION.some(([, z]) => z < 70))
  assert.ok(VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION.some(([, z]) => z > 150))

  const runway = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ sourceWayId }) => sourceWayId === '1170948415',
  )
  assert.ok(runway)
  assert.equal(
    polygonsOverlap(VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, runway.footprint),
    false,
  )
  for (const surface of [
    VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION,
    ...VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS,
  ]) {
    for (const footprint of [
      VIRTUAL_CHURCH_BUILDING_FOOTPRINT,
      VIRTUAL_CHURCH_AUXILIARY_BUILDING,
      ...VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.map((building) => building.footprint),
    ]) assert.equal(polygonsOverlap(surface, footprint), false, 'road and footpaths must clear every building')
  }
})

test('the surroundings guide stands on the mapped approach and faces the 117 office', () => {
  const [x, feetY, z] = SCENE_LANDMARKS.surroundingsPreview
  assert.ok(x >= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[0] && x <= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[1])
  assert.ok(z >= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[0] && z <= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[1])
  assert.equal(virtualChurchPositionIsBlocked(x, z, feetY), false)
  assert.equal(
    VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS.some((footpath) => (
      virtualChurchPointInsidePolygon(footpath, x, z)
    )),
    true,
  )
  const runway = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ sourceWayId }) => sourceWayId === '1170948415',
  )
  assert.ok(runway)
  const frame = virtualChurchSurroundingFacadeFrame(runway)
  assert.ok(frame)
  const target: Point = [
    (frame.start[0] + frame.end[0]) / 2,
    (frame.start[1] + frame.end[1]) / 2,
  ]
  const targetLength = Math.hypot(target[0] - x, target[1] - z)
  const targetDirection: Point = [
    (target[0] - x) / targetLength,
    (target[1] - z) / targetLength,
  ]
  const forward: Point = [
    -Math.sin(SCENE_LANDMARKS.surroundingsPreviewYaw),
    -Math.cos(SCENE_LANDMARKS.surroundingsPreviewYaw),
  ]
  assert.ok(forward[0] * targetDirection[0] + forward[1] * targetDirection[1] > 0.995)
})

test('aerial service court fills the warehouse gap without declaring surveyed parking or public access', async () => {
  const court = VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT
  assert.equal(court.horizontalConfidence, 'aerial-estimate')
  assert.equal(court.surfaceConfidence, 'light-paving-only')
  assert.equal(court.aerialYear, 2025)
  assert.match(court.source, /^https:\/\/gis\.ccc\.govt\.nz\/imagery\//)
  assert.deepEqual(court.boundingBuildingWayIds, ['420431718', '1170948415', '1170948387'])
  // Representative open areas, including both sides of the old 4 m access
  // strip: a narrow driveway alone must not count as the finished yard.
  for (const point of [[35, 120], [25, 123], [17, 139], [5, 154]] as Point[]) {
    assert.ok(virtualChurchPointInsidePolygon(court.points, ...point), `missing pavement at ${point}`)
  }
  const access = VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS.find(a => a.sourceWayIds.includes('1547753372'))!
  assert.ok(virtualChurchPointInsidePolygon(court.points, ...access.centreline[2]))
  for (const tree of VIRTUAL_CHURCH_SURROUNDING_TREES) {
    assert.equal(virtualChurchPointInsidePolygon(court.points, ...tree.point), false, 'retain mapped planting')
  }
  for (let i = 0; i < court.points.length; i++) {
    for (let j = i + 2; j < court.points.length; j++) {
      assert.equal(segmentsProperlyIntersect(court.points[i], court.points[(i + 1) % court.points.length],
        court.points[j], court.points[(j + 1) % court.points.length]), false, 'court outline is simple')
    }
  }
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const V3_SHARED_CONCRETE_GROUND_POLYGONS = \[[\s\S]*?VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT\.points,\s*CARPARK_SPINE_WALKWAY,\s*\] as const/)
  assert.match(source, /visualVersion === 'v3' \? \(\s*<GroundPolygonSet\s*polygons=\{V3_SHARED_CONCRETE_GROUND_POLYGONS\}/)
})

test('117 photo correction keeps pale frontage, narrow upper ribbon and a small entry canopy in both LODs', async () => {
  const runway = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(b => b.address === '117 The Runway')!
  const panels = virtualChurchOfficeRibbonPanels(runway)
  const band = panels.filter(p => p.kind === 'band'), canopies = panels.filter(p => p.kind === 'canopy')
  assert.equal(band.length, 1)
  assert.equal(band[0].height, 1.3)
  assert.ok(band[0].y - band[0].height / 2 > 4, 'do not paint the ground floor dark')
  assert.equal(canopies.length, 1)
  assert.ok(canopies[0].height <= .15 && canopies[0].width <= 1.7 && canopies[0].depth <= .9)
  assert.equal(canopies[0].t, .12, 'small awning at the yard end, not a tall orange portal')
  assert.equal(panels.filter(p => p.kind === 'glass' && p.height > 2).length, 1)
  assert.equal(runway.tone, 'pale')
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(b => b !== runway)) assert.deepEqual(virtualChurchOfficeRibbonPanels(building), [])
  const frame = virtualChurchSurroundingFacadeFrame(runway)!
  const geometry = createVirtualChurchMobileSurroundings([runway])
  const positions = geometry.walls.getAttribute('position'), colors = geometry.walls.getAttribute('color')
  const orange = new Color(ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext.entryOrange)
  for (const item of panels) {
    const [x, z] = virtualChurchFacadePointAt(frame, item.t, item.outset + item.depth / 2)
    const left = [x - frame.tangent[0] * item.width / 2, item.y - item.height / 2, z - frame.tangent[1] * item.width / 2]
    assert.ok(Array.from({ length: positions.count }, (_, i) => i).some(i =>
      Math.hypot(positions.getX(i) - left[0], positions.getY(i) - left[1], positions.getZ(i) - left[2]) < .0001), 'mobile panel matches the shared desktop front face')
    assert.ok(item.t - item.width / frame.length / 2 >= 0 && item.t + item.width / frame.length / 2 <= 1)
  }
  for (let i = 0; i < positions.count; i++) {
    if (Math.abs(colors.getX(i) - orange.r) + Math.abs(colors.getY(i) - orange.g) + Math.abs(colors.getZ(i) - orange.b) < .00001) {
      assert.ok(positions.getY(i) >= 2.35 && positions.getY(i) <= 2.51, 'orange confined to the awning edge')
    }
  }
  const source = await readFile(new URL('../src/views/VirtualChurchSurroundingFacades.tsx', import.meta.url), 'utf8')
  assert.match(source, /for \(const panel of virtualChurchOfficeRibbonPanels\(building\)\)/)
  assert.doesNotMatch(source, /darkOfficeBackdrops/)
  assert.match(source, /claddingRibCount = building.feature === 'ribbon-office' \? 0/)
  geometry.walls.dispose(); geometry.roofs.dispose()
})

test('surrounding footprints do not overwrite the approved church or detached auxiliary building', () => {
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    assert.equal(
      polygonsOverlap(building.footprint, VIRTUAL_CHURCH_BUILDING_FOOTPRINT),
      false,
      `${building.id} overlaps the church`,
    )
    assert.equal(
      polygonsOverlap(building.footprint, VIRTUAL_CHURCH_AUXILIARY_BUILDING),
      false,
      `${building.id} overlaps the auxiliary building`,
    )
  }
})

test('context buildings entering player bounds remain solid exterior shells', () => {
  const enteringPlayerBounds = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(({ footprint }) => (
    footprint.some(([x, z]) => (
      x >= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[0]
      && x <= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[1]
      && z >= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[0]
      && z <= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[1]
    ))
  ))
  assert.deepEqual(enteringPlayerBounds.map(({ id }) => id), [
    'east-logistics-warehouse',
    'north-west-industrial-complex',
  ])
  assert.equal(virtualChurchPositionIsBlocked(25, -30, 0), true)
  assert.equal(virtualChurchPositionIsBlocked(-63, 42, 0), true)
})

test('mobile keeps surrounding massing while deferring non-critical facade detail', () => {
  assert.equal(virtualChurchShouldRenderSurroundingFacadeDetails(false, false), false)
  assert.equal(virtualChurchShouldRenderSurroundingFacadeDetails(false, true), false)
  assert.equal(virtualChurchShouldRenderSurroundingFacadeDetails(true, true), false)
  assert.equal(virtualChurchShouldRenderSurroundingFacadeDetails(true, false), true)
})

test('Low batches preserve structural walls, total mapped roof area, exterior normals and facade colours', () => {
  const palette = ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext
  const glass = new Color(palette.glass), orange = new Color(palette.entryOrange)
  let wallVertices = 0, roofVertices = 0
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    const { walls, roofs } = createVirtualChurchMobileSurroundings([building])
    const p = walls.getAttribute('position'), n = walls.getAttribute('normal'), c = walls.getAttribute('color')
    const structure = virtualChurchSurroundingStructure(building)
    const frames = virtualChurchSurroundingPerimeterFrames({ ...building, footprint: structure.wallFootprint })
    // Each perimeter edge has its full wall, then a narrow eave and plinth.
    frames.forEach((frame, edge) => {
      for (let v = edge * 18; v < (edge + 1) * 18; v++) {
        assert.ok(n.getX(v) * frame.outward[0] + n.getZ(v) * frame.outward[1] > .9999)
        assert.ok(Math.abs(n.getY(v)) < .00001)
      }
      const ys = Array.from({ length: 6 }, (_, v) => p.getY(edge * 18 + v))
      assert.ok(Math.abs(Math.min(...ys)) < .00001)
      assert.ok(Math.abs(Math.max(...ys) - building.height) < .00001)
    })
    const rp = roofs.getAttribute('position'), rn = roofs.getAttribute('normal')
    let roofArea = 0
    for (let i = 0; i < rp.count; i += 3) {
      const a: Point = [rp.getX(i), rp.getZ(i)], b: Point = [rp.getX(i + 1), rp.getZ(i + 1)], d: Point = [rp.getX(i + 2), rp.getZ(i + 2)]
      roofArea += Math.abs(orientation(a, b, d)) / 2
      assert.ok(virtualChurchPointInsidePolygon(building.footprint, (a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3))
    }
    const expectedArea = Math.abs(building.footprint.reduce((area, point, i) => {
      const next = building.footprint[(i + 1) % building.footprint.length]
      return area + point[0] * next[1] - next[0] * point[1]
    }, 0)) / 2
    assert.ok(Math.abs(roofArea - expectedArea) < .01, building.id)
    for (let i = 0; i < rp.count; i++) {
      const onRidge = structure.gable && [structure.gable.frontRidge, structure.gable.rearRidge].some(p =>
        Math.hypot(p[0] - rp.getX(i), p[1] - rp.getZ(i)) < .0001)
      const expectedHeight = structure.canopy && Math.abs(rp.getY(i) - structure.canopy.height) < .00001
        ? structure.canopy.height : building.height + .035 + (onRidge ? structure.gable!.rise : 0)
      assert.ok(Math.abs(rp.getY(i) - expectedHeight) < .00001)
      assert.ok(rn.getY(i) > (structure.gable ? .99 : .9999), 'roof must face upward under the mirrored scene root')
    }
    const hasColor = (color: Color) => Array.from({ length: c.count }, (_, i) => i).some(i =>
      Math.abs(c.getX(i) - color.r) + Math.abs(c.getY(i) - color.g) + Math.abs(c.getZ(i) - color.b) < .00001)
    assert.equal(hasColor(orange), building.feature === 'ribbon-office')
    assert.equal(hasColor(glass), ['office-glazing', 'ribbon-office', 'window-band'].includes(building.feature))
    assert.equal(walls.groups.length, 0, 'vertex colours must not create a draw per window')
    wallVertices += p.count; roofVertices += rp.count
    walls.dispose(); roofs.dispose()
  }
  const combined = createVirtualChurchMobileSurroundings(VIRTUAL_CHURCH_SURROUNDING_BUILDINGS)
  assert.equal(combined.walls.getAttribute('position').count, wallVertices)
  assert.equal(combined.roofs.getAttribute('position').count, roofVertices)
  assert.ok((wallVertices + roofVertices) / 3 < 1000)
  combined.walls.dispose(); combined.roofs.dispose()
})

test('117 mapped canopy projection is open below, lower than the warehouse, and uses north-side doors', () => {
  const building = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(b => b.address === '117 The Runway')!
  const original = JSON.stringify(building)
  const { wallFootprint, canopy } = virtualChurchSurroundingStructure(building)
  assert.ok(canopy)
  assert.deepEqual(wallFootprint, building.footprint.filter((_, index) => ![11, 12].includes(index)))
  assert.deepEqual(canopy.footprint, [13, 12, 11, 10].map(index => building.footprint[index]))
  assert.ok(canopy.height > 5 && canopy.height < building.height - 1)
  assert.equal(canopy.doors.length, 3)
  assert.ok(canopy.wallFrame.outward[1] > .5, 'doors face the mapped north-east loading side, not the street office')
  const front = virtualChurchSurroundingFacadeFrame(building)!
  assert.ok(Math.abs(front.outward[0] * canopy.wallFrame.outward[0] + front.outward[1] * canopy.wallFrame.outward[1]) < .04)
  for (const door of canopy.doors) {
    assert.ok(door.t - door.width / canopy.wallFrame.length / 2 > 0)
    assert.ok(door.t + door.width / canopy.wallFrame.length / 2 < 1)
    assert.ok(door.height < canopy.height - canopy.thickness)
  }
  const geometry = createVirtualChurchMobileSurroundings([building])
  const material = new MeshBasicMaterial(), walls = new Mesh(geometry.walls, material), roof = new Mesh(geometry.roofs, material)
  walls.updateMatrixWorld(); roof.updateMatrixWorld()
  const p = virtualChurchFacadePointAt(canopy.wallFrame, .5, 2.2)
  const ray = new Raycaster(new Vector3(p[0], 12, p[1]), new Vector3(0, -1, 0))
  assert.ok(Math.abs(ray.intersectObject(roof)[0].point.y - canopy.height) < .00001)
  ray.set(new Vector3(p[0], 1, p[1]), new Vector3(0, 1, 0))
  assert.ok(Math.abs(ray.intersectObject(walls)[0].point.y - canopy.height + canopy.thickness) < .00001, 'canopy has a downward-facing underside')
  for (const t of [.2, .5, .8]) {
    const outside = virtualChurchFacadePointAt(canopy.wallFrame, t, 6)
    ray.set(new Vector3(outside[0], 2, outside[1]), new Vector3(-canopy.wallFrame.outward[0], 0, -canopy.wallFrame.outward[1]))
    const hit = ray.intersectObject(walls)[0]
    assert.ok(hit.distance > 5.8 && hit.distance < 6.1, 'no wall or post at the outer canopy edge; closed door remains on the inner wall')
  }
  assert.equal(JSON.stringify(building), original, 'visual correction must not mutate collision/site metadata')
  for (const other of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(b => b !== building)) {
    const structure = virtualChurchSurroundingStructure(other)
    assert.equal(structure.canopy, null); assert.equal(structure.wallFootprint, other.footprint)
  }
  geometry.walls.dispose(); geometry.roofs.dispose(); material.dispose()
})

test('desktop uses the same open canopy shell and keeps roof strips off its former high roof', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const facade = await readFile(new URL('../src/views/VirtualChurchSurroundingFacades.tsx', import.meta.url), 'utf8')
  assert.match(source, /createVirtualChurchMobileSurroundings\(\[building\], false\)/)
  assert.match(facade, /footprint: virtualChurchSurroundingStructure\(building\).flatRoofFootprint/)
  assert.match(facade, /return !isFront && !isLoading/)
  assert.match(facade, /batches.entryAccents.push\(framedBox\(canopy.wallFrame/)
  assert.match(facade, /batches.rollerSlats.push\(framedBox\(canopy.wallFrame/)
  const building = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(b => b.address === '117 The Runway')!
  const { flatRoofFootprint, canopy } = virtualChurchSurroundingStructure(building)
  assert.ok(canopy)
  for (const { start, end } of virtualChurchSurroundingRoofBandSegments({ ...building, footprint: flatRoofFootprint })) {
    for (const t of [.1, .5, .9]) {
      const p: Point = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]
      assert.equal(virtualChurchPointInsidePolygon(canopy.footprint, ...p), false)
    }
  }
})

test('117 front has a closed shallow gable, no duplicate flat roof, and slope-attached colour strips in both LODs', () => {
  const building = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(b => b.address === '117 The Runway')!
  const original = JSON.stringify(building)
  const { gable, flatRoofFootprint } = virtualChurchSurroundingStructure(building)
  assert.ok(gable)
  assert.ok(gable.rise > .5 && gable.rise < 1.2, 'restrained estimated industrial roof pitch')
  const low = createVirtualChurchMobileSurroundings([building])
  const desktop = createVirtualChurchMobileSurroundings([building], false)
  assert.deepEqual(desktop.roofs.getAttribute('position').array, low.roofs.getAttribute('position').array)
  const material = new MeshBasicMaterial(), roof = new Mesh(low.roofs, material), wall = new Mesh(low.walls, material)
  roof.updateMatrixWorld(); wall.updateMatrixWorld()
  const ray = new Raycaster()
  const sample = (x: number, z: number) => {
    ray.set(new Vector3(x, 15, z), new Vector3(0, -1, 0))
    return ray.intersectObject(roof)
  }
  const front = virtualChurchSurroundingFacadeFrame(building)!
  for (const t of [.17, .43, .79]) {
    const ridge: Point = [gable.frontRidge[0] + (gable.rearRidge[0] - gable.frontRidge[0]) * t,
      gable.frontRidge[1] + (gable.rearRidge[1] - gable.frontRidge[1]) * t]
    for (const cross of [-.32, .19, .37]) {
      const x = ridge[0] + front.tangent[0] * front.length * cross
      const z = ridge[1] + front.tangent[1] * front.length * cross
      assert.equal(virtualChurchPointInsidePolygon(flatRoofFootprint, x, z), false)
      const hits = sample(x, z)
      assert.equal(hits.length, 1, 'front roof must not keep a second flat surface underneath')
      assert.ok(hits[0].point.y > building.height + .1 && hits[0].point.y < building.height + gable.rise)
    }
  }
  // Both triangular end caps must be visible from their own exterior side.
  for (const [endIndex, ridge] of [gable.frontRidge, gable.rearRidge].entries()) {
    const direction = endIndex === 0 ? 1 : -1
    ray.set(new Vector3(ridge[0] + direction * front.outward[0], building.height + .4, ridge[1] + direction * front.outward[1]),
      new Vector3(-direction * front.outward[0], 0, -direction * front.outward[1]))
    assert.ok(ray.intersectObject(wall).some(hit => Math.abs(hit.distance - 1) < .04), 'gable end is closed with outward winding')
  }
  const p = low.walls.getAttribute('position'), c = low.walls.getAttribute('color'), n = low.walls.getAttribute('normal')
  const band = new Color(ALIFE_V3_ENVIRONMENT_TREATMENT.industrialContext.roofBandLight)
  let strips = 0
  for (let i = 0; i < p.count; i += 3) {
    if (Math.abs(c.getX(i) - band.r) + Math.abs(c.getY(i) - band.g) + Math.abs(c.getZ(i) - band.b) > .00001) continue
    const centre = new Vector3()
    for (let v = i; v < i + 3; v++) centre.add(new Vector3().fromBufferAttribute(p, v))
    centre.multiplyScalar(1 / 3)
    const hits = sample(centre.x, centre.z)
    assert.ok(hits.length > 0)
    assert.ok(Math.abs(centre.y - hits[0].point.y - .014) < .00002, 'colour strip follows its underlying roof slope')
    assert.ok(n.getY(i) > .99)
    strips++
  }
  assert.ok(strips >= 14 && strips < 100)
  assert.equal(JSON.stringify(building), original)
  for (const geometry of [low, desktop]) { geometry.walls.dispose(); geometry.roofs.dispose() }
  material.dispose()
})

test('deferred facade details project outside the authoritative collision footprint', () => {
  const detailedBuildings = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.filter(
    ({ detail }) => detail !== 'silhouette',
  )
  assert.ok(detailedBuildings.length > 0)
  for (const building of detailedBuildings) {
    const frame = virtualChurchSurroundingFacadeFrame(building)
    assert.ok(frame, building.id)
    assert.ok(frame.length > 1, building.id)
    const exterior = virtualChurchFacadePointAt(frame, 0.5, 0.24)
    const interior = virtualChurchFacadePointAt(frame, 0.5, -0.24)
    assert.equal(
      virtualChurchPointInsidePolygon(building.footprint, exterior[0], exterior[1]),
      false,
      `${building.id} exterior normal`,
    )
    assert.equal(
      virtualChurchPointInsidePolygon(building.footprint, interior[0], interior[1]),
      true,
      `${building.id} interior normal`,
    )
  }
})

test('secondary and silhouette cladding can follow every authoritative exterior edge', () => {
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    const frames = virtualChurchSurroundingPerimeterFrames(building)
    assert.equal(frames.length, building.footprint.length, building.id)
    for (const frame of frames) {
      assert.ok(frame.length > 0, building.id)
      const exterior = virtualChurchFacadePointAt(frame, 0.5, 0.105)
      assert.equal(
        virtualChurchPointInsidePolygon(building.footprint, exterior[0], exterior[1]),
        false,
        `${building.id} perimeter exterior normal`,
      )
    }
  }
})

test('aerial-informed roof tone bands remain clipped inside each OSM footprint', () => {
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    const segments = virtualChurchSurroundingRoofBandSegments(building)
    assert.ok(segments.length >= 1, building.id)
    assert.ok(segments.length <= 16, building.id)
    for (const { start, end } of segments) {
      for (const t of [0, 0.5, 1]) {
        const point: Point = [
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t,
        ]
        assert.equal(
          virtualChurchPointInsidePolygon(building.footprint, point[0], point[1]),
          true,
          `${building.id} roof band`,
        )
      }
    }
  }
})

test('loading pads do not repaint the approved east-side parking relationship', () => {
  const eastNeighbour = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ id }) => id === 'east-logistics-warehouse',
  )
  const northWarehouse = VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.find(
    ({ id }) => id === 'north-road-warehouse-west',
  )
  assert.ok(eastNeighbour)
  assert.ok(northWarehouse)
  assert.equal(virtualChurchSurroundingFacadeUsesLoadingPad(eastNeighbour), false)
  assert.equal(virtualChurchSurroundingFacadeUsesLoadingPad(northWarehouse), true)
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    if (building.feature !== 'roller-doors') {
      assert.equal(virtualChurchSurroundingFacadeUsesLoadingPad(building), false)
    }
  }
})

test('neighbour hardstand grounds every exterior except the approved east parking edge', () => {
  for (const building of VIRTUAL_CHURCH_SURROUNDING_BUILDINGS) {
    const strips = virtualChurchSurroundingHardstandStrips(building)
    const expectedCount = building.id === 'east-logistics-warehouse'
      ? building.footprint.length - 1
      : building.footprint.length
    assert.equal(strips.length, expectedCount, building.id)
    for (const { frame, width, edgeIndex } of strips) {
      assert.ok(width >= 0.85 && width <= 1.35, building.id)
      const outer = virtualChurchFacadePointAt(frame, 0.5, width * 0.75)
      assert.equal(
        virtualChurchPointInsidePolygon(building.footprint, outer[0], outer[1]),
        false,
        `${building.id} hardstand edge ${edgeIndex}`,
      )
      if (building.id === 'east-logistics-warehouse') {
        assert.notEqual(edgeIndex, building.featureEdge?.[0])
      }
    }
  }
})
