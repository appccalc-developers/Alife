import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const eventsDir = resolve(scriptDir, '..')
const repositoryRoot = resolve(eventsDir, '..', '..')
const readmePath = join(eventsDir, 'README.md')
const contractPath = join(eventsDir, 'event-contract.json')
const aboutPath = join(eventsDir, 'EventManagement-About.html')
const templatePath = join(eventsDir, 'templates', 'alife-event-composition-model.zh-TW-en.template.html')
const handbookPath = join(eventsDir, 'generated', 'alife-event-composition-model.zh-TW-en.html')
const expectedModules = [
  'TEAM.WORK',
  'PEOPLE.REGISTRATION',
  'SERVICE.ROSTER',
  'MONEY.FINANCE',
  'SAFETY.RAM',
  'SAFEGUARDING.CHILD',
  'PROGRAM.PRODUCTION',
  'PLACE.RESOURCE',
  'MOVE.STAY',
  'FOOD.HOSPITALITY',
  'FESTIVAL.OPERATIONS',
  'COMMS.FOLLOWUP',
]
const expectedArchetypes = [
  'simple-social',
  'camp-retreat',
  'recurring-gathering',
  'festival-celebration',
]
const localeOrder = ['zh-CN', 'zh-TW', 'en']
const operationalContractKeys = ['baseline', 'implementationInventory', 'migrationPhases', 'verificationEvidence']
const requiredEventPackageEnums = [
  'eventPackageScopeType',
  'eventPackageCoverageMode',
  'eventGovernanceTier',
  'eventPackageStatus',
  'eventPackageApprovalValidity',
  'eventPackageDecisionType',
  'eventPackageConditionStatus',
  'eventLifecycleGate',
  'eventPackageEnforcementMode',
  'legacyEventPackageTransition',
  'eventChangeClassification',
]
const requiredEventPackageAuthorizationRules = [
  'event.package.view',
  'event.package.generate',
  'event.package.submit',
  'event.package.withdraw',
  'event.package.decide',
  'event.package.decision.revoke',
  'event.package.condition.satisfy',
  'event.package.condition.verify',
  'event.publish',
  'event.unpublish',
  'event.registration.open',
  'event.registration.close',
  'event.execution.confirm',
]

const fail = (message) => {
  throw new Error(message)
}

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const renderInline = (value) => {
  const placeholders = []
  let output = escapeHtml(value)
  output = output.replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE${placeholders.length}@@`
    placeholders.push(`<code>${code}</code>`)
    return token
  })
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  placeholders.forEach((html, index) => {
    output = output.replace(`@@CODE${index}@@`, html)
  })
  return output
}

const renderMarkdown = (markdown) => {
  const lines = markdown.replace(/<!--[^]*?-->/g, '').trim().split(/\r?\n/)
  const output = []
  let paragraph = []
  let list = []
  let code = []
  let inCode = false

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (list.length) {
      output.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
      list = []
    }
  }
  const flushCode = () => {
    output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
    code = []
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      if (inCode) flushCode()
      inCode = !inCode
      continue
    }
    if (inCode) {
      code.push(line)
      continue
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }
    const listItem = line.match(/^[-*]\s+(.+)$/)
    if (listItem) {
      flushParagraph()
      list.push(listItem[1])
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    paragraph.push(line.trim())
  }
  flushParagraph()
  flushList()
  if (inCode) fail('README.md contains an unclosed code fence.')
  return output.join('\n')
}

const extractOverviewLocales = (markdown) => Object.fromEntries(localeOrder.map((locale) => {
  const expression = new RegExp(`<!-- overview:${locale}:start -->([\\s\\S]*?)<!-- overview:${locale}:end -->`)
  const match = markdown.match(expression)
  if (!match) fail(`README.md is missing the ${locale} overview markers.`)
  return [locale, match[1].trim()]
}))

const overviewShape = (markdown) => {
  const headings = [...markdown.matchAll(/^(#{2,4})\s+/gm)].map((match) => match[1].length)
  const listCounts = markdown.split(/\n\s*\n/).map((block) =>
    block.split(/\r?\n/).filter((line) => /^[-*]\s+/.test(line)).length,
  ).filter(Boolean)
  return JSON.stringify({ headings, listCounts, fences: (markdown.match(/^```/gm) ?? []).length })
}

