import assert from 'node:assert/strict'
import test from 'node:test'
import { bulletinDateForSermon, formatSermonDate, parseSermonTitle, presentSermon, sundayBeforePublication } from '../src/utils/sermonPresentation.ts'

test('legacy cached sermon titles yield a concise topic, the named speaker, and a validated date', () => {
  assert.deepEqual(parseSermonTitle('2026 05 24 主日证道 與主連結 | 講員: 吳誠牧師'), { title: '與主連結', speakerName: '吳誠牧師', date: '2026-05-24' })
  assert.deepEqual(parseSermonTitle('2026年5月24日 主日庆典 直播：认识你里面的基督 2'), { title: '认识你里面的基督 2', speakerName: '', date: '2026-05-24' })
  assert.deepEqual(parseSermonTitle('2024/02/29 Sunday Sermon Hope | Speaker: Jane Smith'), { title: 'Hope', speakerName: 'Jane Smith', date: '2024-02-29' })
  assert.equal(parseSermonTitle('2026-02-30 主日证道 盼望').date, null)
})

test('missing or invalid title dates fall back to the Sunday before publication in Auckland', () => {
  assert.equal(sundayBeforePublication('2026-07-01T00:00:00Z'), '2026-06-28')
  assert.equal(sundayBeforePublication('2026-06-28T00:00:00Z'), '2026-06-21')
  assert.equal(sundayBeforePublication('2026-06-27T13:00:00Z'), '2026-06-21')
  assert.equal(sundayBeforePublication('2026-01-01'), '2025-12-28')
  assert.equal(sundayBeforePublication('invalid'), null)
  const raw = { id: 'one', title: 'Short', speakerName: '豐盛生命教會', preachedAt: '2026-07-01T00:00:00Z' }
  assert.deepEqual(presentSermon(raw), { ...raw, speakerName: '', preachedAt: '2026-06-28' })
  assert.equal(raw.speakerName, '豐盛生命教會')
})

test('persisted normalized entities are not parsed again or shifted back another week', () => {
  const normalized = { id: 'one', title: 'Hope', speakerName: 'Jane Smith', preachedAt: '2026-06-28T00:00:00Z', metadataVersion: 1 }
  assert.equal(presentSermon(normalized), normalized)
  assert.equal(bulletinDateForSermon(normalized.preachedAt), '2026-06-28')
  assert.equal(bulletinDateForSermon('2022-06-26'), '2022-06-26')
  assert.equal(bulletinDateForSermon('2024-02-29'), '2024-02-29')
  assert.equal(bulletinDateForSermon('2026-02-30'), null)
  assert.equal(bulletinDateForSermon(null), null)
  assert.equal(formatSermonDate(normalized.preachedAt, 'zh', ''), '2026年6月28日')
})
