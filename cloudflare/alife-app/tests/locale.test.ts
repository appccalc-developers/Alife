import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInitialLanguage } from '../src/i18n/locale.ts'

test('stored language preference takes precedence over the browser language', () => {
  assert.equal(resolveInitialLanguage('en', ['zh-CN']), 'en')
  assert.equal(resolveInitialLanguage('zh', ['en-NZ']), 'zh')
})

test('Simplified and Traditional Chinese browser languages default to Chinese', () => {
  for (const browserLanguage of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-TW', 'zh-HK', 'zh-Hant']) {
    assert.equal(resolveInitialLanguage(null, [browserLanguage]), 'zh')
  }
})

test('non-Chinese browser languages default to English', () => {
  for (const browserLanguage of ['en-NZ', 'fr-FR', 'ja-JP']) {
    assert.equal(resolveInitialLanguage(null, [browserLanguage]), 'en')
  }
})

test('invalid stored values fall back to the primary browser language', () => {
  assert.equal(resolveInitialLanguage('invalid', ['zh-TW', 'en-NZ']), 'zh')
  assert.equal(resolveInitialLanguage('invalid', ['en-NZ', 'zh-CN']), 'en')
})
