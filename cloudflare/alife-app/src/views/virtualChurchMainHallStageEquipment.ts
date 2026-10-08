import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Quaternion, TorusGeometry, Vector2, Vector3, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Point = readonly [number, number, number]
// Retain the existing historical-review anchors, not a surveyed equipment list.
export const MAIN_HALL_STAGE_EQUIPMENT_ANCHORS = Object.freeze({
  drum: Object.freeze([0, .49, -8.45] as const),
  keyboard: Object.freeze([-3.3, .97, -8.55] as const),
  musicStandXs: Object.freeze([2.7, 4] as const),
  cymbalXs: Object.freeze([-1.05, 1.1] as const),
})

/** Original unbranded silhouettes informed by the distant 2017 stage photo.
 * No specific instrument brand/model, exact key count or current fit-out claim.
 * All parts replace the former props in two opaque draws. Caller owns/disposes
 * the returned buffers; construction temporaries are always released. */
export function createMainHallStageEquipmentGeometry(lowDetail = false) {
  const surfaces: BufferGeometry[] = []
  const hardware: BufferGeometry[] = []
  const radial = lowDetail ? 12 : 20
  const tubeRadial = lowDetail ? 6 : 8
  const up = new Vector3(0, 1, 0)
  const add = (target: BufferGeometry[], generated: BufferGeometry, color: string, position: Point, rotation: Point = [0, 0, 0]) => {
    const part = generated.index ? generated.toNonIndexed() : generated
    if (part !== generated) generated.dispose()
    target.push(part)
    part.rotateX(rotation[0]); part.rotateY(rotation[1]); part.rotateZ(rotation[2]); part.translate(...position)
    const rgb = new Color(color).toArray()
    const values = new Float32Array(part.getAttribute('position').count * 3)
    for (let i = 0; i < values.length; i++) values[i] = rgb[i % 3]
    part.setAttribute('color', new Float32BufferAttribute(values, 3))
  }
  const bar = (from: Point, to: Point, radius = .012, color = '#747d7b') => {
    const start = new Vector3(...from)
    const delta = new Vector3(...to).sub(start)
    const part = new CylinderGeometry(radius, radius, delta.length(), tubeRadial)
    part.applyQuaternion(new Quaternion().setFromUnitVectors(up, delta.clone().normalize()))
    const centre = start.addScaledVector(delta, .5)
    add(hardware, part, color, centre.toArray() as [number, number, number])
  }
  const tripod = (x: number, z: number, radius: number) => {
    for (let leg = 0; leg < 3; leg++) {
      const angle = leg * Math.PI * 2 / 3
      bar([x, .19, z], [x + Math.cos(angle) * radius, .016, z + Math.sin(angle) * radius], .011, '#535d5c')
    }
  }
  let mergedSurfaces: BufferGeometry | null = null
  let mergedHardware: BufferGeometry | null = null
  try {
    const [, y, z] = MAIN_HALL_STAGE_EQUIPMENT_ANCHORS.drum
    add(surfaces, new CylinderGeometry(.42, .42, .31, radial, 1, true), '#d0cec6', [0, y, z], [Math.PI / 2, 0, 0])
    for (const side of [-1, 1]) {
      const faceZ = z + side * .161
      add(surfaces, new CircleGeometry(.415, radial), side > 0 ? '#d8d6ca' : '#c3c3bc', [0, y, faceZ], [0, side < 0 ? Math.PI : 0, 0])
      add(hardware, new TorusGeometry(.423, .009, lowDetail ? 3 : 4, radial), '#aeb6b1', [0, y, faceZ])
    }
    add(surfaces, new CircleGeometry(.065, radial), '#32393a', [.15, y - .14, z + .163])
    for (const x of [-.32, .32]) {
      add(surfaces, new CylinderGeometry(.16, .17, .28, radial, 1, true), '#cfcdc5', [x, .96, -8.63])
      for (const side of [-1, 1]) {
        const headY = .96 + side * .141
        add(surfaces, new CircleGeometry(.165, radial), '#dce0d9', [x, headY, -8.63], [-side * Math.PI / 2, 0, 0])
        add(hardware, new TorusGeometry(.165, .006, lowDetail ? 3 : 4, radial), '#aeb6b1', [x, headY, -8.63], [Math.PI / 2, 0, 0])
      }
      bar([x, .82, -8.63], [x, 1.01, -8.63], .013)
      bar([0, .8, -8.63], [x, .88, -8.63], .013)
      bar([Math.sign(x) * .34, .38, z], [Math.sign(x) * .48, .016, z + .19])
    }
    for (const x of MAIN_HALL_STAGE_EQUIPMENT_ANCHORS.cymbalXs) {
      bar([x, .02, -8.55], [x, 1.69, -8.55], .012)
      tripod(x, -8.55, .28)
      add(hardware, new LatheGeometry([
        new Vector2(0, .04), new Vector2(.045, .04), new Vector2(.085, .015),
        new Vector2(.31, 0), new Vector2(.31, -.007), new Vector2(.09, .006),
        new Vector2(.055, .03), new Vector2(0, .03),
      ], radial), '#b5a176', [x, 1.65, -8.55], [0, 0, x < 0 ? -.065 : .065])
    }
    const [kx, ky, kz] = MAIN_HALL_STAGE_EQUIPMENT_ANCHORS.keyboard
    const body = new RoundedBoxGeometry(1, 1, 1, 1, .065)
    body.scale(1.5, .14, .38)
    add(surfaces, body, '#2e3436', [kx, ky, kz])
    // A readable generic key bed, not a claim about the historical keyboard.
    for (let key = 0; key < 35; key++) {
      const x = kx - .7 + (key + .5) * .04
      add(surfaces, new BoxGeometry(.0385, .018, .22), '#dce0da', [x, 1.045, kz + .055])
      if ([0, 1, 3, 4, 5].includes(key % 7)) add(surfaces, new BoxGeometry(.023, .019, .12), '#242a2c', [x + .02, 1.0635, kz])
    }
    for (const offset of [-.11, .11]) {
      bar([kx - .55, .035, kz + offset], [kx + .52, .895, kz + offset], .015, '#4d5757')
      bar([kx + .55, .035, kz + offset], [kx - .52, .895, kz + offset], .015, '#4d5757')
    }
    for (const offset of [-.55, .55]) bar([kx + offset, .018, kz - .25], [kx + offset, .018, kz + .25], .014, '#4d5757')
    for (const x of MAIN_HALL_STAGE_EQUIPMENT_ANCHORS.musicStandXs) {
      bar([x, .02, -8.2], [x, 1.38, -8.2], .014, '#4c5555')
      tripod(x, -8.2, .27)
      const tray = new RoundedBoxGeometry(1, 1, 1, 1, .06)
      tray.scale(.43, .31, .025)
      add(surfaces, tray, '#2e3436', [x, 1.33, -8.23], [-.13, 0, 0])
      add(surfaces, new BoxGeometry(.43, .022, .038), '#353d3e', [x, 1.175, -8.185], [-.13, 0, 0])
    }
    mergedSurfaces = mergeGeometries(surfaces, false)
    mergedHardware = mergeGeometries(hardware, false)
    if (!mergedSurfaces || !mergedHardware) throw new Error('Unable to assemble main-hall stage equipment')
    for (const geometry of [mergedSurfaces, mergedHardware]) { geometry.computeBoundingBox(); geometry.computeBoundingSphere() }
    return { surfaces: mergedSurfaces, hardware: mergedHardware }
  } catch (error) {
    mergedSurfaces?.dispose(); mergedHardware?.dispose()
    throw error
  } finally {
    for (const part of [...surfaces, ...hardware]) part.dispose()
  }
}
