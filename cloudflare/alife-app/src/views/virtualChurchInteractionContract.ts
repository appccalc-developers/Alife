import { THE_RUNWAY, V3_THE_RUNWAY_APPROACH, STARK_DRIVE_NORTH, STARK_DRIVE_SERVICE, ENTRANCE_DRIVEWAY, MAIN_CARPARK, VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, VIRTUAL_CHURCH_SWALE } from './virtualChurchScene.ts'

export type VirtualChurchSourcePosition = readonly [
  x: number,
  y: number,
  z: number,
]

export type VirtualChurchPlatform = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  top: number
}

// Local metre coordinates converted from OpenStreetMap way 1459962252.
// X points east and Z points north, with the building centroid near the origin.
export const VIRTUAL_CHURCH_BUILDING_FOOTPRINT: Array<[number, number]> = [
  [-24.81, 10.34], [-13.49, -3.62], [-15.56, -5.3], [-5.9, -17.21],
  [-4.01, -15.68], [3.48, -24.89], [18.89, -12.37], [16.61, -9.58],
  [21.22, -5.84], [14.34, 2.65], [10.95, -0.1], [8.57, 2.84],
  [11.96, 5.59], [-1.44, 22.1], [-6.24, 18.2], [-9.76, 22.54],
]

export const VIRTUAL_CHURCH_AUXILIARY_BUILDING: Array<[number, number]> = [
  [-53.23, -9.06], [-45.57, -18.4], [-46.5, -19.16], [-42.98, -23.44],
  [-38.34, -19.64], [-41.7, -15.54], [-40.27, -14.37], [-41.32, -13.1],
  [-36.42, -9.08], [-38.2, -6.9], [-36.65, -5.62], [-40.08, -1.42],
  [-48.01, -7.93], [-49.55, -6.04],
]

export const VIRTUAL_CHURCH_STEP_TOLERANCE_METRES = 0.5

export const VIRTUAL_CHURCH_PLATFORMS: VirtualChurchPlatform[] = [
  { minX: -10.4, maxX: -2.4, minZ: -22.1, maxZ: -13.1, top: 0.08 },
  { minX: -47.6, maxX: -40.2, minZ: 12.4, maxZ: 20.2, top: 0.06 },
]

export const VIRTUAL_CHURCH_PLAYER_BOUNDS = {
  x: [-70, 65],
  z: [-56, 78],
} as const

export const VIRTUAL_CHURCH_ENTRANCE_TRIGGER_RADIUS_METRES = 6

// The entrance elevation is authored in the same local coordinate system as
// ChurchBuilding. Keep the collision opening derived from the OSM edge so the
// door, foyer shell and controller cannot drift apart when the footprint moves.
const VIRTUAL_CHURCH_ENTRANCE_START = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[4]
const VIRTUAL_CHURCH_ENTRANCE_END = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[5]
const VIRTUAL_CHURCH_ENTRANCE_DX =
  VIRTUAL_CHURCH_ENTRANCE_END[0] - VIRTUAL_CHURCH_ENTRANCE_START[0]
const VIRTUAL_CHURCH_ENTRANCE_DZ =
  VIRTUAL_CHURCH_ENTRANCE_END[1] - VIRTUAL_CHURCH_ENTRANCE_START[1]
const VIRTUAL_CHURCH_ENTRANCE_LENGTH = Math.hypot(
  VIRTUAL_CHURCH_ENTRANCE_DX,
  VIRTUAL_CHURCH_ENTRANCE_DZ,
)
export const VIRTUAL_CHURCH_ENTRANCE_ANGLE = -Math.atan2(
  VIRTUAL_CHURCH_ENTRANCE_DZ,
  VIRTUAL_CHURCH_ENTRANCE_DX,
)
export const VIRTUAL_CHURCH_ENTRANCE_MID: [number, number] = [
  (VIRTUAL_CHURCH_ENTRANCE_START[0] + VIRTUAL_CHURCH_ENTRANCE_END[0]) / 2,
  (VIRTUAL_CHURCH_ENTRANCE_START[1] + VIRTUAL_CHURCH_ENTRANCE_END[1]) / 2,
]

export type VirtualChurchSurroundingBuildingTone = 'silver' | 'pale' | 'grey'

