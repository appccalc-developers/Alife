import { BufferGeometry, Mesh, type Object3D } from 'three'

// The authored GLB has a photo-backdrop at local Z=6.4, not a structural end
// wall. Remove it and its attached cross only from the V3 instance. Exterior
// geometry and the cached source GLB are unchanged.
const inPhotoBackWall = (material: string, x: number, y: number, z: number) => (
  material === 'M_OffWhite'
    ? x > -17.55 && x < .8 && y >= -.02 && y < 6.18 && z > 6.29 && z < 6.51
    : (material === 'M_CedarDark' || material === 'M_CedarLight')
      && x > -9.05 && x < -7.65 && y > 3.55 && y < 5.34 && z > 6.04 && z < 6.46
)

// The three immutable church LODs share two enormous off-white triangles on
// each face of the right foyer partition (x=.49/.68). They cover the service
// window despite the V3 frontage in front. Remove only those four faces from
// the clone; the V3 layer replaces their volume with four wall strips around
// the window. Matching the complete source bounds avoids cutting unrelated
// exterior or floor triangles that merely intersect this region.
const isServicePartitionFace = (material: string, vertices: [number, number, number][]) => {
  if (material !== 'M_OffWhite') return false
  const x = vertices.map(vertex => vertex[0])
  const onFace = [.49, .68].some(plane => x.every(value => Math.abs(value - plane) < .015))
  if (!onFace) return false
  const y = vertices.map(vertex => vertex[1]), z = vertices.map(vertex => vertex[2])
  return Math.min(...y) < .03 && Math.max(...y) > 6.02
    && Math.min(...z) < -.49 && Math.max(...z) > 6.37
}

// The old shallow foyer has two complete faces at each side of its near-left
// wall. Replace only these four faces on the V3 clone with wall strips around
// the photographed pair of main-hall doors; the published GLB stays intact.
const isMainHallPartitionFace = (material: string, vertices: [number, number, number][]) => {
  if (material !== 'M_OffWhite') return false
  const x = vertices.map(vertex => vertex[0])
  const onFace = [-17.2547, -17.4344].some(plane => x.every(value => Math.abs(value - plane) < .015))
  if (!onFace) return false
  const y = vertices.map(vertex => vertex[1]), z = vertices.map(vertex => vertex[2])
  return Math.min(...y) < .03 && Math.max(...y) > 6.02
    && Math.min(...z) < -.49 && Math.max(...z) > 6.37
}

// The immutable shallow-foyer GLB has three charcoal returns on each side.
// On the left, those old returns cut through the newly photographed two-door
// frontage. V3 supplies its later perimeter returns separately, so remove
// only the three original left returns from this clone, not the right wall or
// any exterior charcoal. Bounds come from Foyer_LeftWallLine_* in the source.
const isOldLeftWallLine = (material: string, vertices: [number, number, number][]) => (
  (material === 'M_Charcoal' || material === 'M_CedarLight')
  && vertices.every(([x, y]) => x > -17.48 && x < -17.04
    && y >= -.02 && y < 6.08)
  && [1.05, 1.45, 3.45, 5.15, 5.80].some(centre =>
    vertices.every(([, , z]) => Math.abs(z - centre) < .245))
)

// The original shallow foyer also left three full-height charcoal returns on
// the service-window side. Photos 07/08 show a pale upper wall there, with the
// dark frontage confined to the door and window below. Remove only these old
// interior returns from V3; the explicit service wall and frames remain.
const isOldServiceWallLine = (material: string, vertices: [number, number, number][]) => (
  (material === 'M_Charcoal' || material === 'M_CedarLight')
  && vertices.every(([x, y]) => x > .33 && x < .69 && y >= -.02 && y < 6.08)
  // Low simplifies the original three charcoal returns to two cedar-atlas
  // boxes at different Z positions. Match each LOD's complete source bounds.
  && (material === 'M_CedarLight' ? [1.45, 5.15] : [1.05, 3.45, 5.80]).some(centre =>
    vertices.every(([, , z]) => Math.abs(z - centre) < .245))
)

