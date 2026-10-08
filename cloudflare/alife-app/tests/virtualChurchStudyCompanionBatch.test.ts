import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { Bone, BoxGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, ShaderChunk, Skeleton, SkinnedMesh, Texture, Vector3, Vector4 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from '../../../tools/virtual-church/gate-a-character-geometry.mjs'
import { createStudyCompanionBatch, studyInstanceSkinningChunk } from '../src/views/virtualChurchStudyCompanionBatch.ts'
import { createSeatedStudyCompanion, STUDY_COMPANION_SEATS } from '../src/views/virtualChurchStudyPose.ts'
import { createVirtualChurchStrictModeCleanupGuard } from '../src/views/virtualChurchResourceLeaseContract.ts'

async function realSource() {
  const bytes = await readFile(new URL('../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/characters/character-hero-female-low.glb', import.meta.url))
  const decoded = await decompressCharacterDraco(bytes), length = decoded.readUInt32LE(12)
  const document = JSON.parse(decoded.subarray(20, 20 + length).toString()), binary = decoded.subarray(length + 28)
  // Geometry/rigger proof only. Real image/material appearance is browser QA.
  document.materials = document.materials.map((material: { name: string; alphaMode?: string; doubleSided?: boolean }) => ({ name: material.name, alphaMode: material.alphaMode, doubleSided: material.doubleSided }))
  delete document.images; delete document.textures
  const text = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
  text.copy(json)
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8)
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4)
  const file = Buffer.concat([header, json, binaryHeader, binary])
  return (await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.length), '')).scene
}

function disposeSource(source: Object3D) {
  source.traverse(node => {
    if (!(node instanceof Mesh)) return
    node.geometry.dispose()
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
  })
}

test('actual Low room clones keep every triangle, per-person skin position, material and independent motion in 18 batches', async () => {
  const source = await realSource()
  const people = STUDY_COMPANION_SEATS.map((seat, index) => createSeatedStudyCompanion(source, seat.tint, index))
  const batch = createStudyCompanionBatch(people.map(person => person.model))
  assert.ok(batch, 'released Low model must use the optimized path, not silently fall back')
  try {
    assert.equal(batch.instances.length, 18)
    assert.equal(new Set(batch.palette.bones).size, batch.palette.bones.length, 'never alias different people')
    const parts = people.map(person => {
      const result: SkinnedMesh[] = []
      person.model.traverse(node => { if (node instanceof SkinnedMesh) result.push(node) })
      return result
    })
    const stride = parts[0][0].skeleton.bones.length
    assert.equal(batch.palette.bones.length, stride * 5)
    const originalTriangles = parts.flat().reduce((sum, part) => sum + part.geometry.index!.count / 3, 0)
    assert.equal(batch.instances.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3 * mesh.count, 0), originalTriangles)
    const expectedWorld = new Vector3(), actualWorld = new Vector3(), boneMatrix = new Matrix4(), instanceMatrix = new Matrix4()
    const base = new Vector4(), weighted = new Vector4(), result = new Vector4()
    let checked = 0, maxError = 0
    for (const time of [0, 1.5, 7, 15]) {
      people.forEach(person => person.updateMotion(time)); batch.update(); batch.palette.update()
      for (let person = 0; person < 5; person++) {
        const seat = STUDY_COMPANION_SEATS[person], placement = new Object3D()
        placement.position.set(...seat.position); placement.rotation.y = seat.yaw; placement.updateMatrix()
        for (let part = 0; part < 18; part++) {
          const old = parts[person][part], mesh = batch.instances[part], geometry = mesh.geometry
          mesh.getMatrixAt(person, instanceMatrix)
          assert.ok(new Matrix4().multiplyMatrices(placement.matrix, old.matrixWorld).elements.every((value, index) => Math.abs(value - instanceMatrix.elements[index]) < 2e-7))
          const color = new Vector3().fromArray(mesh.instanceColor!.array, person * 3)
          const material = old.material as MeshBasicMaterial | MeshStandardMaterial
          assert.ok(color.distanceTo(new Vector3(material.color.r, material.color.g, material.color.b)) < 1e-7)
          assert.equal((mesh.material as MaterialLike).transparent, material.transparent)
          assert.equal((mesh.material as MaterialLike).side, material.side)
          assert.equal((mesh.material as MaterialLike).alphaTest, material.alphaTest)
          const position = geometry.getAttribute('position'), skinIndex = geometry.getAttribute('skinIndex'), skinWeight = geometry.getAttribute('skinWeight')
          for (let vertex = 0; vertex < position.count; vertex++) {
            old.getVertexPosition(vertex, expectedWorld).applyMatrix4(old.matrixWorld).applyMatrix4(placement.matrix)
            base.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex), 1).applyMatrix4(mesh.bindMatrix)
            result.set(0, 0, 0, 0)
            for (let influence = 0; influence < 4; influence++) {
              const joint = skinIndex.getComponent(vertex, influence) + person * stride
              boneMatrix.fromArray(batch.palette.boneMatrices, joint * 16)
              weighted.copy(base).applyMatrix4(boneMatrix).multiplyScalar(skinWeight.getComponent(vertex, influence))
              result.add(weighted)
            }
            result.applyMatrix4(mesh.bindMatrixInverse)
            actualWorld.set(result.x, result.y, result.z).applyMatrix4(instanceMatrix)
            maxError = Math.max(maxError, actualWorld.distanceTo(expectedWorld)); checked++
          }
        }
      }
    }
    assert.ok(checked > 100000)
    assert.ok(maxError < 1e-6, `GPU palette and original skinning differ by ${maxError} m`)
    assert.ok(people.every(person => person.model.parent === null), 'no reparenting or rig rewriting')
    let meshDisposals = 0, textureDisposals = 0, geometryDisposals = 0
    batch.instances.forEach(mesh => {
      mesh.addEventListener('dispose', () => meshDisposals++)
      mesh.geometry.addEventListener('dispose', () => geometryDisposals++)
    })
    batch.palette.computeBoneTexture()
    batch.palette.boneTexture!.addEventListener('dispose', () => textureDisposals++)
    batch.dispose(); batch.dispose()
    assert.equal(meshDisposals, 18); assert.equal(textureDisposals, 1); assert.equal(geometryDisposals, 0)
  } finally { batch.dispose(); people.forEach(person => person.dispose()); disposeSource(source) }
})