export type VirtualChurchSurroundingBuilding = {
  id: string
  sourceWayId: string
  address?: string
  addressEvidence?: 'osm-way-tag' | 'property-listing'
  footprint: Array<[number, number]>
  height: number
  tone: VirtualChurchSurroundingBuildingTone
  detail: 'near' | 'mid' | 'silhouette'
  featureEdge?: readonly [startIndex: number, endIndex: number]
  feature: 'roller-doors' | 'window-band' | 'office-glazing' | 'ribbon-office' | 'wall-rhythm'
  featureBayCount?: number
  featureEvidence?: 'project-photo' | 'property-listing-photo'
  featureReference?: string
  hasInterior: false
  horizontalConfidence: 'osm-footprint'
  verticalConfidence: 'aerial-estimate'
}

/**
 * Exterior-only context around 182 The Runway. X/Z points are local metres in
 * the same north-up source coordinate system as the church footprint. They are
 * converted from the listed OpenStreetMap ways and cross-checked against the
 * Christchurch City Council 2025 orthophoto. Heights remain visual estimates.
 */
export const VIRTUAL_CHURCH_SURROUNDING_BUILDINGS: VirtualChurchSurroundingBuilding[] = [
  {
    id: 'east-logistics-warehouse', sourceWayId: '897328722',
    address: '124 Hayton Road', addressEvidence: 'osm-way-tag',
    footprint: [
      [77.01, -127.52], [6.23, -39.91], [35.89, -16.14], [55.81, -40.79],
      [61.34, -36.37], [48.88, -20.94], [68.67, -5.07], [99.51, 19.63],
      [111.88, 4.34], [133.51, 21.68], [131.13, 24.63], [173.7, 58.72],
      [209.94, 13.87], [214.8, 17.77], [220.59, 10.6], [216.24, 7.11],
      [217.28, 5.83], [151.66, -46.73], [161.96, -59.48],
    ],
    height: 9.4, tone: 'silver', detail: 'near', featureEdge: [1, 2],
    feature: 'office-glazing', featureEvidence: 'project-photo', hasInterior: false,
    horizontalConfidence: 'osm-footprint', verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-west-industrial-complex', sourceWayId: '1208036890',
    footprint: [
      [-118.07, 79.35], [-81.57, 108.73], [-44.75, 62.82], [-48.79, 59.58],
      [-42.79, 52.42], [-60.82, 37.58], [-66.55, 44.82], [-80.85, 33.4],
      [-103.29, 61], [-107.37, 57.8], [-113.2, 65.11], [-109.22, 68.31],
    ],
    height: 8.2, tone: 'grey', detail: 'mid', featureEdge: [4, 5],
    feature: 'wall-rhythm', hasInterior: false,
    horizontalConfidence: 'osm-footprint', verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-road-warehouse-east', sourceWayId: '420431718',
    address: '115 The Runway', addressEvidence: 'osm-way-tag',
    footprint: [
      [-6.28, 157.14], [30.89, 111.15], [27.61, 108.52], [32.52, 102.45],
      [20.47, 92.79], [15.64, 98.78], [12.51, 96.27], [8.44, 101.31],
      [-24.73, 142.36],
    ],
    height: 7.5, tone: 'pale', detail: 'mid', featureEdge: [3, 4],
    feature: 'window-band', hasInterior: false,
    horizontalConfidence: 'osm-footprint', verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-road-warehouse-west', sourceWayId: '1482114898',
    footprint: [
      [-44.03, 127.17], [-51.94, 120.84], [-45.93, 113.41], [-36.72, 120.78],
      [-14.6, 93.36], [-15.23, 87.83], [-3.89, 86.56], [-3.27, 91.94],
      [8.44, 101.31], [-24.73, 142.36],
    ],
    height: 7.1, tone: 'silver', detail: 'mid', featureEdge: [5, 6],
    feature: 'roller-doors', hasInterior: false,
    horizontalConfidence: 'osm-footprint', verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-east-workshop', sourceWayId: '1170948413',
    footprint: [
      [86.21, 84.27], [91.69, 88.74], [88.87, 92.18], [97.37, 99.12],
      [100.52, 95.27], [105.92, 99.68], [119.61, 82.93], [100.23, 67.12],
    ],
    height: 6.5, tone: 'grey', detail: 'silhouette', feature: 'wall-rhythm',
    hasInterior: false, horizontalConfidence: 'osm-footprint',
    verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-east-warehouse', sourceWayId: '1302247112',
    footprint: [
      [108.93, 124.98], [127.63, 140.14], [153.12, 108.48],
      [130.02, 89.42], [115.29, 108.03], [119.7, 111.51],
    ],
    height: 7.8, tone: 'pale', detail: 'silhouette', feature: 'wall-rhythm',
    hasInterior: false, horizontalConfidence: 'osm-footprint',
    verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'north-stark-drive-warehouse', sourceWayId: '1170948387',
    address: '5 Stark Drive', addressEvidence: 'osm-way-tag',
    footprint: [
      [-6.21, 155.95], [-24.64, 141.23], [-43.91, 126.1], [-67.68, 155.26],
      [-59.97, 161.51], [-66.87, 169.97], [-31.39, 198.7], [-22.78, 188.13],
      [-19.32, 190.92], [-14.61, 185.14], [-12.21, 187.1], [5.59, 165.28],
    ],
    height: 8.4, tone: 'silver', detail: 'silhouette', feature: 'wall-rhythm',
    hasInterior: false, horizontalConfidence: 'osm-footprint',
    verticalConfidence: 'aerial-estimate',
  },
  {
    id: 'far-north-industrial-complex', sourceWayId: '1170948415',
    address: '117 The Runway', addressEvidence: 'property-listing',
    footprint: [
      [-11.92, 191.05], [28.55, 223.49], [39.48, 209.95], [43.98, 213.55],
      [37.99, 220.98], [48.88, 229.7], [54.93, 222.21], [54.36, 221.75],
      [74.52, 196.75], [34.43, 164.64], [37.87, 160.37], [41.27, 162.99],
      [63.39, 135.77], [59.67, 132.7], [64.34, 127.02], [49.04, 114.5],
      [18.9, 151.85], [18.14, 151.24], [-2.31, 176.59], [-1.06, 177.58],
    ],
    height: 9, tone: 'pale', detail: 'silhouette', featureEdge: [14, 15],
    // Listing gallery photos 2/4 show pale walls, an upper grey ribbon and a
    // small entry canopy, not a full-height dark facade/orange entrance block.
    // Module dimensions remain estimates; the north loading side is not moved here.
    feature: 'ribbon-office', featureBayCount: 6,
    featureEvidence: 'property-listing-photo',
    featureReference: 'https://www.realestate.co.nz/property/117-the-runway-wigram-christchurch-city-canterbury/kwlq7401d',
    hasInterior: false,
    horizontalConfidence: 'osm-footprint',
    verticalConfidence: 'aerial-estimate',
  },
]

