const assert = require('node:assert/strict')
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173'
const bi = value => ({ en: value, zh: value })
const eventId = '4a89c971-6593-48c9-8be8-427a224a587d'
const offerId = 'cc4b2986-33f5-4abc-978e-f9287518760e'
const occurrenceId = 'd1a80ed2-7db5-46cb-aef8-5193535104f7'
const participantId = '281456f9-ae3e-4af7-9b38-31cf574dc33c'
const policy = { id: 'f172cc7f-7ca7-4df1-8952-fdd6915b9e4b', version: 1, eTag: '"activity-policy"', feeApprovalStatus: 'approved', rules: {
  eligibility: bi(''), minimumAge: 14, maximumAge: null, capacity: 12, allowWaitlist: true, requiresGuardianConsent: false, feeMinor: 1000, currency: 'NZD', opensUtc: '2026-01-01T00:00:00Z', deadlineUtc: '2028-01-01T00:00:00Z', needsSpace: false, terms: bi('Terms'), feeChargeScope: 'perOccurrence' } }
const offer = { id: offerId, activityId: 'meal-1', occurrenceId, startUtc: '2027-11-01T01:00:00Z', endUtc: '2027-11-01T03:00:00Z', capacity: 12, status: 'open', eTag: '"activity-offer"', confirmed: 0, reserved: 0, waitlisted: 0, space: null }
const operations = { eventId, canConfigure: true, canManage: true, canFinance: false, canApproveFees: false, canManageSpace: true,
  projects: [{ activityId: 'meal-1', name: { en: 'Dinner', zh: '晚餐' }, policy, offers: [offer], participations: [] }], participants: [{ participantId, displayName: 'Participant', isChild: false, seatStatus: 'confirmed', canProvidePrivateData: true, canConsent: false, canSelect: true }] }

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      let state = structuredClone(operations)
      await page.route('**/api/**', route => {
        const request = route.request(), url = request.url()
        requests.push({ method: request.method(), url, body: request.postDataJSON?.(), headers: request.headers() })
        if (url.endsWith('/activity-operations') && request.method() === 'GET') return route.fulfill({ json: state })
        if (url.includes('/registration-work?')) return route.fulfill({ json: { policy: { rules: { feeMinor: 500, currency: 'NZD' } } } })
        if (url.includes('/private-data')) return route.fulfill({ json: { birthDate: null, eTag: '"activity-new"' } })
        if (url.endsWith('/selection/preview')) return route.fulfill({ json: { previewToken: 'quote-1', change: request.postDataJSON(), addedOffers: [offer], addedFeeMinor: 1000, currency: 'NZD', refundReviewCount: 0 } })
        if (url.endsWith('/selection/apply')) { state = { ...state, projects: [{ ...state.projects[0], participations: [{ id: '7d93c962-7f53-4c55-aa80-1e667783fc12', offerId, participantId, displayName: 'Participant', seatStatus: 'draft', procedureStatus: 'incomplete', eligibility: 'needsReview', feeMinor: 1000, currency: 'NZD', paidMinor: 0, refundedMinor: 0, reservedUntilUtc: null, eTag: '"activity-participation"', chargeParticipationId: null }] }] }; return route.fulfill({ json: state }) }
        return route.fulfill({ status: 403, json: { message: 'Unavailable in fixture' } })
      })
      await page.route('**/project-operations-fixture', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="fixture" class="mx-auto max-w-5xl p-3"></div></body></html>' }))
      await page.goto(`${base}/project-operations-fixture`)
      await page.evaluate(async ({ language, eventId, offer, occurrenceId, policy }) => {
        const runtime = (await import('/@react-refresh')).default; runtime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true
        await import('/src/styles/global.css')
        const React = (await import('/node_modules/.vite/deps/react.js')).default, { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default
        const { AuthProvider } = await import('/src/stores/auth.tsx')
        const { default: Selection } = await import('/src/components/events/EventActivitySelectionPanel.tsx')
        const { default: Configuration } = await import('/src/components/events/EventActivityProjectConfiguration.tsx')
        const { default: Modules } = await import('/src/components/events/EventActivityModuleConfigurations.tsx')
        const activity = { id: 'meal-1', name: { en: 'Dinner', zh: '晚餐' }, conditions: { en: '', zh: '' }, attributes: ['meal'], answers: { foodService: { value: 'yes', source: 'human', confirmed: true } }, defaultConfiguration: { minimumAge: 14 } }
        const project = { activityId: 'meal-1', name: activity.name, policy, offers: [offer], participations: [] }
        const workspace = { eventId, canConfigure: true, canManage: true, canFinance: false, canApproveFees: false, canManageSpace: true, projects: [project], participants: [] }
        function Fixture() { const [lang, setLang] = React.useState(language); window.changeFixtureLanguage = () => setLang(x => x === 'zh' ? 'en' : 'zh'); return React.createElement(React.Fragment, null,
          React.createElement(Selection, { eventId, language: lang, timeZone: 'Pacific/Auckland' }),
          React.createElement(Configuration, { eventId, activity, project, workspace, occurrences: [{ id: occurrenceId, startUtc: offer.startUtc, endUtc: offer.endUtc, status: 'scheduled' }], reservations: [], timeZone: 'Pacific/Auckland', language: lang, planDirty: true, busy: false, mutate: async () => {} }),
          React.createElement(Modules, { eventId, activity, workspace: { items: [], canEditKinds: ['meal'] }, occurrences: [], timeZone: 'Pacific/Auckland', language: lang, planDirty: false, busy: false, onSave: async (kind, details) => { window.savedModule = { kind, details } } })) }
        createRoot(document.getElementById('fixture')).render(React.createElement(AuthProvider, null, React.createElement(Fixture)))
      }, { language, eventId, offer, occurrenceId, policy })
      const selection = page.locator('[data-project-selection]')
      await selection.getByText(language === 'zh' ? '晚餐' : 'Dinner').first().waitFor()
      assert.equal(await selection.getByText(language === 'zh' ? '用于年龄核查的生日' : 'Birth date for age check').count() > 0, true)
      const box = selection.getByRole('checkbox').first(); await box.focus(); await page.keyboard.press('Space'); assert.equal(await box.isChecked(), true)
      await selection.getByRole('button', { name: language === 'zh' ? '核对变更' : 'Review changes' }).click()
      await selection.getByText(language === 'zh' ? /Event 基础费/ : /Event base fee/).waitFor()
      await selection.getByRole('button', { name: language === 'zh' ? '确认项目选报' : 'Confirm project selection' }).click()
      await selection.getByText(language === 'zh' ? '已选报项目' : 'Your selected projects').waitFor()
      const apply = requests.find(x => x.url.endsWith('/selection/apply')); assert.deepEqual(apply.body.change.addOfferIds, [offerId]); assert.equal(apply.headers['idempotency-key']?.length > 0, true)
      const project = page.locator('[data-project-configuration]'); await project.locator('[data-project-policy] summary').first().click()
      assert.equal(await project.getByRole('button', { name: language === 'zh' ? '保存项目规则' : 'Save project rules' }).isDisabled(), true)
      const modules = page.locator('[data-project-module-configurations]'); await modules.locator('summary').first().click(); await modules.locator('div > details > summary').first().click()
      await modules.getByRole('button', { name: language === 'zh' ? '保存安排' : 'Save arrangement' }).click()
      assert.deepEqual(await page.evaluate(() => window.savedModule), { kind: 'meal', details: { occurrenceId: null, meal: { serviceMethod: bi(''), preparationPlace: bi(''), dietaryHandling: bi(''), foodSafetyPlan: bi('') } } })
      const prior = await page.locator('[data-project-configuration]').count(); await page.evaluate(() => window.changeFixtureLanguage()); assert.equal(await page.locator('[data-project-configuration]').count(), prior)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.deepEqual(errors, [])
      console.log(`PASS project operations ${language}/${width}`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
