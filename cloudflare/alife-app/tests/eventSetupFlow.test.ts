import assert from 'node:assert/strict'
import test from 'node:test'
import { canPublishFromFlow, canVisitSetupStep, eventFlowLabels, publicationAudience, resolveSetupStage, setupPath, setupStages } from '../src/utils/eventSetupFlow.ts'
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../src/types/eventPackage.ts'
import { getRouteTransitionKey } from '../src/app/routing/routeTransitionPolicy.ts'

test('saved preparation stages share one mounted route while event identity changes remount', () => {
  const key = (pathname: string, stage: string) => getRouteTransitionKey({ pathname, search: `?flow=setup&stage=${stage}`, isManagedPublicPage: false })
  for (const path of ['/events/e/workspace', '/groups/g/events/e/workspace']) {
    assert.equal(key(path, 'details'), key(path, 'arrangements'))
    assert.equal(key(path, 'poster'), key(path, 'approval'))
    assert.notEqual(key(path, 'details'), key(path.replace('/e/', '/another/'), 'details'))
  }
})

test('one eight-step flow preserves the saved event identity and resolves only known stages', () => {
  assert.equal(eventFlowLabels(true).length, 8)
  assert.equal(eventFlowLabels(false).length, 8)
  assert.equal(setupPath('/groups/g/events/e', 'poster'), '/groups/g/events/e/workspace?flow=setup&stage=poster')
  assert.equal(resolveSetupStage('approval'), 'approval')
  assert.equal(resolveSetupStage('https://untrusted.test'), 'setup')
  assert.equal(resolveSetupStage(null), 'setup')
  assert.deepEqual(setupStages, ['details', 'arrangements', 'review', 'setup', 'approval', 'poster', 'publish'])
})

test('approval divides repeatable preparation from poster and publication', () => {
  for (const step of [2, 3, 4, 5]) {
    assert.equal(canVisitSetupStep(step, false, false), true)
    assert.equal(canVisitSetupStep(step, true, true), false)
    assert.equal(canVisitSetupStep(step, true, false), false)
  }
  for (const step of [7, 8]) {
    assert.equal(canVisitSetupStep(step, false, false), false)
    assert.equal(canVisitSetupStep(step, true, true), true)
    assert.equal(canVisitSetupStep(step, true, false), false)
  }
  assert.equal(canVisitSetupStep(6, false, false), true)
  assert.equal(canVisitSetupStep(6, true, true), true)
  assert.equal(canVisitSetupStep(1, false, false), false)
})

test('publication requires active approval, server authority and satisfied publication checks', () => {
  const item = { status: 'approved', approvalValidityStatus: 'active' } as EventPackage
  const lifecycle = { gates: [{ gate: 'publish', allowed: true, requirementsSatisfied: true }] } as EventLifecycle
  const caps = { canPublish: true } as EventPackageActorCapabilities
  assert.equal(canPublishFromFlow(item, lifecycle, caps), true)
  assert.equal(canPublishFromFlow(null, lifecycle, caps), false)
  assert.equal(canPublishFromFlow({ ...item, status: 'submitted' }, lifecycle, caps), false)
  assert.equal(canPublishFromFlow({ ...item, approvalValidityStatus: 'revoked' }, lifecycle, caps), false)
  assert.equal(canPublishFromFlow(item, lifecycle, { ...caps, canPublish: false }), false)
  assert.equal(canPublishFromFlow(item, { ...lifecycle, gates: [{ ...lifecycle.gates[0], requirementsSatisfied: false }] }, caps), false)
  assert.equal(canPublishFromFlow(item, { ...lifecycle, gates: [] }, caps), false)
})

test('publication audience distinguishes public, church and owning-group visibility', () => {
  assert.match(publicationAudience('public', false), /public website/)
  assert.match(publicationAudience('churchVisible', false), /hidden from anonymous/)
  assert.match(publicationAudience('groupVisible', true), /仅有权限的小组成员/)
  assert.equal(publicationAudience('unknown', true), publicationAudience('groupVisible', true))
})
