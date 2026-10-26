import { MAIN_HALL_DIMENSIONS } from './virtualChurchMainHallLayout.ts'

type LightingPlacement = { position: [number, number, number]; scale: [number, number, number] }

// Gallery photos 1 and 6 distinguish the longitudinal ceiling channels from
// the three short stage-light banks. Coordinates are visual estimates, not a
// surveyed 2017 rig or a statement about the present-day installation.
export const MAIN_HALL_STAGE_RIG = Object.freeze({
  centersX: Object.freeze([-6.4, 0, 6.4]),
  centerZ: -7.2,
  width: 5.3,
  depth: 1.1,
  y: MAIN_HALL_DIMENSIONS.height - .42,
  channelXs: Object.freeze([-5.75, 5.75]),
})

const rig = MAIN_HALL_STAGE_RIG
export const MAIN_HALL_LIGHTING_TRACKS: LightingPlacement[] = [
  ...rig.channelXs.map((x): LightingPlacement => ({
    position: [x, MAIN_HALL_DIMENSIONS.height - .025, 0],
    scale: [.09, .04, MAIN_HALL_DIMENSIONS.depth - .2],
  })),
  ...rig.centersX.flatMap(centerX => [
    ...[-1, 1].map((side): LightingPlacement => ({
      position: [centerX, rig.y, rig.centerZ + side * rig.depth / 2],
      scale: [rig.width, .034, .034],
    })),
    ...[-1, 1].map((side): LightingPlacement => ({
      position: [centerX + side * rig.width / 2, rig.y, rig.centerZ],
      scale: [.034, .034, rig.depth],
    })),
    ...[-1, 1].flatMap(side => [-1, 1].map((end): LightingPlacement => ({
      position: [centerX + side * rig.width / 2, (rig.y + MAIN_HALL_DIMENSIONS.height) / 2,
        rig.centerZ + end * rig.depth / 2],
      scale: [.018, MAIN_HALL_DIMENSIONS.height - rig.y, .018],
    }))),
  ]),
]
// Reuse the existing 21 housings and one instanced batch. They depict equipment
// only: no extra lights, emissive lenses, live animation or shadow casters.
export const MAIN_HALL_LIGHTING_HEADS: LightingPlacement[] = rig.centersX.flatMap(centerX =>
  Array.from({ length: 7 }, (_, index) => ({
    position: [centerX + (index - 3) * .75, rig.y - .14, rig.centerZ + rig.depth / 2] as [number, number, number],
    scale: [.16, .25, .16] as [number, number, number],
  })),
)

// One bounded directional map, not additional lights or screen-space effects.
// Artistic review settings, not measured auditorium photometry.
// Reuse the existing hemisphere for pale daylight above and warm floor bounce
// below. Keep its fill subordinate to the stage-window key: a stronger uniform
// fill erased the photographed chair backs and acoustic-wall depth. This is
// art direction, not simulated hall GI or measured illuminance.
export const MAIN_HALL_FILL_RESPONSE = Object.freeze({
  ambientIntensity: .14,
  hemisphereIntensity: 1.35,
  skyColor: '#f5f7fa',
  groundColor: '#bbb19d',
})

export const MAIN_HALL_SHADOW = Object.freeze({
  camera: Object.freeze({ left: -18, right: 18, top: 10, bottom: -5, near: .5, far: 45 }),
  bias: -.00012, normalBias: .025, intensity: .7,
})
export const mainHallShadowMapSize = (lowDetail: boolean) => lowDetail ? 512 : 1024
