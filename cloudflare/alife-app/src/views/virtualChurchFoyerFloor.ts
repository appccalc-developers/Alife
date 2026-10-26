import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { VIRTUAL_CHURCH_WALKABLE_FOYER } from './virtualChurchInteractionContract.ts'
import { VIRTUAL_CHURCH_FOYER_CIRCULATION } from './virtualChurchInteractionContract.ts'

// Photos 01/02/06/09 show narrow staggered oak boards in both the entrance
// and the side corridors. Dimensions are visual estimates, not a floor survey.
export const VIRTUAL_CHURCH_FOYER_FLOOR = {
  minX: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.minX - .18,
  maxX: VIRTUAL_CHURCH_WALKABLE_FOYER.interior.maxX + .2,
  minZ: -.52, maxZ: 13.4,
  baseY: .094, boardY: .095,
  boardWidth: .28, boardLength: 1.4, gap: .001,
} as const
const PHOTO_FLOOR_END_Z = 6.4

// Photos 06/09 show the floor gradually catching more daylight toward the
// courtyard glazing. This is an exposure cue, not a surveyed light position.
export const VIRTUAL_CHURCH_FOYER_OAK_DAYLIGHT = {
  startZ: 5.3,
  endZ: 12.8,
  near: [.42, .35, .31] as const,
  far: [.82, .74, .66] as const,
  // Photo 01 receives a broad wash of courtyard daylight. Its pale oak is
  // noticeably brighter than the double-height entrance floor, even though
  // the boards share one texture and draw batch.
  sideCorridor: [1.55, 1.36, 1.18] as const,
} as const

export function virtualChurchFoyerOakTintAt(z: number, sideCorridor: boolean): [number, number, number] {
  const light = VIRTUAL_CHURCH_FOYER_OAK_DAYLIGHT
  if (sideCorridor) return [...light.sideCorridor]
  const daylight = Math.max(0, Math.min(1, (z - light.startZ) / (light.endZ - light.startZ)))
  return light.near.map((value, index) => value + (light.far[index] - value) * daylight) as [number, number, number]
}

/** A thin opaque surface above the authored .09 m floor hides its coarse LOD
 * seams. Cached GLB meshes, UVs, material and textures are never mutated.
 * No texture is generated or fetched; UVs stay inside the existing cedar tile.
 */
