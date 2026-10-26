import { Color, Float32BufferAttribute, Shape, ShapeGeometry, type BufferGeometry, type ColorRepresentation } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type VirtualChurchGroundPoint = readonly [number, number]
export type VirtualChurchGroundPolygon = readonly VirtualChurchGroundPoint[]

/**
 * Batches horizontal polygons that share one material. The points use
 * the scene's existing [x, z] convention; the mesh rotation is still applied
 * by the caller so positions, normals and UVs remain identical to the former
 * individual ShapeGeometry meshes. Optional elevation offsets are applied on
 * local Z (world Y after that rotation), leaving the original UVs untouched.
 *
 * The caller owns and disposes the returned geometry.
 */
export function createVirtualChurchGroundPolygonGeometry(
  polygons: readonly VirtualChurchGroundPolygon[],
  tints?: readonly ColorRepresentation[],
  elevationOffsets?: readonly number[],
): BufferGeometry | null {
  if (tints && tints.length !== polygons.length) throw new Error('Ground polygon tint count must match polygon count')
  if (elevationOffsets && (elevationOffsets.length !== polygons.length || elevationOffsets.some(y => !Number.isFinite(y)))) {
    throw new Error('Ground polygon elevations must be finite and match polygon count')
  }
  if (polygons.length === 0) return null

  const parts = polygons.map((points, index) => {
    const shape = new Shape()
    points.forEach(([x, z], vertex) => vertex === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z))
    shape.closePath()
    const part = new ShapeGeometry(shape)
    if (elevationOffsets) part.translate(0, 0, elevationOffsets[index])
    if (tints) {
      const tint = new Color(tints[index])
      const values = new Float32Array(part.getAttribute('position').count * 3)
      for (let i = 0; i < values.length; i += 3) tint.toArray(values, i)
      part.setAttribute('color', new Float32BufferAttribute(values, 3))
    }
    return part
  })

  try {
    const geometry = mergeGeometries(parts, false)
    if (!geometry) throw new Error('Incompatible ground polygon geometry attributes')
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  } finally {
    parts.forEach((part) => part.dispose())
  }
}