export const virtualChurchShouldRenderSurroundingFacadeDetails = (
  siteAssetsReady: boolean,
  isMobile: boolean,
) => siteAssetsReady && !isMobile

export const VIRTUAL_CHURCH_SURROUNDING_SOURCE = {
  osmReferenceDate: '2026-09-13',
  aerialYear: 2025,
  horizontalAuthority: 'OpenStreetMap building footprints',
  visualAuthority: 'Christchurch City Council ChristchurchImageryLatest',
  scope: 'exterior-only',
} as const
const VIRTUAL_CHURCH_FACADE_RIGHT = VIRTUAL_CHURCH_ENTRANCE_LENGTH / 2
const VIRTUAL_CHURCH_FOYER_START = VIRTUAL_CHURCH_FACADE_RIGHT - 15
const VIRTUAL_CHURCH_FOYER_END = VIRTUAL_CHURCH_FACADE_RIGHT
const VIRTUAL_CHURCH_CEDAR_END = VIRTUAL_CHURCH_FOYER_START + 4.2
const VIRTUAL_CHURCH_CEDAR_START = VIRTUAL_CHURCH_CEDAR_END - 18
const VIRTUAL_CHURCH_RECESS_WIDTH = 18 * 0.68
const VIRTUAL_CHURCH_RECESS_CENTRE = VIRTUAL_CHURCH_CEDAR_START + 18 * 0.64
const VIRTUAL_CHURCH_RECESS_START =
  VIRTUAL_CHURCH_RECESS_CENTRE - VIRTUAL_CHURCH_RECESS_WIDTH / 2
const VIRTUAL_CHURCH_DOOR_BANK_START =
  VIRTUAL_CHURCH_RECESS_START + VIRTUAL_CHURCH_RECESS_WIDTH * 0.315
const VIRTUAL_CHURCH_DOOR_BANK_END = VIRTUAL_CHURCH_DOOR_BANK_START + 3.8
const VIRTUAL_CHURCH_FOYER_GLASS_END = VIRTUAL_CHURCH_FOYER_END - 15 * 0.39

