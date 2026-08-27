import type { EventDto } from '../types/event'
import type { EventFactInput, EventPlanComposeRequest } from '../types/eventComposition'

const compositionFact = (code: string, value: boolean | string | null): EventFactInput => ({
  code,
  value,
  certainty: value === null ? 'unknown' : 'confirmed',
  source: 'human',
})

export const buildCreationComposition = (event: EventDto): EventPlanComposeRequest => {
  const hasMoneyFlow = Boolean(
    (event.baseFeePerAdult ?? 0) > 0 ||
    (event.baseFeePerChild ?? 0) > 0 ||
    event.optionalActivities.some((activity) => activity.extraFee > 0),
  )
  const transportRequired = event.ram?.outingSafety.transportRequired ?? null
  const requiresRam = event.ram
    ? event.ram.isOuting === true || event.ram.hazards.length > 0 || transportRequired === true
    : null
  return {
    schemaVersion: '1.0.0',
    archetypeCode: 'simple-social',
    facts: {
      items: [
        compositionFact('people.registrationMode', event.maxCapacity > 0 ? 'required' : 'none'),
        compositionFact('visibility', event.visibility ?? 'groupVisible'),
        compositionFact('people.volunteersRequired', null),
        compositionFact('money.hasMoneyFlow', hasMoneyFlow),
        compositionFact('safety.requiresRam', requiresRam),
        compositionFact('people.childrenPresent', null),
        compositionFact('programme.productionRequired', null),
        compositionFact('place.resourcesRequired', null),
        compositionFact('move.transportRequired', transportRequired),
        compositionFact('move.accommodationRequired', null),
        compositionFact('food.serviceRequired', null),
        compositionFact('scale.multiZone', null),
        compositionFact('comms.followupRequired', null),
      ],
    },
    humanSelections: [],
    basePlanVersion: null,
  }
}
