import assert from 'node:assert/strict'
import test from 'node:test'
import type { PageEditModel, SectionEditModel } from '../src/types/page-editor.ts'
import {
  applyPageTranslations,
  collectSectionTranslationRequests,
} from '../src/utils/pageBilingualCompletion.ts'

const section: SectionEditModel = {
  order: 0,
  type: 'RichText',
  contentJson: {
    header: {
      title: { en: 'Updated title', zh: '旧标题' },
      subtitle: { en: '', zh: '只存在于旧版本' },
    },
    title: { en: 'Updated title', zh: '旧标题' },
    text: { en: '<p>Updated body</p>', zh: '<p>旧正文</p>' },
    actions: [{
      label: { en: 'Learn more', zh: '了解更多' },
      url: '/learn-more',
    }],
  },
  styleJson: {},
}

const model: PageEditModel = {
  groupId: 'group-1',
  title: { en: 'Page', zh: '页面' },
  description: { en: '', zh: '' },
  tags: [],
  titleDisplayStyle: 'Default',
  visibility: 'draft',
  sections: [section],
}

test('section translation requests use the current editor language even when the target already has text', () => {
  const requests = collectSectionTranslationRequests(section, 0, 'en')

  assert.deepEqual(requests, [
    {
      field: 'sections.0.header.title',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      sourceText: 'Updated title',
      textType: 'sectionHeaderTitle',
    },
    {
      field: 'sections.0.text',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      sourceText: '<p>Updated body</p>',
      textType: 'richTextBody',
    },
    {
      field: 'sections.0.actions.0.label',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      sourceText: 'Learn more',
      textType: 'sectionActionLabel',
    },
  ])

  const reverseRequests = collectSectionTranslationRequests(section, 0, 'zh')
  assert.ok(reverseRequests.every((request) => (
    request.sourceLanguage === 'zh' && request.targetLanguage === 'en'
  )))
  assert.ok(reverseRequests.some((request) => request.field === 'sections.0.header.subtitle'))
})

test('section translation can overwrite the previous target-language version without changing the source', () => {
  const requests = collectSectionTranslationRequests(section, 0, 'en')
  const translations = [
    { field: 'sections.0.header.title', language: 'zh' as const, text: '更新后的标题' },
    { field: 'sections.0.text', language: 'zh' as const, text: '<p>更新后的正文</p>' },
    { field: 'sections.0.actions.0.label', language: 'zh' as const, text: '进一步了解' },
  ]

  const withoutOverwrite = applyPageTranslations(model, translations, requests)
  assert.deepEqual(withoutOverwrite.sections[0].contentJson.text, {
    en: '<p>Updated body</p>',
    zh: '<p>旧正文</p>',
  })

  const updated = applyPageTranslations(model, translations, requests, { overwriteExisting: true })
  assert.deepEqual(updated.sections[0].contentJson.header, {
    title: { en: 'Updated title', zh: '更新后的标题' },
    subtitle: { en: '', zh: '只存在于旧版本' },
  })
  assert.deepEqual(updated.sections[0].contentJson.title, {
    en: 'Updated title',
    zh: '更新后的标题',
  })
  assert.deepEqual(updated.sections[0].contentJson.text, {
    en: '<p>Updated body</p>',
    zh: '<p>更新后的正文</p>',
  })
  assert.deepEqual(updated.sections[0].contentJson.actions, [{
    label: { en: 'Learn more', zh: '进一步了解' },
    url: '/learn-more',
  }])
})