export const VIRTUAL_CHURCH_WALKABLE_FOYER = {
  doorway: {
    minX: VIRTUAL_CHURCH_DOOR_BANK_START + 0.18,
    maxX: VIRTUAL_CHURCH_DOOR_BANK_END - 0.18,
    minZ: -3.7,
    maxZ: 0.45,
  },
  interior: {
    minX: VIRTUAL_CHURCH_RECESS_START + 0.3,
    maxX: VIRTUAL_CHURCH_FOYER_GLASS_END + 0.3,
    minZ: 0.18,
    maxZ: 13.15,
  },
} as const

// Photo-informed circulation candidate. The user confirmed the order of
// spaces, not surveyed dimensions: straight ahead from the entrance, main
// sanctuary on the left, secondary sanctuary on the right, then a left/right
// branch beside the opposite door. This extends the photo-backed foyer into a
// review-only circulation shell; distances and room boundaries are estimates.
const foyerAxisX = (VIRTUAL_CHURCH_WALKABLE_FOYER.doorway.minX + VIRTUAL_CHURCH_WALKABLE_FOYER.doorway.maxX) / 2
const foyerBranchLeftX = -25.6
export const VIRTUAL_CHURCH_FOYER_CIRCULATION = {
  axisX: foyerAxisX,
  // The photographed double-height foyer is open across its full width.
  // These are the perimeter frontages, not walls beside a narrow aisle.
  aisleLeftX: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minX - .08,
  aisleRightX: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.maxX + .08,
  branchLeftX: foyerBranchLeftX,
  // Keep the speculative right-hand corridor inside the existing OSM shell.
  // Its outer edge is still a review estimate, not a measured room boundary.
  branchRightX: 4.7,
  partitionStartZ: 6.45,
  partitionEndZ: 10.15,
  branchWallZ: 10.30,
  branchOpeningStartZ: 10.15,
  branchDepthZ: 11.3,
  // Keep the unmeasured right branch visibly corridor-shaped within the
  // existing building shell; its closed room fronts sit along this wall.
  rightBranchRoomDoorZ: 11.95,
  // Photo 01 reads as a compact, ordinary-height corridor rather than the
  // 3.3 m-deep cross-hall previously left open on this review-only branch.
  leftBranchOpeningStartZ: 11.05,
  leftBranchDepthZ: 12.2,
  oppositeDoorZ: 13.28,
  // Photo 04: the opposite glazing is roughly twice the visible cabinet
  // width and nearly meets the stair, rather than a narrow central slot.
  farGlazingHalfWidth: 2.6,
  // Photo 09: two separate double-door banks are already on the left when
  // looking inward from the entrance. Photos 07/08 and the owner's review
  // confirm just one later, charcoal double-door bank beside the cafe.
  leftDoorBanks: [[0.65, 2.75], [3.45, 5.55]] as const,
  rightDoorBanks: [[6.5, 8.1]] as const,
  // Photo 01 shows successive side-room doors and a closed far-end door.
  // Their spacing within the left branch is estimated; no room is opened.
  leftBranchRoomDoors: [foyerBranchLeftX + 3, foyerAxisX - 8.3] as const,
  rightBranchRoomDoors: [1.55, 3.75] as const,
  // Photos 01/02 show one tall courtyard window near the foyer end of the
  // same corridor as the successive doors. Which physical branch this is
  // remains unconfirmed, so keep it in the review-only left-branch shell.
  leftBranchCourtyardWindow: { centerX: foyerAxisX - 6.5, width: 1.8, sillY: .10, headY: 2.70 },
  // In photo 09 the brochure table sits just beyond the second left door,
  // beside that frontage rather than in the middle of the walking axis.
  welcomeTable: { x: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minX + 2.8, z: 6.0, halfWidth: .83, halfDepth: .36 },
} as const
// Photos 05–08 show the service window before the later right-hand doors.
// Only its shallow visible recess is represented, not a surveyed room.
export const VIRTUAL_CHURCH_FOYER_SERVICE_FRONTAGE = {
  // Photo 08's glazed frontage is several times the adjacent double-door
  // width. Keep a solid pier before that door and stay inside the foyer wall.
  startZ: .67,
  endZ: 6.01,
  sillY: 1.05,
  headY: 3.05,
  visibleDepth: 1.32,
} as const
// The owner confirms a small guard room immediately to the left on entry,
// before the first main-hall doors. Its dimensions and fittings are a V3
// visual candidate; the room remains closed until surveyed.
export const VIRTUAL_CHURCH_FOYER_GUARD_ROOM = {
  minX: VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX + .12,
  maxX: VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX + 1.36,
  minZ: -.48,
  maxZ: VIRTUAL_CHURCH_FOYER_CIRCULATION.leftDoorBanks[0][0] - .17,
  height: 2.42,
} as const
// Photos 04/07 place the stair to the right of the opposite glazing. The
// footprint is a visual estimate, not a measured stair or an upper-floor route.
export const VIRTUAL_CHURCH_FOYER_STAIR = {
  minX: foyerAxisX + 2.7,
  maxX: foyerAxisX + 5.7,
  minZ: 11.85,
  maxZ: 13.12,
  rise: 2.3,
  steps: 10,
} as const
// The photo-backed pier is part of the wall immediately beyond the stair.
// Share its small footprint with the scene so the player cannot enter it.
export const VIRTUAL_CHURCH_FOYER_STAIR_END_PIER = {
  centerX: VIRTUAL_CHURCH_FOYER_STAIR.maxX + .28,
  centerZ: 13.35,
  halfWidth: .18,
  halfDepth: .12,
} as const
// Photos 04/07 show two modest planters at the stair foot and beside the
// charcoal frontage. Keep them off the central glazing route; dimensions are
// visual estimates and both pots share the same collision footprint.
export const VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS = [
  { centerX: VIRTUAL_CHURCH_FOYER_STAIR.minX + .24, centerZ: VIRTUAL_CHURCH_FOYER_STAIR.minZ - .12, radius: .33 },
  { centerX: VIRTUAL_CHURCH_FOYER_STAIR.maxX + .42, centerZ: VIRTUAL_CHURCH_FOYER_STAIR.minZ + .08, radius: .33 },
] as const
// Photo 04 shows low storage to the left of the opposite glazing, not a
// second room entrance immediately beside it. The footprint is approximate.
export const VIRTUAL_CHURCH_FOYER_FAR_CABINET = {
  centerX: foyerAxisX - 4.28,
  centerZ: 13.02,
  halfWidth: 1.24,
  halfDepth: .27,
} as const
const foyerJunctionBounds = {
  minX: VIRTUAL_CHURCH_FOYER_CIRCULATION.branchLeftX,
  maxX: VIRTUAL_CHURCH_FOYER_CIRCULATION.branchRightX,
  minZ: VIRTUAL_CHURCH_FOYER_CIRCULATION.branchOpeningStartZ,
  maxZ: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.maxZ,
}

