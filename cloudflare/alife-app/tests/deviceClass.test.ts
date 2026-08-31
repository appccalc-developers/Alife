import assert from 'node:assert/strict'
import test from 'node:test'
import { isLikelyMobileDevice } from '../src/services/deviceClass.ts'

test('prefers userAgentData mobile classification when available', () => {
  assert.equal(isLikelyMobileDevice({ userAgentData: { mobile: true }, userAgent: 'Desktop' }), true)
  assert.equal(isLikelyMobileDevice({ userAgentData: { mobile: false }, userAgent: 'iPhone' }), false)
})

test('recognizes common mobile and touch iPad user agents', () => {
  assert.equal(isLikelyMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel)' }), true)
  assert.equal(isLikelyMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }), true)
  assert.equal(isLikelyMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 5 }), true)
})

test('keeps ordinary desktop browsers out of mobile registration', () => {
  assert.equal(isLikelyMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 }), false)
})
