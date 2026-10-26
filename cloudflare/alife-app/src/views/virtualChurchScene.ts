/**
 * Virtual church scene measurements.
 *
 * Coordinate contract:
 * - one Three.js world unit equals one metre;
 * - source X points east and source Z points north;
 * - the render root mirrors source Z once so Three.js +Z points south;
 * - Y is elevation above the local ground plane;
 * - geometry marked `reference` comes from public property/OSM data;
 * - geometry marked `provisional` must be recalibrated from a site plan or photos.
 */

export type SceneConfidence = 'reference' | 'provisional'

// Shared source-space paving footprints. Rendering and player support must use
// the same polygons: the provisional terrain can dip beneath these flat slabs.
export const THE_RUNWAY: Array<[number, number]> = [[-76, 8], [-13, 59], [36, 91], [42, 82], [-6.37, 49.22], [-69.37, -1.78]]
export const V3_THE_RUNWAY_APPROACH: Array<[number, number]> = [
  [-76, 8], [-13, 59], [13.65, 77.83], [24.62, 69.24], [-6.37, 49.22], [-69.37, -1.78],
]
export const STARK_DRIVE_NORTH: Array<[number, number]> = [[-14, 58], [-69, 109], [-62, 116], [-6, 62]]
export const STARK_DRIVE_SERVICE: Array<[number, number]> = [[-13, 51], [29, -4], [37, 2], [-5, 58]]
export const ENTRANCE_DRIVEWAY: Array<[number, number]> = [[-52, 20.7], [-46.8, 24.9], [-33.3, 8.5], [-38.5, 4.3]]
export const MAIN_CARPARK: Array<[number, number]> = [[-31, 10], [-40, 7], [-48, -3], [-50, -25], [-39, -42], [-24, -52], [4, -49], [19, -26], [4, -22], [-7, -14], [-16, -3], [-24, 10]]

export type ParkingRowSpec = {
  id: string
  start: [number, number]
  bays: number
  bayWidth: number
  bayDepth: number
  angle: number
  confidence: SceneConfidence
  layoutAuthority?: 'user-confirmed-overhead-view'
}

export type AccessibleParkingPairSpec = {
  id: string
  start: [number, number]
  bayWidth: number
  aisleWidth: number
  bayDepth: number
  angle: number
  confidence: SceneConfidence
}

export const SCENE_SCALE = {
  metresPerUnit: 1,
  adultHeight: 1.72,
  eyeHeight: 1.58,
  carLength: 4.55,
  carWidth: 1.82,
  carHeight: 1.48,
  standardBayWidth: 2.5,
  standardBayDepth: 5,
  driveAisleWidth: 6.2,
  kerbHeight: 0.15,
} as const

export const CHURCH_DIMENSIONS = {
  roofPeakHeight: 10.2,
  roofLowHeight: 6.5,
  foyerHeight: 6.3,
  // The supplied parking-elevation photo puts the 3.8 m cedar portal at about
  // three-fifths of the double-height foyer rather than below an oversized tower.
  timberEntranceHeight: 3.8,
  entranceDoorHeight: 2.35,
  // The photographed entrance is a four-leaf commercial door bank. A 0.95 m
  // leaf keeps the complete bank at a realistic 3.8 m rather than scaling it
  // to the width of the surrounding recessed portal.
  entranceDoorWidth: 0.95,
  entranceCanopyDepth: 3.5,
  confidence: 'provisional' as SceneConfidence,
} as const

