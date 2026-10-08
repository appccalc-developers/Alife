import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Matrix4, TorusGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type CulvertMouthPlacement = { position: readonly [number, number]; rotation: number }
type CulvertMaterialRole = 'precastConcrete' | 'concreteEdge' | 'pipeInterior'

/** The two road-crossing slabs share the V3 material response. Bake their
 * distinct colours into one batch, retaining the authored positions and UVs.
 * Both surfaces can receive the same roadside shadows as the asphalt slab.
 */
export function createVirtualChurchCulvertCrossingGeometry(asphaltColor: string, concreteColor: string): BufferGeometry {
  const slabs = [
    { size: [5.2, .11, 6.4], position: [0, -.06, 0], color: asphaltColor },
    { size: [5.25, .035, 1.25], position: [0, -.005, 1.75], color: concreteColor },
  ] as const
  const parts = slabs.map(({ size, position, color }) => {
    const geometry = new BoxGeometry(...size)
    geometry.translate(position[0], position[1], position[2])
    const tint = new Color(color)
    const values = new Float32Array(geometry.getAttribute('position').count * 3)
    for (let index = 0; index < values.length; index += 3) tint.toArray(values, index)
    geometry.setAttribute('color', new Float32BufferAttribute(values, 3))
    return geometry
  })
  try {
    const merged = mergeGeometries(parts, false)
    if (!merged) throw new Error('Incompatible culvert crossing geometry')
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    return merged
  } finally {
    parts.forEach(part => part.dispose())
  }
}

/** Preserve the authored inlet/outlet geometry and shadow settings. The two
 * originally .95/.98 matte precast finishes share one visually equivalent .97
 * finish so both small roadside mouths submit as one concrete batch; unlike a
 * per-vertex shader this adds no new GPU program on the mobile path.
 * Coordinates remain inside the caller's existing north/south mirrored group.
 * Returned geometry is instance-owned; no cached asset or texture is modified.
 */
export function createVirtualChurchCulvertBatches(mouths: readonly CulvertMouthPlacement[]) {
  if (!mouths.length) return []
  const groups: Array<{
    id: string; role: CulvertMaterialRole; roughness: number; castShadow: boolean; receiveShadow: boolean
    side: typeof FrontSide | typeof DoubleSide; parts: BufferGeometry[]
  }> = [
    { id: 'precast', role: 'precastConcrete', roughness: .97, castShadow: true, receiveShadow: true, side: FrontSide, parts: [] },
    { id: 'sill', role: 'concreteEdge', roughness: 1, castShadow: false, receiveShadow: true, side: FrontSide, parts: [] },
    { id: 'pipe', role: 'pipeInterior', roughness: .92, castShadow: false, receiveShadow: false, side: DoubleSide, parts: [] },
    { id: 'rim', role: 'concreteEdge', roughness: .94, castShadow: false, receiveShadow: false, side: FrontSide, parts: [] },
  ]
  const completed: Array<Omit<(typeof groups)[number], 'parts'> & { geometry: BufferGeometry }> = []
  try {
    for (const mouth of mouths) {
      const root = new Matrix4().makeRotationY(mouth.rotation)
      root.setPosition(mouth.position[0], -.11, mouth.position[1])
      const add = (group: number, geometry: BufferGeometry, position: [number, number, number], rotation?: Matrix4) => {
        const local = new Matrix4().makeTranslation(...position)
        if (rotation) local.multiply(rotation)
        geometry.applyMatrix4(root.clone().multiply(local))
        groups[group].parts.push(geometry)
      }
      for (const x of [-.86, .86]) add(0, new BoxGeometry(.58, .74, .3), [x, .28, 0])
      add(0, new BoxGeometry(2.3, .22, .3), [0, .61, 0])
      for (const side of [-1, 1]) {
        add(0, new BoxGeometry(1.05, .54, .22), [side * 1.35, .18, -.38], new Matrix4().makeRotationY(side * -.42))
      }
      add(1, new BoxGeometry(1.22, .16, .38), [0, -.005, .01])
      add(2, new CylinderGeometry(.51, .51, .24, 28), [0, .28, .22], new Matrix4().makeRotationX(Math.PI / 2))
      add(3, new TorusGeometry(.54, .075, 8, 28), [0, .28, .36])
    }
    for (const { parts, ...settings } of groups) {
      const geometry = mergeGeometries(parts, false)
      if (!geometry) throw new Error(`Incompatible culvert ${settings.id} geometry`)
      completed.push({ ...settings, geometry })
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }
    return completed
  } catch (error) {
    completed.forEach(({ geometry }) => geometry.dispose())
    throw error
  } finally {
    groups.forEach(({ parts }) => parts.forEach(part => part.dispose()))
  }
}