type MaterialLike = MeshBasicMaterial | MeshStandardMaterial

function simplePeople() {
  const geometry = new BoxGeometry(.2, .2, .2)
  geometry.setAttribute('skinIndex', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 4), 4))
  const weights = new Float32Array(geometry.getAttribute('position').count * 4)
  for (let index = 0; index < weights.length; index += 4) weights[index] = 1
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4)); geometry.clearGroups()
  const models = Array.from({ length: 5 }, () => {
    const model = new Object3D(), bone = new Bone(), mesh = new SkinnedMesh(geometry, new MeshStandardMaterial())
    mesh.name = 'same-part'; model.add(bone, mesh); mesh.bind(new Skeleton([bone])); return model
  })
  return { models, geometry, part: (index: number) => models[index].getObjectByName('same-part') as SkinnedMesh }
}

test('incompatible models remain intact for fallback, including mixed geometry, binds, materials, morphs and non-skinned meshes', () => {
  for (const change of ['missing-person', 'matrix', 'bind', 'material', 'morph', 'regular', 'geometry', 'hidden', 'unknown-shader']) {
    const input = simplePeople(), part = input.part(4)
    let extra: BoxGeometry | undefined
    if (change === 'missing-person') input.models.pop()
    if (change === 'matrix') part.position.y = .1
    if (change === 'bind') part.bindMatrix.elements[12] = .1
    if (change === 'material') (part.material as MeshStandardMaterial).roughness = .2
    if (change === 'morph') { extra = input.geometry.clone(); extra.morphAttributes.position = [extra.getAttribute('position')]; part.geometry = extra }
    if (change === 'regular') input.models[4].add(new Mesh(input.geometry, part.material))
    if (change === 'geometry') { extra = input.geometry.clone(); extra.getAttribute('position').setX(0, 10); part.geometry = extra }
    if (change === 'hidden') part.visible = false
    if (change === 'unknown-shader') input.models.forEach((_, index) => {
      const material = input.part(index).material as MeshStandardMaterial
      material.onBeforeCompile = shader => { shader.uniforms.unknownPerPerson = { value: index } }
    })
    assert.equal(createStudyCompanionBatch(input.models), null, change)
    assert.equal(part.parent, input.models[4] ?? part.parent)
    extra?.dispose(); input.geometry.dispose()
    input.models.forEach(model => model.traverse(node => { if (node instanceof SkinnedMesh) { node.skeleton.dispose(); (node.material as MeshStandardMaterial).dispose() } }))
  }
})

