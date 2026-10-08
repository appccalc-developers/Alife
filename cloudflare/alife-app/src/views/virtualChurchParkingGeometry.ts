import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Object3D, TorusGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Marking = {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
}

const mergeOwnedParts = (parts: BufferGeometry[]) => {
  try {
    const result = mergeGeometries(parts, false)
    if (!result) throw new Error('Incompatible parking geometry attributes')
    result.computeBoundingBox()
    result.computeBoundingSphere()
    return result
  } finally {
    parts.forEach((part) => part.dispose())
  }
}

/** Bake the existing body and circular caps, preserving every triangle and UV.
 * Static geometry costs a little more memory but needs one draw per colour.
 * The caller owns and disposes the returned geometry.
 */
export function createVirtualChurchRoundedMarkings(items: readonly Marking[]) {
  if (items.length === 0) return null
  const box = new BoxGeometry(1, 1, 1)
  const cap = new CylinderGeometry(0.5, 0.5, 1, 12)
  const root = new Object3D()
  const part = new Object3D()
  const matrix = new Matrix4()
  const parts: BufferGeometry[] = []
  try {
    for (const item of items) {
      root.position.set(...item.position)
      root.rotation.set(...(item.rotation ?? [0, 0, 0]))
      root.updateMatrix()
      const [x, y, z] = item.scale
      const alongX = x > z
      const width = Math.min(x, z)
      const length = Math.max(x, z)
      const bodyLength = Math.max(length - width, width * 0.02)
      const capOffset = Math.max(0, (length - width) / 2)
      part.position.set(0, 0, 0)
      part.scale.set(alongX ? bodyLength : width, y, alongX ? width : bodyLength)
      part.updateMatrix()
      parts.push(box.clone().applyMatrix4(matrix.multiplyMatrices(root.matrix, part.matrix)))
      for (const direction of [-1, 1]) {
        part.position.set(alongX ? direction * capOffset : 0, 0, alongX ? 0 : direction * capOffset)
        part.scale.set(width, y, width)
        part.updateMatrix()
        parts.push(cap.clone().applyMatrix4(matrix.multiplyMatrices(root.matrix, part.matrix)))
      }
    }
    return mergeOwnedParts(parts)
  } finally {
    box.dispose()
    cap.dispose()
  }
}

/** Merge equally lit parking markings while retaining each line's exact
 * linear-space material colour at every vertex. No UV or triangle changes. */
export function createVirtualChurchColoredRoundedMarkings(groups: readonly {
  items: readonly Marking[]
  color: string
}[]) {
  const parts: BufferGeometry[] = []
  try {
    for (const group of groups) {
      const geometry = createVirtualChurchRoundedMarkings(group.items)
      if (!geometry) continue
      const tint = new Color(group.color)
      const colors = new Float32Array(geometry.getAttribute('position').count * 3)
      for (let offset = 0; offset < colors.length; offset += 3) {
        colors[offset] = tint.r
        colors[offset + 1] = tint.g
        colors[offset + 2] = tint.b
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
      parts.push(geometry)
    }
    return parts.length ? mergeOwnedParts(parts) : null
  } catch (error) {
    parts.forEach((part) => part.dispose())
    throw error
  }
}

/** The V3 accessible pictograms are the same pavement paint/material as the
 * gold bay markings. Bake their existing instance transforms into that single
 * vertex-coloured surface; V2 keeps its separate symbols unchanged. */
export function createVirtualChurchColoredParkingMarkings(
  groups: readonly { items: readonly Marking[]; color: string }[],
  symbols: { positions: readonly (readonly [number, number])[]; angle: number; color: string },
) {
  const parts: BufferGeometry[] = []
  const symbol = symbols.positions.length ? createVirtualChurchAccessibleSymbol() : null
  try {
    const lines = createVirtualChurchColoredRoundedMarkings(groups)
    if (lines) parts.push(lines)
    if (symbol) {
      const tint = new Color(symbols.color)
      const root = new Object3D()
      const inner = new Object3D()
      inner.rotation.set(-Math.PI / 2, 0, 0)
      inner.updateMatrix()
      for (const [x, z] of symbols.positions) {
        root.position.set(x, .058, z)
        root.rotation.set(0, -symbols.angle, 0)
        root.scale.setScalar(.62)
        root.updateMatrix()
        const piece = symbol.clone().applyMatrix4(new Matrix4().multiplyMatrices(root.matrix, inner.matrix))
        const colors = new Float32Array(piece.getAttribute('position').count * 3)
        for (let offset = 0; offset < colors.length; offset += 3) {
          colors[offset] = tint.r
          colors[offset + 1] = tint.g
          colors[offset + 2] = tint.b
        }
        piece.setAttribute('color', new Float32BufferAttribute(colors, 3))
        parts.push(piece)
      }
    }
    return parts.length ? mergeOwnedParts(parts) : null
  } catch (error) {
    parts.forEach(part => part.dispose())
    throw error
  } finally {
    symbol?.dispose()
  }
}

/** The original wheelchair ring, head and two strokes in symbol-local space. */
export function createVirtualChurchAccessibleSymbol() {
  const stroke = (x: number, y: number, rotation: number, width: number, height: number) =>
    new BoxGeometry(1, 1, 1).scale(width, height, 0.025).rotateZ(rotation).translate(x, y, 0)
  return mergeOwnedParts([
    new TorusGeometry(0.42, 0.075, 8, 22, Math.PI * 1.7).translate(0, 0.52, 0),
    new CircleGeometry(0.13, 16).translate(-0.08, 1.08, 0),
    stroke(0.02, 0.85, -0.18, 0.12, 0.58),
    stroke(0.25, 0.72, Math.PI / 2, 0.11, 0.55),
  ])
}
