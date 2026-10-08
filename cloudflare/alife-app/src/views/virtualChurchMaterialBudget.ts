import { MeshPhysicalMaterial, type Material } from 'three'

/** Imported GLB materials must obey the same transmission budget as JSX glass.
 * Return an owned clone only when necessary; never mutate the loader cache.
 * The caller disposes the clone, but not its shared textures.
 */
export function virtualChurchMaterialForBudget(material: Material, glassTransmission: boolean): Material {
  if (glassTransmission || !(material instanceof MeshPhysicalMaterial) || material.transmission <= 0) return material
  const result = material.clone()
  result.transmission = 0
  // Low/mobile drops screen-space transmission, but the entrance must remain
  // visibly glazed rather than becoming an opaque blue-black wall. Conventional
  // alpha blending is cheaper and lets the photo-backed shallow foyer read.
  result.transparent = true
  result.opacity = 0.48
  result.depthWrite = false
  return result
}