// Decoded immutable r9 LODs contain the obsolete shallow-foyer pendant line
// at X=-8.8, Z=1.65/3.225/4.8 (Low keeps just the first). V3 now supplies the
// photo-backed four-shade line separately. Remove only complete triangles
// of these shades/cords/bulbs from the clone, not ceiling panels, roof, cross,
// facade timber or the cached source. Bounds include Draco quantization.
const isOldPendant = (material: string, vertices: [number, number, number][]) => {
  const bounds = material === 'M_CedarLight' ? [-9.14, -8.46, 4.36, 6.03, .34]
    : material === 'M_Charcoal' ? [-8.84, -8.76, 5.37, 6.03, .04]
      : material === 'M_WarmLight' ? [-8.89, -8.71, 4.85, 5.07, .09] : null
  return bounds !== null && [1.65, 3.225, 4.8].some(centerZ =>
    vertices.every(([x, y, z]) => x > bounds[0] && x < bounds[1]
      && y > bounds[2] && y < bounds[3] && Math.abs(z - centerZ) < bounds[4]))
}

export function prepareVirtualChurchFoyerPassage(model: Object3D) {
  const owned: BufferGeometry[] = []
  let removedTriangles = 0
  let removedServicePartitionTriangles = 0
  let removedMainHallPartitionTriangles = 0
  let removedLeftWallLineTriangles = 0
  let removedServiceWallLineTriangles = 0
  let removedPendantTriangles = 0
  model.traverse(node => {
    if (!(node instanceof Mesh) || Array.isArray(node.material)
      || !['M_OffWhite', 'M_CedarDark', 'M_CedarLight', 'M_Charcoal', 'M_WarmLight'].includes(node.material.name)) return
    const geometry = node.geometry as BufferGeometry
    const position = geometry.getAttribute('position')
    const index = geometry.index
    if (!position || geometry.groups.length !== 0
      || node.position.lengthSq() !== 0 || node.quaternion.x !== 0 || node.quaternion.y !== 0
      || node.quaternion.z !== 0 || node.quaternion.w !== 1
      || node.scale.x !== 1 || node.scale.y !== 1 || node.scale.z !== 1) return

    const retained: number[] = []
    let removed = 0
    const triangleVertexCount = index?.count ?? position.count
    for (let triangle = 0; triangle < triangleVertexCount; triangle += 3) {
      const indices = index
        ? [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
        : [triangle, triangle + 1, triangle + 2]
      const vertices = indices.map(vertex => [
        position.getX(vertex), position.getY(vertex), position.getZ(vertex),
      ] as [number, number, number])
      const isBackdrop = indices.every(vertex => inPhotoBackWall(
        node.material.name,
        position.getX(vertex), position.getY(vertex), position.getZ(vertex),
      ))
      const isServicePartition = isServicePartitionFace(node.material.name, vertices)
      const isMainHallPartition = isMainHallPartitionFace(node.material.name, vertices)
      const isLeftWallLine = isOldLeftWallLine(node.material.name, vertices)
      const isServiceWallLine = isOldServiceWallLine(node.material.name, vertices)
      const isPendant = isOldPendant(node.material.name, vertices)
      if (isBackdrop || isServicePartition || isMainHallPartition || isLeftWallLine || isServiceWallLine || isPendant) {
        removed++
        if (isServicePartition) removedServicePartitionTriangles++
        if (isMainHallPartition) removedMainHallPartitionTriangles++
        if (isLeftWallLine) removedLeftWallLineTriangles++
        if (isServiceWallLine) removedServiceWallLineTriangles++
        if (isPendant) removedPendantTriangles++
      }
      else retained.push(...indices)
    }
    if (!removed) return
    const instanceGeometry = geometry.clone()
    instanceGeometry.setIndex(retained)
    instanceGeometry.computeBoundingBox()
    instanceGeometry.computeBoundingSphere()
    node.geometry = instanceGeometry
    owned.push(instanceGeometry)
    removedTriangles += removed
  })
  return {
    removedTriangles,
    removedServicePartitionTriangles,
    removedMainHallPartitionTriangles,
    removedLeftWallLineTriangles,
    removedServiceWallLineTriangles,
    removedPendantTriangles,
    dispose() { owned.forEach(geometry => geometry.dispose()) },
  }
}
