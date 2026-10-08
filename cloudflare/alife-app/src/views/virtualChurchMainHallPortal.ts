import {
  VIRTUAL_CHURCH_ENTRANCE_ANGLE,
  VIRTUAL_CHURCH_ENTRANCE_MID,
  VIRTUAL_CHURCH_FOYER_CIRCULATION,
  virtualChurchPositionToEntranceLocal,
} from './virtualChurchInteractionContract.ts'

// The auditorium remains a separate review scene. Both photographed left
// door banks can launch it, but the shell beyond them is not yet walkable.
export function virtualChurchNearbyMainHallDoor(x: number, z: number, visualVersion: 'v2' | 'v3'): number | null {
  if (visualVersion !== 'v3') return null
  const local = virtualChurchPositionToEntranceLocal(x, z)
  const { aisleLeftX, leftDoorBanks } = VIRTUAL_CHURCH_FOYER_CIRCULATION
  if (local.x < aisleLeftX + .3 || local.x > aisleLeftX + 2.25) return null
  const index = leftDoorBanks.findIndex(([start, end]) => local.z >= start - .22 && local.z <= end + .22)
  return index < 0 ? null : index
}

// Cross only the shallow threshold of an opened V3 door. Navigation happens
// before the unbuilt auditorium shell behind the door could be entered.
export function virtualChurchCrossedMainHallThreshold(x: number, z: number, visualVersion: 'v2' | 'v3'): number | null {
  if (visualVersion !== 'v3') return null
  const local = virtualChurchPositionToEntranceLocal(x, z)
  const { aisleLeftX, leftDoorBanks } = VIRTUAL_CHURCH_FOYER_CIRCULATION
  if (local.x >= aisleLeftX - .16 || local.x <= aisleLeftX - .38) return null
  const index = leftDoorBanks.findIndex(([start, end]) => local.z > start + .16 && local.z < end - .16)
  return index < 0 ? null : index
}

export const virtualChurchMainHallDoorFromQuery = (value: string | null): number => value === '2' ? 1 : 0

export const virtualChurchMainHallEntryView = (value: string | null): 'walk' | 'entrance' =>
  value === '1' || value === '2' ? 'walk' : 'entrance'

export const virtualChurchMainHallArrivalDoor = (value: string | null): number | null => {
  if (value === 'main-hall-1') return 0
  if (value === 'main-hall-2') return 1
  return null
}

const reviewCharacterIds = new Set([
  'female-v12', 'male-v12', 'female-v13', 'male-v13', 'female-v14', 'male-v14',
])

// Only the local, unpublished character review crosses the hall boundary.
// Keep the selected in-page character (which can differ from the entry URL),
// but never carry arbitrary source query fields into the next route.
const mainHallReviewQuery = (review: string | null, sourceSearch: string, isDevelopment: boolean) => {
  const result = new URLSearchParams()
  if (!isDevelopment || !review || !reviewCharacterIds.has(review)) return result
  const source = new URLSearchParams(sourceSearch)
  result.set('vcCharacterReview', review)
  const quality = source.get('vcCharacterReviewQuality')
  if (quality === 'high' || quality === 'medium' || quality === 'low') {
    result.set('vcCharacterReviewQuality', quality)
  }
  if (review === 'male-v14' && source.get('vcSharedMotion') === '1') {
    result.set('vcSharedMotion', '1')
  }
  return result
}

export const virtualChurchMainHallEntryUrl = (
  door: number | null,
  review: string | null,
  sourceSearch: string,
  isDevelopment: boolean,
) => {
  const query = mainHallReviewQuery(review, sourceSearch, isDevelopment)
  if (door !== null) query.set('vcHallDoor', door === 1 ? '2' : '1')
  const search = query.toString()
  return `/virtual-church/main-hall${search ? `?${search}` : ''}`
}

export const virtualChurchMainHallReturnUrl = (door: number, sourceSearch: string, isDevelopment: boolean) => {
  const source = new URLSearchParams(sourceSearch)
  const query = mainHallReviewQuery(source.get('vcCharacterReview'), sourceSearch, isDevelopment)
  query.set('vcVisual', 'v3')
  query.set('vcArrival', `main-hall-${door === 1 ? 2 : 1}`)
  return `/virtual-church?${query.toString()}`
}

export type MainHallArrivalPromptGate = 'awaiting-arrival' | 'awaiting-departure' | 'ready'

// A return spawn is deliberately beside its hall door. Do not immediately
// cover the foyer view with an offer to go back; re-arm it only after the
// visitor has actually left that doorway and approached again.
export function virtualChurchMainHallPromptAfterProximity(
  gate: MainHallArrivalPromptGate,
  nearbyDoor: number | null,
): { gate: MainHallArrivalPromptGate; offeredDoor: number | null } {
  if (gate === 'awaiting-arrival') return {
    gate: nearbyDoor === null ? 'awaiting-arrival' : 'awaiting-departure',
    offeredDoor: null,
  }
  if (gate === 'awaiting-departure') return {
    gate: nearbyDoor === null ? 'ready' : 'awaiting-departure',
    offeredDoor: null,
  }
  return { gate, offeredDoor: nearbyDoor }
}

export function virtualChurchMainHallDoorReturnView(index: number) {
  const { aisleLeftX, leftDoorBanks } = VIRTUAL_CHURCH_FOYER_CIRCULATION
  const [start, end] = leftDoorBanks[index === 1 ? 1 : 0]
  const localX = aisleLeftX + 1.35
  const localZ = (start + end) / 2
  return {
    position: [
      VIRTUAL_CHURCH_ENTRANCE_MID[0] + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * localX + Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * localZ,
      .095,
      VIRTUAL_CHURCH_ENTRANCE_MID[1] - Math.sin(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * localX + Math.cos(VIRTUAL_CHURCH_ENTRANCE_ANGLE) * localZ,
    ] as [number, number, number],
    // Follow the foyer's long axis on return. Facing across the hall puts the
    // third-person camera into the near wall and obscures the actual route.
    yaw: VIRTUAL_CHURCH_ENTRANCE_ANGLE - Math.PI,
    pitch: -.08,
  }
}