// Look down the entrance axis from the photo-backed threshold.
const foyerViewLocalX = VIRTUAL_CHURCH_FOYER_CIRCULATION.axisX
const foyerViewLocalZ = 0.92
export const VIRTUAL_CHURCH_FOYER_VIEW = {
  position: [
    VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * foyerViewLocalX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * foyerViewLocalZ,
    .095,
    VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * foyerViewLocalX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * foyerViewLocalZ,
  ] as [number, number, number],
  yaw: VIRTUAL_CHURCH_ENTRANCE_ANGLE - Math.PI,
  pitch: -.08,
}

// Stand inside the actual entrance opening for the user's photo comparison.
// This is a viewpoint candidate, not a survey of the photographer's position.
const mainHallViewLocalX = foyerAxisX + 1
const mainHallViewLocalZ = .75
export const VIRTUAL_CHURCH_MAIN_HALL_VIEW = {
  position: [
    VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * mainHallViewLocalX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * mainHallViewLocalZ,
    .095,
    VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * mainHallViewLocalX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * mainHallViewLocalZ,
  ] as [number, number, number],
  yaw: VIRTUAL_CHURCH_FOYER_VIEW.yaw - .72,
  pitch: -.12,
}

// A wide landscape viewport sees beyond the entrance's near-left edge and
// reveals the real exterior metal frontage in the photo-comparison view.
// At the supplied photo's 4:3 aspect, turn toward the near-left bank enough
// to retain both entrances. Wider frames still turn inward to avoid showing
// the real exterior metal frontage; neither the building nor free camera moves.
export const virtualChurchMainHallComparisonYaw = (aspect: number) => {
  const wide = Number.isFinite(aspect) ? Math.max(0, Math.min(1, (aspect - 1.4) / .4)) : 0
  return VIRTUAL_CHURCH_MAIN_HALL_VIEW.yaw + wide * .10
}

