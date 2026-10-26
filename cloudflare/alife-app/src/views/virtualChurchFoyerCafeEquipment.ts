import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type FoyerCafeEquipmentPart = Readonly<{
  position: readonly [number, number, number]
  scale: readonly [number, number, number]
  color?: string
  shape?: 'rounded' | 'grinder' | 'hopper' | 'cup'
}>

/** Photo 08's unbranded appliance silhouettes. Preserve the frontage's existing
 * anchors and bounds; all opaque parts share one draw, with no new maps/lights.
 * The caller owns the returned geometry, never the input configuration. */
export function createVirtualChurchFoyerCafeEquipmentGeometry(items: readonly FoyerCafeEquipmentPart[]): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  try {
    for (const item of items) {
      const generated = item.shape === 'cup'
        ? new LatheGeometry([
          new Vector2(0, -.5), new Vector2(.32, -.5), new Vector2(.41, -.43),
          new Vector2(.5, .48), new Vector2(.46, .5), new Vector2(.42, .43),
          new Vector2(.34, -.36), new Vector2(0, -.36),
        ], 12)
        : item.shape === 'grinder' ? new CylinderGeometry(.45, .48, 1, 12)
          : item.shape === 'hopper' ? new CylinderGeometry(.5, .34, 1, 12)
            : item.shape === 'rounded' ? new RoundedBoxGeometry(1, 1, 1, 1, .04)
              : new BoxGeometry(1, 1, 1)
      const part = generated.index ? generated.toNonIndexed() : generated
      if (part !== generated) generated.dispose()
      parts.push(part)
      part.scale(...item.scale); part.translate(...item.position)
      const rgb = new Color(item.color ?? '#3a4140').toArray()
      const colors = new Float32Array(part.getAttribute('position').count * 3)
      for (let i = 0; i < colors.length; i++) colors[i] = rgb[i % 3]
      part.setAttribute('color', new Float32BufferAttribute(colors, 3))
    }
    const result = parts.length ? mergeGeometries(parts, false) : null
    result?.computeBoundingBox(); result?.computeBoundingSphere()
    return result
  } finally {
    parts.forEach(part => part.dispose())
  }
}