export const SCENE_LANDMARKS = {
  // OSM service way 888737618 joins The Runway at approximately
  // [-49.4, 22.8], then runs through the gate toward [-35.9, 6.4].
  // Spawn on the clear entrance drive, about five metres inside the vehicle
  // gate. The former point was technically inside the property, but the
  // third-person camera boom still crossed the fence and filled the opening
  // frame with black bars. Moving only the spawn along the verified driveway
  // keeps the church, gate and parking geometry unchanged while placing both
  // the avatar and camera on the car-park side of the fence.
  playerStart: [-30.6, 0, 0.3] as [number, number, number],
  // Look down the verified OSM driveway toward the main car park.
  playerStartYaw: -0.69,
  // OSM marks the barrier gate inside the property at [-35.9, 6.4]. The 2025
  // CCC orthophoto shows the drainage crossing farther toward The Runway,
  // close to the intermediate driveway vertex at [-43.9, 16.2]. Keeping the
  // two landmarks separate avoids placing the roadside swale at the gate.
  roadGate: [-35.9, 0, 6.4] as [number, number, number],
  culvert: [-43.9, 0, 16.2] as [number, number, number],
  // The public doors sit in the recessed cedar portal at the south-west end
  // of the long parking elevation (OSM footprint edge 4 -> 5). The marker is
  // on the exterior apron so it can later lead into a walkable interior.
  entrance: [-10.21, 0, -13.28] as [number, number, number],
  // Keep the guide arrival on the clear concrete apron. The real entrance has
  // no physical planter, flowerbed, welcome board, or freestanding sign.
  // Aligned to the actual 3.8 m door bank, not the white pier to its right.
  entranceApproachPoint: [-10.30, 0, -13.40] as [number, number, number],
  entranceApproachYaw: -2.26,
  // A near-perpendicular view across the main car park keeps the complete
  // silver, cedar, louvre and foyer elevation in one frame for comparison.
  parkingPreview: [-33, 0, -26] as [number, number, number],
  parkingPreviewYaw: -2.2,
  // Match the public-road Street View position so the driveway crossing,
  // swale and gate can be compared directly against the March 2025 image.
  streetFrontPreview: [-49.4, 0, 22.8] as [number, number, number],
  streetFrontPreviewYaw: -0.69,
  // Stand on the mapped eastern footpath near the north edge of the playable
  // site and look along the real road curve toward 117 The Runway. This uses
  // the road as a leading line instead of presenting the photo-backed office
  // facade across an unexplained field of grass.
  surroundingsPreview: [33.5, 0, 75.2] as [number, number, number],
  surroundingsPreviewYaw: -2.67,
} as const

// Align the provisional channel to the existing aerial-constrained crossing
// and carriageway edge. The former [-63, 8.5] -> [-30.5, 32] line missed the
// culvert by 4.95 m and ran underneath the asphalt. Preserve its longitudinal
// extent by projecting those endpoints; this is not new survey information.
const swaleRoadLength = Math.hypot(63, 51)
const swaleDirection = [63 / swaleRoadLength, 51 / swaleRoadLength] as const
const swalePoint = (x: number, z: number): [number, number] => {
  const [cx, , cz] = SCENE_LANDMARKS.culvert
  const along = (x - cx) * swaleDirection[0] + (z - cz) * swaleDirection[1]
  return [cx + along * swaleDirection[0], cz + along * swaleDirection[1]]
}
export const VIRTUAL_CHURCH_SWALE = {
  start: swalePoint(-63, 8.5),
  end: swalePoint(-30.5, 32),
  crossing: [SCENE_LANDMARKS.culvert[0], SCENE_LANDMARKS.culvert[2]] as [number, number],
} as const

// Provisional planting rhythm on the property-side bank, not a surveyed
// planting inventory. Keep the existing ten grass clumps and two flax plants,
// with a generous clear gap around both pipe mouths and the driveway.
const swalePlantPoint = (t: number, offset: number): [number, number] => {
  const { start, end } = VIRTUAL_CHURCH_SWALE
  return [start[0] + (end[0] - start[0]) * t - swaleDirection[1] * offset,
    start[1] + (end[1] - start[1]) * t + swaleDirection[0] * offset]
}
export const VIRTUAL_CHURCH_SWALE_PLANTS = {
  grass: [.07, .13, .21, .28, .34, .65, .72, .79, .86, .93].map((t, i) => swalePlantPoint(t, -1.5 - (i % 3) * .15)),
  flax: [.18, .82].map(t => swalePlantPoint(t, -1.75)),
} as const

// OSM way 243729471 continues The Runway north-east beyond the Stark Drive
// junction. The original scene road stopped at that junction, leaving the
// documented 117 The Runway office standing beyond a false grass field. The
// polygon below follows the two mapped pedestrian edges (ways 1294946704 and
// 1294946668), overlapping the existing road only at the junction so the
// approved church entrance geometry remains untouched.
export const VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION: Array<[number, number]> = [
  [13.65, 77.83], [45.27, 103.43], [76.97, 129.09], [87.31, 137.46],
  [109.23, 155.2], [119.89, 146.12], [98.73, 129.07], [24.62, 69.24],
]

