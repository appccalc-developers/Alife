import { BufferGeometry, Float32BufferAttribute } from 'three'

// Original unit slat with a small flat chamfer, not a measured timber profile.
// Eight vertical faces and two caps: 28 triangles instead of a box's 12.
// Both established slat batches retain their existing transforms and UV grain.
export function createMainHallTimberGeometry() {
  const section = [
    [-.42, -.5], [.42, -.5], [.5, -.42], [.5, .42],
    [.42, .5], [-.42, .5], [-.5, .42], [-.5, -.42],
  ] as const
  const vertices: number[] = [], uvs: number[] = []
  const triangle = (points: number[][], texture: number[][]) => {
    points.forEach((point, index) => { vertices.push(...point); uvs.push(...texture[index]) })
  }
  section.forEach(([x, z], index) => {
    const [nextX, nextZ] = section[(index + 1) % section.length]
    const bottom = [x, -.5, z], top = [x, .5, z]
    const nextBottom = [nextX, -.5, nextZ], nextTop = [nextX, .5, nextZ]
    // Flat side normals preserve the thin highlight on each physical chamfer.
    triangle([bottom, top, nextTop], [[0, 0], [0, 1], [1, 1]])
    triangle([bottom, nextTop, nextBottom], [[0, 0], [1, 1], [1, 0]])
  })
  for (let index = 1; index < section.length - 1; index++) {
    for (const y of [-.5, .5]) {
      const points = y < 0 ? [section[0], section[index], section[index + 1]] : [section[0], section[index + 1], section[index]]
      triangle(points.map(([x, z]) => [x, y, z]), points.map(([x, z]) => [x + .5, z + .5]))
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