// Review the later right-side sanctuary doors from the walking route. The
// far-right corridor guide is past these doors and cannot validate their order.
const secondaryHallViewLocalX = foyerAxisX + 3
const secondaryHallViewLocalZ = 5.55
export const VIRTUAL_CHURCH_SECONDARY_HALL_VIEW = {
  position: [
    VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * secondaryHallViewLocalX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * secondaryHallViewLocalZ,
    .095,
    VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * secondaryHallViewLocalX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * secondaryHallViewLocalZ,
  ] as [number, number, number],
  yaw: VIRTUAL_CHURCH_FOYER_VIEW.yaw + 1.33,
  pitch: -.06,
}

// Keep the courtyard window at the frame edge while the closed end door and
// successive room doors remain readable, as in photo 01.
const junctionViewLocalZ = VIRTUAL_CHURCH_FOYER_CIRCULATION.leftBranchDepthZ - .08
const leftJunctionViewLocalX = VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX - .25
// Frame the unmeasured right-hand branch from the open foyer, before the
// first room frontage. Standing inside the short passage made its near door
// fill the screen and obscured the second room and corridor depth.
const rightJunctionViewLocalX = VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleRightX - .8
const rightJunctionViewLocalZ = VIRTUAL_CHURCH_FOYER_CIRCULATION.branchOpeningStartZ + .3
export const VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW = {
  position: [
    VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * leftJunctionViewLocalX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * junctionViewLocalZ,
    .095,
    VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * leftJunctionViewLocalX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * junctionViewLocalZ,
  ] as [number, number, number],
  yaw: VIRTUAL_CHURCH_FOYER_VIEW.yaw - Math.PI / 2 + .43,
  pitch: -.06,
}
export const VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW = {
  position: [
    VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * rightJunctionViewLocalX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * rightJunctionViewLocalZ,
    .095,
    VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * rightJunctionViewLocalX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * rightJunctionViewLocalZ,
  ] as [number, number, number],
  pitch: -.04,
  // Aim between the two closed room fronts, not at the blank outer wall.
  yaw: VIRTUAL_CHURCH_FOYER_VIEW.yaw + 1.06,
}

export const virtualChurchPositionToEntranceLocal = (x: number, z: number) => {
  const dx = x - VIRTUAL_CHURCH_ENTRANCE_MID[0]
  const dz = z - VIRTUAL_CHURCH_ENTRANCE_MID[1]
  return {
    x: Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * dx
      - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * dz,
    z: Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * dx
      + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * dz,
  }
}

const virtualChurchPointInsideLocalRect = (
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  x: number,
  z: number,
) => x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ

// A narrow V3-only passage through the two photographed near-left double
// doors. It ends at the transition plane; the auditorium remains a separate
// scene and no speculative room floor is made walkable behind it.
const virtualChurchPointInsideMainHallThreshold = (x: number, z: number) => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  return x > route.aisleLeftX - .38 && x < route.aisleLeftX + .30
    && route.leftDoorBanks.some(([start, end]) => z > start + .12 && z < end - .12)
}

/** The open sliding-door bank, first foyer and V3 junction form a continuous
 * route. Player and camera use the same threshold opening.
 */
export const virtualChurchPositionIsInsideWalkableFoyer = (x: number, z: number, visualVersion: 'v2' | 'v3' = 'v3') => {
  const local = virtualChurchPositionToEntranceLocal(x, z)
  return virtualChurchPointInsideLocalRect(
    VIRTUAL_CHURCH_WALKABLE_FOYER.doorway,
    local.x,
    local.z,
  ) || virtualChurchPointInsideLocalRect(
    VIRTUAL_CHURCH_WALKABLE_FOYER.interior,
    local.x,
    local.z,
  ) || (visualVersion === 'v3' && virtualChurchPointInsideMainHallThreshold(local.x, local.z)) || (visualVersion === 'v3'
    && !(local.x < VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX
      && local.z < VIRTUAL_CHURCH_FOYER_CIRCULATION.leftBranchOpeningStartZ)
    && virtualChurchPointInsideLocalRect(foyerJunctionBounds, local.x, local.z))
}

/** Only the enclosed side of the threshold needs the compact camera boom.
 * Keeping the exterior doorway on the normal boom preserves a readable view
 * of the complete entrance before the avatar crosses the doors.
 */