export function createVirtualChurchFoyerFloorGeometry() {
  const floor = VIRTUAL_CHURCH_FOYER_FLOOR
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = []
  const quad = (x0: number, x1: number, z0: number, z1: number, y: number, tone: number, sample: number) => {
    // GLTF V is image-down: cedar occupies the atlas's upper-left quadrant.
    // Stay inside one similarly toned board in the atlas. Cycling across all
    // eight painted boards made the photographed oak floor read as a checker.
    // The atlas board has a dark painted edge near U=.300; keep the crop
    // well inside its face so that edge is not repeated on every plank.
    const u0 = .312 + (sample % 3) * .001
    const u1 = u0 + .025
    const v0 = .018 + Math.floor(sample / 2) * .038
    const v1 = v0 + .33
    const vertices = [[x0, z0, u0, v0], [x0, z1, u0, v1],
      [x1, z1, u1, v1], [x1, z0, u1, v0]]
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, z, u, v] = vertices[i]
      positions.push(x, y, z); normals.push(0, 1, 0); uvs.push(u, v)
      colors.push(tone, tone, tone)
    }
  }
  quad(floor.minX, floor.maxX, floor.minZ, floor.maxZ, floor.baseY, .88, 0)
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  quad(route.branchLeftX, floor.minX, route.leftBranchOpeningStartZ, floor.maxZ, floor.baseY, .88, 0)
  quad(floor.maxX, route.branchRightX, route.branchOpeningStartZ, floor.maxZ, floor.baseY, .88, 0)
  const boards = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const columns = Math.ceil((maxX - minX) / floor.boardWidth)
    for (let column = 0; column < columns; column++) {
      const x0 = minX + column * floor.boardWidth
      const x1 = Math.min(maxX, x0 + floor.boardWidth)
      // Offsets run along the boards, not across their width like brick courses.
      const stagger = (column % 3) / 3 * floor.boardLength
      let row = 0
      for (let z = minZ - stagger; z < maxZ; z += floor.boardLength) {
        const z0 = Math.max(minZ, z), z1 = Math.min(maxZ, z + floor.boardLength)
        if (x1 - x0 <= floor.gap || z1 - z0 <= floor.gap) continue
        const variation = (column * 17 + row * 13) % 11
        // The atlas already has real grain variation; strong per-board vertex
        // tones made the photographed continuous floor read as square tiles.
        quad(x0 + floor.gap / 2, x1 - floor.gap / 2, z0 + floor.gap / 2, z1 - floor.gap / 2,
          floor.boardY, .94 + variation * .0015, variation % 8)
        row++
      }
    }
  }
  boards(floor.minX, floor.maxX, floor.minZ, PHOTO_FLOOR_END_Z)
  // Use the same narrow plank cadence through the V3 circulation candidate;
  // the earlier three-board-wide strips read as dark outdoor decking indoors.
  boards(floor.minX, floor.maxX, PHOTO_FLOOR_END_Z, floor.maxZ)
  boards(route.branchLeftX, floor.minX, route.leftBranchOpeningStartZ, floor.maxZ)
  boards(floor.maxX, route.branchRightX, route.branchOpeningStartZ, floor.maxZ)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  // High/Medium export MaterialAtlasUV as UV1; Low exports it as UV0.
  geometry.setAttribute('uv1', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

/** A separate, reversible V3 surface keeps the photo-guided indoor oak away
 * from the cedar facade batch. The existing floor remains visible if this
 * small optional texture cannot load. Geometry still supplies every joint.
 */
export function createVirtualChurchFoyerOakFloorGeometry() {
  const geometry = createVirtualChurchFoyerFloorGeometry()
  const position = geometry.getAttribute('position') as Float32BufferAttribute
  const uv = geometry.getAttribute('uv') as Float32BufferAttribute
  const uv1 = geometry.getAttribute('uv1') as Float32BufferAttribute
  const color = geometry.getAttribute('color') as Float32BufferAttribute
  for (let quad = 0; quad < position.count / 6; quad++) {
    const first = quad * 6
    const board = quad >= 3
    const sample = quad - 3
    const u0 = board ? .035 + (sample % 4) * .23 : .4
    const u1 = board ? u0 + .19 : .6
    const v0 = board ? .04 + (Math.floor(sample / 4) % 3) * .09 : .4
    const v1 = board ? v0 + .60 : .6
    const x = (position.getX(first) + position.getX(first + 2)) / 2
    // The foyer and side corridors share one wood species. Photos 06/09 show
    // daylight increasing toward the courtyard glass, while photo 01's side
    // corridor is paler throughout. Vertex tint changes exposure within the
    // existing batch without an extra material, texture or draw call.
    const sideCorridor = x < VIRTUAL_CHURCH_FOYER_FLOOR.minX || x > VIRTUAL_CHURCH_FOYER_FLOOR.maxX
    for (let vertex = 0; vertex < 6; vertex++) {
      const index = first + vertex
      const u = [u0, u0, u1, u0, u1, u1][vertex]
      const v = [v0, v1, v1, v0, v1, v0][vertex]
      const tint = virtualChurchFoyerOakTintAt(position.getZ(index), sideCorridor)
      position.setY(index, position.getY(index) + .003)
      uv.setXY(index, u, v)
      uv1.setXY(index, u, v)
      color.setXYZ(index, tint[0], tint[1], tint[2])
    }
  }
  position.needsUpdate = true; uv.needsUpdate = true; uv1.needsUpdate = true; color.needsUpdate = true
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export function prepareVirtualChurchFoyerFloor(model: Object3D) {
  let target: Mesh<BufferGeometry, MeshStandardMaterial> | undefined
  model.traverse(child => {
    if (child instanceof Mesh && child.material instanceof MeshStandardMaterial
      && child.material.name === 'M_CedarLight') target = child as Mesh<BufferGeometry, MeshStandardMaterial>
  })
  const source = target?.material
  // An unknown/fallback asset keeps its original floor instead of guessing.
  if (!target || !source?.map || ![0, 1].includes(source.map.channel)
    || JSON.stringify(source.userData.vc04AtlasQuadrant) !== '[0,0.5,0.5,1]') return null
  // Authored church batches have identity transforms and only these attributes.
  // Do not apply entrance-local coordinates to an unknown transformed mesh.
  if (target.position.lengthSq() !== 0 || target.quaternion.x !== 0 || target.quaternion.y !== 0
    || target.quaternion.z !== 0 || target.quaternion.w !== 1
    || target.scale.x !== 1 || target.scale.y !== 1 || target.scale.z !== 1
    || target.geometry.groups.length !== 0
    || Object.keys(target.geometry.attributes).some(name => !['position', 'normal', 'uv', 'uv1'].includes(name))) return null
  const original = target.geometry.clone()
  const overlay = createVirtualChurchFoyerFloorGeometry()
  original.setAttribute('color', new Float32BufferAttribute(new Float32Array(original.getAttribute('position').count * 3).fill(1), 3))
  for (const name of Object.keys(overlay.attributes)) if (!original.hasAttribute(name)) overlay.deleteAttribute(name)
  if (original.index) overlay.setIndex(Array.from({ length: overlay.getAttribute('position').count }, (_, i) => i))
  let geometry: BufferGeometry | null
  try { geometry = mergeGeometries([original, overlay], false) }
  finally { original.dispose(); overlay.dispose() }
  if (!geometry) return null
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  const material = source.clone()
  material.vertexColors = true
  // Caller passes its instance clone: replace only that batch, never the cached
  // GLTF. White vertex colours keep every pre-existing surface unchanged.
  target.geometry = geometry
  target.material = material
  return { mesh: target, dispose() { geometry.dispose(); material.dispose() } }
}
