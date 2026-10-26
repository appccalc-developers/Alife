import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { VIRTUAL_CHURCH_FOYER_CIRCULATION, VIRTUAL_CHURCH_FOYER_VIEW, virtualChurchPositionToEntranceLocal } from '../src/views/virtualChurchInteractionContract.ts'
import {
  virtualChurchMainHallArrivalDoor,
  virtualChurchMainHallDoorFromQuery,
  virtualChurchMainHallEntryView,
  virtualChurchMainHallEntryUrl,
  virtualChurchMainHallDoorReturnView,
  virtualChurchMainHallReturnUrl,
  virtualChurchMainHallPromptAfterProximity,
  virtualChurchCrossedMainHallThreshold,
  virtualChurchNearbyMainHallDoor,
} from '../src/views/virtualChurchMainHallPortal.ts'

test('both photographed left door banks have a V3-only proximity portal', () => {
  for (const index of [0, 1]) {
    const view = virtualChurchMainHallDoorReturnView(index)
    const local = virtualChurchPositionToEntranceLocal(view.position[0], view.position[2])
    const [start, end] = VIRTUAL_CHURCH_FOYER_CIRCULATION.leftDoorBanks[index]
    assert.ok(local.x > VIRTUAL_CHURCH_FOYER_CIRCULATION.aisleLeftX + 1)
    assert.ok(local.z > start && local.z < end)
    assert.equal(virtualChurchNearbyMainHallDoor(view.position[0], view.position[2], 'v3'), index)
    assert.equal(virtualChurchNearbyMainHallDoor(view.position[0], view.position[2], 'v2'), null)
    assert.ok(Math.abs(view.yaw - VIRTUAL_CHURCH_FOYER_VIEW.yaw) < 1e-8)
  }
  const one = virtualChurchMainHallDoorReturnView(0)
  assert.equal(virtualChurchNearbyMainHallDoor(one.position[0] + 20, one.position[2], 'v3'), null)
})

test('review entry and foyer arrival map only the two expected door identifiers', () => {
  assert.equal(virtualChurchMainHallDoorFromQuery('1'), 0)
  assert.equal(virtualChurchMainHallDoorFromQuery('2'), 1)
  assert.equal(virtualChurchMainHallDoorFromQuery('bad'), 0)
  assert.equal(virtualChurchMainHallEntryView('1'), 'walk')
  assert.equal(virtualChurchMainHallEntryView('2'), 'walk')
  assert.equal(virtualChurchMainHallEntryView(null), 'entrance')
  assert.equal(virtualChurchMainHallEntryView('bad'), 'entrance')
  assert.equal(virtualChurchMainHallArrivalDoor('main-hall-1'), 0)
  assert.equal(virtualChurchMainHallArrivalDoor('main-hall-2'), 1)
  assert.equal(virtualChurchMainHallArrivalDoor('main-hall-3'), null)
  assert.equal(virtualChurchMainHallArrivalDoor(null), null)
})

test('hall round trip preserves only the selected local character review', () => {
  const source = '?vcCharacterReview=male-v14&vcCharacterReviewQuality=low&vcSharedMotion=1&private=drop-me'
  for (const door of [0, 1]) {
    const entry = virtualChurchMainHallEntryUrl(door, 'male-v14', source, true)
    const entryQuery = new URL(entry, 'http://localhost').search
    assert.equal(new URLSearchParams(entryQuery).get('vcHallDoor'), String(door + 1))
    const returned = virtualChurchMainHallReturnUrl(door, entryQuery, true)
    const query = new URL(returned, 'http://localhost').searchParams
    assert.equal(query.get('vcCharacterReview'), 'male-v14')
    assert.equal(query.get('vcCharacterReviewQuality'), 'low')
    assert.equal(query.get('vcSharedMotion'), '1')
    assert.equal(query.get('vcVisual'), 'v3')
    assert.equal(query.get('vcArrival'), `main-hall-${door + 1}`)
    assert.equal(query.has('private'), false)
    assert.equal(query.has('vcHallDoor'), false)
  }
  assert.equal(virtualChurchMainHallEntryUrl(null, 'male-v14', source, true).includes('vcHallDoor'), false)
})

test('hall route uses the current picker selection and rejects invalid or unpublished query data', () => {
  const pickerEntry = virtualChurchMainHallEntryUrl(0, 'female-v14', '?vcCharacterReview=male-v14&vcSharedMotion=1', true)
  const pickerQuery = new URL(pickerEntry, 'http://localhost').searchParams
  assert.equal(pickerQuery.get('vcCharacterReview'), 'female-v14')
  assert.equal(pickerQuery.has('vcSharedMotion'), false)
  assert.equal(virtualChurchMainHallReturnUrl(0, `?${pickerQuery.toString()}`, true).includes('female-v14'), true)
  assert.equal(virtualChurchMainHallEntryUrl(0, 'unknown', '?vcCharacterReviewQuality=ultra', true), '/virtual-church/main-hall?vcHallDoor=1')
  assert.equal(virtualChurchMainHallEntryUrl(0, 'male-v14', '?vcCharacterReviewQuality=ultra&vcSharedMotion=0', true), '/virtual-church/main-hall?vcCharacterReview=male-v14&vcHallDoor=1')
  assert.equal(virtualChurchMainHallEntryUrl(1, 'male-v14', '?vcCharacterReview=male-v14', false), '/virtual-church/main-hall?vcHallDoor=2')
  assert.equal(virtualChurchMainHallReturnUrl(1, '?vcCharacterReview=male-v14&vcSharedMotion=1', false), '/virtual-church?vcVisual=v3&vcArrival=main-hall-2')
})

