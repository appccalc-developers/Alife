import { BufferGeometry, Float32BufferAttribute, Matrix4, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type RockSource = {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  matrix: Matrix4
}

// The nature GLBs split each rock into separate dirt and grass meshes. In V3
// Low those surfaces use the same PBR settings, differing only in tint. Bake
// that tint per vertex so both surfaces remain visible in a single draw call.
export function mergeVirtualChurchRockSources(sources: RockSource[]) {
  if (sources.length < 2) return null
  const first = sources[0].material
  if (sources.some(({ geometry, material }) =>
    geometry.hasAttribute('color')
    || material.opacity !== first.opacity
    || !material.emissive.equals(first.emissive)
    || material.transparent !== first.transparent
    || material.side !== first.side
    || material.roughness !== first.roughness
    || material.metalness !== first.metalness
    || material.envMapIntensity !== first.envMapIntensity
    || material.map !== first.map
    || material.normalMap !== first.normalMap
    || material.aoMap !== first.aoMap
    || material.roughnessMap !== first.roughnessMap
    || material.metalnessMap !== first.metalnessMap
    || material.emissiveMap !== first.emissiveMap
    || material.alphaMap !== first.alphaMap
  )) return null

  const pieces = sources.map(({ geometry, material, matrix }) => {
    const piece = geometry.clone()
    piece.applyMatrix4(matrix)
    const colors = new Float32Array(piece.getAttribute('position').count * 3)
    for (let index = 0; index < colors.length; index += 3) {
      colors[index] = material.color.r
      colors[index + 1] = material.color.g
      colors[index + 2] = material.color.b
    }
    piece.setAttribute('color', new Float32BufferAttribute(colors, 3))
    piece.clearGroups()
    return piece
  })
  const geometry = mergeGeometries(pieces, false)
  pieces.forEach(piece => piece.dispose())
  if (!geometry) return null
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const material = first.clone()
  material.color.set('#ffffff')
  material.vertexColors = true
  material.name = 'v3-low-rock-vertex-colors'
  return { geometry, material, matrix: new Matrix4() }
}
