import { Object3D, VSMShadowMap, type Camera, type DirectionalLight, type InstancedMesh, type Mesh, type MeshStandardMaterial, type Scene, type WebGLRenderer } from 'three'

/** Compare depth-producing state after world matrices update, not camera view.
 * Unsupported/deforming casters deliberately retain per-frame shadow rendering.
 * No geometry, material, texture or shadow target is owned by this cache.
 */
export function createVirtualChurchShadowCache() {
  const previous: unknown[] = []
  return {
    reset() { previous.length = 0 },
    needsUpdate(scene: Scene, camera: Camera, shadowType: number) {
      let cursor = 0
      let changed = false
      let dynamic = shadowType === VSMShadowMap // VSM also renders receivers.
      const track = (...values: unknown[]) => {
        for (const value of values) {
          if (previous[cursor] !== value) changed = true
          previous[cursor++] = value
        }
      }
      track(scene, camera.layers.mask, shadowType)
      scene.traverseVisible(object => {
        if ('isLight' in object && object.castShadow) {
          const light = object as DirectionalLight
          if (!light.isDirectionalLight) { dynamic = true; return }
          light.target.updateWorldMatrix(true, false)
          const shadow = light.shadow
          track(light, light.layers.mask, ...light.matrixWorld.elements, ...light.target.matrixWorld.elements,
            shadow, shadow.map, shadow.mapSize.x, shadow.mapSize.y, shadow.autoUpdate, shadow.needsUpdate, shadow.camera.layers.mask,
            ...shadow.camera.projectionMatrix.elements)
        }
        if (!object.castShadow || !object.layers.test(camera.layers)) return
        if (!('isMesh' in object)) {
          if (!('isLight' in object)) dynamic = true
          return
        }
        const mesh = object as Mesh
        if ('isSkinnedMesh' in mesh || 'isBatchedMesh' in mesh || mesh.morphTargetInfluences?.length || mesh.customDepthMaterial
          || mesh.customDistanceMaterial || mesh.onBeforeShadow !== Object3D.prototype.onBeforeShadow) dynamic = true
        track(mesh, ...mesh.matrixWorld.elements, mesh.geometry, mesh.frustumCulled)
        const geometry = mesh.geometry
        track(geometry.drawRange.start, geometry.drawRange.count, geometry.index, geometry.index?.version)
        for (const [name, attribute] of Object.entries(geometry.attributes)) {
          track(name, attribute, 'data' in attribute ? attribute.data.version : attribute.version)
        }
        for (const group of geometry.groups) track(group.start, group.count, group.materialIndex)
        if ('isInstancedMesh' in mesh) {
          const instanced = mesh as InstancedMesh
          if (instanced.morphTexture) dynamic = true
          track(instanced.count, instanced.instanceMatrix, instanced.instanceMatrix.version)
        }
        for (const entry of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const material = entry as MeshStandardMaterial
          // These sources can change depth without matrix/buffer version changes.
          if (material.alphaTest > 0 || material.alphaToCoverage || material.displacementMap
            || material.clippingPlanes?.length || 'isShaderMaterial' in material) dynamic = true
          track(material, material.version, material.visible, material.side, material.shadowSide,
            material.wireframe, material.wireframeLinewidth)
        }
      })
      // Retiring a custom/deforming caster must clear the last dynamic map
      // even when its ordinary mesh/material/buffer signature did not change.
      track(dynamic)
      if (previous.length !== cursor) changed = true
      previous.length = cursor
      return changed || dynamic
    },
  }
}

/** Scene hook runs after animation/world transforms and before shadow submission.
 * Offscreen prewarming cannot consume the visible scene's pending invalidation.
 */
export function installVirtualChurchShadowCache(scene: Scene, renderer: WebGLRenderer) {
  const cache = createVirtualChurchShadowCache()
  const previousHook = scene.onBeforeRender
  const previousAutoUpdate = renderer.shadowMap.autoUpdate
  const hook: Scene['onBeforeRender'] = function (this: Scene, ...args) {
    previousHook.apply(this, args)
    if (args[0] !== renderer) return
    if (args[3] !== null || !renderer.shadowMap.enabled || renderer.localClippingEnabled || renderer.clippingPlanes.length > 0) {
      cache.reset()
      renderer.shadowMap.needsUpdate = true
      return
    }
    // Respect explicit invalidation requested elsewhere as well.
    renderer.shadowMap.needsUpdate = cache.needsUpdate(scene, args[2], renderer.shadowMap.type)
      || renderer.shadowMap.needsUpdate
  }
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  scene.onBeforeRender = hook
  return () => {
    if (scene.onBeforeRender === hook) scene.onBeforeRender = previousHook
    renderer.shadowMap.autoUpdate = previousAutoUpdate
    renderer.shadowMap.needsUpdate = true
    cache.reset()
  }
}
