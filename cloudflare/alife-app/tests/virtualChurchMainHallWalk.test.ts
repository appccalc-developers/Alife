import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { PerspectiveCamera, Vector3 } from 'three'
import { MAIN_HALL_CHAIR_PARTS, MAIN_HALL_CHAIRS, MAIN_HALL_DIMENSIONS, MAIN_HALL_STAGE_ACCESS } from '../src/views/virtualChurchMainHallLayout.ts'
import { MAIN_HALL_FOYER_EXIT_CENTERS, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z, MAIN_HALL_WALK_START, MAIN_HALL_WALK_REVIEW_DURATION_MS, createMainHallWalkReview, mainHallWalkReviewEnabled, mainHallFoyerExitDoorAt, mainHallWalkStartForDoor, mainHallWalkable, stepMainHallWalk } from '../src/views/virtualChurchMainHallWalk.ts'

test('bounded input review requires all three explicit review parameters', () => {
  assert.equal(mainHallWalkReviewEnabled(new URLSearchParams('?profile3d=desktop&profile3dTiming=1&profile3dInput=main-hall-walk')), true)
  for (const search of ['', '?profile3d=desktop', '?profile3dTiming=1&profile3dInput=main-hall-walk', '?profile3d=mobile&profile3dInput=main-hall-walk', '?profile3d=desktop&profile3dTiming=1&profile3dInput=locomotion']) {
    assert.equal(mainHallWalkReviewEnabled(new URLSearchParams(search)), false)
  }
})

test('review traverses both real aisles and turns through the ordinary collision controller, then stops', () => {
  for (const door of [0, 1]) {
    const review = createMainHallWalkReview()
    let pose = mainHallWalkStartForDoor(door), minimumZ = pose.z
    const phases = new Set<string>()
    for (let elapsed = 0; elapsed <= MAIN_HALL_WALK_REVIEW_DURATION_MS; elapsed += 20) {
      const sample = review.advance(7000 + elapsed, true, false)
      phases.add(sample.phase)
      pose = stepMainHallWalk(pose, sample.input, .02)
      minimumZ = Math.min(minimumZ, pose.z)
      assert.ok(mainHallWalkable(pose.x, pose.z))
      assert.equal(mainHallFoyerExitDoorAt(pose.x, pose.z), null, 'review must not leave the room')
    }
    assert.deepEqual([...phases], ['forward', 'backward', 'turn', 'complete'])
    assert.ok(minimumZ < 2 && pose.yaw < -9, 'both translation and rotation actually occur')
    const stopped = review.advance(999999, true, false)
    assert.equal(stopped.status, 'complete')
    assert.deepEqual(stopped.input, { forward: 0, strafe: 0, turn: 0 })
    assert.deepEqual(stepMainHallWalk(pose, stopped.input, .02), pose)
  }
})

test('background, manual input, blur, clock failures and slow callbacks cannot resume an input review', () => {
  for (const cause of ['hidden', 'manual-input', 'window-blur', 'clock', 'frame-gap']) {
    const review = createMainHallWalkReview()
    review.advance(1000, true, false)
    if (cause === 'window-blur') review.cancel(cause)
    const stopped = review.advance(cause === 'clock' ? NaN : cause === 'frame-gap' ? 2000 : 1020, cause !== 'hidden', cause === 'manual-input')
    assert.equal(stopped.status, 'cancelled')
    assert.equal(stopped.reason, cause)
    assert.deepEqual(stopped.input, { forward: 0, strafe: 0, turn: 0 })
    assert.equal(review.advance(1040, true, false).status, 'cancelled')
  }
  const repeatedClock = createMainHallWalkReview()
  repeatedClock.advance(100, true, false)
  assert.equal(repeatedClock.advance(100, true, false).reason, 'clock')
})