// The shared paths are 1.8 m visual strips centred on their OSM footway
// centre-lines. They are intentionally texture-only surfaces: no kerb height
// is invented without a survey or closer street photograph.
export const VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_FOOTPATHS: Array<Array<[number, number]>> = [
  [
    [-6.5, 68.07], [-3.01, 68.43], [-0.52, 69.34], [2.65, 71.26],
    [12.51, 79.23], [44.13, 104.83], [75.83, 130.49], [86.17, 138.86],
    [108.09, 156.6], [109.23, 155.2], [87.31, 137.46], [76.97, 129.09],
    [45.27, 103.43], [13.65, 77.83], [3.69, 69.78], [0.26, 67.7],
    [-2.61, 66.67], [-6.32, 66.27],
  ],
  [
    [14.95, 61.41], [98.73, 129.07], [119.89, 146.12],
    [121.01, 144.72], [99.87, 127.67], [16.09, 60.01],
  ],
]

export const VIRTUAL_CHURCH_SURROUNDING_ROAD_SOURCE = {
  roadWayId: '243729471',
  footwayWayIds: ['1294946704', '1294946668'],
  referenceDate: '2026-09-14',
  horizontalAuthority: 'OpenStreetMap centre-lines transformed into the church local-metre frame',
  footpathWidthMetres: 1.8,
  verticalConfidence: 'surface-only',
} as const

/** OSM surface-parking outlines checked against the council's 2025 aerial.
 * Same datum as the approved building vectors: lon 172.56261068823528,
 * lat -43.549999882352935, local X = longitude delta * 80800 and Z = latitude
 * delta * 111000. These are neighbouring paved surfaces, not new church bays.
 * Neutral pavement only: the data does not establish individual bay markings,
 * exact surfacing material, kerb heights or a right of public access.
 */
export const VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS: Array<{
  sourceWayId: string
  points: Array<[number, number]>
}> = [
  { sourceWayId: '1547522212', points: [
    [-34.61, 45.96], [-37.17, 44.04], [-40.09, 41.85], [-41.89, 40.5],
    [-43.02, 41.69], [-44.39, 42.26], [-46.16, 42.24], [-49.93, 39.47],
    [-51.4, 33.96], [-52.99, 32.15], [-70.2, 19.93], [-74.32, 25.66],
    [-75.05, 26.67], [-59.69, 37.62], [-40.31, 53], [-37.9, 50.03],
  ] },
  { sourceWayId: '1547753361', points: [
    [32.51, 10.17], [35.9, 5.83], [34.18, 4.48], [36.14, 2],
    [44.97, -9.14], [39.83, -13.3], [36.41, -16.07], [42.78, -24.12],
    [104.78, 25.93], [112.05, 16.89], [126.63, 28.8], [102, 59.24],
    [98.47, 56.4], [95.48, 60.14], [45.62, 20.62],
  ] },
  { sourceWayId: '1547753368', points: [
    [6.27, 78.45], [10.34, 81.74], [15.25, 85.7], [7.86, 95.04],
    [-3.46, 85.69], [-10.82, 79.98], [-16.19, 75.81], [-13.03, 73.4],
    [-10.6, 72.29], [-8.18, 71.86], [-5.43, 71.7], [-3.01, 72],
    [-0.18, 73.19], [1.46, 74.52],
  ] },
  // OSM's independently traced parking outline penetrates the existing 117
  // footprint by 0.02 / 0.56 m at two vertices. Fit those vertices just outside
  // the building (max adjustment 0.65 m) and follow its intervening corner;
  // never alter the approved building.
  { sourceWayId: '1547753373', points: [
    [64.31, 128.87], [68.26, 132.07], [71.95, 135.05], [74.68, 137.27],
    [70.6, 142.46], [73.63, 144.93], [48.51, 175.82], [38.57, 167.92],
    [63.69, 136.74], [63.54, 135.77], [60.65, 133.4],
  ] },
  { sourceWayId: '1547753378', points: [
    [102.33, 118.66], [88.91, 107.77], [86.11, 105.49], [76.3, 97.53],
    [83.19, 88.91], [102.5, 104.43], [118.52, 84.94], [127.38, 92.16],
    [114.42, 108.35], [118.71, 111.8], [116.69, 114.29], [114.75, 116.7],
    [108.93, 123.95], [105.19, 120.95],
  ] },
]

