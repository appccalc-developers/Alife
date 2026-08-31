import assert from 'node:assert/strict'
import test from 'node:test'
import type { UiTextKey } from '../src/i18n/uiText.ts'
import { normalizeIdentityError } from '../src/services/identityErrorPresentation.ts'

const translate = (key: UiTextKey, values?: Record<string, string | number>) =>
  values?.traceId ? `${key}:${values.traceId}` : key

test('browser passkey cancellation and timeout use an incomplete-state message', () => {
  assert.equal(
    normalizeIdentityError(new Error('passkey_cancelled'), 'fallback', translate),
    'passkeyCancelled',
  )
  for (const name of ['NotAllowedError', 'AbortError', 'TimeoutError']) {
    assert.equal(
      normalizeIdentityError(new DOMException('browser detail', name), 'fallback', translate),
      'passkeyCancelled',
    )
  }
})

test('passkey API failures provide safe recovery messages and a trace reference', () => {
  assert.equal(
    normalizeIdentityError({ message: 'failed', code: 'passkey_unknown' }, 'fallback', translate),
    'passkeyUnknown',
  )
  assert.equal(
    normalizeIdentityError({ message: 'failed', code: 'passkey_verification_failed', traceId: 'trace-700' }, 'fallback', translate),
    'passkeyVerificationFailedWithReference:trace-700',
  )
})
