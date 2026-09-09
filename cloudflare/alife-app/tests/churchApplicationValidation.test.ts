import assert from 'node:assert/strict'
import test from 'node:test'
import { validateChurchApplication, type ChurchApplicationForm } from '../src/services/churchApplicationValidation.ts'

const valid: ChurchApplicationForm = {
  displayName: '张三 Alice', sex: 'Unknown', email: 'alice@example.test', phoneE164: '',
  declaration: '希望加入教会', replyPreference: 'email', privacyConsent: true, notificationConsent: true, honeypot: '',
}
test('email notification permits a phoneless application', () => {
  assert.equal(validateChurchApplication(valid), null)
})
test('SMS needs a usable phone while email does not', () => {
  assert.equal(validateChurchApplication({ ...valid, replyPreference: 'sms' }), 'phone')
  assert.equal(validateChurchApplication({ ...valid, replyPreference: 'sms', phoneE164: '+64210000000' }), null)
  assert.equal(validateChurchApplication({ ...valid, phoneE164: 'wrong' }), 'phone')
})
test('both consents and applicant details are required', () => {
  for (const override of [{ privacyConsent: false }, { notificationConsent: false }, { email: '' }, { sex: '' }, { declaration: ' ' }, { displayName: ' ' }]) {
    assert.equal(validateChurchApplication({ ...valid, ...override }), 'required')
  }
})
