import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { virtualChurchAppShellRequestMatches } from '../src/views/virtualChurchPwaContract.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const hall = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx', import.meta.url))
const study = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
const css = read('../src/views/virtualChurchInteriorControls.css')

test('interior styles are lazy, bounded to interiors, and need no additional media or fonts', () => {
  for (const source of [hall, study]) assert.match(source, /import '\.\/virtualChurchInteriorControls\.css'/)
  for (const source of [read('../src/main.tsx'), read('../src/views/VirtualChurchView.tsx')]) {
    assert.doesNotMatch(source, /virtualChurchInteriorControls/)
  }
  assert.match(hall, /data-vc-interior="main-hall"/)
  assert.match(study, /data-vc-interior="study-room"/)
  const selectors = css.split('\n').map(line => line.trim()).filter(line => line.startsWith('.'))
  assert.ok(selectors.length >= 20)
  for (const selector of selectors) assert.match(selector, /^\.virtual-church-ui\[data-vc-interior(?:="(?:main-hall|study-room)")?\]/, selector)
  assert.doesNotMatch(css, /@import|url\(|animation:|backdrop-filter/)
})

test('short-landscape interiors compact headers and hall labels without hiding truth or shrinking targets', () => {
  const compact = css.slice(css.indexOf('@media (orientation: landscape)'), css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(compact, /max-height: 480px/)
  assert.match(compact, /grid-template-columns: auto minmax\(0, 1fr\) auto/)
  assert.match(compact, /flex-wrap: nowrap/)
  const selectors = compact.split('\n').map(line => line.trim()).filter(line => line.startsWith('.'))
  assert.ok(selectors.length > 4)
  let sharedHeaders = 0
  for (const selector of selectors) {
    if (selector.startsWith('.virtual-church-ui[data-vc-interior]')) {
      assert.match(selector, /\.vc-interior-(?:header|caption(?: h1)?) \{$/)
      sharedHeaders++
    } else assert.ok(selector.startsWith('.virtual-church-ui[data-vc-interior="main-hall"]'), selector)
  }
  assert.equal(sharedHeaders, 3)
  const note = compact.slice(compact.indexOf('.vc-interior-note'))
  assert.doesNotMatch(note, /display:\s*none|overflow:\s*hidden|text-overflow|line-clamp/)
  assert.doesNotMatch(compact, /min-height:|min-width:\s*(?:[1-3]?\d|4[0-3])px/)
  for (const [full, short] of [['View the stage','Stage'],['View the seating','Seating'],['Walk through','Walk']]) {
    assert.ok(hall.includes(full) && hall.includes(short))
  }
  assert.equal((hall.match(/aria-label=\{zh \? '(?:从后方看舞台|从舞台看座席|步行查看)'/g) ?? []).length, 3)
  assert.equal((hall.match(/className="vc-interior-label-compact" aria-hidden="true"/g) ?? []).length, 3)
  assert.match(hall, /frameloop="demand"/)
})

test('truth captions and bilingual actions remain present, not hidden by truncation', () => {
  for (const label of ['2017 影像参考', '2017 photo reference', '不代表 2026 年现状', 'not a record of the 2026 interior']) {
    assert.ok(hall.includes(label))
  }
  for (const label of ['场景为概念设计', 'Concept room', '非实时成员', 'Not live members', '五位虚拟同伴', 'Five virtual companions']) {
    assert.ok(study.includes(label))
  }
  for (const source of [hall, study]) {
    assert.match(source, /返回门厅/)
    assert.match(source, /Back to foyer/)
    assert.doesNotMatch(source, /className="truncate/)
    assert.doesNotMatch(source, /!border-\[#|!bg-\[#/)
  }
  assert.match(study, /navigate\('\/study\?from=virtual-church-study-room'\)/)
  assert.match(study, /navigate\('\/virtual-church\?vcArrival=study-room'\)/)
})

test('hall walk help is a collapsed bilingual disclosure, not a permanent scene-wide banner', () => {
  assert.match(hall, /const \[walkHelpOpen, setWalkHelpOpen\] = useState\(false\)/)
  assert.match(hall, /aria-expanded=\{walkHelpOpen\}/)
  assert.match(hall, /aria-controls=\{walkHelpId\}/)
  assert.match(hall, /id=\{walkHelpId\} hidden=\{!walkHelpOpen\}/)
  for (const label of ['操作说明', 'Controls', '收起说明', 'Hide controls']) assert.ok(hall.includes(label))
  assert.match(hall, /if \(walkHelpOpen\) pageRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(hall, /event.code === 'Escape'[\s\S]*setWalkHelpOpen\(false\)/)
  assert.doesNotMatch(hall, /vc-interior-hint pointer-events-none absolute left-1\/2/)
  assert.match(css, /\.virtual-church-ui\[data-vc-interior="main-hall"\] \.vc-interior-walk-help/)
})

test('selected, disabled, focus, touch, reduced-motion, and safe-area states are explicit', () => {
  assert.match(css, /min-height: 44px/)
  assert.match(css, /min-width: 44px/)
  assert.match(css, /\[aria-pressed="true"\]/)
  assert.match(css, /:disabled[\s\S]*cursor: not-allowed/)
  assert.match(css, /:focus-visible[\s\S]*outline: 2px solid #f2f0ea/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
  for (const edge of ['top', 'bottom', 'left', 'right']) assert.ok(css.includes(`env(safe-area-inset-${edge})`))
  assert.match(study, /disabled=\{reducedMotion \|\| failed \|\| !companions.length\}/)
  for (const source of [hall, study]) assert.match(source, /aria-pressed=/)
  for (const handler of ['onPointerDown', 'onPointerUp', 'onPointerCancel', 'onLostPointerCapture']) assert.ok(hall.includes(handler))
})

test('interior neutral text, caption and primary action meet contrast on bright and dark scenes', () => {
  const luminance = (channels: number[]) => channels.reduce((sum, channel, index) => {
    const value = channel / 255
    return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      * [.2126, .7152, .0722][index]!
  }, 0)
  const surface = [23, 28, 30]
  for (const backdrop of [0, 255]) {
    const background = luminance(surface.map(channel => channel * .94 + backdrop * .06))
    for (const text of [[242, 240, 234], [195, 199, 198]]) {
      assert.ok((luminance(text) + .05) / (background + .05) >= 4.5)
    }
  }
  assert.ok((luminance([242, 240, 234]) + .05) / (luminance(surface) + .05) >= 4.5)
})

test('shared interior CSS stays outside PWA install precache and is counted by the closure guard', () => {
  assert.match(read('../vite.config.ts'), /'\*\*\/assets\/virtualChurch\*\.css'/)
  assert.match(read('../../../tools/virtual-church/validate-production-chunk-closure.mjs'), /\[Vv\]irtualChurch\[\^\/\]\*/)
  const request = { request: { destination: 'style', mode: 'cors' }, url: { origin: 'http://localhost', pathname: '/assets/virtualChurchInteriorControls-test.css' } }
  assert.equal(virtualChurchAppShellRequestMatches(request, 'http://localhost'), true)
  assert.equal(virtualChurchAppShellRequestMatches(request, 'http://other.test'), false)
})