export const virtualChurchPositionIsInsideFoyerInterior = (x: number, z: number, visualVersion: 'v2' | 'v3' = 'v3') => {
  const local = virtualChurchPositionToEntranceLocal(x, z)
  return virtualChurchPointInsideLocalRect(
    VIRTUAL_CHURCH_WALKABLE_FOYER.interior,
    local.x,
    local.z,
  ) || (visualVersion === 'v3' && virtualChurchPointInsideMainHallThreshold(local.x, local.z)) || (visualVersion === 'v3'
    && !(local.x < VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX
      && local.z < VIRTUAL_CHURCH_FOYER_CIRCULATION.leftBranchOpeningStartZ)
    && virtualChurchPointInsideLocalRect(foyerJunctionBounds, local.x, local.z))
}

export const virtualChurchPointInsidePolygon = (
  points: Array<[number, number]>,
  x: number,
  z: number,
) => {
  let inside = false
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index++
  ) {
    const [xi, zi] = points[index]
    const [xj, zj] = points[previous]
    if (
      (zi > z) !== (zj > z)
      && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

const virtualChurchPointInsidePlatform = (
  platform: VirtualChurchPlatform,
  x: number,
  z: number,
) => (
  x > platform.minX
  && x < platform.maxX
  && z > platform.minZ
  && z < platform.maxZ
)

export const virtualChurchGroundHeightAt = (
  x: number,
  z: number,
  feetY: number,
  terrainHeight: number,
  visualVersion: 'v2' | 'v3' = 'v3',
) => {
  // The cut terrain sits below the authored banks/bed. Feet stand on those
  // opaque surfaces, not the lowered backing mesh or the thin water ribbon.
  let ground = Math.max(terrainHeight, virtualChurchSwaleFloorAt(x, z) ?? terrainHeight)
  // Paving is solid even where the temporary terrain falls into the swale.
  // Do not apply the step limit here: an avatar already below the thin road
  // surface must recover to it. Raised platforms retain their step rule below.
  for (const [points, top] of (visualVersion === 'v3' ? v3Paving : v2Paving)) {
    if (top > ground && pointOnPaving(points, x, z)) ground = top
  }
  if (visualVersion === 'v3' && virtualChurchPositionIsInsideFoyerInterior(x, z, visualVersion)) {
    ground = Math.max(ground, .095)
  }
  for (const platform of VIRTUAL_CHURCH_PLATFORMS) {
    if (
      virtualChurchPointInsidePlatform(platform, x, z)
      && platform.top <= feetY + VIRTUAL_CHURCH_STEP_TOLERANCE_METRES
      && platform.top > ground
    ) {
      ground = platform.top
    }
  }
  return ground
}

export function virtualChurchSwaleFloorAt(x: number, z: number): number | null {
  const { start, end, crossing } = VIRTUAL_CHURCH_SWALE
  const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz)
  const along = ((x - start[0]) * dx + (z - start[1]) * dz) / length
  const crossingAlong = ((crossing[0] - start[0]) * dx + (crossing[1] - start[1]) * dz) / length
  const offset = Math.abs(((x - start[0]) * -dz + (z - start[1]) * dx) / length)
  if (along < -1e-7 || along > length + 1e-7 || Math.abs(along - crossingAlong) < 3.2 || offset > 3.05 + 1e-7) return null
  if (offset <= .68) return -.18
  if (offset <= 1.1) return -.18 + (offset - .68) / (1.1 - .68) * .06
  return -.12 + (Math.min(3.05, offset) - 1.1) / (3.05 - 1.1) * .145
}

const commonPaving: Array<[Array<[number, number]>, number]> = [
  [STARK_DRIVE_NORTH, .018], [STARK_DRIVE_SERVICE, .019],
  [ENTRANCE_DRIVEWAY, .032], [MAIN_CARPARK, .010],
]
const v2Paving = [...commonPaving, [THE_RUNWAY, .018] as [Array<[number, number]>, number]]
const v3Paving = [...commonPaving,
  [V3_THE_RUNWAY_APPROACH, .018] as [Array<[number, number]>, number],
  [VIRTUAL_CHURCH_THE_RUNWAY_NORTH_EAST_EXTENSION, .018] as [Array<[number, number]>, number],
]

function pointOnPaving(points: Array<[number, number]>, x: number, z: number) {
  if (virtualChurchPointInsidePolygon(points, x, z)) return true
  // Include exact polygon edges so a seam cannot alternate between road and
  // underlying terrain. No enlarged bounding box or off-road invisible floor.
  return points.some(([ax, az], index) => {
    const [bx, bz] = points[(index + 1) % points.length]
    const dx = bx - ax, dz = bz - az
    const lengthSquared = dx * dx + dz * dz
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared)) : 0
    return Math.hypot(x - ax - t * dx, z - az - t * dz) <= 1e-7
  })
}

