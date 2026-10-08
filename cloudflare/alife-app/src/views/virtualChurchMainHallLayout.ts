// Photo-informed 2017 review candidate, not a surveyed or current floor plan.
// Alloyfold documents 360 chairs in this church's main auditorium. The exact
// row/block arrangement below is deliberately isolated until site validation.
export const MAIN_HALL_REFERENCE = {
  source: 'https://www.alloyfold.co.nz/portfolio/abundant-life-church/',
  year: 2017,
  suppliedChairs: 360,
} as const

// The supplier's current Church Chair specification is a dimensional guide
// for the photographed model, not proof of the exact 2017 batch dimensions.
export const MAIN_HALL_CHAIR_REFERENCE = {
  source: 'https://www.alloyfold.co.nz/seating/church-chair/',
  height: .88,
  width: .545,
  depth: .63,
  seatHeight: .475,
} as const

const seatThickness = .12
const backBottom = MAIN_HALL_CHAIR_REFERENCE.seatHeight + .015
const legHeight = MAIN_HALL_CHAIR_REFERENCE.seatHeight - .07
export const MAIN_HALL_CHAIR_PARTS = {
  seat: { y: MAIN_HALL_CHAIR_REFERENCE.seatHeight - seatThickness / 2, z: -.015, width: .52, height: seatThickness, depth: .54 },
  back: { y: (MAIN_HALL_CHAIR_REFERENCE.height + backBottom) / 2, z: .28, width: .5, height: MAIN_HALL_CHAIR_REFERENCE.height - backBottom, depth: .11 },
  // Retain the established walk-clearance envelope, not separate render parts.
  lowerBack: { y: MAIN_HALL_CHAIR_REFERENCE.seatHeight + .06, z: .28, width: .46, height: .09, depth: .085 },
  leg: { y: legHeight / 2, height: legHeight, xOffsets: [-.25, .25], zOffsets: [-.24, .25] },
  sideFrame: { y: .65, z: .28, height: .34, xOffsets: [-.265, .265] },
  rowLink: { y: .48, z: .28, height: .022, depth: .025 },
} as const

export const MAIN_HALL_DIMENSIONS = {
  width: 23.2,
  depth: 22,
  height: 6.55,
  stageZ: -8.25,
  stageWidth: 18.2,
  stageDepth: 3.5,
  stageHeight: .43,
} as const

// In the 2017 seating gallery the rear wall has a pale square acoustic field
// between darker vertical timber bands. Width and cell pitch are estimates;
// this is not a claim about the current fit-out.
export const MAIN_HALL_REAR_ACOUSTIC_FIELD = {
  halfWidth: 4.4,
  cellsPerMeter: 4.1,
} as const

// Photo 6 shows a bright recessed stage centre, pale returns and deep side
// wings. These proportions are visual estimates for the 2017 review only.
export const MAIN_HALL_STAGE_RECESS = {
  width: 10.2,
  bottomY: MAIN_HALL_DIMENSIONS.stageHeight,
  height: 4.86,
  faceZ: -10.72,
  sidePierWidth: .48,
  revealWidth: .055,
  wingX: 9.12,
  wingWidth: .92,
} as const

// Photo 6 shows two shallow stage approaches with slim metal handrails. These
// positions are visual estimates within the 2017-only auditorium candidate.
export const MAIN_HALL_STAGE_ACCESS = {
  stairCentersX: [-7.65, 7.65],
  stepCenterZ: -5.96,
  railOffsetX: .55,
  railFrontZ: -5.68,
  railBackZ: -6.48,
  railFrontTopY: .91,
  railBackTopY: 1.25,
} as const

// In the 2017 gallery, the longer rear glazing appears on the viewer's right
// when looking from the stage (world -X). The shorter low window is on the
// opposite wall beside the stage. Positions remain visual estimates, not
// surveyed openings or a claim about the present-day auditorium.
export const MAIN_HALL_SIDE_WINDOW_BAYS = [
  { side: -1, centerZ: 5.55, length: 4.8, bottomY: 1.83, topY: 3.05, panes: 6 },
  { side: 1, centerZ: -8.5, length: 3.5, bottomY: 1.78, topY: 2.79, panes: 4 },
] as const

// Photo 6 shows a low door on each side of the stage, facing the audience.
// These are visual-only 2017 references; their destinations and present-day
// configuration are unknown. Keep them out of the walkable rear-door route.
export const MAIN_HALL_STAGE_FRONT_DOORS = [-10.25, 10.25].map(centerX => ({
  centerX,
  faceZ: -10.78,
  width: 1.5,
  bottomY: .08,
  topY: 2.48,
  panes: 2,
}))

export type MainHallChair = {
  x: number
  z: number
  yaw: number
  block: number
  row: number
  column: number
}

const blockCenters = [-6.25, 0, 6.25] as const
export const MAIN_HALL_CHAIRS: MainHallChair[] = blockCenters.flatMap((center, block) =>
  Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 10 }, (_, column) => ({
      x: center + (column - 4.5) * .56,
      z: 6.65 - row * .94,
      yaw: block === 0 ? -.025 : block === 2 ? .025 : 0,
      block,
      row,
      column,
    })),
  ).flat(),
)

// The photographed chairs are separate upholstered seats linked within each
// row, not a continuous pew. Never bridge the two walkable aisles.
export const MAIN_HALL_CHAIR_ROW_LINKS = MAIN_HALL_CHAIRS.flatMap((chair, index) => {
  if (chair.column === 9) return []
  const next = MAIN_HALL_CHAIRS[index + 1]
  return [{ block: chair.block, row: chair.row, x: (chair.x + next.x) / 2, z: chair.z, width: next.x - chair.x - .48 }]
})

export const MAIN_HALL_CAMERA = {
  // Photo 6 reads from normal standing eye height behind the central block,
  // not from an elevated room overview. Keep both aisles and the rear clearance.
  // This framing is a visual candidate, not a recovered camera calibration.
  entrance: { position: [0, 1.8, 10.05], target: [0, 1.8, -8.0], fov: 55 },
  stage: { position: [0, 2.12, -7.8], target: [0, 1.42, 4.4], fov: 64 },
} as const

export type MainHallCameraView = keyof typeof MAIN_HALL_CAMERA
