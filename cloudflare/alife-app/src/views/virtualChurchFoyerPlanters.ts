import { BufferGeometry, Color, Float32BufferAttribute, LatheGeometry, Object3D, PlaneGeometry, Vector2, type InstancedMesh } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type PlanterAnchor = Readonly<{ centerX: number; centerZ: number }>
export const FOYER_PLANTER_LEAVES_PER_POT = 18
export const FOYER_PLANTER_POT_HEIGHTS = [.66, .44] as const

/** Photos 04/07: modest grey cylindrical and grey-green square pots.
 * These are visual estimates, not measurements. The existing anchors and
 * collision footprints remain authoritative; both pots share one opaque draw. */
export function createVirtualChurchFoyerPlanterPotGeometry(anchors: readonly PlanterAnchor[], floorY: number) {
  const parts: BufferGeometry[] = []
  const add = (generated: BufferGeometry, pot: PlanterAnchor, colour: string, soil = false) => {
    const part = generated.index ? generated.toNonIndexed() : generated
    if (part !== generated) generated.dispose()
    parts.push(part)
    const position = part.getAttribute('position'), colours = new Float32Array(position.count * 3)
    const grey = new Color(colour), earth = new Color('#65584a')
    for (let vertex = 0; vertex < position.count; vertex++) {
      const radius = Math.hypot(position.getX(vertex), position.getZ(vertex))
      const rgb = soil && position.getY(vertex) > .61 && position.getY(vertex) < .625 && radius <= .245 ? earth : grey
      rgb.toArray(colours, vertex * 3)
    }
    part.setAttribute('color', new Float32BufferAttribute(colours, 3))
    part.translate(pot.centerX, floorY, pot.centerZ)
  }
  try {
    anchors.forEach((anchor, index) => {
      if (index === 0) {
        const profile = [
          new Vector2(0, 0), new Vector2(.20, 0), new Vector2(.23, .04), new Vector2(.27, .62),
          new Vector2(.28, .66), new Vector2(.25, .66), new Vector2(.242, .615), new Vector2(0, .615),
        ]
        const pot = new LatheGeometry(profile, 64)
        const positions = pot.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const row = vertex % profile.length
          if (row !== 2 && row !== 3) continue
          const x = positions.getX(vertex), z = positions.getZ(vertex), angle = Math.atan2(x, z)
          const radius = Math.hypot(x, z), fluted = radius + .004 * Math.cos(angle * 32)
          positions.setX(vertex, x * fluted / radius); positions.setZ(vertex, z * fluted / radius)
        }
        pot.computeVertexNormals()
        add(pot, anchor, '#929a96', true)
      } else {
        const pot = new RoundedBoxGeometry(.43, .44, .43, 1, .018)
        pot.translate(0, .22, 0)
        add(pot, anchor, '#59726c')
        const soil = new PlaneGeometry(.36, .36)
        soil.rotateX(-Math.PI / 2); soil.translate(0, .445, 0)
        add(soil, anchor, '#65584a')
      }
    })
    const result = parts.length ? mergeGeometries(parts, false) : null
    result?.computeBoundingBox(); result?.computeBoundingSphere()
    return result
  } finally { parts.forEach(part => part.dispose()) }
}

/** A shared folded strap leaf: narrow base, raised ridge, curved crown and
 * lowered tip. No alpha map, per-frame deformation, or borrowed geometry. */
export function createVirtualChurchFoyerPlanterLeafGeometry() {
  const rows = [
    [0, .005, 0], [.16, .015, .005], [.36, .028, .025],
    [.58, .038, .095], [.65, .030, .25], [.57, .017, .44], [.34, 0, .62],
  ] as const
  const positions: number[] = [], indices: number[] = []
  for (const [height, halfWidth, curve] of rows) {
    positions.push(-halfWidth, height, curve - .004, 0, height, curve + .007, halfWidth, height, curve - .004)
  }
  for (let row = 0; row < rows.length - 1; row++) {
    const start = row * 3, next = start + 3
    indices.push(start, next, start + 1, start + 1, next, next + 1)
    indices.push(start + 1, next + 1, start + 2, start + 2, next + 1, next + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export function writeVirtualChurchFoyerPlanterInstances(stems: InstancedMesh, leaves: InstancedMesh, anchors: readonly PlanterAnchor[], floorY: number) {
  const transform = new Object3D()
  anchors.forEach((pot, potIndex) => {
    const height = FOYER_PLANTER_POT_HEIGHTS[potIndex === 0 ? 0 : 1], stemHeight = potIndex === 0 ? .48 : .34
    transform.position.set(pot.centerX, floorY + height + stemHeight / 2, pot.centerZ)
    transform.rotation.set(0, 0, 0); transform.scale.set(1, stemHeight / .56, 1); transform.updateMatrix()
    stems.setMatrixAt(potIndex, transform.matrix)
    for (let leaf = 0; leaf < FOYER_PLANTER_LEAVES_PER_POT; leaf++) {
      const ring = Math.floor(leaf / 6), around = leaf % 6
      const angle = around * Math.PI / 3 + ring * .28 + potIndex * .19 + .06 * Math.sin(leaf * 2.1)
      const length = [.80, .67, .54][ring] * (around % 2 ? .91 : 1)
      const rootY = height + (potIndex === 0 ? .24 : .14) + ring * .07
      transform.position.set(pot.centerX, floorY + rootY, pot.centerZ)
      transform.rotation.set([.08, 0, -.24][ring], angle, 0, 'YXZ')
      transform.scale.set(length * (potIndex === 0 ? .65 : 1.45), length, length); transform.updateMatrix()
      const index = potIndex * FOYER_PLANTER_LEAVES_PER_POT + leaf
      leaves.setMatrixAt(index, transform.matrix)
      leaves.setColorAt(index, new Color(['#31583d', '#436c46', '#587e50'][(around + ring + potIndex) % 3]))
    }
  })
  for (const mesh of [stems, leaves]) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }
}
