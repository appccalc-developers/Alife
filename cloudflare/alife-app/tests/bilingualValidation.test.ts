import assert from 'node:assert/strict'
import test from 'node:test'
import { compactBilingualText, validateRequiredBilingualFields } from '../src/utils/bilingualValidation.ts'

test('AI translation candidates include only fields with exactly one language', () => {
  const result = validateRequiredBilingualFields(
    {
      title: { en: 'Community picnic', zh: '' },
      summary: { en: 'Already complete', zh: '已经完整' },
      content: { en: '', zh: '' },
    },
    [
      { field: 'title', textType: 'announcementTitle' },
      { field: 'summary', textType: 'announcementSummary' },
      { field: 'content', textType: 'announcementContent' },
    ],
  )

  assert.deepEqual(result.missingTranslatableFields, [{
    field: 'title',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    sourceText: 'Community picnic',
    textType: 'announcementTitle',
  }])
  assert.deepEqual(result.blockingIncompleteFields, ['content'])
})

test('compact bilingual payload trims text and omits empty languages', () => {
  assert.deepEqual(compactBilingualText({ en: '  Welcome  ', zh: '  ' }), { en: 'Welcome' })
  assert.deepEqual(compactBilingualText({ en: '', zh: ' 欢迎 ' }), { zh: '欢迎' })
})
