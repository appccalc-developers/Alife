import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOnboardingLocation, normalizeIdentityReturnPath } from '../src/services/identityPathPolicy.ts'

test('identity return path preserves safe relative targets', () => {
  const target = '/groups/abc?view=overview#today'
  assert.equal(normalizeIdentityReturnPath(target), target)
  assert.equal(buildOnboardingLocation(target), `/onboarding?returnTo=${encodeURIComponent(target)}`)
})

test('identity return path rejects external, malformed, and looping targets', () => {
  for (const value of [
    'https://evil.example/path',
    '//evil.example/path',
    '/groups\\escape',
    '/onboarding',
    '/onboarding?returnTo=/tasks',
    '/onboarding/resume',
    '/activate/selector',
    '/join/selector',
    '/application/selector',
    '/internal/alpha-login',
    `/groups/${String.fromCharCode(10)}escape`,
  ]) {
    assert.equal(normalizeIdentityReturnPath(value), '')
  }
  assert.equal(buildOnboardingLocation('//evil.example/path'), '/onboarding')
})
