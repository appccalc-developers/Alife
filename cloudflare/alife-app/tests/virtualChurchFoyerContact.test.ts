import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { ACESFilmicToneMapping, CubeUVReflectionMapping, LinearFilter, Mesh, MeshStandardMaterial, PCFShadowMap, RedFormat, Scene, SRGBColorSpace, Texture, WebGLRenderTarget } from 'three'
import { WebGLPrograms } from 'three/src/renderers/webgl/WebGLPrograms.js'
import { addVirtualChurchFoyerContactUV, createVirtualChurchFoyerContactMask, createVirtualChurchFoyerFloorMaterial, createVirtualChurchFoyerFloorShaderPreparation, virtualChurchFoyerFloorContactShader } from '../src/views/virtualChurchFoyerContact.ts'
import { createVirtualChurchFoyerOakFloorGeometry, VIRTUAL_CHURCH_FOYER_FLOOR as floor } from '../src/views/virtualChurchFoyerFloor.ts'

const centerX = (floor.minX + floor.maxX) / 2
const at = (texture: ReturnType<typeof createVirtualChurchFoyerContactMask>, x: number, z: number) => {
  const { width, height, data } = texture.image
  const column = Math.max(0, Math.min(width - 1, Math.floor((x - floor.minX) / (floor.maxX - floor.minX) * width)))
  const row = Math.max(0, Math.min(height - 1, Math.floor((z - floor.minZ) / (floor.maxZ - floor.minZ) * height)))
  return data[row * width + column]
}
const contact = { x: centerX, z: 5, halfX: .2, halfZ: .2, feather: .4, strength: .5 }

test('contact mask is bounded single-channel data, not a downloaded image or mip chain', () => {
  const texture = createVirtualChurchFoyerContactMask([contact])
  try {
    assert.equal(texture.format, RedFormat)
    assert.equal(texture.channel, 2)
    assert.equal(texture.image.data.byteLength, 65_536)
    assert.equal(texture.image.width, 256); assert.equal(texture.image.height, 256)
    assert.equal(texture.generateMipmaps, false)
    assert.equal(texture.minFilter, LinearFilter); assert.equal(texture.magFilter, LinearFilter)
    assert.equal(texture.flipY, false)
    assert.ok(at(texture, centerX, 5) < at(texture, centerX, 5.42))
    assert.ok(at(texture, centerX, 5.42) < at(texture, centerX, 6))
    assert.equal(at(texture, centerX, 6), 255)
  } finally { texture.dispose() }
})

test('mask is deterministic, never multiplies overlaps black, and keeps exterior/corridor edges white', () => {
  const single = createVirtualChurchFoyerContactMask([contact])
  const repeated = createVirtualChurchFoyerContactMask([contact, contact])
  const clipped = createVirtualChurchFoyerContactMask([{ ...contact, x: floor.minX, z: floor.minZ }])
  try {
    assert.deepEqual(single.image.data, repeated.image.data)
    const { data, width, height } = clipped.image
    for (let index = 0; index < width; index++) {
      assert.equal(data[index], 255); assert.equal(data[(height - 1) * width + index], 255)
    }
    for (let index = 0; index < height; index++) {
      assert.equal(data[index * width], 255); assert.equal(data[index * width + width - 1], 255)
    }
    assert.ok(Math.min(...single.image.data) >= 127)
  } finally { single.dispose(); repeated.dispose(); clipped.dispose() }
})

test('bad footprint or resolution cannot allocate unbounded contact data', () => {
  for (const size of [31, 513, 32.5, Number.NaN]) assert.throws(() => createVirtualChurchFoyerContactMask([], size), RangeError)
  for (const changed of [{ feather: 0 }, { strength: .8 }, { x: Infinity }, { halfX: -1 }]) {
    assert.throws(() => createVirtualChurchFoyerContactMask([{ ...contact, ...changed }]), RangeError)
  }
})

test('contact UV does not change wood grain, board color, geometry, or floor/collision height', () => {
  const original = createVirtualChurchFoyerOakFloorGeometry(), geometry = original.clone()
  try {
    assert.equal(addVirtualChurchFoyerContactUV(geometry), geometry)
    for (const key of ['position', 'normal', 'uv', 'uv1', 'color']) {
      assert.deepEqual(geometry.getAttribute(key).array, original.getAttribute(key).array)
    }
    assert.equal(original.getAttribute('uv2'), undefined)
    const uv = geometry.getAttribute('uv2'), p = geometry.getAttribute('position')
    assert.equal(uv.count, p.count)
    for (let index = 0; index < uv.count; index++) {
      assert.ok(uv.getX(index) >= 0 && uv.getX(index) <= 1)
      assert.ok(uv.getY(index) >= 0 && uv.getY(index) <= 1)
    }
  } finally { original.dispose(); geometry.dispose() }
})

