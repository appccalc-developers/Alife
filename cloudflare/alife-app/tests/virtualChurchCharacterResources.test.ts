import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { AnimationClip, AnimationMixer, Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Texture, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from '../../../tools/virtual-church/gate-a-character-geometry.mjs'
import { createVirtualChurchResourceLeaseRegistry, createVirtualChurchStrictModeCleanupGuard, disposeVirtualChurchCharacterSkeletons, freezeVirtualChurchUnanimatedCloneBoneMatrices, shareVirtualChurchOwnedCloneSkeletons } from '../src/views/virtualChurchResourceLeaseContract.ts'
import { gateARefineFemaleWalkGait } from '../src/views/virtualChurchCharacterGait.ts'
import { virtualChurchResourceBelongsToSession } from '../src/views/virtualChurchPerformanceContract.ts'

test('separate review motion counts toward critical bytes, without including portraits or stale visits', () => {
  const name = 'http://localhost:5186/__alife-review/virtual-church/character-hero-male-v14-motion.glb'
  assert.equal(virtualChurchResourceBelongsToSession({ name, startTime: 1000 }, 1000), true)
  assert.equal(virtualChurchResourceBelongsToSession({ name, startTime: 0 }, 1000), false)
  assert.equal(virtualChurchResourceBelongsToSession({ name: name.replace('motion.glb', 'picker.webp'), startTime: 1000 }, 1000), false)
})

const avatar = () => {
  const model = new Group()
  const bone = new Bone()
  const skeleton = new Skeleton([bone])
  const geometry = new BoxGeometry()
  const texture = new Texture()
  const material = new MeshBasicMaterial({ map: texture })
  model.add(bone)
  for (let index = 0; index < 3; index += 1) {
    const mesh = new SkinnedMesh(geometry, material)
    mesh.bind(skeleton)
    model.add(mesh)
  }
  return { model, skeleton, geometry, texture, material }
}

test('owned clone parts share identical bone buffers but separate people retain independent poses', () => {
  const source = avatar()
  const models = [clone(source.model), clone(source.model)]
  const skeletons = (model: Group) => {
    const result: Skeleton[] = []
    model.traverse(node => { if (node instanceof SkinnedMesh) result.push(node.skeleton) })
    return result
  }
  let cloneDisposals = 0, sourceDisposals = 0
  source.skeleton.computeBoneTexture()
  source.skeleton.boneTexture!.addEventListener('dispose', () => { sourceDisposals++ })
  for (const model of models) {
    const before = skeletons(model)
    assert.equal(new Set(before).size, 3)
    model.children[0].position.x = models.indexOf(model) + 2
    model.updateMatrixWorld(true)
    before.forEach(skeleton => skeleton.update())
    const buffers = before.map(skeleton => Array.from(skeleton.boneMatrices))
    assert.equal(shareVirtualChurchOwnedCloneSkeletons(model), 2)
    const after = skeletons(model)
    assert.equal(new Set(after).size, 1)
    after.forEach((skeleton, index) => { skeleton.update(); assert.deepEqual(Array.from(skeleton.boneMatrices), buffers[index]) })
    assert.notEqual(after[0], source.skeleton)
    after[0].computeBoneTexture()
    after[0].boneTexture!.addEventListener('dispose', () => { cloneDisposals++ })
    assert.equal(shareVirtualChurchOwnedCloneSkeletons(model), 0)
  }
  assert.notEqual(skeletons(models[0])[0], skeletons(models[1])[0])
  assert.notEqual(skeletons(models[0])[0].bones[0], skeletons(models[1])[0].bones[0])
  models.forEach(model => { disposeVirtualChurchCharacterSkeletons(model); disposeVirtualChurchCharacterSkeletons(model) })
  assert.equal(cloneDisposals, 2)
  assert.equal(sourceDisposals, 0)
  source.skeleton.dispose(); source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
})

test('different inverse binds or bone identities must not share a clone skeleton', () => {
  for (const mismatch of ['inverse', 'bones']) {
    const source = avatar(), model = clone(source.model)
    const meshes = model.children.filter(node => node instanceof SkinnedMesh)
    if (mismatch === 'inverse') {
      // Skeleton.clone borrows inverse matrices, so own this changed test matrix.
      meshes[1].skeleton.boneInverses = meshes[1].skeleton.boneInverses.map(matrix => matrix.clone())
      meshes[1].skeleton.boneInverses[0].elements[12] = 7
    } else meshes[1].skeleton.bones = [new Bone()]
    assert.equal(shareVirtualChurchOwnedCloneSkeletons(model), 1)
    assert.notEqual(meshes[0].skeleton, meshes[1].skeleton)
    assert.equal(meshes[0].skeleton, meshes[2].skeleton)
    disposeVirtualChurchCharacterSkeletons(model)
    source.skeleton.dispose(); source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
  }
})

test('already rendered clone skeletons keep their live bone textures during consolidation', () => {
  const source = avatar(), model = clone(source.model)
  const meshes = model.children.filter(node => node instanceof SkinnedMesh)
  const rendered = meshes[0].skeleton
  rendered.computeBoneTexture()
  const texture = rendered.boneTexture
  let disposals = 0
  texture!.addEventListener('dispose', () => { disposals++ })
  assert.equal(shareVirtualChurchOwnedCloneSkeletons(model), 1)
  assert.equal(meshes[0].skeleton, rendered)
  assert.equal(rendered.boneTexture, texture)
  assert.notEqual(meshes[0].skeleton, meshes[1].skeleton)
  assert.equal(meshes[1].skeleton, meshes[2].skeleton)
  assert.equal(disposals, 0)
  disposeVirtualChurchCharacterSkeletons(model)
  assert.equal(disposals, 1)
  source.skeleton.dispose(); source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
})

test('releases every rendered clone bone texture, without touching cached source data', () => {
  const source = avatar()
  const model = clone(source.model)
  source.skeleton.computeBoneTexture()
  let sourceDisposals = 0
  for (const object of [source.skeleton.boneTexture!, source.geometry, source.texture, source.material]) {
    object.addEventListener('dispose', () => { sourceDisposals += 1 })
  }
  const skeletons: Skeleton[] = []
  let cloneDisposals = 0
  model.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return
    assert.notEqual(node.skeleton, source.skeleton)
    node.skeleton.computeBoneTexture()
    node.skeleton.boneTexture!.addEventListener('dispose', () => { cloneDisposals += 1 })
    skeletons.push(node.skeleton)
  })
  assert.equal(new Set(skeletons).size, 3)
  disposeVirtualChurchCharacterSkeletons(model)
  assert.equal(cloneDisposals, 3)
  assert.equal(sourceDisposals, 0)
  assert.ok(skeletons.every(skeleton => skeleton.boneTexture === null))
  disposeVirtualChurchCharacterSkeletons(model)
  assert.equal(cloneDisposals, 3)
  source.skeleton.dispose(); source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
})

