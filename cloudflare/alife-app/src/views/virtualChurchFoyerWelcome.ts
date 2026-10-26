import { BoxGeometry, BufferGeometry, Color, Euler, Float32BufferAttribute, LatheGeometry, QuadraticBezierCurve3, Quaternion, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type FoyerWelcomePart = Readonly<{
  position: readonly [number, number, number]
  scale: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  color?: string
  shape?: 'rounded' | 'vase' | 'stem' | 'petal' | 'leaf'
}>

const stemCurve = new QuadraticBezierCurve3(new Vector3(0, -.5, 0), new Vector3(.22, .15, .08), new Vector3(-.24, .5, .12))

/** Photo 09 supports a small pale arrangement, not a particular species or
 * printed message. Preserve the existing vase anchor and table footprint. */
export function createVirtualChurchFoyerWelcomeArrangement(table: Readonly<{ x: number; z: number }>, topY: number): FoyerWelcomePart[] {
  const vaseX = table.x + .55, vaseZ = table.z - .16
  const parts: FoyerWelcomePart[] = [{ position: [vaseX, topY + .1275, vaseZ], scale: [.12, .19, .12], color: '#d6d2c6', shape: 'vase' }]
  for (let stem = 0; stem < 3; stem++) {
    const height = .34 + stem * .07, width = .15 + stem * .025
    const x = vaseX + [-.024, .016, .037][stem], y = topY + .1775 + height / 2, z = vaseZ + (stem - 1) * .014
    parts.push({ position: [x, y, z], scale: [width, height, .10], color: '#4d6950', shape: 'stem' })
    const at = (t: number) => {
      const p = stemCurve.getPoint(t)
      return [x + p.x * width, y + p.y * height, z + p.z * .10] as const
    }
    for (const t of [.24, .47]) {
      const p = at(t)
      parts.push({ position: [p[0] + .025, p[1], p[2]], scale: [.095, .012, .039], rotation: [.15, stem * .7, -.3], color: '#526e4f', shape: 'leaf' })
    }
    for (const [bloom, t] of [.65, .84, 1].entries()) {
      const p = at(t), bloomX = p[0] + (bloom % 2 ? .025 : -.020)
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 2 / 5 + stem * .32
        parts.push({ position: [bloomX + .022 * Math.cos(angle), p[1] + .01 + .022 * Math.sin(angle), p[2]],
          scale: [.057, .033, .014], rotation: [.10, stem * .20, angle], color: '#e9e3d3', shape: 'petal' })
      }
      parts.push({ position: [bloomX, p[1] + .010, p[2] - .009], scale: [.018, .018, .013], color: '#c6b68d', shape: 'petal' })
    }
  }
  return parts
}

/** All existing box woodwork and curved welcome details share the original
 * single opaque batch. Transforms/colours of unrelated box parts stay intact.
 * Only generated buffers are owned; input data and shared source assets are not. */
export function createVirtualChurchFoyerWoodworkGeometry(items: readonly FoyerWelcomePart[]): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  try {
    for (const item of items) {
      const generated = item.shape === 'rounded' ? new RoundedBoxGeometry(1, 1, 1, 1, .04)
        : item.shape === 'vase' ? new LatheGeometry([
          new Vector2(0, -.5), new Vector2(.31, -.5), new Vector2(.37, -.43), new Vector2(.45, .44),
          new Vector2(.46, .5), new Vector2(.39, .5), new Vector2(.34, -.34), new Vector2(0, -.34),
        ], 12)
          : item.shape === 'stem' ? new TubeGeometry(stemCurve, 6, .019, 4, false)
            : item.shape === 'petal' || item.shape === 'leaf' ? new SphereGeometry(.5, 6, 3)
              : new BoxGeometry(1, 1, 1)
      const part = generated.index ? generated.toNonIndexed() : generated
      if (part !== generated) generated.dispose()
      parts.push(part)
      part.scale(...item.scale)
      if (item.rotation) part.applyQuaternion(new Quaternion().setFromEuler(new Euler(...item.rotation)))
      part.translate(...item.position)
      const rgb = new Color(item.color ?? '#ffffff').toArray(), colors = new Float32Array(part.getAttribute('position').count * 3)
      for (let i = 0; i < colors.length; i++) colors[i] = rgb[i % 3]
      part.setAttribute('color', new Float32BufferAttribute(colors, 3))
    }
    const result = parts.length ? mergeGeometries(parts, false) : null
    result?.computeBoundingBox(); result?.computeBoundingSphere()
    return result
  } finally { parts.forEach(part => part.dispose()) }
}
