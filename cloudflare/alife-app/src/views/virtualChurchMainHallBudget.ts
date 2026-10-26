import { Frustum, Matrix4, type Camera, type InstancedMesh, type Mesh, type Object3D } from 'three'

// Explicit profile only: retain the first four callback-to-submission intervals,
// including the first draw. This is CPU/wall-clock evidence, never GPU time,
// navigation timing, or a reason to discard a cancelled walking review.
export function createMainHallInitialSubmissionRecorder() {
  type Start = { atMs: number; environmentPresent: boolean; shadowPending: boolean }
  const frames: Array<Start & { completedAtMs: number; durationMs: number; callbackGapMs: number | null }> = []
  let pending: Start | null = null, previousStartMs: number | null = null
  return {
    begin(atMs: number, environmentPresent: boolean, shadowPending: boolean) {
      if (frames.length >= 4 || !Number.isFinite(atMs)) return
      pending = { atMs, environmentPresent, shadowPending }
    },
    complete(completedAtMs: number) {
      if (!pending || !Number.isFinite(completedAtMs) || completedAtMs < pending.atMs) return
      frames.push({ ...pending, completedAtMs, durationMs: completedAtMs - pending.atMs,
        callbackGapMs: previousStartMs === null ? null : pending.atMs - previousStartMs })
      previousStartMs = pending.atMs
      pending = null
    },
    snapshot: () => ({ kind: 'first-four-frame-callback-through-submission-not-gpu-time', frames: frames.map(frame => ({ ...frame })) }),
  }
}

// Scene-cost diagnostic, not an FPS/GPU-residency or formal schema-7 profile.
// Count entire submitted instance batches, not only individual chairs in view.
export function measureMainHallSceneBudget(scene: Object3D, camera: Camera) {
  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  let sceneTriangleCeiling = 0
  let visibleTriangles = 0
  let visibleDrawCalls = 0
  scene.traverseVisible(node => {
    if (!(node as Mesh).isMesh) return
    const mesh = node as Mesh
    const geometry = mesh.geometry
    const available = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
    const start = Math.max(0, geometry.drawRange.start)
    const end = Math.min(available, geometry.drawRange.start + geometry.drawRange.count)
    const instances = (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).count : 1
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const ranges = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count: available, materialIndex: 0 }]
    let triangles = 0
    let draws = 0
    for (const range of ranges) {
      if (!materials[range.materialIndex ?? 0]?.visible) continue
      const submitted = Math.max(0, Math.min(end, range.start + range.count) - Math.max(start, range.start))
      if (!submitted || instances <= 0) continue
      triangles += submitted / 3 * instances
      draws++
    }
    sceneTriangleCeiling += triangles
    if (mesh.frustumCulled && !frustum.intersectsObject(mesh)) return
    visibleTriangles += triangles
    visibleDrawCalls += draws
  })
  return { sceneTriangleCeiling, visibleTriangles, visibleDrawCalls }
}