test('runtime review feeds the existing controller and is disabled for reduced motion without its own timer', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  const controller = view.split('function HallWalkCamera(')[1].split('function HallRearDoor(')[0]
  assert.ok(view.includes('mainHallWalkReviewEnabled(new URLSearchParams(window.location.search)) && !reducedMotion'))
  assert.ok(controller.includes('if (startingWalk && inputReview) reviewRun.current = createMainHallWalkReview()'))
  assert.ok(controller.includes('reviewRun.current?.advance(performance.now(), !document.hidden, Boolean(input.forward || input.strafe || input.turn))'))
  assert.ok(controller.includes("if (review?.status === 'running') input = review.input"))
  assert.ok(controller.includes('stepMainHallWalk(walkPose.current, input, delta)'))
  assert.ok(controller.includes("reviewRun.current?.cancel('manual-input')"))
  assert.ok(controller.includes('delete gl.domElement.dataset.mainHallWalkReview'))
  assert.doesNotMatch(controller, /requestAnimationFrame\(|setInterval\(|setTimeout\(/)
})

test('both foyer entrances open at distinct walkable rear aisles in the review candidate', () => {
  const first = mainHallWalkStartForDoor(0)
  const second = mainHallWalkStartForDoor(1)
  assert.deepEqual(first, MAIN_HALL_WALK_START)
  assert.ok(first.x > 0 && second.x < 0)
  assert.equal(first.z, second.z)
  assert.ok(mainHallWalkable(first.x, first.z))
  assert.ok(mainHallWalkable(second.x, second.z))
  assert.ok(MAIN_HALL_CHAIRS.every(chair => Math.abs(chair.x - first.x) > .35 || Math.abs(chair.z - first.z) > .7))
  assert.ok(MAIN_HALL_CHAIRS.every(chair => Math.abs(chair.x - second.x) > .35 || Math.abs(chair.z - second.z) > .7))
})

test('historical review walk starts in an aisle and cannot pass through a chair, stage, or wall', () => {
  assert.ok(mainHallWalkable(MAIN_HALL_WALK_START.x, MAIN_HALL_WALK_START.z))
  const chair = MAIN_HALL_CHAIRS[0]
  assert.equal(mainHallWalkable(chair.x, chair.z), false)
  const chairFront = chair.z + MAIN_HALL_CHAIR_PARTS.seat.z - MAIN_HALL_CHAIR_PARTS.seat.depth / 2
  assert.equal(mainHallWalkable(chair.x, chairFront - .2), false,
    'the player must not clip the front edge of a recalibrated seat')
  assert.equal(mainHallWalkable(0, MAIN_HALL_DIMENSIONS.stageZ), false)
  assert.equal(mainHallWalkable(MAIN_HALL_DIMENSIONS.width / 2, 0), false)
  assert.equal(mainHallWalkable(0, MAIN_HALL_DIMENSIONS.depth / 2), false)
  assert.equal(mainHallWalkable(Number.NaN, 0), false)
})

test('only the two cut rear openings can hand a walking visitor back to the matching foyer door', () => {
  for (const [index, center] of MAIN_HALL_FOYER_EXIT_CENTERS.entries()) {
    assert.equal(mainHallFoyerExitDoorAt(center, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z - .01), null)
    assert.equal(mainHallWalkable(center, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z), true)
    assert.equal(mainHallFoyerExitDoorAt(center, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z), index)
    assert.equal(mainHallWalkable(center, MAIN_HALL_DIMENSIONS.depth / 2), false)
  }
  assert.equal(mainHallFoyerExitDoorAt(0, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z), null)
  assert.equal(mainHallWalkable(0, MAIN_HALL_FOYER_EXIT_THRESHOLD_Z), false)
  assert.equal(mainHallFoyerExitDoorAt(Number.NaN, 11), null)
  assert.equal(mainHallFoyerExitDoorAt(0, Number.NaN), null)
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  assert.match(view, /mainHallFoyerExitDoorAt\(x, z\)/)
  assert.match(view, /onExit\(exitDoor\)/)
  assert.match(view, /main-hall-foyer-exit-/)
  assert.match(view, /height - 2\.4/)
  assert.match(view, /[Ww]alk back through a rear door to return to the foyer/)
})

test('forward motion follows the right-hand aisle and stops at the stage', () => {
  let pose = { ...MAIN_HALL_WALK_START }
  for (let frame = 0; frame < 220; frame += 1) {
    pose = stepMainHallWalk(pose, { forward: 1, strafe: 0, turn: 0 }, .05)
    assert.ok(mainHallWalkable(pose.x, pose.z))
  }
  assert.ok(Math.abs(pose.x - MAIN_HALL_WALK_START.x) < .001)
  assert.ok(pose.z < -5.9, 'the aisle must remain traversable from back to front')
  assert.ok(pose.z > MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2)
})

test('walking cannot pass through the photo-informed stage handrails', () => {
  const access = MAIN_HALL_STAGE_ACCESS
  const z = (access.railFrontZ + access.railBackZ) / 2
  for (const centerX of access.stairCentersX) {
    for (const side of [-1, 1]) {
      assert.equal(mainHallWalkable(centerX + side * access.railOffsetX, z), false)
    }
    assert.equal(mainHallWalkable(centerX, z), true, 'the gap between rails stays open up to the stage')
  }
  assert.equal(mainHallWalkable(MAIN_HALL_WALK_START.x, z), true, 'the main aisle remains open')
})

test('walk input is frame-clamped, diagonal speed is normalized, and turning changes heading', () => {
  const straight = stepMainHallWalk(MAIN_HALL_WALK_START, { forward: 1, strafe: 0, turn: 0 }, .05)
  const diagonal = stepMainHallWalk(MAIN_HALL_WALK_START, { forward: 1, strafe: 1, turn: 0 }, .05)
  assert.ok(Math.hypot(diagonal.x - MAIN_HALL_WALK_START.x, diagonal.z - MAIN_HALL_WALK_START.z) <= MAIN_HALL_WALK_START.z - straight.z + .0001)
  const delayed = stepMainHallWalk(MAIN_HALL_WALK_START, { forward: 1, strafe: 0, turn: 0 }, 5)
  assert.deepEqual(delayed, straight)
  const turned = stepMainHallWalk(MAIN_HALL_WALK_START, { forward: 0, strafe: 0, turn: 1 }, .05)
  assert.ok(turned.yaw < 0)
  assert.equal(turned.x, MAIN_HALL_WALK_START.x)
})

test('right/left turn inputs move the actual camera view to the corresponding side at every cardinal heading', () => {
  const camera = new PerspectiveCamera()
  const direction = new Vector3()
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const pose = { ...MAIN_HALL_WALK_START, yaw }
    const initialForward = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const initialRight = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    for (const turn of [-1, 1]) {
      const result = stepMainHallWalk(pose, { forward: 0, strafe: 0, turn }, .05)
      camera.position.set(result.x, 1.68, result.z)
      camera.lookAt(result.x - Math.sin(result.yaw), 1.68, result.z - Math.cos(result.yaw))
      camera.getWorldDirection(direction)
      assert.ok(direction.dot(initialRight) * turn > 0, `turn ${turn} from ${yaw} must look to that side`)
      assert.ok(direction.dot(initialForward) > .99, 'small turn remains forward-facing')
      assert.equal(result.x, pose.x)
      assert.equal(result.z, pose.z)
    }
  }
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  assert.match(view, /Number\(keys.has\('KeyE'\) \|\| keys.has\('ArrowRight'\)\) - Number\(keys.has\('KeyQ'\) \|\| keys.has\('ArrowLeft'\)\)/)
  assert.match(view, /walkControl\('turn', 1, zh \? '向右转' : 'Turn right'/)
  assert.match(view, /walkControl\('turn', -1, zh \? '向左转' : 'Turn left'/)
  assert.match(view, /camera.lookAt\(x - Math.sin\(yaw\) \* cosine, MAIN_HALL_WALK_EYE_HEIGHT \+ Math.sin\(pitch.current\), z - Math.cos\(yaw\) \* cosine\)/)
  assert.match(view, /cameraQuaternion: args\[2\].quaternion.toArray\(\)/)
})

test('walk preview keeps photo comparison, bilingual controls and demand rendering', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  assert.match(view, /view === 'walk'/)
  assert.match(view, /<HallCamera view=\{view\}/)
  assert.match(view, /frameloop="demand"/)
  assert.match(view, /stepMainHallWalk/)
  assert.match(view, /'步行查看' : 'Walk through'/)
  assert.match(view, /'向前走' : 'Walk forward'/)
  assert.match(view, /'向左转' : 'Turn left'/)
  assert.match(view, /onPointerCancel=/)
  assert.match(view, /onLostPointerCapture=/)
  assert.match(view, /target\?\.closest\('button, a, input, select, textarea, \[contenteditable="true"\], \[role="dialog"\]'\)/)
  assert.match(view, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/)
  assert.match(view, /window\.addEventListener\('orientationchange', onBlur\)/)
  assert.match(view, /document\.addEventListener\('focusin', onFocusIn\)/)
  assert.match(view, /if \(heldKeys\.current\.has\(event\.code\)\) event\.preventDefault\(\)/)
})

test('explicit walk-mode entry hands keyboard focus to the scene without weakening control focus guards', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  const walkButton = view.split("aria-label={zh ? '步行查看' : 'Walk through'}")[1].split('</button>')[0]
  assert.match(walkButton, /onClick=\{\(\) => \{ setView\('walk'\); pageRef\.current\?\.focus\(\{ preventScroll: true \}\) \}\}/)
  // A focused return/language button, form or dialog must still own its keys.
  const keyDown = view.split('const onKeyDown =')[1].split('const onKeyUp =')[0]
  assert.match(keyDown, /target\?\.closest\('button, a, input, select, textarea, \[contenteditable="true"\], \[role="dialog"\]'\)\) return/)
  assert.ok(keyDown.indexOf('closest(') < keyDown.indexOf('heldKeys.current.add'))
  assert.match(view, /<main ref=\{pageRef\} tabIndex=\{-1\}/)
})
