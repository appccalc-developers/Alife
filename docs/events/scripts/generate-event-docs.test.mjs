import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { extractOverviewLocales, markdownAnchors, validateLinks, validateOverview } from './generate-event-docs.mjs'

const overview = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8')

test('compact three-language overview retains required topic and module navigation', () => {
  assert.doesNotThrow(() => validateOverview(extractOverviewLocales(overview)))
})

test('a missing locale, topic link or language structure fails validation', () => {
  assert.throws(() => extractOverviewLocales(overview.replace('<!-- overview:zh-TW:start -->', '')), /missing the zh-TW/)
  const locales = extractOverviewLocales(overview)
  assert.throws(() => validateOverview({ ...locales, en: locales.en.replace('](EVENT-PACKAGE-APPROVAL.md)', '](missing.md)') }), /missing EVENT-PACKAGE-APPROVAL/)
  assert.throws(() => validateOverview({ ...locales, 'zh-CN': `${locales['zh-CN']}\n\n### Unmatched section` }), /structure differs/)
})

test('Markdown bookmarks include moved aliases, duplicate headings and bilingual headings', () => {
  const anchors = markdownAnchors('# Core\n## Same\n## Same\n## 中文规则\n<a id="old-bookmark"></a>\n```md\n## Not a heading\n```')
  for (const value of ['core', 'same', 'same-1', '中文规则', 'old-bookmark']) assert.ok(anchors.has(value))
  assert.ok(!anchors.has('not-a-heading'))
})

test('link validation detects missing files and moved section fragments', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alife-event-doc-links-'))
  try {
    const source = join(directory, 'source.md')
    writeFileSync(join(directory, 'target.md'), '# Current\n<a id="old"></a>\n')
    writeFileSync(source, '# Source\n[Moved](target.md#old) [Self](#source)')
    assert.doesNotThrow(() => validateLinks([source]))
    writeFileSync(source, '[Broken](target.md#removed)')
    assert.throws(() => validateLinks([source]), /missing Markdown anchor/)
    writeFileSync(source, '[Missing](absent.md)')
    assert.throws(() => validateLinks([source]), /absent\.md/)
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    assert.ok(basename(directory).startsWith('alife-event-doc-links-'))
    rmSync(directory, { recursive: true, force: true })
  }
})
