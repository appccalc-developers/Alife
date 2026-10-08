import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Box3, Matrix4, MeshStandardMaterial, type BufferGeometry } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVirtualChurchRockSources } from '../src/views/virtualChurchGroundRockBatch.ts'

const loadRock = async (name: string) => {
  const bytes = await readFile(new URL(`../public/virtual-church-assets/nature/${name}.glb`, import.meta.url))
  return new Promise<{
    geometry: BufferGeometry
    material: MeshStandardMaterial
    matrix: Matrix4
  }[]>((resolve, reject) => {
    new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', gltf => {
      gltf.scene.updateMatrixWorld(true)
      const ground = new Matrix4().makeTranslation(0, -new Box3().setFromObject(gltf.scene).min.y, 0)
      const sources: { geometry: BufferGeometry; material: MeshStandardMaterial; matrix: Matrix4 }[] = []
      gltf.scene.traverse(node => {
        if (!('isMesh' in node) || !node.isMesh) return
        const mesh = node as typeof node & { geometry: BufferGeometry; material: MeshStandardMaterial }
        const material = mesh.material.clone()
        material.color.set(material.name === 'grass' ? '#5d7966' : '#867c6d')
        material.roughness = .9
        material.metalness = 0
        material.envMapIntensity = .35
        sources.push({ geometry: mesh.geometry, material, matrix: ground.clone().multiply(mesh.matrixWorld) })
      })
      resolve(sources)
    }, reject)
  })
}

for (const rock of ['rock-large-a', 'rock-large-c', 'rock-flat']) {
  test(`${rock} dirt and grass keep geometry and two tints in one V3 Low batch`, async () => {
    const sources = await loadRock(rock)
    assert.equal(sources.length, 2)
    const merged = mergeVirtualChurchRockSources(sources)
    assert.ok(merged)
    assert.equal(merged.geometry.index?.count,
      sources.reduce((sum, source) => sum + (source.geometry.index?.count ?? 0), 0))
    assert.equal(merged.geometry.getAttribute('position').count,
      sources.reduce((sum, source) => sum + source.geometry.getAttribute('position').count, 0))
    const color = merged.geometry.getAttribute('color')
    assert.equal(color.count, merged.geometry.getAttribute('position').count)
    const [firstCount, secondCount] = sources.map(source => source.geometry.getAttribute('position').count)
    for (let index = 0; index < firstCount; index += 1) {
      assert.ok(Math.abs(color.getX(index) - sources[0].material.color.r) < 1e-6)
    }
    for (let index = firstCount; index < firstCount + secondCount; index += 1) {
      assert.ok(Math.abs(color.getX(index) - sources[1].material.color.r) < 1e-6)
    }
    const expected = new Box3()
    sources.forEach(source => expected.union(new Box3().setFromBufferAttribute(source.geometry.getAttribute('position')).applyMatrix4(source.matrix)))
    assert.ok(merged.geometry.boundingBox?.min.distanceTo(expected.min) < 1e-4)
    assert.ok(merged.geometry.boundingBox?.max.distanceTo(expected.max) < 1e-4)
    assert.deepEqual(merged.matrix.elements, new Matrix4().elements)
    assert.equal(merged.material.vertexColors, true)
    merged.geometry.dispose()
    merged.material.dispose()
    sources.forEach(source => source.material.dispose())
  })
}

test('the three culvert rock variants retain positions and tints in one Low batch', async () => {
  const variants = await Promise.all(
    ['rock-large-a', 'rock-large-c', 'rock-flat'].map(loadRock),
  )
  const sources = variants.flatMap((variant, index) => variant.map(source => ({
    ...source,
    matrix: new Matrix4().makeTranslation(index * 3, -.13, index * 2).multiply(source.matrix),
  })))
  const merged = mergeVirtualChurchRockSources(sources)
  assert.ok(merged)
  assert.equal(merged.geometry.getAttribute('position').count,
    sources.reduce((sum, source) => sum + source.geometry.getAttribute('position').count, 0))
  assert.equal(merged.geometry.getAttribute('color').count,
    merged.geometry.getAttribute('position').count)
  const expected = new Box3()
  sources.forEach(source => expected.union(
    new Box3().setFromBufferAttribute(source.geometry.getAttribute('position')).applyMatrix4(source.matrix),
  ))
  assert.ok(merged.geometry.boundingBox?.min.distanceTo(expected.min) < 1e-4)
  assert.ok(merged.geometry.boundingBox?.max.distanceTo(expected.max) < 1e-4)
  merged.geometry.dispose()
  merged.material.dispose()
  sources.forEach(source => source.material.dispose())
})

test('rock batch refuses surfaces with different PBR settings', async () => {
  const sources = await loadRock('rock-large-a')
  sources[1].material.roughness = .4
  assert.equal(mergeVirtualChurchRockSources(sources), null)
  sources.forEach(source => source.material.dispose())
})
