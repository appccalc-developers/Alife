import type { Camera, Object3D, Scene } from 'three'

type PlantVisibilityEntry = {
  mesh: Object3D
  update: (camera: Camera) => void
}

const entriesByScene = new WeakMap<Scene, Set<PlantVisibilityEntry>>()

export function registerVirtualChurchPlantVisibility(
  scene: Scene,
  mesh: Object3D,
  update: (camera: Camera) => void,
) {
  let entries = entriesByScene.get(scene)
  if (!entries) {
    entries = new Set()
    entriesByScene.set(scene, entries)
  }
  const entry = { mesh, update }
  entries.add(entry)
  return () => {
    entries.delete(entry)
    if (entries.size === 0) entriesByScene.delete(scene)
  }
}

export function updateVirtualChurchPlantVisibility(scene: Scene, camera: Camera) {
  if (!scene.visible) return
  for (const entry of entriesByScene.get(scene) ?? []) {
    // Match traverseVisible: a detached mesh or any hidden ancestor is skipped.
    let node: Object3D | null = entry.mesh
    while (node && node !== scene && node.visible) node = node.parent
    if (node === scene) entry.update(camera)
  }
}