test('colour/depth shaders share the exact instance bone offset, preserving fabric dye and no asset shader mutation', () => {
  const input = simplePeople()
  input.models.forEach((_, index) => {
    const material = input.part(index).material as MeshStandardMaterial
    material.color.setRGB(.2 + index * .1, .4, .5)
    material.userData.studyFabricTint = material.color.toArray()
    material.customProgramCacheKey = () => 'study-companion-fabric-v1'
    material.onBeforeCompile = shader => {
      shader.fragmentShader = `uniform vec3 studyFabricTint;\n${shader.fragmentShader}\nstudyFabricTint * vec3(1.);`
    }
  })
  const original = ShaderChunk.skinning_pars_vertex
  const batch = createStudyCompanionBatch(input.models)
  assert.ok(batch)
  try {
    const mesh = batch.instances[0], material = mesh.material as MeshStandardMaterial
    const shader = { vertexShader: '#include <skinning_pars_vertex>\n#include <color_vertex>', fragmentShader: 'void main(){}', uniforms: {} }
    material.onBeforeCompile(shader as never, {} as never)
    assert.match(shader.vertexShader, /gl_InstanceID \* 1/)
    assert.match(shader.vertexShader, /vStudyFabricTint = instanceColor;/)
    assert.match(shader.fragmentShader, /varying vec3 vStudyFabricTint;/)
    assert.doesNotMatch(shader.fragmentShader, /uniform vec3 studyFabricTint/)
    const depth = { vertexShader: '#include <skinning_pars_vertex>', fragmentShader: '', uniforms: {} }
    mesh.customDepthMaterial!.onBeforeCompile(depth as never, {} as never)
    assert.match(depth.vertexShader, /gl_InstanceID \* 1/)
    assert.equal(ShaderChunk.skinning_pars_vertex, original)
    assert.throws(() => studyInstanceSkinningChunk(0)); assert.throws(() => studyInstanceSkinningChunk(1.5))
  } finally { batch.dispose(); input.geometry.dispose(); input.models.forEach((_, index) => (input.part(index).material as MeshStandardMaterial).dispose()) }
})

test('batch release never frees borrowed geometry/maps/rigs and refuses different texture identities', () => {
  const input = simplePeople(), texture = new Texture(), otherTexture = new Texture()
  let mapDisposals = 0, geometryDisposals = 0, boneDisposals = 0
  texture.addEventListener('dispose', () => mapDisposals++)
  input.geometry.addEventListener('dispose', () => geometryDisposals++)
  input.models.forEach((_, index) => {
    const part = input.part(index)
    ;(part.material as MeshStandardMaterial).map = texture
    part.skeleton.computeBoneTexture()
    part.skeleton.boneTexture!.addEventListener('dispose', () => boneDisposals++)
  })
  const batch = createStudyCompanionBatch(input.models)
  assert.ok(batch)
  assert.equal((batch.instances[0].material as MeshStandardMaterial).map, texture)
  batch.dispose()
  assert.equal(mapDisposals, 0); assert.equal(geometryDisposals, 0); assert.equal(boneDisposals, 0)
  ;(input.part(4).material as MeshStandardMaterial).map = otherTexture
  assert.equal(createStudyCompanionBatch(input.models), null, 'same-looking maps cannot hide distinct samplers/UV transforms')
  input.geometry.dispose(); texture.dispose(); otherTexture.dispose()
  input.models.forEach((_, index) => { input.part(index).skeleton.dispose(); (input.part(index).material as MeshStandardMaterial).dispose() })
})

test('StrictMode effect replay renews the same batch but real unmount frees it exactly once', async () => {
  const input = simplePeople(), batch = createStudyCompanionBatch(input.models)
  assert.ok(batch)
  const scheduled: Array<() => void> = [], guard = createVirtualChurchStrictModeCleanupGuard(callback => scheduled.push(callback))
  let disposed = 0
  batch.instances[0].addEventListener('dispose', () => disposed++)
  guard.activate(); guard.release(() => batch.dispose()); guard.activate()
  scheduled.splice(0).forEach(callback => callback())
  assert.equal(disposed, 0)
  guard.release(() => batch.dispose()); scheduled.splice(0).forEach(callback => callback())
  assert.equal(disposed, 1)
  const view = await readFile(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url), 'utf8')
  assert.match(view, /batchCleanup\.activate\(\)[\s\S]*?batchCleanup\.release\(\(\) => companionBatch\?\.dispose\(\)\)/)
  assert.match(view, /useFrame\(\(\) => companionBatch\?\.update\(\), -1\)/)
  input.geometry.dispose(); input.models.forEach((_, index) => { input.part(index).skeleton.dispose(); (input.part(index).material as MeshStandardMaterial).dispose() })
})