// Mapped centre-lines connect the service court and forecourts to The Runway,
// rather than leaving paved islands surrounded by grass. Widths are estimated.
export const VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS: Array<{
  sourceWayIds: string[]
  centreline: Array<[number, number]>
  width: number
  widthConfidence: 'aerial-estimate'
}> = [
  { sourceWayIds: ['1547753372'], width: 4, widthConfidence: 'aerial-estimate',
    centreline: [[49.51, 98.02], [44.76, 103.83], [40.6, 108.93], [1.09, 157.41]],
  },
  { sourceWayIds: ['651089713', '651089709'], width: 4, widthConfidence: 'aerial-estimate',
    centreline: [[17.7, 72.51], [13.1, 78.31], [11.98, 79.71], [10.34, 81.74], [5.79, 87.47]],
  },
  { sourceWayIds: ['888737620'], width: 4, widthConfidence: 'aerial-estimate',
    centreline: [[-33.73, 32.94], [-38.23, 39.15], [-40.09, 41.85], [-43.61, 46.92]],
  },
  // OSM 651089715 (surface=paved), checked 2026-09-23 against Bayleys
  // 5529745 aerial: street access to the existing 117 side parking outline
  // 1547753373. Keep the office-front lawn; width remains an estimate.
  { sourceWayIds: ['651089715'], width: 4, widthConfidence: 'aerial-estimate',
    centreline: [[81.26, 123.5], [76.51, 129.41], [71.95, 135.05], [71.53, 135.55]],
  },
]

export const VIRTUAL_CHURCH_SURROUNDING_PAVED_POLYGONS = [
  ...VIRTUAL_CHURCH_SURROUNDING_HARDSTANDS.map(({ points }) => points),
  ...VIRTUAL_CHURCH_SURROUNDING_SERVICE_ACCESS.flatMap(access => access.centreline.slice(1).map((end, index) => {
    const start = access.centreline[index]
    const dx = end[0] - start[0], dz = end[1] - start[1]
    const halfWidth = access.width / 2
    const nx = -dz / Math.hypot(dx, dz) * halfWidth
    const nz = dx / Math.hypot(dx, dz) * halfWidth
    return [
      [start[0] + nx, start[1] + nz], [end[0] + nx, end[1] + nz],
      [end[0] - nx, end[1] - nz], [start[0] - nx, start[1] - nz],
    ] as Array<[number, number]>
  })),
]

/** The light paved service court between OSM building 420431718 and
 * 117 The Runway (1170948415), closed at the rear by 1170948387.
 * Traced from the council's 2025 orthophoto, checked 2026-09-22; building
 * footprints constrain the wall edges. This is NOT an OSM parking polygon
 * or a surveyed property boundary. Keep stock, bay markings and fences out
 * until separately evidenced. The already mapped access remains unchanged.
 */
export const VIRTUAL_CHURCH_SURROUNDING_SERVICE_COURT = {
  source: 'https://gis.ccc.govt.nz/imagery/rest/services/CorporateImagery/ChristchurchImageryLatest/MapServer',
  referenceDate: '2026-09-22',
  aerialYear: 2025,
  referenceExtent: [172.5624475, -43.54915, 172.5633225, -43.54845],
  boundingBuildingWayIds: ['420431718', '1170948415', '1170948387'],
  horizontalConfidence: 'aerial-estimate',
  surfaceConfidence: 'light-paving-only',
  points: [
    [32.8, 103.2], [41.8, 104.9], [48.75, 114.55], [17.5, 151.7],
    [5.45, 164.6], [-4.7, 155.8], [31.28, 111.1], [28, 108.5],
  ] as Array<[number, number]>,
} as const

/** OSM natural=tree nodes, checked 2026-09-14 against the council aerial.
 * Trunk locations are mapped; broadleaf form, height and crown size remain
 * visual proxies. These do not add trees to the church's approved parking.
 */
export const VIRTUAL_CHURCH_SURROUNDING_TREES: Array<{
  sourceNodeId: string
  point: [number, number]
}> = [
  { sourceNodeId: '14075284200', point: [-72.36, 142.02] },
  { sourceNodeId: '14075284201', point: [-68.61, 137.78] },
  { sourceNodeId: '14075284202', point: [-64.73, 132.83] },
  { sourceNodeId: '14075284203', point: [-60.36, 127.16] },
  { sourceNodeId: '14075284204', point: [-72.71, 149.44] },
  { sourceNodeId: '14075284205', point: [-55.81, 122.01] },
  { sourceNodeId: '14075284206', point: [-52.51, 124.68] },
  { sourceNodeId: '14075284207', point: [-35.71, 97.76] },
  { sourceNodeId: '14075284208', point: [-31.82, 92.87] },
  { sourceNodeId: '14075284209', point: [-26.17, 85.3] },
  { sourceNodeId: '14075284210', point: [-19.96, 77.6] },
  { sourceNodeId: '14077360753', point: [105.91, 129.34] },
  { sourceNodeId: '14077360792', point: [74.56, 141.91] },
  { sourceNodeId: '14077360810', point: [108.74, 162.85] },
  { sourceNodeId: '14077360811', point: [106.93, 156.2] },
  { sourceNodeId: '14077360812', point: [100.69, 151.28] },
]

