const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { existsSync, mkdirSync } = require('node:fs')
const { fileURLToPath } = require('node:url')
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const screenshotDir = process.env.ALIFE_DESIGN_SCREENSHOTS
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true })
  try {
    for (const width of [320, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(pathToFileURL(path.resolve(__dirname, '../prototypes/review.html')).href)
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `prototype-${width}.png`), fullPage: true })
      assert.equal(await page.locator('#save').isDisabled(), true)
      await page.locator('#role').selectOption('leader')
      await page.locator('#submit').click()
      await page.locator('#role').selectOption('reviewer')
      assert.equal(await page.locator('#save').isDisabled(), true)
      await page.locator('#approve').click()
      assert.equal(await page.locator('#published').textContent(), '示例聚会 A')
      await page.locator('#role').selectOption('coLeader')
      await page.locator('#title').fill('示例聚会 B')
      await page.locator('#save').click()
      await page.locator('#submit').click()
      await page.locator('#role').selectOption('reviewer')
      await page.locator('#return').click()
      assert.equal(await page.locator('#published').textContent(), '示例聚会 A')
      assert.equal(await page.locator('#submitted').textContent(), '示例聚会 B')
      await page.locator('#domain').selectOption('workspace')
      assert.equal(await page.locator('#workspace').isVisible(), true)
      await page.locator('#domain').selectOption('identity')
      await page.locator('[data-intent="signIn"]').click()
      await page.locator('#cancel').click()
      assert.match(await page.locator('#feedback').textContent(), /不会自动申请/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`Prototype role/lifecycle/intent/layout checks passed at ${width}px`)
    }
    for (const name of ['architecture', 'pages', 'identity', 'church', 'group', 'personal', 'management']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 900 } })
      await page.goto(pathToFileURL(path.resolve(__dirname, `../generated/${name}.html`)).href)
      if (screenshotDir && name === 'pages') await page.screenshot({ path: path.join(screenshotDir, 'pages-320.png'), fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name)
      assert.equal(await page.locator('nav a').count(), 8)
      for (const href of await page.locator('a').evaluateAll(links => links.map(link => link.href))) {
        if (href.startsWith('file:')) assert.equal(existsSync(fileURLToPath(new URL(href.split('#')[0]))), true, href)
      }
      await page.locator('summary').click()
      assert.equal(await page.locator('details').getAttribute('open'), '')
      await page.close()
    }
    console.log('Seven presentation mobile overflow/navigation/local-link/expansion checks passed')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
