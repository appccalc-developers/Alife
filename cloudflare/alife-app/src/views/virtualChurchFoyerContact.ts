import { DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RedFormat, SRGBColorSpace, UnsignedByteType, type BufferGeometry, type Texture } from 'three'
import { VIRTUAL_CHURCH_FOYER_FLOOR as floor } from './virtualChurchFoyerFloor.ts'

export type FoyerFloorContact = {
  x: number; z: number; halfX: number; halfZ: number; feather: number; strength: number
}

// A local artistic contact mask, not a light bake or a directional cast shadow.
// One R8 texture grounds only fixed furniture; doors and people must not enter
// this list. White borders keep the extending side corridors unaffected.
export function createVirtualChurchFoyerContactMask(contacts: readonly FoyerFloorContact[], size = 256) {
  if (!Number.isInteger(size) || size < 32 || size > 512) throw new RangeError('Contact mask size must be 32–512')
  const data = new Uint8Array(size * size).fill(255)
  const width = floor.maxX - floor.minX, depth = floor.maxZ - floor.minZ
  for (const c of contacts) {
    if (![c.x, c.z, c.halfX, c.halfZ, c.feather, c.strength].every(Number.isFinite)
      || c.halfX < 0 || c.halfZ < 0 || c.feather <= 0 || c.strength < 0 || c.strength > .7) {
      throw new RangeError('Invalid fixed floor contact')
    }
    const fromX = Math.max(1, Math.floor((c.x - c.halfX - c.feather - floor.minX) / width * size))
    const toX = Math.min(size - 2, Math.ceil((c.x + c.halfX + c.feather - floor.minX) / width * size))
    const fromZ = Math.max(1, Math.floor((c.z - c.halfZ - c.feather - floor.minZ) / depth * size))
    const toZ = Math.min(size - 2, Math.ceil((c.z + c.halfZ + c.feather - floor.minZ) / depth * size))
    for (let row = fromZ; row <= toZ; row++) for (let column = fromX; column <= toX; column++) {
      const x = floor.minX + (column + .5) / size * width
      const z = floor.minZ + (row + .5) / size * depth
      const distance = Math.hypot(Math.max(0, Math.abs(x - c.x) - c.halfX), Math.max(0, Math.abs(z - c.z) - c.halfZ))
      const t = Math.min(1, distance / c.feather)
      const fade = 1 - t * t * (3 - 2 * t)
      const pixel = row * size + column
      // Use the strongest contact, not repeated multiplication into black.
      data[pixel] = Math.min(data[pixel], Math.round(255 * (1 - c.strength * fade)))
    }
  }
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  texture.name = 'vc:foyer-floor-contact-mask'
  texture.channel = 2
  texture.minFilter = texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

// Only call on the freshly created, owned oak geometry. Board grain UVs and
// all positions remain intact; aoMap uses a separate entrance-local UV set.
export function addVirtualChurchFoyerContactUV(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  for (let index = 0; index < position.count; index++) {
    uv[index * 2] = Math.max(0, Math.min(1, (position.getX(index) - floor.minX) / (floor.maxX - floor.minX)))
    uv[index * 2 + 1] = Math.max(0, Math.min(1, (position.getZ(index) - floor.minZ) / (floor.maxZ - floor.minZ)))
  }
  geometry.setAttribute('uv2', new Float32BufferAttribute(uv, 2))
  return geometry
}

export const virtualChurchFoyerFloorContactShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  // Three's standard AO path covers indirect light. This floor-only contact
  // also attenuates diffuse sun fill under the same static footprints.
  shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
    #ifdef USE_AOMAP
      reflectedLight.directDiffuse *= ambientOcclusion;
    #endif`)
}

// One material factory keeps the never-drawn preparation and the real oak floor
// on exactly the same shader features. The real image/contact data stay owned
// by the floor; disposing this material must not dispose either input texture.
export function createVirtualChurchFoyerFloorMaterial(map: Texture, contactMask: Texture) {
  const material = new MeshStandardMaterial({ map, vertexColors: true, roughness: .72, metalness: 0,
    envMapIntensity: .55, emissive: '#8f7658', emissiveIntensity: .025, aoMap: contactMask })
  material.onBeforeCompile = virtualChurchFoyerFloorContactShader
  material.customProgramCacheKey = () => 'foyer-floor-contact-v1'
  return material
}

// Compile the floor's existing features while church/character files download.
// Three compile() traverses hidden meshes, but render() never draws this mesh.
// Keep its material alive until route cleanup so the arriving real floor can
// acquire both cached programs; no placeholder appears in the visible scene.
export function createVirtualChurchFoyerFloorShaderPreparation() {
  const map = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  map.colorSpace = SRGBColorSpace
  const contact = new DataTexture(new Uint8Array([255]), 1, 1, RedFormat, UnsignedByteType)
  contact.channel = 2
  contact.minFilter = contact.magFilter = LinearFilter
  map.needsUpdate = contact.needsUpdate = true
  const geometry = new PlaneGeometry(1, 1)
  geometry.setAttribute('uv2', geometry.getAttribute('uv').clone())
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3))
  const material = createVirtualChurchFoyerFloorMaterial(map, contact)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'vc:foyer-floor-shader-preparation'
  mesh.visible = false
  mesh.receiveShadow = true
  let disposed = false
  return { mesh, dispose() {
    if (disposed) return
    disposed = true
    geometry.dispose(); material.dispose(); map.dispose(); contact.dispose()
  } }
}
