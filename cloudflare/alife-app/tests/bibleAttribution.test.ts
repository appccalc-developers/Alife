import assert from 'node:assert/strict'
import test from 'node:test'
import { bibleVersionAttribution } from '../src/utils/bibleAttribution.ts'

test('prefers the current brief copyright notice', () => {
  assert.equal(bibleVersionAttribution({ copyright: '  Brief notice  ', promotional_content: 'Long notice' }), 'Brief notice')
})

test('uses promotional attribution when copyright is absent', () => {
  assert.equal(bibleVersionAttribution({ copyright: '  ', promotional_content: '  Publisher notice  ' }), 'Publisher notice')
})

test('never treats a missing attribution as a valid one', () => {
  assert.equal(bibleVersionAttribution({ copyright: null, promotional_content: null }), null)
})
