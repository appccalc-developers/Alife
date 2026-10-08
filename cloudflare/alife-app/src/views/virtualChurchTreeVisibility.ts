import { Box3, Frustum, Matrix4, Sphere } from 'three'

/** Mobile trees do not cast shadows. Cull a whole tree only when its complete
 * near/far envelope is outside the camera; source +Z is mirrored by SiteScene.
 * Reuse scratch objects for every tree and never alter the caller's matrices.
 */
export function createVirtualChurchTreeVisibility(bounds: Box3) {
  const local = bounds.getBoundingSphere(new Sphere())
  const valid = !bounds.isEmpty() && [...local.center.toArray(), local.radius].every(Number.isFinite)
  const frustum = new Frustum(), projectionView = new Matrix4(), world = new Matrix4(), sphere = new Sphere()
  const mirror = new Matrix4().makeScale(1, 1, -1)
  return {
    update(projection: Matrix4, view: Matrix4) {
      frustum.setFromProjectionMatrix(projectionView.multiplyMatrices(projection, view))
    },
    isVisible(sourceRoot: Matrix4) {
      // Unknown bounds must not make a tree disappear.
      if (!valid) return true
      world.multiplyMatrices(mirror, sourceRoot)
      sphere.copy(local).applyMatrix4(world)
      return frustum.intersectsSphere(sphere)
    },
  }
}
