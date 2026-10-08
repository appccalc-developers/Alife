import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { AnimationClip, AnimationMixer, Bone, BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh, Texture, Vector3, VectorKeyframeTrack } from 'three'
import { createVirtualChurchOutfitBatch, virtualChurchShouldBatchOriginalOutfitMaps } from '../src/views/virtualChurchOutfitBatch.ts'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { decompressCharacterDraco } from '../../../tools/virtual-church/gate-a-character-geometry.mjs'
import { disposeVirtualChurchCharacterSkeletons, shareVirtualChurchOwnedCloneSkeletons } from '../src/views/virtualChurchResourceLeaseContract.ts'

function fixture() {
  const root = new Group(), bone = new Bone(), skeleton = new Skeleton([bone])
  root.add(bone)
  const normal = new Texture()
  const parts = [0, 1, 2, 3].map(i => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([i, 0, 0, i + 1, 0, 0, i, 1, 0], 3))
    geometry.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2))
    geometry.setAttribute('skinIndex', new Float32BufferAttribute(new Float32Array(12), 4))
    geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4))
    geometry.morphTargetsRelative = true
    geometry.morphAttributes.position = [new Float32BufferAttribute([0, 0, .1, 0, 0, .2, 0, 0, .3], 3)]
    geometry.setIndex([0, 1, 2])
    const material = new MeshStandardMaterial({ name: `Test_CLOTH_${i}`, map: new Texture(), normalMap: normal, alphaTest: .5 })
    const mesh = new SkinnedMesh(geometry, material)
    mesh.name = `Outfit${i}`; mesh.bind(skeleton); root.add(mesh)
    return mesh
  })
  const clip = new AnimationClip('Walk', 1, parts.map(part => new NumberKeyframeTrack(`${part.name}.morphTargetInfluences`, [0, 1], [0, .8])))
  return { root, bone, parts, clip }
}

test('original texture batch preserves every skinned/morphed vertex across animated poses', () => {
  const { root, bone, parts, clip } = fixture()
  const originals = parts.map(part => ({ geometry: part.geometry, material: part.material, values: Array.from(part.geometry.getAttribute('position').array) }))
  const batch = createVirtualChurchOutfitBatch(root, [clip], 16)
  assert.ok(batch.supported)
  assert.equal(batch.mesh.material.map, originals[0].material.map)
  assert.deepEqual(batch.maps, originals.map(item => item.material.map))
  const discoverableMaps = new Set(Object.values(batch.mesh.material).filter(value => value instanceof Texture))
  assert.ok(batch.maps.every(map => discoverableMaps.has(map)), 'custom samplers remain visible to memory diagnostics')
  assert.ok(parts.every(part => !part.visible))
  assert.deepEqual(Array.from(batch.mesh.geometry.getAttribute('alifeMapSlot').array), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
  const mixer = new AnimationMixer(root)
  mixer.clipAction(clip).play()
  for (let frame = 0; frame < 61; frame++) {
    mixer.setTime(frame / 60); bone.rotation.y = frame / 60
    root.updateMatrixWorld(true)
    for (const [i, part] of parts.entries()) for (let vertex = 0; vertex < 3; vertex++) {
      assert.deepEqual(batch.mesh.getVertexPosition(i * 3 + vertex, new Vector3()).toArray(), part.getVertexPosition(vertex, new Vector3()).toArray())
    }
  }
  for (const [i, part] of parts.entries()) {
    assert.equal(part.geometry, originals[i].geometry)
    assert.deepEqual(Array.from(part.geometry.getAttribute('position').array), originals[i].values)
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root); batch.dispose()
})

test('batch owns only merged geometry/material; disposal restores original parts exactly once', () => {
  const { root, parts, clip } = fixture(), batch = createVirtualChurchOutfitBatch(root, [clip], 16)
  assert.ok(batch.supported)
  let owned = 0, borrowed = 0
  batch.mesh.geometry.addEventListener('dispose', () => owned++)
  batch.mesh.material.addEventListener('dispose', () => owned++)
  for (const part of parts) {
    part.geometry.addEventListener('dispose', () => borrowed++)
    part.material.addEventListener('dispose', () => borrowed++)
    part.material.map!.addEventListener('dispose', () => borrowed++)
  }
  batch.dispose(); batch.dispose()
  assert.equal(owned, 2); assert.equal(borrowed, 0)
  assert.ok(parts.every(part => part.visible)); assert.equal(batch.mesh.parent, null)
})

test('rejects unequal rendering, texture sampling, skeletons, transforms and animated morphs without hiding anything', () => {
  const changes = [
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].material.roughness = .2 },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].material.map!.repeat.x = 2 },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].material.normalMap = new Texture() },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].position.x = 1 },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].skeleton = new Skeleton([new Bone()]) },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].material.transparent = true },
    ({ parts }: ReturnType<typeof fixture>) => { parts[1].castShadow = true },
    ({ clip }: ReturnType<typeof fixture>) => { clip.tracks[1].values[1] = .3 },
    ({ clip }: ReturnType<typeof fixture>) => { clip.tracks.pop() },
    ({ parts, clip }: ReturnType<typeof fixture>) => { clip.tracks.push(new VectorKeyframeTrack(`${parts[1].name}.position`, [0, 1], [0, 0, 0, 1, 0, 0])) },
  ]
  for (const change of changes) {
    const data = fixture(); change(data)
    assert.equal(createVirtualChurchOutfitBatch(data.root, [data.clip], 16).supported, false)
    assert.ok(data.parts.every(part => part.visible))
  }
  const data = fixture()
  assert.equal(createVirtualChurchOutfitBatch(data.root, [data.clip], 8).supported, false)
})

