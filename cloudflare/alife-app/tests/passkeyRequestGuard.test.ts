import assert from 'node:assert/strict'
import test from 'node:test'
import { createPasskeyRequestGuard } from '../src/services/passkeyRequestGuard.ts'

test('passkey request guard aborts a request when its timeout fires', () => {
  let timeoutHandler: (() => void) | undefined
  const guard = createPasskeyRequestGuard(25, {
    setTimeout: (handler) => {
      timeoutHandler = handler
      return 1 as ReturnType<typeof setTimeout>
    },
    clearTimeout: () => undefined,
  })

  timeoutHandler?.()

  assert.equal(guard.signal.aborted, true)
  assert.equal((guard.signal.reason as DOMException).name, 'TimeoutError')
})

test('disposing a passkey request guard clears the timeout and aborts the browser request', () => {
  let cleared = false
  const guard = createPasskeyRequestGuard(25, {
    setTimeout: () => 1 as ReturnType<typeof setTimeout>,
    clearTimeout: () => { cleared = true },
  })

  guard.dispose()

  assert.equal(cleared, true)
  assert.equal(guard.signal.aborted, true)
  assert.equal((guard.signal.reason as DOMException).name, 'AbortError')
})