test('only owned V3 oak material opts in, uses static feet, and disposes its mask', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /foyerWelcomeTableFrame\.slice\(1\)\.map/)
  assert.match(source, /createVirtualChurchFoyerFloorMaterial\(texture, contactMask\)/)
  assert.match(source, /<primitive object=\{material\} attach="material" \/>/)
  assert.match(source, /useEffect\(\(\) => \(\) => contactMask\.dispose\(\), \[contactMask\]\)/)
  const definition = source.slice(source.indexOf('const foyerFloorContacts:'), source.indexOf('const FoyerOakFloor ='))
  assert.doesNotMatch(definition, /foyerAllDoorLeaves|character|player|useFrame/)
  const shader = { fragmentShader: '#include <aomap_fragment>' }
  virtualChurchFoyerFloorContactShader(shader as never, null as never)
  assert.match(shader.fragmentShader, /#include <aomap_fragment>/)
  assert.match(shader.fragmentShader, /#ifdef USE_AOMAP[\s\S]*reflectedLight.directDiffuse \*= ambientOcclusion/)
})

test('real floor factory preserves the original PBR material and owns no input textures', () => {
  const map = new Texture(), contactTexture = createVirtualChurchFoyerContactMask([contact])
  const material = createVirtualChurchFoyerFloorMaterial(map, contactTexture)
  const original = new MeshStandardMaterial({ map, vertexColors: true, roughness: .72, metalness: 0,
    envMapIntensity: .55, emissive: '#8f7658', emissiveIntensity: .025, aoMap: contactTexture })
  let disposedInputs = 0
  for (const texture of [map, contactTexture]) texture.addEventListener('dispose', () => disposedInputs++)
  try {
    for (const key of ['map', 'aoMap', 'vertexColors', 'roughness', 'metalness', 'envMapIntensity', 'emissiveIntensity', 'side', 'toneMapped'] as const) {
      assert.equal(material[key], original[key])
    }
    assert.ok(material.emissive.equals(original.emissive)); assert.ok(material.color.equals(original.color))
    assert.equal(material.onBeforeCompile, virtualChurchFoyerFloorContactShader)
    assert.equal(material.customProgramCacheKey(), 'foyer-floor-contact-v1')
    material.dispose(); assert.equal(disposedInputs, 0)
  } finally { original.dispose(); map.dispose(); contactTexture.dispose() }
})

test('invisible preparation owns only five texture bytes and idempotently releases every owned object', () => {
  const preparation = createVirtualChurchFoyerFloorShaderPreparation(), { mesh } = preparation
  const material = mesh.material
  assert.equal(mesh.visible, false); assert.equal(mesh.receiveShadow, true); assert.equal(mesh.castShadow, false)
  assert.equal(material.map!.colorSpace, SRGBColorSpace); assert.equal(material.map!.channel, 0)
  assert.equal(material.aoMap!.channel, 2)
  assert.equal(material.map!.image.data.byteLength + material.aoMap!.image.data.byteLength, 5)
  assert.equal(material.map!.image.width, 1); assert.equal(material.aoMap!.image.width, 1)
  assert.equal(mesh.geometry.getAttribute('color').itemSize, 3)
  assert.equal(mesh.geometry.getAttribute('uv2').itemSize, 2)
  const resources = [mesh.geometry, material, material.map!, material.aoMap!], released = new Set()
  for (const resource of resources) resource.addEventListener('dispose', () => { assert.ok(!released.has(resource)); released.add(resource) })
  preparation.dispose(); preparation.dispose(); assert.equal(released.size, resources.length)
})

test('installed Three program parameters and cache keys match real floor for both targets and shadow budgets', () => {
  const preparation = createVirtualChurchFoyerFloorShaderPreparation(), map = new Texture()
  map.colorSpace = SRGBColorSpace
  const contactTexture = createVirtualChurchFoyerContactMask([contact])
  const material = createVirtualChurchFoyerFloorMaterial(map, contactTexture)
  const geometry = addVirtualChurchFoyerContactUV(createVirtualChurchFoyerOakFloorGeometry())
  const realFloor = new Mesh(geometry, material), scene = new Scene(), environment = new Texture()
  environment.mapping = CubeUVReflectionMapping; environment.image = { height: 256 }; scene.environment = environment
  realFloor.receiveShadow = true
  const lights = { directional: [{}], point: [{}, {}], spot: [], spotLightMap: [], rectArea: [], hemi: [{}],
    directionalShadowMap: [{}], pointShadowMap: [], spotShadowMap: [], numSpotLightShadowsWithMaps: 0, numLightProbes: 0 }
  const target = new WebGLRenderTarget(1, 1)
  try {
    for (const shadows of [false, true]) for (const renderTarget of [null, target]) {
      const renderer = { getRenderTarget: () => renderTarget, state: { buffers: { depth: { getReversed: () => false } } },
        toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace, shadowMap: { enabled: shadows, type: PCFShadowMap } }
      const programs = WebGLPrograms(renderer, { get: (texture: unknown) => texture }, { has: () => true },
        { precision: 'highp', logarithmicDepthBuffer: false }, {}, { numPlanes: 0, numIntersection: 0 })
      const warm = programs.getParameters(preparation.mesh.material, lights, shadows ? [{}] : [], scene, preparation.mesh, [])
      const actual = programs.getParameters(material, lights, shadows ? [{}] : [], scene, realFloor, [])
      assert.deepEqual(warm, actual, 'no helper-only shader variant or lower-quality floor')
      assert.equal(programs.getProgramCacheKey(warm), programs.getProgramCacheKey(actual))
    }
  } finally { preparation.dispose(); geometry.dispose(); material.dispose(); map.dispose(); contactTexture.dispose(); environment.dispose(); target.dispose() }
})
