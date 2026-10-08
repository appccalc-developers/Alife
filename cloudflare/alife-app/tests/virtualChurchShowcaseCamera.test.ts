import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createVirtualChurchTeleport, virtualChurchCameraLerpFactor } from '../src/views/virtualChurchTeleport.ts'
import { VIRTUAL_CHURCH_BUILDING_FOOTPRINT } from '../src/views/virtualChurchInteractionContract.ts'
import { SCENE_SHOWCASE_CAMERA, SCENE_V3_SHOWCASE_CAMERA } from '../src/views/virtualChurchScene.ts'

const closeTo = (actual: number, expected: number, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`)

test('guide destination selected before controller mount is applied once, latest selection wins', () => {
  const teleport = createVirtualChurchTeleport(), calls: unknown[] = []
  const destination: [number, number, number] = [4, 0, 8]
  teleport.request([1, 0, 2], .2)
  teleport.request(destination, .7)
  destination[0] = 99
  const detach = teleport.attach((position, yaw) => calls.push({ position, yaw }))
  assert.deepEqual(calls, [{ position: [4, 0, 8], yaw: .7 }])
  detach()
  teleport.attach((position, yaw) => calls.push({ position, yaw }))
  assert.equal(calls.length, 1, 'StrictMode effect replay must not replay an already consumed choice')
  teleport.request([8, 1, 3], -.3)
  assert.deepEqual(calls[1], { position: [8, 1, 3], yaw: -.3 })
})

test('unmounted controller queues new choices and stale cleanup cannot detach its replacement', () => {
  const teleport = createVirtualChurchTeleport(), calls: string[] = []
  const detachOld = teleport.attach(() => calls.push('old'))
  detachOld(); teleport.request([1, 2, 3], 0)
  assert.deepEqual(calls, [])
  const detachNew = teleport.attach(() => calls.push('new'))
  detachOld(); teleport.request([4, 5, 6], 1)
  assert.deepEqual(calls, ['new', 'new'])
  detachNew()
  const freshView = createVirtualChurchTeleport()
  freshView.attach(() => calls.push('fresh'))
  assert.deepEqual(calls, ['new', 'new'], 'route visits have no shared pending state')
  assert.throws(() => teleport.request([NaN, 0, 0], 0), /Invalid/)
  assert.throws(() => teleport.request([0, 0, 0], Infinity), /Invalid/)
})

test('guide choice waits for the player group instead of disappearing during a cold load', () => {
  const teleport = createVirtualChurchTeleport()
  const calls: Array<{ position: number[]; yaw: number }> = []
  let playerReady = false
  const detach = teleport.attach((position, yaw) => {
    if (!playerReady) return false
    calls.push({ position, yaw })
  })

  teleport.request([1, 0, 2], .2)
  teleport.request([4, 0, 8], .7)
  assert.deepEqual(calls, [])
  playerReady = true
  teleport.flush()
  teleport.flush()
  assert.deepEqual(calls, [{ position: [4, 0, 8], yaw: .7 }])
  detach()
})

test('all nine guide destinations use the view-owned queue and controller detaches on unmount', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const teleportRef = useMemo\(createVirtualChurchTeleport, \[\]\)/)
  const guideHandlers = source.slice(source.indexOf('const returnToEntrance ='), source.indexOf('const changeCameraMode ='))
  assert.equal((guideHandlers.match(/teleportRef.request\(/g) ?? []).length, 9)
  assert.match(source, /const detachTeleport = teleportRef.attach\(/)
  assert.match(source, /detachTeleport\(\)/)
  assert.match(source, /if \(!playerRef\.current\) return false/)
  assert.match(source, /if \(player\) teleportRef\.flush\(\)/)
  assert.doesNotMatch(source, /teleportRef.current/)
})

test('guide jumps snap the camera once without changing normal follow smoothing', () => {
  assert.equal(virtualChurchCameraLerpFactor(true, false, 11, 1 / 60), 1)
  assert.equal(virtualChurchCameraLerpFactor(true, false, 5.5, 1 / 60), 1)
  assert.equal(virtualChurchCameraLerpFactor(false, true, 11, 1 / 60), 1)
  closeTo(virtualChurchCameraLerpFactor(false, false, 11, 1 / 60), 1 - Math.exp(-11 / 60))
  closeTo(virtualChurchCameraLerpFactor(false, false, 5.5, 1 / 60), 1 - Math.exp(-5.5 / 60))
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /teleportCameraPendingRef\.current = true/)
  assert.equal((source.match(/virtualChurchCameraLerpFactor\(snapTeleportedCamera, reducedMotion,/g) ?? []).length, 3)
  assert.match(source, /camera\.lookAt\(lookAt\)\s*teleportCameraPendingRef\.current = false/)
})

test('hero view centres and faces the signed street elevation', () => {
  const [startX, startSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[15]
  const [endX, endSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[0]
  const startZ = -startSourceZ
  const endZ = -endSourceZ
  const midpointX = (startX + endX) / 2
  const midpointZ = (startZ + endZ) / 2
  const [lookX, lookY, lookZ] = SCENE_SHOWCASE_CAMERA.lookAt
  const [cameraX, cameraY, cameraZ] = SCENE_SHOWCASE_CAMERA.position

  closeTo(lookX, midpointX)
  closeTo(lookZ, midpointZ)
  assert.ok(cameraY > lookY, 'camera should look gently down at the bilingual sign wall')

  const edgeX = endX - startX
  const edgeZ = endZ - startZ
  const edgeLength = Math.hypot(edgeX, edgeZ)
  const offsetX = cameraX - midpointX
  const offsetZ = cameraZ - midpointZ
  const setback = Math.hypot(offsetX, offsetZ)
  const alongFacadeOffset = (offsetX * edgeX + offsetZ * edgeZ) / edgeLength

  assert.ok(setback >= 18.8 && setback <= 19.2, `expected a roughly 19 m setback, received ${setback}`)
  assert.ok(Math.abs(alongFacadeOffset) < 0.02, `camera should be perpendicular to the facade, received ${alongFacadeOffset} m along it`)
})

test('V3 hero view moves toward the bilingual sign without changing the released V2 camera', () => {
  const [startX, startSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[15]
  const [endX, endSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[0]
  const startZ = -startSourceZ
  const endZ = -endSourceZ
  const edgeX = endX - startX
  const edgeZ = endZ - startZ
  const edgeLengthSquared = edgeX * edgeX + edgeZ * edgeZ
  const [lookX, lookY, lookZ] = SCENE_V3_SHOWCASE_CAMERA.lookAt
  const [cameraX, cameraY, cameraZ] = SCENE_V3_SHOWCASE_CAMERA.position
  const alongFacade = ((lookX - startX) * edgeX + (lookZ - startZ) * edgeZ) / edgeLengthSquared
  const lineOffset = Math.abs((lookX - startX) * edgeZ - (lookZ - startZ) * edgeX) / Math.sqrt(edgeLengthSquared)
  const setback = Math.hypot(cameraX - lookX, cameraZ - lookZ)
  const cameraAlongFacade = ((cameraX - lookX) * edgeX + (cameraZ - lookZ) * edgeZ) / Math.sqrt(edgeLengthSquared)

  assert.ok(alongFacade > .18 && alongFacade < .30, 'target should favor the sign bay, not the facade midpoint')
  assert.ok(lineOffset < .02, 'look target should remain on the real facade line')
  assert.ok(setback >= 12.8 && setback <= 13.2, 'sign should be readable from the shorter setback')
  assert.ok(Math.abs(cameraAlongFacade) < .02, 'camera should remain perpendicular to the signed facade')
  assert.ok(cameraY > lookY, 'cross and bilingual name should fit a gently downward view')
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /config3D\.visualVersion === 'v3' \? SCENE_V3_SHOWCASE_CAMERA : SCENE_SHOWCASE_CAMERA/)
})

test('V3 facade wordmark uses dark lettering on the pale sign wall while V2 keeps its release colors', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const ChurchFacadeSign = \(\{ position, rotation, visualVersion \}/)
  assert.match(source, /visualVersion === 'v3' \? '#292d2d' : '#f1f0ea'[\s\S]*?fillText\('基督城华人丰盛生命教会'/)
  assert.match(source, /visualVersion === 'v3' \? '#755226' : '#d5a94d'[\s\S]*?fillText\('182 THE RUNWAY · WIGRAM'/)
  assert.match(source, /<ChurchFacadeSign[^\n]+visualVersion=\{visualVersion\}/)
})

test('complete signed facade fits the supported short-landscape field of view', () => {
  const [startX, startSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[15]
  const [endX, endSourceZ] = VIRTUAL_CHURCH_BUILDING_FOOTPRINT[0]
  const facadeHalfWidth = Math.hypot(endX - startX, endSourceZ - startSourceZ) / 2
  const [lookX, , lookZ] = SCENE_SHOWCASE_CAMERA.lookAt
  const [cameraX, , cameraZ] = SCENE_SHOWCASE_CAMERA.position
  const setback = Math.hypot(cameraX - lookX, cameraZ - lookZ)
  const facadeHalfAngle = Math.atan2(facadeHalfWidth, setback)
  const verticalFov = SCENE_SHOWCASE_CAMERA.verticalFovDegrees * Math.PI / 180
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * SCENE_SHOWCASE_CAMERA.minimumLandscapeAspect,
  )

  const horizontalHalfFov = horizontalFov / 2
  const safeFrameUse = facadeHalfAngle / horizontalHalfFov

  assert.ok(
    safeFrameUse <= 0.85,
    `facade should use at most 85% of the short-landscape half-FOV, received ${safeFrameUse * 100}%`,
  )
})
