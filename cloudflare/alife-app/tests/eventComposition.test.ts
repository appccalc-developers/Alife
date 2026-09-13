import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eventSurfaceRegistry,
  resolveEventSurface,
  resolveEventSurfacePath,
} from '../src/components/events/eventSurfaceRegistry.ts'
import { eventSurfaceKeys } from '../src/types/eventComposition.ts'
import {
  omitServerControlledEventFacts,
  resolveWorkspaceLoadFailure,
  resolveWorkspaceMutationFailure,
} from '../src/utils/eventWorkspaceState.ts'
import type { EventDto } from '../src/types/event.ts'
import type { EventArchetype } from '../src/types/eventComposition.ts'
import {
  applyAiCopyDraft,
  deriveAiCandidateFacts,
  proposalIsCurrent,
  resolveActivityType,
} from '../src/utils/eventCreationWizard.ts'

test('controlled event surface registry resolves every contract key exactly once', () => {
  assert.deepEqual(Object.keys(eventSurfaceRegistry).sort(), [...eventSurfaceKeys].sort())
  assert.equal(new Set(Object.values(eventSurfaceRegistry).map((entry) => entry.surfaceKey)).size, 14)
  assert.equal(resolveEventSurface('workspace.governance')?.componentContract, 'EventPackageGovernanceWorkspace')
  assert.equal(resolveEventSurface('workspace.workflow'), null)
  assert.equal(resolveEventSurface('safety.ram')?.componentContract, 'EventRamWorkspace')
  assert.equal(resolveEventSurfacePath('follow-up')?.surfaceKey, 'comms.followup')
})

test('unknown server or AI supplied surface keys fail closed', () => {
  assert.equal(resolveEventSurface('https://example.test/remote-component.js'), null)
  assert.equal(resolveEventSurface('../../views/AdminView'), null)
  assert.equal(resolveEventSurface('ai.generated.component'), null)
  assert.equal(resolveEventSurfacePath('../finance'), null)
})

test('registered presentation never contains an executable URL or import path', () => {
  for (const entry of Object.values(eventSurfaceRegistry)) {
    assert.match(entry.componentContract, /^[A-Z][A-Za-z0-9]+$/)
    assert.ok(entry.presentation === 'tab' || entry.presentation === 'page')
    assert.equal(entry.pathSegment?.includes('/') ?? false, false)
  }
})

test('workspace errors map to explicit permission, stale, conflict and generic states', () => {
  assert.equal(resolveWorkspaceLoadFailure(403), 'permission-denied')
  assert.equal(resolveWorkspaceLoadFailure(500), 'error')
  assert.equal(resolveWorkspaceMutationFailure(412), 'stale')
  assert.equal(resolveWorkspaceMutationFailure(409), 'conflict')
  assert.equal(resolveWorkspaceMutationFailure(422), 'error')
})

test('workspace recomposition omits server-controlled facts from legacy plans', () => {
  const planFacts = [
    {
      code: 'event.exists', value: true, certainty: 'confirmed', source: 'legacyBackfill',
    },
    {
      code: 'safety.requiresRam', value: true, certainty: 'confirmed', source: 'human',
    },
  ] as const

  const requestFacts = omitServerControlledEventFacts(planFacts)

  assert.deepEqual(requestFacts.map((fact) => fact.code), ['safety.requiresRam'])
  assert.equal(planFacts.length, 2)
})

test('four-archetype catalogue filters sixteen unique activity types and unknown codes fail closed', () => {
  const archetypes = ['simple-social', 'camp-retreat', 'recurring-gathering', 'festival-celebration']
    .map((archetypeCode, archetypeIndex) => ({
      code: archetypeCode,
      version: 1,
      name: { en: archetypeCode, zh: archetypeCode },
      isSeries: archetypeCode === 'recurring-gathering', occurrenceCount: 1,
      hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [],
      conditionalModules: [], workflowTemplateRecommendations: [],
      activityTypes: Array.from({ length: 4 }, (_, typeIndex) => ({
        code: `type-${archetypeIndex}-${typeIndex}`,
        version: 1,
        archetypeCode,
        name: { en: 'Type', zh: '类型' },
        description: { en: '', zh: '' },
        iconKey: 'people',
        defaults: { visibility: 'groupVisible' as const, registrationMode: 'none' as const, capacityUnit: 'People' as const },
        preselectedModules: ['COMMS.FOLLOWUP'],
        recommendedWorkflowTemplateCode: null,
        presetServiceSlots: [],
      })),
    })) satisfies EventArchetype[]

  const codes = archetypes.flatMap((archetype) => archetype.activityTypes.map((type) => type.code))
  assert.equal(archetypes.length, 4)
  assert.equal(codes.length, 16)
  assert.equal(new Set(codes).size, 16)
  assert.equal(resolveActivityType(archetypes, 'camp-retreat', 'type-1-2')?.archetypeCode, 'camp-retreat')
  assert.equal(resolveActivityType(archetypes, 'simple-social', 'type-1-2'), null)
  assert.equal(resolveActivityType(archetypes, 'simple-social', '../../unknown'), null)
})

test('AI adoption is limited to bilingual copy and safety-derived values remain candidates', () => {
  const aiDraft = exampleEvent()
  aiDraft.title = { en: 'AI title', zh: 'AI 标题' }
  aiDraft.ram!.outingSafety.transportRequired = true
  aiDraft.ram!.isOuting = true
  const current = {
    title: { en: 'Current', zh: '目前' },
    description: { en: '', zh: '' },
    locationName: { en: '', zh: '' },
  }

  const copy = applyAiCopyDraft(current, aiDraft)
  const candidates = deriveAiCandidateFacts(aiDraft)

  assert.deepEqual(copy.title, aiDraft.title)
  assert.equal(candidates['move.transportRequired'], true)
  assert.equal(candidates['safety.requiresRam'], true)
  assert.deepEqual(Object.keys(copy).sort(), ['description', 'locationName', 'title'])
})

test('any draft signature change invalidates a reviewed proposal', () => {
  assert.equal(proposalIsCurrent('same', 'same'), true)
  assert.equal(proposalIsCurrent('same', 'changed'), false)
  assert.equal(proposalIsCurrent('', ''), false)
})

const exampleEvent = (): EventDto => ({
  title: { en: 'Event', zh: '活动' }, description: { en: '', zh: '' }, locationName: { en: '', zh: '' },
  startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-01T02:00:00Z',
  registrationDeadline: '2026-08-31T00:00:00Z', maxCapacity: 20, capacityUnit: 'People',
  hardConstraints: [], optionalActivities: [], currency: 'NZD', galleryUrls: [], visibility: 'groupVisible',
  ram: {
    activityName: { en: '', zh: '' }, activityDescription: { en: '', zh: '' }, participantCount: null,
    participantAgeRange: { en: '', zh: '' }, isOuting: null, hazards: [], emergencyContacts: [],
    leaderConfirmed: false, missingInformation: [], outingSafety: {
      transportRequired: null, licensedDriverConfirmed: null, vehicleRegistrationConfirmed: null,
      vehicleWofConfirmed: null, venueRiskAssessed: null, firstAidKitAvailable: null,
      trainedFirstAiderName: '', trainedFirstAiderQualificationConfirmed: null,
      participantHealthNeedsReviewed: null, weatherPlanReviewed: null,
    },
  },
})
