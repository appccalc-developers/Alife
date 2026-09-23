import assert from 'node:assert/strict'
import test from 'node:test'
import { applyEventTranslation, eventTranslationFields } from '../src/utils/eventTranslation.ts'

test('reuses allowed content field with only the missing language and supplied text', () => {
  assert.deepEqual(eventTranslationFields({ zh: ' 聚餐 ', en: '' }, 'Event title'), [{ field: 'content', sourceLanguage: 'zh', targetLanguage: 'en', sourceText: '聚餐', textType: 'Event title' }])
  assert.equal(eventTranslationFields({ zh: '', en: '' }, 'Title').length, 0)
  assert.equal(eventTranslationFields({ zh: '聚餐', en: 'Dinner' }, 'Title').length, 0)
})
test('fills only the requested language, preserving the current original text', () => {
  const value = { zh: ' 聚餐 ', en: '' }, fields = eventTranslationFields(value, 'Title')
  assert.deepEqual(applyEventTranslation(value, fields, [{ field: 'content', language: 'en', text: 'Dinner' }]), { ...value, en: 'Dinner' })
  const english = { en: 'Dinner', zh: '' }
  assert.deepEqual(applyEventTranslation(english, eventTranslationFields(english, 'Title'), [{ field: 'content', language: 'zh', text: '聚餐' }]), { ...english, zh: '聚餐' })
})
test('late translations cannot overwrite a manual edit or translate a changed source', () => {
  const fields = eventTranslationFields({ zh: '聚餐', en: '' }, 'Title'), reply = [{ field: 'content', language: 'en', text: 'Dinner' }]
  assert.equal(applyEventTranslation({ zh: '新活动', en: '' }, fields, reply), null)
  assert.equal(applyEventTranslation({ zh: '聚餐', en: 'My title' }, fields, reply), null)
})
test('invalid, unrelated, empty and over-length provider results are not adopted', () => {
  const value = { zh: '聚餐', en: '' }, fields = eventTranslationFields(value, 'Title')
  for (const reply of [[], [{ field: 'title', language: 'en', text: 'Dinner' }], [{ field: 'content', language: 'zh', text: '聚餐' }], [{ field: 'content', language: 'en', text: ' ' }]]) assert.equal(applyEventTranslation(value, fields, reply), null)
  assert.equal(applyEventTranslation(value, fields, [{ field: 'content', language: 'en', text: 'Dinner' }], 3), null)
})