export const virtualChurchPositionIsBlocked = (
  x: number,
  z: number,
  feetY: number,
  visualVersion: 'v2' | 'v3' = 'v3',
) => {
  if (visualVersion === 'v3') {
    const local = virtualChurchPositionToEntranceLocal(x, z)
    const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
    const onPartition = local.z > route.partitionStartZ
      && ((local.z < route.leftBranchOpeningStartZ && Math.abs(local.x - route.aisleLeftX) < .20)
        || (local.z < route.partitionEndZ && Math.abs(local.x - route.aisleRightX) < .20))
    const table = route.welcomeTable
    const onWelcomeTable = Math.abs(local.x - table.x) < table.halfWidth
      && Math.abs(local.z - table.z) < table.halfDepth
    const guard = VIRTUAL_CHURCH_FOYER_GUARD_ROOM
    const onGuardRoom = local.x > guard.minX && local.x < guard.maxX
      && local.z > guard.minZ && local.z < guard.maxZ
    const behindRightBranchRooms = local.x > route.aisleRightX
      && local.x < route.branchRightX + .2
      && local.z > route.rightBranchRoomDoorZ - .12
      && local.z < route.oppositeDoorZ + .2
    const stair = VIRTUAL_CHURCH_FOYER_STAIR
    const onUnbuiltStair = local.x > stair.minX && local.x < stair.maxX
      && local.z > stair.minZ && local.z < stair.maxZ
    const stairPier = VIRTUAL_CHURCH_FOYER_STAIR_END_PIER
    const onStairEndPier = Math.abs(local.x - stairPier.centerX) < stairPier.halfWidth
      && Math.abs(local.z - stairPier.centerZ) < stairPier.halfDepth
    const onStairPlanter = VIRTUAL_CHURCH_FOYER_STAIR_PLANTERS.some(planter =>
      Math.hypot(local.x - planter.centerX, local.z - planter.centerZ) < planter.radius)
    const cabinet = VIRTUAL_CHURCH_FOYER_FAR_CABINET
    const onFarCabinet = Math.abs(local.x - cabinet.centerX) < cabinet.halfWidth
      && Math.abs(local.z - cabinet.centerZ) < cabinet.halfDepth
    if (onPartition || onWelcomeTable || onGuardRoom || behindRightBranchRooms || onUnbuiltStair || onStairEndPier || onStairPlanter || onFarCabinet) return true
  }
  if (
    (virtualChurchPointInsidePolygon(VIRTUAL_CHURCH_BUILDING_FOOTPRINT, x, z)
      && !virtualChurchPositionIsInsideWalkableFoyer(x, z, visualVersion))
    || virtualChurchPointInsidePolygon(
      VIRTUAL_CHURCH_AUXILIARY_BUILDING,
      x,
      z,
    )
    || VIRTUAL_CHURCH_SURROUNDING_BUILDINGS.some((building) => (
      virtualChurchPointInsidePolygon(building.footprint, x, z)
    ))
  ) {
    return true
  }
  return VIRTUAL_CHURCH_PLATFORMS.some(
    (platform) => (
      virtualChurchPointInsidePlatform(platform, x, z)
      && platform.top > feetY + VIRTUAL_CHURCH_STEP_TOLERANCE_METRES
    ),
  )
}

export const virtualChurchPositionIsWithinPlayerBounds = (
  position: VirtualChurchSourcePosition,
) => (
  position[0] >= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[0]
  && position[0] <= VIRTUAL_CHURCH_PLAYER_BOUNDS.x[1]
  && position[2] >= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[0]
  && position[2] <= VIRTUAL_CHURCH_PLAYER_BOUNDS.z[1]
)

export const virtualChurchPositionIsNearEntrance = (
  position: VirtualChurchSourcePosition,
  entrance: VirtualChurchSourcePosition,
) => Math.hypot(
  position[0] - entrance[0],
  position[1] - entrance[1],
  position[2] - entrance[2],
) < VIRTUAL_CHURCH_ENTRANCE_TRIGGER_RADIUS_METRES