test('shared skeletons dispose once and unrendered skeletons are safe', () => {
  const source = avatar()
  source.model.add(new Mesh(source.geometry, source.material))
  let calls = 0
  const dispose = source.skeleton.dispose.bind(source.skeleton)
  source.skeleton.dispose = () => { calls += 1; dispose() }
  disposeVirtualChurchCharacterSkeletons(source.model)
  assert.equal(calls, 1)
  source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
})

test('StrictMode replay retains live bone textures until the real avatar unmount', () => {
  const source = avatar()
  source.skeleton.computeBoneTexture()
  const pending: Array<() => void> = []
  const guard = createVirtualChurchStrictModeCleanupGuard(task => pending.push(task))
  guard.activate()
  guard.release(() => disposeVirtualChurchCharacterSkeletons(source.model))
  guard.activate()
  pending.shift()!()
  assert.ok(source.skeleton.boneTexture)
  guard.release(() => disposeVirtualChurchCharacterSkeletons(source.model))
  pending.shift()!()
  assert.equal(source.skeleton.boneTexture, null)
  source.geometry.dispose(); source.material.dispose(); source.texture.dispose()
})

test('both avatar paths own skeleton cleanup and diagnostics restart for a new asset', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  for (const component of ['const GateASkinnedFemaleHero =', 'const AnimatedPlayerAvatar =']) {
    const start = view.indexOf(component)
    assert.ok(start >= 0)
    const section = view.slice(start, view.indexOf('\nconst ', start + component.length))
    assert.match(section, /cleanupGuard\.release\(\(\) => \{[\s\S]*disposeVirtualChurchCharacterSkeletons\(model\)/)
  }
  assert.match(view, /<VirtualChurchPerformanceProbe\s+key=\{gateACharacterAssetPath\}/)
  const probe = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  assert.match(probe, /publicationEpochRef\.current \+= 1/)
  assert.match(probe, /if \(publicationEpoch !== publicationEpochRef\.current\) return/)
  assert.match(probe, /characterAssetPath: document\.documentElement\.getAttribute\(VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE\)/)
})

test('only the V3 hero consolidates its unrendered owned clone before material and animation preparation', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const hero = view.slice(view.indexOf('const GateASkinnedFemaleHero ='), view.indexOf('const AnimatedPlayerAvatar ='))
  assert.match(hero, /const cloned = cloneSkeleton\(gltf.scene\)\s+shareVirtualChurchOwnedCloneSkeletons\(cloned\)\s+cloned.name/)
  assert.match(hero, /const staticBoneMatrices = config3D\.visualVersion === 'v3'\s*\? freezeVirtualChurchUnanimatedCloneBoneMatrices\(cloned, sourceClips\)\s*: null/)
  assert.match(hero, /cleanupGuard\.release\(\(\) => \{[\s\S]*staticBoneMatrices\?\.supported\) staticBoneMatrices\.restore\(\)/)
  const legacy = view.slice(view.indexOf('const AnimatedPlayerAvatar ='))
  assert.doesNotMatch(legacy, /shareVirtualChurchOwnedCloneSkeletons\(/)
  assert.doesNotMatch(legacy, /freezeVirtualChurchUnanimatedCloneBoneMatrices\(/)
})

test('static clone bones inherit animated parents and restore without changing authored static flags', () => {
  const root = new Group(), parent = new Bone(), child = new Bone(), authoredStatic = new Bone()
  parent.name = 'Parent'; child.position.y = 1; authoredStatic.matrixAutoUpdate = false
  root.add(parent, authoredStatic); parent.add(child)
  const clip = new AnimationClip('Turn', 1, [new QuaternionKeyframeTrack('Parent.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 1, 0])])
  const frozen = freezeVirtualChurchUnanimatedCloneBoneMatrices(root, [clip])
  assert.ok(frozen.supported); assert.equal(frozen.count, 1)
  assert.equal(parent.matrixAutoUpdate, true); assert.equal(child.matrixAutoUpdate, false)
  const mixer = new AnimationMixer(root); mixer.clipAction(clip).play(); mixer.setTime(.5)
  root.position.x = 3; root.updateMatrixWorld(true)
  assert.ok(child.getWorldPosition(new Vector3()).distanceTo(new Vector3(2, 0, 0)) < 1e-6)
  frozen.restore(); frozen.restore()
  assert.equal(child.matrixAutoUpdate, true); assert.equal(authoredStatic.matrixAutoUpdate, false)
  mixer.stopAllAction(); mixer.uncacheRoot(root)
})

test('unknown, indirect or unresolved bindings leave every clone bone update enabled', () => {
  for (const name of ['Missing.position', 'Root.userData[x]', '.bones[0].quaternion']) {
    const root = new Group(), bone = new Bone(); root.name = 'Root'; root.add(bone)
    const result = freezeVirtualChurchUnanimatedCloneBoneMatrices(root, [new AnimationClip('Unknown', 1, [new NumberKeyframeTrack(name, [0, 1], [0, 1])])])
    assert.equal(result.supported, false); assert.equal(bone.matrixAutoUpdate, true)
  }
})

for (const hero of ['female', 'male']) for (const quality of ['high', 'medium', 'low']) {
  test(`released ${hero} ${quality} hero retains animated skin vertices and independent clone ownership`, async () => {
    const release = hero === 'male' ? 'male-hero-v14-r1' : 'gate-a-baseline-r9'
    const bytes = readFileSync(new URL(`../public/virtual-church-assets/v3/releases/${release}/characters/character-hero-${hero}-${quality}.glb`, import.meta.url))
    const decoded = await decompressCharacterDraco(bytes), length = decoded.readUInt32LE(12)
    const document = JSON.parse(decoded.subarray(20, 20 + length).toString())
    const binary = decoded.subarray(length + 28)
    // Geometry/animation equivalence only; retain original assets and use browser QA for colour.
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
    const reference = clone(source.scene), consolidated = clone(source.scene)
    const parts = (model: Group) => {
      const meshes: SkinnedMesh[] = []
      model.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node) })
      return meshes
    }
    const original = parts(reference), optimized = parts(consolidated)
    const sourcePose = source.scene.toJSON()
    const mixers = [new AnimationMixer(reference), new AnimationMixer(consolidated)]
    const clips = gateARefineFemaleWalkGait(source.animations, hero === 'female')
    let frozen: ReturnType<typeof freezeVirtualChurchUnanimatedCloneBoneMatrices> | null = null
    try {
      const expectedParts = hero === 'male' ? 13 : 18
      assert.equal(original.length, expectedParts)
      assert.equal(new Set(original.map(mesh => mesh.skeleton)).size, expectedParts)
      assert.equal(shareVirtualChurchOwnedCloneSkeletons(consolidated), expectedParts - 1)
      assert.equal(new Set(optimized.map(mesh => mesh.skeleton)).size, 1)
      frozen = freezeVirtualChurchUnanimatedCloneBoneMatrices(consolidated, clips)
      assert.ok(frozen.supported)
      assert.equal(frozen.count, hero === 'male' ? 51 : 101)
      optimized.forEach((mesh, index) => {
        assert.equal(mesh.geometry, original[index].geometry)
        assert.equal(mesh.material, original[index].material)
        assert.ok(mesh.bindMatrix.equals(original[index].bindMatrix))
        assert.ok(mesh.bindMatrixInverse.equals(original[index].bindMatrixInverse))
        assert.notEqual(mesh.skeleton.bones[0], original[index].skeleton.bones[0])
      })
      assert.equal(clips.length, 14, 'exercise every released motion, including the refined female gait')
      for (const clip of clips) {
        mixers.forEach(mixer => { mixer.stopAllAction(); mixer.clipAction(clip).reset().play() })
        for (const time of [0, .13, .53, 1.27]) {
          mixers.forEach(mixer => mixer.setTime(time))
          for (const model of [reference, consolidated]) {
            model.position.set(time, .1, -time); model.rotation.y = time
          }
          reference.updateMatrixWorld(true); consolidated.updateMatrixWorld(true)
          original.forEach((mesh, index) => {
            mesh.skeleton.update(); optimized[index].skeleton.update()
            assert.deepEqual(Array.from(optimized[index].skeleton.boneMatrices), Array.from(mesh.skeleton.boneMatrices), `${clip.name}: bone buffer`)
            const count = mesh.geometry.getAttribute('position').count
            for (const vertex of [0, Math.floor(count / 3), Math.floor(count * 2 / 3), count - 1]) {
              const expected = mesh.getVertexPosition(vertex, new Vector3())
              const actual = optimized[index].getVertexPosition(vertex, new Vector3())
              assert.ok(actual.distanceTo(expected) < 1e-7, `${clip.name}: skin vertex`)
            }
          })
        }
      }
      assert.deepEqual(source.scene.toJSON(), sourcePose)
    } finally {
      if (frozen?.supported) frozen.restore()
      mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()) })
      disposeVirtualChurchCharacterSkeletons(reference); disposeVirtualChurchCharacterSkeletons(consolidated)
      disposeVirtualChurchCharacterSkeletons(source.scene)
      const geometry = new Set(parts(source.scene).map(mesh => mesh.geometry))
      const materials = new Set(parts(source.scene).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
      geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose())
    }
  })
}

