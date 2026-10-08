import assert from 'node:assert/strict'
import test from 'node:test'
import { Group, PerspectiveCamera, Scene } from 'three'
import {
  registerVirtualChurchPlantVisibility,
  updateVirtualChurchPlantVisibility,
} from '../src/views/virtualChurchPlantVisibilityRegistry.ts'

test('plant visibility updates only registered, attached, visible meshes in the current scene', () => {
  const scene = new Scene(), otherScene = new Scene(), camera = new PerspectiveCamera()
  const parent = new Group(), mesh = new Group(), unregistered = new Group(), otherMesh = new Group()
  scene.add(parent, unregistered)
  otherScene.add(otherMesh)
  parent.add(mesh)
  const calls: unknown[] = []
  const release = registerVirtualChurchPlantVisibility(scene, mesh, currentCamera => calls.push(currentCamera))
  const releaseOther = registerVirtualChurchPlantVisibility(otherScene, otherMesh, () => calls.push('other'))

  updateVirtualChurchPlantVisibility(scene, camera)
  assert.deepEqual(calls, [camera])
  mesh.visible = false
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 1)
  mesh.visible = true
  parent.visible = false
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 1)
  parent.visible = true
  scene.visible = false
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 1)
  scene.visible = true
  parent.remove(mesh)
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 1)
  parent.add(mesh)
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 2)
  release()
  updateVirtualChurchPlantVisibility(scene, camera)
  assert.equal(calls.length, 2)
  updateVirtualChurchPlantVisibility(otherScene, camera)
  assert.equal(calls.at(-1), 'other')
  releaseOther()
})
