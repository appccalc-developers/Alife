// Run against Vite with ALIFE_PLAYWRIGHT_MODULE pointing to an installed Playwright.
// Browser speech and all application APIs are fixtures; no microphone or live AI is used.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const template = {
  code: 'shared-meal', archetypeCode: 'simple-social', version: 2,
  name: { zh: '团契聚餐', en: 'Fellowship meal' }, description: { zh: '一起用餐', en: 'Share a meal' }, iconKey: 'meal',
  defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: [], presetServiceSlots: [],
};
const catalogue = [{
  code: 'simple-social', version: 1, name: { zh: '轻松相聚', en: 'Simple social' }, isSeries: false,
  occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [],
  conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template],
}];

async function setup(browser, language, width, speech = 'standard') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: language === 'zh' ? 'America/Los_Angeles' : 'Australia/Perth' });
  await context.addInitScript(({ language, speech }) => {
    localStorage.setItem('alife.language', language);
    window.__voice = { instances: [], failStart: false };
    class MockRecognition {
      constructor() { this.aborts = 0; this.stops = 0; window.__voice.instances.push(this); }
      start() {
        if (window.__voice.failStart) throw new DOMException('Denied', 'NotAllowedError');
        this.onstart?.();
      }
      stop() { this.stops++; }
      abort() { this.aborts++; }
      emit(parts) {
        this.onresult?.({ results: parts.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
      }
    }
    window.SpeechRecognition = speech === 'standard' ? MockRecognition : undefined;
    window.webkitSpeechRecognition = speech === 'prefixed' ? MockRecognition : undefined;
  }, { language, speech });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [], messages = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let data = [];
    if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access'], memberships: [] };
    else if (pathname === '/api/event-archetypes') data = catalogue;
    else if (pathname.includes('/details-session/') && pathname.endsWith('/message')) {
      const payload = route.request().postDataJSON(); messages.push(payload);
      const snapshot = payload.appContext.knownFacts.snapshot;
      const timed = payload.message.includes('9月19');
      const resultForm = timed ? { ...snapshot.form, startLocal: '2026-09-19T13:00', endLocal: '2026-09-19T16:00' } : snapshot.form;
      data = { responseMode: 'result', result: { ...snapshot, form: resultForm, adoptedFields: timed ? ['startLocal', 'endLocal'] : [], sources: timed ? { ...snapshot.sources, startLocal: 'explicit', endLocal: 'explicit' } : snapshot.sources, issues: [], assessment: { sufficiencyScore: 20, summary: { zh: '请继续补充', en: 'Please add details' } }, assistantReply: { zh: '已整理', en: 'Organised' } } };
    }
    await route.fulfill({ status: 200, json: data });
  });
  await page.goto(`${base}/events/new?groupId=qa-group`);
  const zh = language === 'zh';
  await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
  await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click();
  await page.getByRole('button', { name: zh ? '继续' : 'Continue', exact: true }).click();
  return {
    context, page, errors, messages,
    prompt: page.getByLabel(zh ? '明确提供的资料会填入草稿；不确定之处会继续询问。请在创建前审阅。' : 'Explicit details fill the draft; uncertain details prompt a follow-up. Review before creating.', { exact: true }),
    start: page.getByRole('button', { name: zh ? '语音输入' : 'Voice input', exact: true }),
    stop: page.getByRole('button', { name: zh ? '停止语音输入' : 'Stop voice input', exact: true }),
    send: page.getByRole('button', { name: zh ? '发送并整理资料' : 'Send and organise details', exact: true }),
  };
}
const emit = (page, parts) => page.evaluate(parts => window.__voice.instances.at(-1).emit(parts), parts);
const end = page => page.evaluate(() => window.__voice.instances.at(-1).onend?.());
const waitText = (page, text) => page.waitForFunction(text => document.querySelector('textarea[id]')?.value === text, text);

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of process.env.ALIFE_VOICE_SKIP_LAYOUT ? [] : ['zh', 'en']) for (const width of [320, 768, 1280]) {
      const { context, page, prompt, start, stop, send, errors, messages } = await setup(browser, language, width, language === 'zh' ? 'standard' : 'prefixed');
      assert.equal(await page.evaluate(() => window.__voice.instances.length), 0);
      await prompt.fill('Existing note'); await start.click();
      assert.equal(await stop.getAttribute('aria-pressed'), 'true');
      assert.equal(await send.isDisabled(), true);
      assert.equal(await page.evaluate(() => window.__voice.instances[0].lang), language === 'zh' ? 'zh-CN' : 'en-NZ');
      await emit(page, [['Partial', false]]);
      await page.getByRole('status').filter({ hasText: 'Partial' }).waitFor();
      assert.equal(await prompt.inputValue(), 'Existing note');
      await emit(page, [['First', true]]); await waitText(page, 'Existing note First');
      await emit(page, [['First', true], ['Second', false]]);
      assert.equal(await prompt.inputValue(), 'Existing note First');
      await prompt.fill('Manually corrected');
      await emit(page, [['First', true], ['Second', true]]); await waitText(page, 'Manually corrected Second');
      await stop.click(); assert.equal(await send.isDisabled(), true);
      await emit(page, [['First', true], ['Second', true], ['Last', true]]);
      await waitText(page, 'Manually corrected Second Last'); await end(page); await start.waitFor();
      assert.equal(messages.length, 0);
      await start.click(); await emit(page, [['Another session', true]]);
      await waitText(page, 'Manually corrected Second Last Another session');
      await stop.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-details-voice-${language}-${width}.png`) });
      await end(page); await start.waitFor(); await send.click();
      await page.getByRole('log').getByText(language === 'zh' ? '已整理' : 'Organised', { exact: true }).waitFor();
      assert.equal(messages.length, 1);
      assert.equal(messages[0].inputMode, 'text');
      assert.equal(messages[0].message, 'Manually corrected Second Last Another session');
      assert.equal(await prompt.inputValue(), '');
      const zone = page.getByLabel(language === 'zh' ? '活动时区' : 'Event time zone', { exact: true });
      await zone.fill('Pacific/Auckland');
      await prompt.fill('2026年9月19日下午1点到下午4点'); await send.click();
      const begins = page.getByLabel(language === 'zh' ? '开始时间' : 'Start time', { exact: true });
      const ends = page.getByLabel(language === 'zh' ? '结束时间' : 'End time', { exact: true });
      await page.waitForFunction(() => Array.from(document.querySelectorAll('input[type="datetime-local"]')).some(x => x.value === '2026-09-19T13:00'));
      assert.equal(await begins.inputValue(), '2026-09-19T13:00'); assert.equal(await ends.inputValue(), '2026-09-19T16:00');
      assert.equal(await zone.inputValue(), 'Pacific/Auckland');
      const history = page.getByRole('log');
      const reply = language === 'zh' ? '已整理' : 'Organised';
      assert.deepEqual(await history.locator('p').allTextContents(), ['Manually corrected Second Last Another session', reply, '2026年9月19日下午1点到下午4点', reply]);
      await history.evaluate(element => { element.scrollTop = 0; });
      await prompt.fill('Next question'); await send.click();
      await page.waitForFunction(() => document.querySelector('[role="log"]')?.children.length === 6);
      await page.waitForFunction(() => { const log = document.querySelector('[role="log"]'); return log.scrollHeight > log.clientHeight && Math.abs(log.scrollHeight - log.clientHeight - log.scrollTop) <= 1; });
      assert.deepEqual((await history.locator('p').allTextContents()).slice(-2), ['Next question', reply]);
      const log = await page.getByRole('log').boundingBox(), input = await prompt.boundingBox();
      assert.ok(log.y + log.height <= input.y, 'AI reply must be above the message input');
      const bubbles = await history.locator(':scope > div > div').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; }));
      assert.ok(bubbles[0].right > bubbles[1].right && bubbles[0].left > bubbles[1].left, 'user bubbles right, assistant bubbles left');
      const progress = await page.getByRole('progressbar').boundingBox(), sendBox = await send.boundingBox();
      const back = await page.getByRole('button', { name: /↑.*(?:回到活动资料表单|Back to event details form)/ }).boundingBox();
      assert.ok(progress.y > sendBox.y + sendBox.height && back.y > progress.y, 'completion follows send and return follows completion');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'chat must not overflow');
      await prompt.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-details-reply-above-${language}-${width}.png`) });
      await page.getByRole('progressbar').scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: /↑.*(?:回到活动资料表单|Back to event details form)/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-details-completion-${language}-${width}.png`) });
      assert.deepEqual(errors, []);
      console.log(`PASS ${language} ${width}: event-zone wall clocks, left/right chat bubbles, completion below send, chronological replies with automatic bottom scroll, explicit start, locale, interim/final deduplication, manual edits, stop flush, append/restart, explicit send, layout`);
      await context.close();
    }

    const qa = await setup(browser, 'en', 1280);
    const { context, page, prompt, start, stop, errors, messages } = qa;
    await prompt.fill('Keep this text');
    for (const code of ['not-allowed', 'audio-capture', 'no-speech', 'network', 'language-not-supported']) {
      await start.click();
      await page.evaluate(code => window.__voice.instances.at(-1).onerror({ error: code }), code);
      await page.getByRole('alert').waitFor(); await start.waitFor();
      assert.equal(await prompt.inputValue(), 'Keep this text');
    }
    await page.evaluate(() => window.__voice.failStart = true); await start.click();
    await page.getByRole('alert').filter({ hasText: 'access was denied' }).waitFor();
    await page.evaluate(() => window.__voice.failStart = false);
    await start.click(); await stop.click(); // A browser that fails to emit end must release eventually.
    await start.waitFor();
    await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    await prompt.fill('x'.repeat(7998)); await start.click(); await emit(page, [['Too long', true]]);
    await page.getByRole('alert').filter({ hasText: '8,000' }).waitFor();
    assert.equal((await prompt.inputValue()).length, 8000); await start.waitFor();
    await prompt.fill('Preserved'); await start.click();
    await page.evaluate(() => window.__lateVoiceResult = window.__voice.instances.at(-1).onresult);
    await page.locator('footer').getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    await page.evaluate(() => window.__lateVoiceResult({ results: [Object.assign([{ transcript: 'Late' }], { isFinal: true })] }));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await prompt.inputValue(), 'Preserved');
    await start.click();
    await page.locator('summary').filter({ hasText: 'AI details assistant' }).click();
    await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    await page.locator('summary').filter({ hasText: 'AI details assistant' }).click();
    await start.click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await start.waitFor(); await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    await page.evaluate(() => delete document.hidden);
    await start.click();
    const recognitionCount = await page.evaluate(() => window.__voice.instances.length);
    await page.getByRole('button', { name: 'Select language, current language: English', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '中文', exact: true }).click();
    await page.getByRole('button', { name: '语音输入', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__voice.instances.length), recognitionCount);
    await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    assert.equal(await page.getByLabel('明确提供的资料会填入草稿；不确定之处会继续询问。请在创建前审阅。', { exact: true }).inputValue(), 'Preserved');
    await page.getByRole('button', { name: '选择语言，当前语言：中文', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    await start.click();
    await page.getByRole('link', { name: '← Back to events', exact: true }).click();
    await page.waitForFunction(() => window.__voice.instances.at(-1).aborts > 0);
    assert.equal(messages.length, 0); assert.deepEqual(errors, []);
    console.log('PASS permission, device, silence, network, language and start failures; stop timeout; length cap; step/collapse/tab/language/unmount cleanup and late results');
    await context.close();

    const unsupported = await setup(browser, 'zh', 320, 'unsupported');
    assert.equal(await unsupported.start.isDisabled(), true);
    await unsupported.page.getByText('此浏览器暂不支持语音输入，请继续打字或粘贴文字。', { exact: true }).waitFor();
    await unsupported.prompt.fill('仍可打字');
    assert.equal(await unsupported.send.isDisabled(), false);
    assert.deepEqual(unsupported.errors, []);
    await unsupported.context.close();
    console.log('PASS unsupported-browser typing fallback');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