test('overlapping decodes of one URL hold separate leases without resetting the scene', () => {
  const pending: Array<() => void> = []
  const disposed: object[] = []
  const registry = createVirtualChurchResourceLeaseRegistry<object>(
    (_key, resource) => disposed.push(resource),
    release => pending.push(release),
  )
  const first = {}
  const second = {}
  const releaseFirst = registry.retain('/nature/rock.glb', first)
  const releaseSecond = registry.retain('/nature/rock.glb', second)
  assert.deepEqual(registry.snapshot(), [{ key: '/nature/rock.glb', users: 2 }])

  releaseFirst()
  pending.shift()!()
  assert.deepEqual(disposed, [first])
  assert.equal(registry.has('/nature/rock.glb'), true)
  assert.deepEqual(registry.snapshot(), [{ key: '/nature/rock.glb', users: 1 }])

  releaseSecond()
  pending.shift()!()
  assert.deepEqual(disposed, [first, second])
  assert.equal(registry.has('/nature/rock.glb'), false)
  assert.deepEqual(registry.snapshot(), [])
})

test('replaying a lease before its deferred cleanup keeps the resource alive', () => {
  const pending: Array<() => void> = []
  const disposed: object[] = []
  const registry = createVirtualChurchResourceLeaseRegistry<object>(
    (_key, resource) => disposed.push(resource),
    release => pending.push(release),
  )
  const resource = {}
  registry.retain('/character.glb', resource)()
  const releaseReplay = registry.retain('/character.glb', resource)
  pending.shift()!()
  assert.deepEqual(disposed, [])
  assert.deepEqual(registry.snapshot(), [{ key: '/character.glb', users: 1 }])
  releaseReplay()
  pending.shift()!()
  assert.deepEqual(disposed, [resource])
})

