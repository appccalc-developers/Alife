import assert from 'node:assert/strict'
import test from 'node:test'
import { writeManualActivationClipboard } from '../src/services/manualActivationClipboard.ts'

test('manual activation copy reports success after writing the complete value', async () => {
  const values: string[] = []

  const copied = await writeManualActivationClipboard('activation-message', {
    writeText: async (value) => { values.push(value) },
  })

  assert.equal(copied, true)
  assert.deepEqual(values, ['activation-message'])
})

test('manual activation copy fails safely when clipboard access is unavailable or denied', async () => {
  assert.equal(await writeManualActivationClipboard('activation-message', null), false)
  assert.equal(await writeManualActivationClipboard('activation-message', {
    writeText: async () => { throw new Error('denied') },
  }), false)
})
