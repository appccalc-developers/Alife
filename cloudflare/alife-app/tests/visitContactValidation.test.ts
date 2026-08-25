import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVisitContactPhone,
  isSelectedVisitContactValid,
  isVisitContactEmailValid,
  isVisitContactPhoneValid,
} from '../src/utils/visitContactValidation.ts'

test('visit contact email validation matches the API contract', () => {
  assert.equal(isVisitContactEmailValid('visitor@example.com'), true)
  assert.equal(isVisitContactEmailValid('visitor@localhost'), false)
  assert.equal(isVisitContactEmailValid('not-an-email'), false)
})

test('visit contact phone validation accepts supported international formats', () => {
  assert.equal(isVisitContactPhoneValid('+86', '138 0013 8000'), true)
  assert.equal(isVisitContactPhoneValid('+852', '6123 4567'), true)
  assert.equal(isVisitContactPhoneValid('+64', '021 123 4567'), true)
  assert.equal(isVisitContactPhoneValid('+61', '0412 345 678'), true)
  assert.equal(isVisitContactPhoneValid('+64', 'abc'), false)
})

test('visit contact phone payload removes local trunk prefixes', () => {
  assert.equal(buildVisitContactPhone('+64', '021 123 4567'), '+64211234567')
  assert.equal(buildVisitContactPhone('+886', '0912-345-678'), '+886912345678')
})

test('selected contact method validates only the active input', () => {
  assert.equal(isSelectedVisitContactValid('email', 'visitor@example.com', '+64', ''), true)
  assert.equal(isSelectedVisitContactValid('phone', '', '+64', '0211234567'), true)
  assert.equal(isSelectedVisitContactValid('email', '', '+64', '0211234567'), false)
})
