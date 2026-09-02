import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const readSource = (relativePath: string) =>
  readFile(path.resolve(import.meta.dirname, relativePath), 'utf8')

test('Package workspace exposes the seven-section review, scoped history and lifecycle gates', async () => {
  const panel = await readSource('../src/components/events/EventPackageFoundationPanel.tsx')

  for (const section of [
    'overview',
    'structure',
    'peoplePlaceResources',
    'safetySafeguarding',
    'registrationFinancePrivacyComms',
    'specialistDecisions',
    'readinessChanges',
  ]) {
    assert.match(panel, new RegExp(`event-package-\\$\\{section\\.code\\}`))
    assert.ok(panel.includes('packageSections'))
    assert.ok(section.length > 0)
  }
  assert.match(panel, /current\.manifest\.triggerReasons/)
  assert.match(panel, /requiredSpecialistDecisions/)
  assert.match(panel, /historyStatus/)
  assert.match(panel, /historySort/)
  assert.match(panel, /scopeType === 'occurrence'/)
  assert.match(panel, /lifecycle\.gates\.map/)
})

test('formal submission and decision use the accessible application confirmation flow', async () => {
  const panel = await readSource('../src/components/events/EventPackageFoundationPanel.tsx')

  assert.match(panel, /useConfirmation\(\)/)
  assert.match(panel, /requestConfirmation/)
  assert.match(panel, /confirmationModal/)
  assert.doesNotMatch(panel, /window\.(?:confirm|alert|prompt)/)
})

test('Package client sends server concurrency and idempotency boundaries for formal mutations', async () => {
  const service = await readSource('../src/services/eventPackageService.ts')

  assert.match(service, /If-Match/)
  assert.match(service, /Idempotency-Key/)
  assert.match(service, /\/registration\/open/)
  assert.match(service, /\/registration\/close/)
  assert.match(service, /\/execution\/confirm/)
  assert.match(service, /scopeId: eventPackage\.scopeId/)
})