const validateOverview = (locales) => {
  const referenceShape = overviewShape(locales.en)
  for (const locale of localeOrder) {
    if (overviewShape(locales[locale]) !== referenceShape) {
      fail(`README.md ${locale} overview structure differs from English.`)
    }
    for (const required of [
      'EVENT-CONTRACT.md',
      'IMPLEMENTATION-STATUS.md',
      'generated/alife-event-composition-model.zh-TW-en.html',
      ...expectedModules.map((code) => `modules/${code}.md`),
    ]) {
      if (!locales[locale].includes(`](${required})`)) {
        fail(`README.md ${locale} overview is missing ${required}.`)
      }
    }
    for (const term of ['Event Plan', 'EventSeries', 'EventOccurrence', 'EventWorkflowRun']) {
      if (!locales[locale].includes(term)) fail(`README.md ${locale} overview is missing ${term}.`)
    }
  }
}

const renderAbout = (locales) => {
  const labels = {
    'zh-CN': { button: '简体中文', name: '简体中文', title: '活动管理概览' },
    'zh-TW': { button: '繁體中文', name: '繁體中文', title: '活動管理概覽' },
    en: { button: 'English', name: 'English', title: 'Event Management overview' },
  }
  const tabs = localeOrder.map((locale, index) =>
    `<button type="button" role="tab" id="tab-${locale}" aria-controls="panel-${locale}" aria-selected="${index === 0}" data-locale-button="${locale}">${labels[locale].button}</button>`,
  ).join('\n')
  const panels = localeOrder.map((locale, index) => `
    <article id="panel-${locale}" role="tabpanel" aria-labelledby="tab-${locale}" data-locale-panel="${locale}" lang="${locale}"${index === 0 ? '' : ' hidden'}>
      ${renderMarkdown(locales[locale])}
    </article>`).join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="docs/events/scripts/generate-event-docs.mjs">
  <title>ALIFE Event Management</title>
  <style>
    :root { color-scheme: light; --ink:#18332d; --muted:#5f6f69; --jade:#176b5a; --mint:#e6f2ed; --paper:#fff; --canvas:#f3f1ea; --line:#dce4df; --coral:#d86548; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:linear-gradient(145deg,#edf5f1 0,#f7f3eb 48%,#eef4f8 100%); font:16px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
    a { color:var(--jade); text-underline-offset:3px; }
    .shell { width:min(1100px,calc(100% - 32px)); margin:0 auto; }
    .site-nav { position:sticky; top:0; z-index:10; border-bottom:1px solid rgba(23,107,90,.18); background:rgba(255,255,255,.94); backdrop-filter:blur(12px); }
    .nav-inner { min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .brand { color:var(--ink); font-weight:850; letter-spacing:.08em; text-decoration:none; }
    .nav-links { display:flex; flex-wrap:wrap; gap:14px; font-size:.9rem; font-weight:700; }
    header { padding:64px 0 34px; }
    .eyebrow { color:var(--coral); font-size:.76rem; font-weight:850; letter-spacing:.16em; text-transform:uppercase; }
    h1 { max-width:820px; margin:.25em 0; font-size:clamp(2.25rem,7vw,5.4rem); line-height:.97; letter-spacing:-.055em; }
    .lede { max-width:720px; color:var(--muted); font-size:1.08rem; }
    .notice { margin:24px 0 0; padding:14px 16px; border-left:4px solid var(--coral); border-radius:0 12px 12px 0; background:#fff9f5; }
    .language-bar { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 20px; }
    [role=tab] { border:1px solid var(--line); border-radius:999px; padding:9px 15px; color:var(--ink); background:var(--paper); font:inherit; font-weight:750; cursor:pointer; }
    [role=tab][aria-selected=true] { color:white; border-color:var(--jade); background:var(--jade); }
    [role=tabpanel] { padding:clamp(22px,5vw,52px); border:1px solid var(--line); border-radius:24px; background:var(--paper); box-shadow:0 18px 55px rgba(24,51,45,.09); }
    [role=tabpanel] h2:first-child { margin-top:0; }
    h2 { margin-top:1.65em; font-size:clamp(1.55rem,3vw,2.35rem); line-height:1.15; }
    h3 { margin-top:1.5em; font-size:1.12rem; }
    pre { overflow:auto; padding:18px; border-radius:14px; color:#effaf6; background:#12372e; font-size:.92rem; }
    code { border-radius:5px; padding:.1em .35em; background:var(--mint); font-family:"SFMono-Regular",Consolas,monospace; }
    pre code { padding:0; background:transparent; }
    li + li { margin-top:.48em; }
    footer { padding:30px 0 48px; color:var(--muted); font-size:.88rem; }
    @media (max-width:720px) { .shell { width:min(100% - 22px,1100px); } .nav-inner { align-items:flex-start; flex-direction:column; padding:12px 0; } header { padding-top:42px; } [role=tabpanel] { border-radius:18px; } }
    @media (prefers-reduced-motion:no-preference) { [role=tabpanel] { animation:enter .25s ease-out; } @keyframes enter { from { opacity:.35; transform:translateY(5px); } } }
  </style>
</head>
<body>
  <nav class="site-nav" aria-label="Event Management documentation">
    <div class="shell nav-inner">
      <a class="brand" href="README.md">ALIFE · EVENTS</a>
      <div class="nav-links">
        <a href="EVENT-CONTRACT.md">Contract</a>
        <a href="IMPLEMENTATION-STATUS.md">Status</a>
        <a href="event-contract.json">JSON</a>
        <a href="generated/alife-event-composition-model.zh-TW-en.html">Handbook</a>
      </div>
    </div>
  </nav>
  <header class="shell">
    <p class="eyebrow">One architecture · multiple projections</p>
    <h1>ALIFE Event Management</h1>
    <p class="lede">A compact, multilingual entry point to the composition model, its authority boundaries, and the documents that govern implementation.</p>
    <p class="notice"><strong>Generated document.</strong> This page is generated from <a href="README.md">README.md</a>. Do not edit this HTML file directly.</p>
  </header>
  <main class="shell">
    <div class="language-bar" role="tablist" aria-label="Language / 语言 / 語言">
      ${tabs}
    </div>
    ${panels.trimStart()}
  </main>
  <footer class="shell">Generated by <code>node docs/events/scripts/generate-event-docs.mjs</code>.</footer>
  <script>
    (() => {
      const buttons = [...document.querySelectorAll('[data-locale-button]')]
      const panels = [...document.querySelectorAll('[data-locale-panel]')]
      const activate = (locale, focus = false) => {
        buttons.forEach((button) => {
          const selected = button.dataset.localeButton === locale
          button.setAttribute('aria-selected', String(selected))
          if (selected && focus) button.focus()
        })
        panels.forEach((panel) => { panel.hidden = panel.dataset.localePanel !== locale })
        document.documentElement.lang = locale
        history.replaceState(null, '', '#' + locale)
      }
      buttons.forEach((button, index) => {
        button.addEventListener('click', () => activate(button.dataset.localeButton))
        button.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
          event.preventDefault()
          const offset = event.key === 'ArrowRight' ? 1 : -1
          const next = buttons[(index + offset + buttons.length) % buttons.length]
          activate(next.dataset.localeButton, true)
        })
      })
      const requested = location.hash.slice(1)
      if (buttons.some((button) => button.dataset.localeButton === requested)) activate(requested)
    })()
  </script>
</body>
</html>
`
}

const assertUnique = (values, label) => {
  if (new Set(values).size !== values.length) fail(`${label} values must be unique.`)
}

const validateContract = (contract) => {
  for (const key of operationalContractKeys) {
    if (Object.hasOwn(contract, key)) fail(`Operational key ${key} must not appear in event-contract.json.`)
  }
  const moduleCodes = contract.modules.map(({ code }) => code)
  const archetypeCodes = contract.archetypes.map(({ code }) => code)
  const activityTypeCodes = contract.activityTypes.map(({ code }) => code)
  assertUnique(moduleCodes, 'module code')
  assertUnique(archetypeCodes, 'archetype code')
  assertUnique(activityTypeCodes, 'activity type code')
  assertUnique(contract.surfaceRegistry.map(({ surfaceKey }) => surfaceKey), 'surface key')
  assertUnique(contract.authorizationRules.map(({ code }) => code), 'authorization rule code')
  assertUnique(contract.apis.map(({ method, path }) => `${method} ${path}`), 'API method/path')
  assertUnique(contract.architectureDecisions.map(({ code }) => code), 'architecture decision code')
  assertUnique(contract.aggregates.map(({ code }) => code), 'aggregate code')
  if (JSON.stringify(moduleCodes) !== JSON.stringify(expectedModules)) fail('The twelve module codes or their canonical order changed.')
  if (JSON.stringify(archetypeCodes) !== JSON.stringify(expectedArchetypes)) fail('The four immutable archetype codes or their order changed.')
  const moduleSet = new Set(moduleCodes)
  const activitySet = new Set(activityTypeCodes)
  for (const module of contract.modules) {
    for (const dependency of module.dependencies) {
      if (!moduleSet.has(dependency)) fail(`${module.code} has unknown dependency ${dependency}.`)
    }
    if (!module.name?.en || !module.name?.zh) fail(`${module.code} is missing bilingual name.en/name.zh.`)
    const contribution = module.eventPackageContribution
    if (!contribution || !contribution.summaryFields?.length || !contribution.prohibitedContent?.length || !contribution.sourceValidityImpact) {
      fail(`${module.code} is missing a complete Event Package contribution contract.`)
    }
  }
  for (const archetype of contract.archetypes) {
    if (!archetype.name?.en || !archetype.name?.zh) fail(`${archetype.code} is missing bilingual name.en/name.zh.`)
    for (const code of archetype.activityTypeCodes) {
      if (!activitySet.has(code)) fail(`${archetype.code} references unknown activity type ${code}.`)
    }
    for (const code of Object.values(archetype.moduleDefaults).flat()) {
      if (!moduleSet.has(code)) fail(`${archetype.code} references unknown module ${code}.`)
    }
  }
  for (const activityType of contract.activityTypes) {
    if (!expectedArchetypes.includes(activityType.archetypeCode)) fail(`${activityType.code} has unknown archetype ${activityType.archetypeCode}.`)
    if (!activityType.name?.en || !activityType.name?.zh) fail(`${activityType.code} is missing bilingual name.en/name.zh.`)
    const owner = contract.archetypes.find(({ code }) => code === activityType.archetypeCode)
    if (!owner.activityTypeCodes.includes(activityType.code)) fail(`${activityType.code} is not referenced by its archetype.`)
    for (const moduleCode of activityType.preselectedModules) {
      if (!moduleSet.has(moduleCode)) fail(`${activityType.code} preselects unknown module ${moduleCode}.`)
    }
    for (const slot of activityType.presetServiceSlots ?? []) {
      if (!slot.label?.en || !slot.label?.zh) fail(`${activityType.code} has a non-bilingual service slot.`)
    }
  }
  for (const surface of contract.surfaceRegistry) {
    if (surface.moduleCode !== null && !moduleSet.has(surface.moduleCode)) fail(`${surface.surfaceKey} references unknown module ${surface.moduleCode}.`)
  }
  for (const module of contract.modules) {
    const surface = contract.surfaceRegistry.find(({ surfaceKey }) => surfaceKey === module.surfaceKey)
    if (!surface || surface.moduleCode !== module.code) fail(`${module.code} has an invalid surface reference.`)
  }
  const eventPackage = contract.eventPackageApproval
  if (!eventPackage || eventPackage.packageSchemaVersion !== '1.0') fail('Event Package Approval schema 1.0 is missing.')
  if (eventPackage.planB !== 'deferred') fail('Plan B must remain explicitly deferred in the Event Package contract.')
  if (!contract.policyContracts?.eventPackageGovernancePolicyV1) fail('Event Package governance policy contract v1 is missing.')
  if (eventPackage.packageSections?.length !== 7) fail('Event Package must define its seven canonical sections.')
  assertUnique(eventPackage.gateReasonCodes, 'Event Package gate reason code')
  assertUnique(eventPackage.targetSurfaces.map(({ surfaceKey }) => surfaceKey), 'Event Package target surface key')
  for (const enumName of requiredEventPackageEnums) {
    if (!contract.enums[enumName]?.length) fail(`Event Package enum ${enumName} is missing or empty.`)
  }
  const authorizationCodes = new Set(contract.authorizationRules.map(({ code }) => code))
  for (const code of requiredEventPackageAuthorizationRules) {
    if (!authorizationCodes.has(code)) fail(`Event Package authorization rule ${code} is missing.`)
  }
  const apiPaths = new Set(contract.apis.map(({ path }) => path))
  for (const path of [
    '/api/events/{id}/packages/current',
    '/api/events/{id}/packages/generate',
    '/api/events/{id}/packages/{packageId}/submit',
    '/api/events/{id}/packages/{packageId}/decisions',
    '/api/events/{id}/lifecycle-gates',
  ]) {
    if (!apiPaths.has(path)) fail(`Event Package API ${path} is missing.`)
  }
}

const validateRepositoryDefinitions = (contract) => {
  const definitionsPath = join(repositoryRoot, 'backend', 'src', 'Alife.Application', 'Events', 'Services', 'EventCompositionDefinitions.cs')
  if (!existsSync(definitionsPath)) return
  const source = readFileSync(definitionsPath, 'utf8')
  const moduleCodes = [...source.matchAll(/Module\(\s*"([^"]+)"/g)].map((match) => match[1])
  const activityTypes = [...source.matchAll(/ActivityType\("([^"]+)",\s*"([^"]+)"/g)].map((match) => ({
    code: match[1],
    archetypeCode: match[2],
  }))
  const surfaces = [...source.matchAll(/Surface\("([^"]+)",\s*(null|"([^"]+)")/g)].map((match) => ({
    surfaceKey: match[1],
    moduleCode: match[2] === 'null' ? null : match[3],
  }))
  if (JSON.stringify(moduleCodes) !== JSON.stringify(contract.modules.map(({ code }) => code))) {
    fail('Backend Event module codes differ from event-contract.json.')
  }
  if (JSON.stringify(activityTypes) !== JSON.stringify(contract.activityTypes.map(({ code, archetypeCode }) => ({ code, archetypeCode })))) {
    fail('Backend Activity Type codes/archetypes differ from event-contract.json.')
  }
  if (JSON.stringify(surfaces) !== JSON.stringify(contract.surfaceRegistry.map(({ surfaceKey, moduleCode }) => ({ surfaceKey, moduleCode })))) {
    fail('Backend Event surface keys/modules differ from event-contract.json.')
  }
}

const renderHandbook = (template, contract) => {
  const json = JSON.stringify(contract, null, 2)
  const sourcePattern = /<script type="application\/json" id="event-composition-contract">[\s\S]*?<\/script>/
  const codexSectionPattern = /<section id="codex-brief"[\s\S]*?(?=\s*<section id="machine-contract")/
  const codexSection = `<section id="codex-brief" class="section">
      <div class="section-heading">
        <span class="section-label">CODEX</span>
        <div>
          <h2><span data-lang="zh-Hant">Codex 實施閱讀範圍</span><span data-lang="en">Codex implementation reading set</span></h2>
          <p class="muted"><span data-lang="zh-Hant">本手冊是產生的廣泛架構展示，不是獨立實施提示或權威來源。普通模組切片不需要重新讀取整份手冊。</span><span data-lang="en">This handbook is a generated broad architecture presentation, not an independent implementation prompt or authority. An ordinary module slice does not need to reread it.</span></p>
        </div>
      </div>
      <div class="contract-grid">
        <article class="contract-panel"><h3><span data-lang="zh-Hant">規範來源</span><span data-lang="en">Normative sources</span></h3><p class="muted"><a href="../../../AGENTS.md">AGENTS.md</a> · <a href="../EVENT-CONTRACT.md">EVENT-CONTRACT.md</a> · <a href="../event-contract.json">event-contract.json</a></p></article>
        <article class="contract-panel"><h3><span data-lang="zh-Hant">當前狀態</span><span data-lang="en">Current state</span></h3><p class="muted"><a href="../IMPLEMENTATION-STATUS.md">IMPLEMENTATION-STATUS.md</a></p></article>
        <article class="contract-panel"><h3><span data-lang="zh-Hant">模組範圍</span><span data-lang="en">Module scope</span></h3><p class="muted"><span data-lang="zh-Hant">只讀取本次切片對應的</span><span data-lang="en">Read only the affected</span> <a href="../modules/TEAM.WORK.md"><code>modules/&lt;MODULE&gt;.md</code></a>.</p></article>
      </div>
    </section>

`
  if (!sourcePattern.test(template)) fail('Handbook template machine-contract source was not found.')
  if (!codexSectionPattern.test(template)) fail('Handbook template Codex section was not found.')
  let output = template.replace(/^<!--[\s\S]*?-->\s*/, '')
  output = output.replace(
    '</head>',
    '  <meta name="generator" content="docs/events/scripts/generate-event-docs.mjs">\n</head>',
  )
  output = output.replace(
    '<body>',
    `<body>\n  <div style="position:relative;z-index:20;padding:12px 20px;border-bottom:1px solid #d8e4df;background:#fff8ef;color:#18332d;font:700 14px/1.5 system-ui,sans-serif">\n    Generated presentation: do not edit directly. Normative sources: <a href="../EVENT-CONTRACT.md">EVENT-CONTRACT.md</a> and <a href="../event-contract.json">event-contract.json</a>. Current repository state: <a href="../IMPLEMENTATION-STATUS.md">IMPLEMENTATION-STATUS.md</a>. Status prose retained in this long-form presentation is historical context when it conflicts with the operational source.\n  </div>`,
  )
  output = output.replace(sourcePattern, `<script type="application/json" id="event-composition-contract">\n${json}\n  </script>`)
  output = output.replace(codexSectionPattern, codexSection)
  output = output.replaceAll('docs/alife-event-composition-model.zh-TW-en.html', 'docs/events/EVENT-CONTRACT.md')
  output = output.replace(
    '<code>MONEY.FINANCE</code>、<code>SAFEGUARDING.CHILD</code>、<code>FOOD.HOSPITALITY</code>、<code>FESTIVAL.OPERATIONS</code>',
    '<code>MONEY.FINANCE</code>、<code>FOOD.HOSPITALITY</code>、<code>FESTIVAL.OPERATIONS</code>',
  )
  output = output.replace(
    'Exact codes, enums and references in this JSON contract',
    'Exact codes, enums and references in docs/events/event-contract.json',
  )
  output = output.replace(
    '<article class="priority-item"><strong><span data-lang="zh-Hant">本文件的 ADR 與架構護欄</span><span data-lang="en">This document’s ADRs and architecture guardrails</span></strong><p class="muted"><span data-lang="zh-Hant">確定責任、邊界、版本與失敗行為；變更時必須更新本契約。</span><span data-lang="en">They settle responsibility, boundaries, versioning and failure behaviour; changing them requires updating this contract.</span></p></article>',
    '<article class="priority-item"><strong><a href="../EVENT-CONTRACT.md">EVENT-CONTRACT.md</a></strong><p class="muted"><span data-lang="zh-Hant">權威 ADR 與架構護欄；產生的手冊不能變更它們。</span><span data-lang="en">The authoritative ADRs and architecture guardrails; this generated handbook cannot change them.</span></p></article>',
  )
  output = output.replace(
    '<article class="priority-item"><strong><code>#event-composition-contract</code></strong><p class="muted"><span data-lang="zh-Hant">內嵌 JSON 是代碼、枚舉、引用、模組、Surface 和遷移階段的精確來源。</span><span data-lang="en">The embedded JSON is authoritative for codes, enums, references, modules, surfaces and migration phases.</span></p></article>',
    '<article class="priority-item"><strong><a href="../event-contract.json"><code>event-contract.json</code></a></strong><p class="muted"><span data-lang="zh-Hant">外部 JSON 是代碼、枚舉、引用、模組與 Surface 的精確權威來源；本頁內嵌副本由產生器注入。</span><span data-lang="en">The external JSON is authoritative for exact codes, enums, references, modules and surfaces; the embedded copy is injected by the generator.</span></p></article>',
  )
  output = output.replace(
    '<span data-lang="zh-Hant">規範：產品、事工、工程與 Codex</span><span data-lang="en">Normative for product, ministry, engineering & Codex</span>',
    '<span data-lang="zh-Hant">產生的規範投影</span><span data-lang="en">Generated normative projection</span>',
  )
  output = output.replace(
    '<span data-lang="zh-Hant">下方內容直接來自同頁 <code>&lt;script type="application/json" id="event-composition-contract"&gt;</code>。頁面載入時會驗證 JSON、唯一代碼與引用完整性。</span><span data-lang="en">The content below comes directly from this page’s <code>&lt;script type="application/json" id="event-composition-contract"&gt;</code>. Page load validates JSON, unique codes and reference integrity.</span>',
    '<span data-lang="zh-Hant">下方副本由 <a href="../event-contract.json"><code>event-contract.json</code></a> 產生。頁面載入時會驗證 JSON、唯一代碼與引用完整性；HTML 本身不是權威來源。</span><span data-lang="en">The copy below is generated from <a href="../event-contract.json"><code>event-contract.json</code></a>. Page load validates JSON, unique codes and reference integrity; the HTML itself is not authoritative.</span>',
  )
  output = output.replace(
    'The authoritative JSON remains embedded in the HTML source.',
    'The authoritative JSON is docs/events/event-contract.json; this generated copy is provided for presentation.',
  )
  return output
}

const walk = (directory) => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})

const validateLinks = (paths) => {
  const failures = []
  for (const path of paths) {
    const source = readFileSync(path, 'utf8')
    const links = extname(path) === '.md'
      ? [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
      : [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    for (const link of links) {
      const target = link.split('#')[0]
      if (!target || /^(https?:|mailto:)/.test(target)) continue
      if (!existsSync(resolve(dirname(path), decodeURIComponent(target)))) failures.push(`${relative(repositoryRoot, path)} -> ${link}`)
    }
  }
  if (failures.length) fail(`Broken local documentation links:\n${failures.join('\n')}`)
}

const main = () => {
  const checkOnly = process.argv.includes('--check')
  if (!existsSync(contractPath)) fail('event-contract.json is missing.')

  const readme = readFileSync(readmePath, 'utf8')
  const locales = extractOverviewLocales(readme)
  validateOverview(locales)
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  validateContract(contract)
  validateRepositoryDefinitions(contract)

  const about = renderAbout(locales)
  const handbook = renderHandbook(readFileSync(templatePath, 'utf8'), contract)
  const outputs = [[aboutPath, about], [handbookPath, handbook]]
  for (const [path, content] of outputs) {
    if (checkOnly) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== content) fail(`${relative(repositoryRoot, path)} is stale. Regenerate Event documentation.`)
    } else {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf8')
    }
  }

  const documentationFiles = walk(eventsDir).filter((path) => ['.md', '.html'].includes(extname(path)) && !path.includes(`${join(eventsDir, 'templates')}`))
  validateLinks(documentationFiles)
  console.log(`Event docs valid: ${contract.modules.length} modules, ${contract.archetypes.length} archetypes, ${contract.activityTypes.length} activity types, ${contract.apis.length} API contracts, 3 equivalent overview structures.`)
}

main()