test('male V14 review card uses its own warm-ivory render, not the green V12 portrait', () => {
  const service = readFileSync(new URL('../src/services/virtualChurchService.ts', import.meta.url), 'utf8')
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(service, /VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS:[\s\S]*?>> = import\.meta\.env\.DEV \? \{/)
  assert.match(service, /VIRTUAL_CHURCH_CHARACTER_REVIEW_PICKERS:[\s\S]*?>> = import\.meta\.env\.DEV \? \{/)
  assert.match(service, /'male-v14': '\/__alife-review\/virtual-church\/character-hero-male-v14-picker\.webp'/)
  assert.match(vite, /'\/__alife-review\/virtual-church\/character-hero-male-v14-picker\.webp': 'male-v14-picker'/)
  assert.match(vite, /'male-v14-picker': resolve\([\s\S]*?defaultMaleV14CharacterReviewPickerFile/)
  assert.match(vite, /review\.endsWith\('-picker'\) \? 'image\/webp' : 'model\/gltf-binary'/)
  assert.match(vite, /response\.setHeader\('Cache-Control', 'no-store, max-age=0'\)/)
})

test('reviewed avatar is posed and tinted before its first visible frame and ready signal', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const start = view.indexOf('const GateASkinnedFemaleHero =')
  const end = view.indexOf('\nconst GateASharedMotionReviewHero =', start)
  assert.ok(start >= 0 && end > start)
  const avatar = view.slice(start, end)
  assert.match(avatar, /const \[poseReady, setPoseReady\] = useState\(false\)/)
  assert.match(avatar, /const \[appearanceReady, setAppearanceReady\] = useState\(false\)/)
  assert.match(avatar, /const avatarReady = prepared && poseReady && appearanceReady/)
  assert.match(avatar, /VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE, avatarReady/)
  assert.match(avatar, /useLayoutEffect\(\(\) => \{\s*const tint = new Color\(gateAOutfitMaterialTint\(outfitId\)\)/)
  assert.match(avatar, /gateAApplyOutfitMaterialTint\([\s\S]*setAppearanceReady\(true\)/)
  assert.match(avatar, /useLayoutEffect\(\(\) => \{\s*cleanupGuard\.activate\(\)/)
  assert.match(avatar, /\.setEffectiveWeight\(1\)\s*\.play\(\)/)
  assert.match(avatar, /mixer\.update\(0\)\s*setPoseReady\(true\)/)
  assert.match(avatar, /visible=\{avatarReady\}/)
})

test('V3 never renders the legacy avatar while the reviewed character is loading', () => {
  const view = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const start = view.indexOf('const DeferredPlayerAvatar =')
  const end = view.indexOf('\nconst ', start + 'const DeferredPlayerAvatar ='.length)
  assert.ok(start >= 0 && end > start)
  const avatar = view.slice(start, end)
  const v3 = avatar.slice(avatar.indexOf("if (config3D.visualVersion === 'v3')"), avatar.indexOf('\n  if (!loadDetailedAvatar)'))
  assert.match(v3, /fallback=\{null\}/)
  assert.match(v3, /<Suspense fallback=\{null\}>/)
  assert.doesNotMatch(v3, /LegacyCharacterAssetBoundary|AnimatedPlayerAvatar|legacyCharacterAssetPath/)
  assert.match(avatar.slice(avatar.indexOf('\n  if (!loadDetailedAvatar)')), /<AnimatedPlayerAvatar/)
})

test('late network metadata cannot republish a profile from an unmounted avatar', async () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchPerformanceProbe.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('const publicationEpoch = publicationEpochRef.current')
  const end = source.indexOf('    })()', start)
  assert.ok(start >= 0 && end > start)
  const publication = source.slice(start, end + '    })()'.length)
  for (const unmounted of [false, true]) {
    const writes: string[] = []
    const epoch = { current: 0 }
    let finish!: (value: object) => void
    const network = new Promise(resolve => { finish = resolve })
    runInNewContext(publication, {
      publicationEpochRef: epoch,
      diagnosticTransport: 'network',
      readDiagnosticNetworkProfile: () => network,
      report: { loading: {} },
      VIRTUAL_CHURCH_PROFILE_ATTRIBUTE: 'profile',
      VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE: 'sampling',
      document: { documentElement: {
        setAttribute: (name: string) => writes.push(name),
        removeAttribute: (name: string) => writes.push(name),
      } },
      console: { info: () => {} },
    })
    if (unmounted) epoch.current += 1
    finish({ kilobitsPerSecond: 10000, latencyMs: 150 })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(writes, unmounted ? [] : ['profile', 'sampling'])
  }
})
