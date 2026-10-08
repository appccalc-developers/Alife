import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { bibleRequestFailure, YouVersionConfigurationError } from '../src/utils/bibleRequestFailure.ts'

test('classifies YouVersion HTTP limits and access failures without treating network errors as limits', () => {
  assert.equal(bibleRequestFailure(new YouVersionConfigurationError()), 'not-configured')
  assert.equal(bibleRequestFailure(Object.assign(new Error('limited'), { status: 429 })), 'rate-limited')
  assert.equal(bibleRequestFailure(Object.assign(new Error('denied'), { status: 403 })), 'access-denied')
  assert.equal(bibleRequestFailure(Object.assign(new Error('invalid key'), { status: 401 })), 'access-denied')
  assert.equal(bibleRequestFailure(Object.assign(new Error('server'), { status: 503 })), 'other')
  assert.equal(bibleRequestFailure(new TypeError('network unavailable')), 'other')
})

test('limited catalog and passage requests do not immediately issue another request', async () => {
  const [study, reader] = await Promise.all([
    readFile(new URL('../src/views/BibleStudyView.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/bible/YouVersionBibleReader.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(study, /useEnglishFallback = language === 'en' && failure === 'other'/)
  assert.match(study, /setAvailableVersions\(useEnglishFallback \? \[englishVersion\] : \[\]\)/)
  assert.match(reader, /retryable: failure === 'other'/)
  assert.match(reader, /readerErrorCopy\(language, bibleRequestFailure\(cause\)\), retryable: false/)
  assert.doesNotMatch(reader, /Bible reading is not configured yet/)
  assert.match(reader, /currentState\.retryable \? <button/)
  assert.match(study, /在 Bible\.com 阅读/)
  assert.match(reader, /在 Bible\.com 阅读/)
})