test('walking across either V3 main-hall threshold selects that door without opening V2', () => {
  for (const index of [0, 1]) {
    const { aisleLeftX, leftDoorBanks } = VIRTUAL_CHURCH_FOYER_CIRCULATION
    const localZ = (leftDoorBanks[index][0] + leftDoorBanks[index][1]) / 2
    const view = virtualChurchMainHallDoorReturnView(index)
    const local = virtualChurchPositionToEntranceLocal(view.position[0], view.position[2])
    const dx = aisleLeftX - .25 - local.x
    const dz = localZ - local.z
    const angle = view.yaw + Math.PI
    const worldX = view.position[0] + Math.cos(angle) * dx + Math.sin(angle) * dz
    const worldZ = view.position[2] - Math.sin(angle) * dx + Math.cos(angle) * dz
    assert.equal(virtualChurchCrossedMainHallThreshold(worldX, worldZ, 'v3'), index)
    assert.equal(virtualChurchCrossedMainHallThreshold(worldX, worldZ, 'v2'), null)
    assert.equal(virtualChurchCrossedMainHallThreshold(view.position[0], view.position[2], 'v3'), null)
  }
})

test('foyer return does not immediately offer re-entry but re-arms after leaving the doorway', () => {
  let gate = 'awaiting-arrival' as const
  const initial = virtualChurchMainHallPromptAfterProximity(gate, null)
  assert.equal(initial.gate, 'awaiting-arrival')
  assert.equal(initial.offeredDoor, null)
  const arrival = virtualChurchMainHallPromptAfterProximity(initial.gate, 0)
  assert.equal(arrival.gate, 'awaiting-departure')
  assert.equal(arrival.offeredDoor, null)
  const stillAtDoor = virtualChurchMainHallPromptAfterProximity(arrival.gate, 0)
  assert.equal(stillAtDoor.offeredDoor, null)
  const departure = virtualChurchMainHallPromptAfterProximity(stillAtDoor.gate, null)
  assert.equal(departure.gate, 'ready')
  assert.equal(departure.offeredDoor, null)
  assert.deepEqual(virtualChurchMainHallPromptAfterProximity(departure.gate, 1), { gate: 'ready', offeredDoor: 1 })
  assert.deepEqual(virtualChurchMainHallPromptAfterProximity('ready', 0), { gate: 'ready', offeredDoor: 0 })
})

test('door prompt and return are bilingual, actionable and reuse the teleport mailbox', () => {
  const church = readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
  const hall = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
  assert.match(church, /onNearMainHallDoor=\{updateNearMainHallDoor\}/)
  assert.match(church, /onEnterMainHallDoor=\{enterMainHallDoor\}/)
  assert.match(church, /const crossedMainHallDoor = virtualChurchCrossedMainHallThreshold\(/)
  assert.match(church, /enteredMainHallDoorRef\.current = true\s+onEnterMainHallDoor\(crossedMainHallDoor\)/)
  assert.match(church, /useAutomaticDoor\('main-hall-1'/)
  assert.match(church, /useAutomaticDoor\('main-hall-2'/)
  assert.match(church, /mainHallDoorAction: '进入主堂预览'/)
  assert.match(church, /mainHallDoorAction: 'Enter auditorium preview'/)
  assert.match(church, /navigate\(virtualChurchMainHallEntryUrl\(door, characterReview, window\.location\.search, import\.meta\.env\.DEV\)\)/)
  assert.match(church, /navigate\(virtualChurchMainHallEntryUrl\(null, characterReview, window\.location\.search, import\.meta\.env\.DEV\)\)/)
  assert.match(church, /\(\(\) => getVirtualChurchCharacterReview\(config3D\.visualVersion\)\)/)
  assert.match(church, /teleportRef\.request\(destination\.position, destination\.yaw\)/)
  assert.match(church, /arrivalCameraMode: CameraMode = config3D\.visualVersion === 'v3' && \(arrivalDoor !== null \|\| arrivalFromStudyRoom \|\| profile3DStartAtFoyer\) \? 'first' : 'follow'/)
  assert.match(church, /useRef<CameraMode>\(arrivalCameraMode\)/)
  assert.match(church, /useState<CameraMode>\(arrivalCameraMode\)/)
  assert.match(church, /if \(config3D\.visualVersion === 'v3' && \(arrivalDoor !== null \|\| arrivalFromStudyRoom\)\) return false/)
  assert.match(hall, /Back to foyer/)
  assert.match(hall, /navigate\(virtualChurchMainHallReturnUrl\(door, window\.location\.search, import\.meta\.env\.DEV\)\)/)
  assert.match(hall, /useState<MainHallCameraView \| 'walk'>\(enteredFromFoyerDoor \? 'walk' : 'entrance'\)/)
  assert.match(hall, /entryDoor=\{returnDoor\}/)
})