test('shader uses each original map with original UV and leaves alpha/normal/PBR chunks intact', () => {
  const { root, clip } = fixture(), batch = createVirtualChurchOutfitBatch(root, [clip], 16)
  assert.ok(batch.supported)
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <uv_vertex>', fragmentShader: '#include <map_fragment>\n#include <alphatest_fragment>\n#include <normal_fragment_maps>' }
  batch.mesh.material.onBeforeCompile(shader as never, null as never)
  assert.equal(shader.uniforms.alifeOutfitMap1.value, batch.maps[1])
  assert.equal(shader.uniforms.alifeOutfitMap3.value, batch.maps[3])
  assert.match(shader.fragmentShader, /texture2D\(alifeOutfitMap3, vMapUv\)/)
  assert.match(shader.fragmentShader, /#include <alphatest_fragment>/)
  assert.match(shader.fragmentShader, /#include <normal_fragment_maps>/)
  batch.dispose()
})

for (const quality of ['medium', 'low']) {
  test(`released male ${quality} outfit batch preserves real skin vertices in every embedded motion`, async () => {
    const path = new URL(`../public/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/character-hero-male-${quality}.glb`, import.meta.url)
    const decoded = await decompressCharacterDraco(readFileSync(path)), length = decoded.readUInt32LE(12)
    const document = JSON.parse(decoded.subarray(20, 20 + length).toString())
    const binary = decoded.subarray(length + 28)
    // Exercise actual geometry, skin, hierarchy and clips in Node. Neutral
    // placeholder textures do not certify colour/sampling; browser comparison
    // of the unmodified GLBs supplies that separate evidence.
    document.materials = document.materials.map((material: { name: string }) => ({ name: material.name }))
    delete document.images; delete document.textures
    const text = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
    text.copy(json)
    const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8)
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8)
    header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
    binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4)
    const file = Buffer.concat([header, json, binaryHeader, binary])
    const source = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.length), '')
    const sourceSnapshot = source.scene.toJSON(), owned = clone(source.scene)
    shareVirtualChurchOwnedCloneSkeletons(owned)
    const placeholders: Texture[] = []
    owned.traverse(node => {
      if (node instanceof SkinnedMesh && node.material instanceof MeshStandardMaterial) {
        node.material = node.material.clone()
        if (/_CLOTH(?:_| \()/.test(node.material.name)) {
          const map = new Texture(); placeholders.push(map); node.material.map = map
        }
      }
    })
    const batch = createVirtualChurchOutfitBatch(owned, source.animations, 16)
    assert.ok(batch.supported)
    assert.equal(batch.parts.length, 4)
    const mixer = new AnimationMixer(owned), expected = new Vector3(), actual = new Vector3()
    try {
      assert.equal(source.animations.length, 14)
      for (const clip of source.animations) {
        mixer.stopAllAction(); mixer.clipAction(clip).reset().play()
        for (const phase of [0, .125, .375, .875]) {
          mixer.setTime(clip.duration * phase); owned.updateMatrixWorld(true); batch.mesh.skeleton.update()
          let offset = 0
          for (const part of batch.parts) {
            const count = part.geometry.getAttribute('position').count
            for (let vertex = 0; vertex < count; vertex++) {
              part.getVertexPosition(vertex, expected); batch.mesh.getVertexPosition(offset + vertex, actual)
              assert.ok(actual.distanceTo(expected) < 1e-7, `${quality}/${clip.name}/${phase}: vertex ${offset + vertex}`)
            }
            offset += count
          }
          assert.equal(offset, batch.mesh.geometry.getAttribute('position').count)
        }
      }
      assert.deepEqual(source.scene.toJSON(), sourceSnapshot, 'borrowed GLTF remains untouched')
    } finally {
      mixer.stopAllAction(); mixer.uncacheRoot(owned); batch.dispose()
      disposeVirtualChurchCharacterSkeletons(owned); disposeVirtualChurchCharacterSkeletons(source.scene)
      const geometries = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial>()
      for (const root of [source.scene, owned]) root.traverse(node => {
        if (node instanceof SkinnedMesh) {
          geometries.add(node.geometry)
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material as MeshStandardMaterial)
        }
      })
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); placeholders.forEach(item => item.dispose())
    }
  })
}

test('V3 Low and Medium batch both released outfits, with review and legacy paths isolated', () => {
  const options = {
    visualVersion: 'v3' as const, characterReview: null,
    isDevelopment: false, reviewOverride: null,
  }
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps(options), true)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, reviewOverride: '0' }), true)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, isDevelopment: true }), true)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, isDevelopment: true, reviewOverride: '0' }), false)
  for (const characterReview of ['female', 'male']) {
    assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, characterReview }), true)
    assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, characterReview, reviewOverride: '0' }), true)
    assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, characterReview, isDevelopment: true, reviewOverride: '0' }), false)
  }
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, visualVersion: 'v2' }), false)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, visualVersion: 'v2', isDevelopment: true, reviewOverride: '1' }), false)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, characterReview: 'male-v14' }), false)
  assert.equal(virtualChurchShouldBatchOriginalOutfitMaps({ ...options, characterReview: 'male-v14', isDevelopment: true, reviewOverride: '1' }), true)

  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /originalMapBatchEnabled = virtualChurchShouldBatchOriginalOutfitMaps\(/)
  assert.match(source, /originalMapBatchEnabled \? createVirtualChurchOutfitBatch\(cloned, sourceClips, gl.capabilities.maxTextures\) : null/)
  assert.match(source, /cleanupGuard.release\(\(\) => \{[\s\S]*?if \(outfitBatch\?\.supported\) outfitBatch.dispose\(\)[\s\S]*?disposeVirtualChurchCharacterSkeletons\(model\)/)
})
