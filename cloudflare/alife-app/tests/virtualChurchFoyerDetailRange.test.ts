import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VIRTUAL_CHURCH_FOYER_DETAIL_DESKTOP_EXTERIOR_RANGE_METRES,
  VIRTUAL_CHURCH_FOYER_DETAIL_LOW_RANGE_METRES,
  VIRTUAL_CHURCH_FOYER_PHOTO_PRELOAD_RANGE_METRES,
  virtualChurchShouldLoadFoyerPhotos,
  virtualChurchShouldRenderFoyerDetail,
  virtualChurchWorldCameraIsInsideFoyer,
} from '../src/views/virtualChurchFoyerDetailRange.ts'
import {
  VIRTUAL_CHURCH_FOYER_CIRCULATION,
  VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW,
  VIRTUAL_CHURCH_FOYER_VIEW,
} from '../src/views/virtualChurchInteractionContract.ts'
import { SCENE_LANDMARKS } from '../src/views/virtualChurchScene.ts'

test('Low foyer detail stays visible throughout the walkable room and camera boom', () => {
  const route = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const farthestWalkableRadius = Math.hypot(route.branchLeftX, route.oppositeDoorZ)
  assert.ok(VIRTUAL_CHURCH_FOYER_DETAIL_LOW_RANGE_METRES > farthestWalkableRadius + 5)
  assert.equal(virtualChurchShouldRenderFoyerDetail(true, farthestWalkableRadius + 5, 0, 0, 0, true), true)
  assert.equal(virtualChurchShouldRenderFoyerDetail(true, 0, 0, 0, 0, false), true)
})

test('desktop hides only exterior far detail; both quality tiers retain occupied and unknown rooms', () => {
  const desktopRange = VIRTUAL_CHURCH_FOYER_DETAIL_DESKTOP_EXTERIOR_RANGE_METRES
  assert.equal(virtualChurchShouldRenderFoyerDetail(false, desktopRange, 0, 0, 0, false), true)
  assert.equal(virtualChurchShouldRenderFoyerDetail(false, desktopRange + .1, 0, 0, 0, false), false)
  assert.equal(virtualChurchShouldRenderFoyerDetail(false, 42, 0, 0, 0, true), true)
  assert.equal(virtualChurchShouldRenderFoyerDetail(true, 30, 0, 0, 0, false), true)
  assert.equal(virtualChurchShouldRenderFoyerDetail(true, 42, 0, 0, 0, false), false)
  assert.equal(virtualChurchShouldRenderFoyerDetail(false, Number.NaN, 0, 0, 0, false), true)
  assert.equal(virtualChurchShouldRenderFoyerDetail(true, Number.NaN, 0, 0, 0, false), true)
  // Current desktop follow camera at the parking spawn is outside this range.
  assert.equal(virtualChurchShouldRenderFoyerDetail(false, -35.7603, -3.7368, -10.21, 13.28, false), false)
})

test('foyer photos wait outdoors, prefetch near the doors, and load after an interior guide jump', () => {
  const radius = VIRTUAL_CHURCH_FOYER_PHOTO_PRELOAD_RANGE_METRES
  assert.equal(virtualChurchShouldLoadFoyerPhotos(39, 0, 0, 0, false), false)
  assert.equal(virtualChurchShouldLoadFoyerPhotos(radius, 0, 0, 0, false), true)
  assert.equal(virtualChurchShouldLoadFoyerPhotos(radius + 0.1, 0, 0, 0, false), false)
  assert.equal(virtualChurchShouldLoadFoyerPhotos(39, 0, 0, 0, true), true)
  assert.equal(virtualChurchShouldLoadFoyerPhotos(Number.NaN, 0, 0, 0, false), true)
})

test('world-space camera Z is converted before checking whether the foyer is occupied', () => {
  for (const view of [VIRTUAL_CHURCH_FOYER_VIEW, VIRTUAL_CHURCH_FOYER_JUNCTION_VIEW, VIRTUAL_CHURCH_FOYER_RIGHT_JUNCTION_VIEW]) {
    const [foyerX, , foyerSourceZ] = view.position
    assert.equal(virtualChurchWorldCameraIsInsideFoyer(foyerX, -foyerSourceZ), true)
  }
  const [streetX, , streetSourceZ] = SCENE_LANDMARKS.streetFrontPreview
  assert.equal(virtualChurchWorldCameraIsInsideFoyer(streetX, -streetSourceZ), false)
})

test('Low street-front review does not submit hidden foyer detail or request courtyard photos', () => {
  const [streetX, , streetSourceZ] = SCENE_LANDMARKS.streetFrontPreview
  const [entranceX, , entranceSourceZ] = SCENE_LANDMARKS.entrance
  const streetWorldZ = -streetSourceZ
  const entranceWorldZ = -entranceSourceZ
  const insideFoyer = virtualChurchWorldCameraIsInsideFoyer(streetX, streetWorldZ)
  assert.equal(insideFoyer, false)
  assert.equal(virtualChurchShouldRenderFoyerDetail(
    true, streetX, streetWorldZ, entranceX, entranceWorldZ, insideFoyer,
  ), false)
  assert.equal(virtualChurchShouldLoadFoyerPhotos(
    streetX, streetWorldZ, entranceX, entranceWorldZ, insideFoyer,
  ), false)
})