// Released V2 framing keeps the whole signed street elevation in view.
export const SCENE_SHOWCASE_CAMERA = {
  position: [-29.25, 5.6, -31.20] as [number, number, number],
  lookAt: [-17.285, 3.7, -16.44] as [number, number, number],
  verticalFovDegrees: 47,
  minimumLandscapeAspect: 568 / 390,
  confidence: 'reference' as SceneConfidence,
} as const

// V3 photo-review framing favors the real bilingual sign bay over the much
// larger dark facade. Keep the cross and enough of the dark wall recognizable;
// only the showcase camera moves, never the authored church geometry.
export const SCENE_V3_SHOWCASE_CAMERA = {
  ...SCENE_SHOWCASE_CAMERA,
  position: [-21.41, 5.1, -29.83] as [number, number, number],
  lookAt: [-13.22, 3.7, -19.73] as [number, number, number],
} as const

// Parking rows traced from the Christchurch City Council March 2025
// orthophoto. The revised -0.78 rad row angle and starts were checked by
// projecting the metre coordinates back onto a georeferenced 2025 export.
// The entrance elevation has two ordinary bays, a two-bay mobility group with
// a shared access aisle, then five ordinary bays. Its common baseline is kept
// inside the gate/fence instead of centring the first stripe over the boundary.
// The user-confirmed parking on the driver's right after entering the gate is
// represented as six ordinary bays after the overhead-layout review removed
// the two spaces nearest the separate central rows. This keeps a 12.7 m clear
// cross-aisle before those rows as well as the 6.2 m entrance drive aisle. The
// exact stripe start remains provisional until a surveyed site plan is
// available.
// The pedestrian spine has eight bays on each side with a clear 1.3 m gap
// between stripe ends, followed by the ten-bay Haytons Stream boundary row.
export const PARKING_ROWS: ParkingRowSpec[] = [
  { id: 'entry-north', start: [-32.77, 9.41], bays: 2, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'reference' },
  { id: 'entry-south', start: [-23.88, 0.61], bays: 5, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'reference' },
  { id: 'entry-gate-right', start: [-40.08, 2.02], bays: 6, bayWidth: 2.5, bayDepth: 4.2, angle: -0.78, confidence: 'provisional', layoutAuthority: 'user-confirmed-overhead-view' },
  { id: 'spine-building-side', start: [-22.65, -19.75], bays: 8, bayWidth: 2.5, bayDepth: 4.6, angle: -0.78, confidence: 'reference' },
  { id: 'spine-boundary-side', start: [-26.81, -23.92], bays: 8, bayWidth: 2.5, bayDepth: 4.6, angle: -0.78, confidence: 'reference' },
  { id: 'south-west-boundary', start: [-41.9, -26.1], bays: 10, bayWidth: 2.5, bayDepth: 5, angle: -0.78, confidence: 'reference' },
]

// The central rows face the pedestrian spine. A negative perpendicular offset
// moves the building-side stops toward the walkway; the boundary-side row needs
// the opposite sign. Keeping the signs here makes the site correction testable.
export const CENTRAL_PARKING_WHEEL_STOP_INNER_SIDE = {
  'spine-building-side': -1,
  'spine-boundary-side': 1,
} as const

export const ACCESSIBLE_PARKING_PAIR: AccessibleParkingPairSpec = {
  id: 'entry-accessible-pair',
  start: [-29.23, 5.89],
  bayWidth: 2.5,
  aisleWidth: 2.5,
  bayDepth: 4.2,
  angle: -0.78,
  confidence: 'reference',
}

export const RENDER_BUDGET = {
  maxDevicePixelRatio: 1.1,
  desktopShadowMap: 1024,
  targetFps: 45,
  maxVisibleDecorativeCars: 10,
  treeLodDistance: 50,
  windUpdateIntervalMs: 120,
} as const
