import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Object3D, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Fixture = {
  position: readonly [number, number, number]
  scale: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  color?: string
}

// Photo 10: the woven shades are slender spindles rather than round cages.
// Keep the photographed high-foyer fixtures clear of the temporary flags.
export const VIRTUAL_CHURCH_FOYER_PENDANT_SHADE = {
  height: 1.42,
  tipRadius: .045,
  maxRadius: .25,
} as const

export function virtualChurchFoyerPendantRadius(t: number) {
  const { tipRadius, maxRadius } = VIRTUAL_CHURCH_FOYER_PENDANT_SHADE
  return tipRadius + (maxRadius - tipRadius) * Math.sin(Math.PI * t)
}

// Continuous flat wicker, not faceted straight bars. This is a photo-guided
// approximation, not a manufacturer's model. Both families stay open so the
// bright ceiling can be seen through the diamond lattice in photos 06/10.
export const VIRTUAL_CHURCH_FOYER_WICKER = {
  strands: 10, sections: 24, width: .017, weaveDepth: .0025,
  topY: 5.16, color: '#b39b79', cordColor: '#dfd4bd',
} as const

/** One owned, static vertex-colour batch for four shades and their cords.
 * Smooth strip normals retain curved highlights without textures, shadows,
 * extra materials, per-frame updates or a draw for every strand. The caller
 * must use DoubleSide for the open ribbons and dispose the returned geometry.
 */
export function createVirtualChurchFoyerWickerGeometry(
  centerX: number, centersZ: readonly number[], cords: readonly Fixture[],
): BufferGeometry | null {
  if (!centersZ.length && !cords.length) return null
  const wicker = VIRTUAL_CHURCH_FOYER_WICKER
  const parts: BufferGeometry[] = []
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  const surfaceNormal = new Vector3(), tangent = new Vector3(), across = new Vector3()
  for (const z of centersZ) for (const direction of [-1, 1]) for (let strand = 0; strand < wicker.strands; strand++) {
    const start = positions.length / 3
    for (let step = 0; step <= wicker.sections; step++) {
      const t = step / wicker.sections
      const angleRate = direction * Math.PI * 1.2
      const angle = 2 * Math.PI * strand / wicker.strands + angleRate * t
      // Opposite families sit on opposite sides at a crossing, avoiding
      // coplanar z-fighting while retaining the same photographed silhouette.
      const radius = virtualChurchFoyerPendantRadius(t) + direction * wicker.weaveDepth * Math.cos(wicker.strands * angle)
      const radiusRate = (VIRTUAL_CHURCH_FOYER_PENDANT_SHADE.maxRadius - VIRTUAL_CHURCH_FOYER_PENDANT_SHADE.tipRadius) * Math.PI * Math.cos(Math.PI * t)
        - direction * wicker.weaveDepth * wicker.strands * angleRate * Math.sin(wicker.strands * angle)
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const y = wicker.topY - t * VIRTUAL_CHURCH_FOYER_PENDANT_SHADE.height
      surfaceNormal.set(cos, radiusRate / VIRTUAL_CHURCH_FOYER_PENDANT_SHADE.height, sin).normalize()
      tangent.set(radiusRate * cos - radius * sin * angleRate, -VIRTUAL_CHURCH_FOYER_PENDANT_SHADE.height,
        radiusRate * sin + radius * cos * angleRate).normalize()
      across.crossVectors(surfaceNormal, tangent).normalize().multiplyScalar(wicker.width / 2)
      for (const side of [-1, 1]) {
        positions.push(centerX + radius * cos + side * across.x, y + side * across.y, z + radius * sin + side * across.z)
        normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z)
        uvs.push((side + 1) / 2, t)
      }
      if (step < wicker.sections) {
        const a = start + step * 2
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
  }
  if (positions.length) {
    const ribbons = new BufferGeometry()
    ribbons.setAttribute('position', new Float32BufferAttribute(positions, 3))
    ribbons.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    ribbons.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    ribbons.setIndex(indices)
    const rgb = new Color(wicker.color).toArray(), colors = positions.map((_, i) => rgb[i % 3])
    ribbons.setAttribute('color', new Float32BufferAttribute(colors, 3))
    parts.push(ribbons)
  }
  const transform = new Object3D(), cordRgb = new Color(wicker.cordColor).toArray()
  for (const cord of cords) {
    const part = new CylinderGeometry(.5, .5, 1, 8)
    transform.position.set(...cord.position)
    transform.rotation.set(...(cord.rotation ?? [0, 0, 0]))
    transform.scale.set(...cord.scale)
    transform.updateMatrix(); part.applyMatrix4(transform.matrix)
    part.setAttribute('color', new Float32BufferAttribute(
      Array.from({ length: part.getAttribute('position').count * 3 }, (_, i) => cordRgb[i % 3]), 3))
    parts.push(part)
  }
  const geometry = mergeGeometries(parts, false)
  parts.forEach(part => part.dispose())
  geometry?.computeBoundingBox(); geometry?.computeBoundingSphere()
  return geometry
}

/** Preserve the photographed round corridor spots and the high-foyer strips
 * while drawing their static, unshadowed Basic-material surfaces in one batch.
 * The returned geometry belongs to the caller; the input arrays are untouched.
 */
export function createVirtualChurchFoyerLuminaireGeometry(
  downlights: readonly Fixture[],
  lightPanels: readonly Fixture[],
): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  const transform = new Object3D()
  for (const [items, round] of [
    [downlights, true],
    [lightPanels, false],
  ] as [readonly Fixture[], boolean][]) for (const item of items) {
    const part = round ? new CylinderGeometry(.5, .5, 1, 12) : new BoxGeometry(1, 1, 1)
    transform.position.set(...item.position)
    transform.rotation.set(...(item.rotation ?? [0, 0, 0]))
    transform.scale.set(...item.scale)
    transform.updateMatrix()
    part.applyMatrix4(transform.matrix)
    const rgb = new Color(item.color ?? (round ? '#fff3d8' : '#ffffff')).toArray()
    const vertexColors = new Float32Array(part.getAttribute('position').count * 3)
    for (let index = 0; index < vertexColors.length; index++) vertexColors[index] = rgb[index % 3]
    part.setAttribute('color', new Float32BufferAttribute(vertexColors, 3))
    parts.push(part)
  }
  const merged = parts.length ? mergeGeometries(parts, false) : null
  parts.forEach(part => part.dispose())
  return merged
}
