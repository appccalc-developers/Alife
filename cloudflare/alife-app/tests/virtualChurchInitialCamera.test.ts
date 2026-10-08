import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { virtualChurchInitialFollowCamera, virtualChurchYawTowardLogicalPoint } from '../src/views/virtualChurchInitialCamera.ts'
import { SCENE_LANDMARKS } from '../src/views/virtualChurchScene.ts'

test('first frame starts at the same follow-camera target as the controller', () => {
  const { position, lookAt } = virtualChurchInitialFollowCamera(
    SCENE_LANDMARKS.playerStart,
    SCENE_LANDMARKS.playerStartYaw,
    0.24,
    6.2,
    1.9,
    3.2,
  )
  const [playerX, playerY, playerZ] = SCENE_LANDMARKS.playerStart

  assert.ok(Math.abs(Math.hypot(position[0] - playerX, position[2] + playerZ) - 6.2) < 1e-9)
  assert.equal(position[1], 1.9 + 0.24 * 3.2 + playerY * 0.6)
  assert.deepEqual(lookAt, [playerX, 1.4 + playerY, -playerZ])
})

test('canvas uses the player camera before its first render', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /camera=\{\{ position: INITIAL_FOLLOW_CAMERA_POSITION\.toArray\(\)/)
  assert.match(source, /onCreated=\{\(\{ gl, camera \}\) => \{(?:\s*if \(profile3DEnabled\) performance\.mark\('vc:canvas:created-start'\))?\s*camera\.lookAt\(\.\.\.INITIAL_FOLLOW_CAMERA\.lookAt\)/)
  assert.doesNotMatch(source, /camera=\{\{ position: \[42, 6\.5, 12\]/)
})

test('V3 arrival faces the real entrance while V2 keeps the driveway heading', () => {
  const yaw = virtualChurchYawTowardLogicalPoint(
    SCENE_LANDMARKS.playerStart,
    SCENE_LANDMARKS.entrance,
  )
  const dx = SCENE_LANDMARKS.entrance[0] - SCENE_LANDMARKS.playerStart[0]
  const dz = SCENE_LANDMARKS.entrance[2] - SCENE_LANDMARKS.playerStart[2]
  const length = Math.hypot(dx, dz)
  assert.ok(Math.abs(-Math.sin(yaw) - dx / length) < 1e-12)
  assert.ok(Math.abs(-Math.cos(yaw) - dz / length) < 1e-12)

  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const PLAYER_START_YAW = profile3DStartAtStreet\s*\? SCENE_LANDMARKS\.streetFrontPreviewYaw\s*: profile3DStartAtFoyer\s*\? VIRTUAL_CHURCH_FOYER_VIEW\.yaw\s*: config3D\.visualVersion === 'v3'\s*\? virtualChurchYawTowardLogicalPoint\(PLAYER_START, SCENE_LANDMARKS\.entrance\)\s*: SCENE_LANDMARKS\.playerStartYaw/)
  assert.match(source, /const cameraViewRef = useRef\(\{ yaw: PLAYER_START_YAW/)
  assert.match(source, /const initialPlayerYaw = gateAAvatarYawForMovement\(\s*-Math\.sin\(PLAYER_START_YAW\),\s*-Math\.cos\(PLAYER_START_YAW\)/)
})

test('street profiling starts at one fixed camera without changing public or hall-return arrivals', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const profile3DStartAtStreet = profile3DEnabled\s*&& profile3DSearchParams\.get\('profile3dView'\) === 'streetFront'\s*&& !profile3DSearchParams\.has\('vcArrival'\)/)
  assert.match(source, /const PLAYER_START = profile3DStartAtStreet\s*\? SCENE_LANDMARKS\.streetFrontPreview\s*: profile3DStartAtFoyer\s*\? VIRTUAL_CHURCH_FOYER_VIEW\.position\s*: SCENE_LANDMARKS\.playerStart/)
  assert.match(source, /const INITIAL_FOLLOW_CAMERA_PITCH = profile3DStartAtStreet\s*\? 0\.12\s*: profile3DStartAtFoyer \? VIRTUAL_CHURCH_FOYER_VIEW\.pitch : 0\.24/)
  assert.deepEqual(SCENE_LANDMARKS.streetFrontPreview, [-49.4, 0, 22.8])
  assert.equal(SCENE_LANDMARKS.streetFrontPreviewYaw, -0.69)
})

test('foyer profiling is V3-only, first person, and does not replace hall-return arrivals', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const profile3DStartAtFoyer = profile3DEnabled\s*&& config3D\.visualVersion === 'v3'\s*&& profile3DSearchParams\.get\('profile3dView'\) === 'foyer'\s*&& !profile3DSearchParams\.has\('vcArrival'\)/)
  assert.match(source, /const arrivalCameraMode: CameraMode = config3D\.visualVersion === 'v3' && \(arrivalDoor !== null \|\| arrivalFromStudyRoom \|\| profile3DStartAtFoyer\) \? 'first' : 'follow'/)
})
