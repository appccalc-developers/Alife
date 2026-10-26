import { virtualChurchPositionIsInsideFoyerInterior } from './virtualChurchInteractionContract.ts'

// Exterior-only distance LOD for the photo-backed foyer candidate. The
// desktop parking spawn is roughly 31 m from the entrance; its enclosed
// foyer props are not legible there. Always keep the full layer for a camera
// inside the walkable room, including its far side branches.
export const VIRTUAL_CHURCH_FOYER_DETAIL_DESKTOP_EXTERIOR_RANGE_METRES = 28
// Preserve the reviewed Low exterior threshold and its camera boom behavior.
export const VIRTUAL_CHURCH_FOYER_DETAIL_LOW_RANGE_METRES = 36
// The courtyard photos are only visible from the foyer. Request them a little
// before reaching the doors, or immediately for an interior guide teleport.
export const VIRTUAL_CHURCH_FOYER_PHOTO_PRELOAD_RANGE_METRES = 22

// The scene root mirrors source Z once. Camera positions are in world space,
// while foyer collision/inside predicates use the original source space.
export const virtualChurchWorldCameraIsInsideFoyer = (cameraX: number, cameraWorldZ: number) =>
  virtualChurchPositionIsInsideFoyerInterior(cameraX, -cameraWorldZ, 'v3')

export function virtualChurchShouldLoadFoyerPhotos(
  cameraX: number,
  cameraZ: number,
  entranceX: number,
  entranceZ: number,
  cameraIsInsideFoyer: boolean,
): boolean {
  if (cameraIsInsideFoyer) return true
  const dx = cameraX - entranceX
  const dz = cameraZ - entranceZ
  // An invalid camera state should not permanently hide the window view.
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return true
  return dx * dx + dz * dz <= VIRTUAL_CHURCH_FOYER_PHOTO_PRELOAD_RANGE_METRES ** 2
}

export function virtualChurchShouldRenderFoyerDetail(
  isMobile: boolean,
  cameraX: number,
  cameraZ: number,
  entranceX: number,
  entranceZ: number,
  cameraIsInsideFoyer: boolean,
): boolean {
  if (cameraIsInsideFoyer) return true
  const dx = cameraX - entranceX
  const dz = cameraZ - entranceZ
  // Unknown camera state must not make the foyer disappear.
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return true
  const range = isMobile
    ? VIRTUAL_CHURCH_FOYER_DETAIL_LOW_RANGE_METRES
    : VIRTUAL_CHURCH_FOYER_DETAIL_DESKTOP_EXTERIOR_RANGE_METRES
  return dx * dx + dz * dz <= range ** 2
}
