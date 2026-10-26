import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { virtualChurchResourceBelongsToProfile } from '../src/views/virtualChurchPerformanceContract.ts'
import { virtualChurchAppShellRequestMatches } from '../src/views/virtualChurchPwaContract.ts'

const view = readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
const css = readFileSync(new URL('../src/views/virtualChurchTourControls.css', import.meta.url), 'utf8')

test('tour presentation is deferred with the 3D route and cannot restyle V2 or other pages', () => {
  assert.match(view, /import '\.\/virtualChurchTourControls\.css'/)
  const selectors = css.split('\n').map(line => line.trim()).filter(line => line.startsWith('.'))
  assert.ok(selectors.length > 15)
  for (const selector of selectors) {
    assert.ok(selector.startsWith('.virtual-church-ui[data-vc-visual="v3"] '), selector)
  }
  assert.doesNotMatch(css, /@import|url\(|animation:/)
  for (const filter of css.matchAll(/backdrop-filter:\s*([^;]+);/g)) {
    assert.equal(filter[1]!.trim(), 'none')
  }
  assert.match(css, /\.vc-tour-button:hover\s*\{[^}]*box-shadow: 0 3px 12px/)
})

test('quiet controls retain labelled actions, touch size, selection, and motion-free focus feedback', () => {
  for (const label of ['t.back', 't.openGuide', 't.character', 't.greet', 't.jump']) {
    assert.ok(view.includes(`aria-label={${label}}`))
  }
  assert.match(view, /aria-label=\{labels\.group\}/)
  assert.match(view, /aria-pressed=\{mode === id\}/)
  assert.match(view, /gateATouchLayout \? 'h-11 min-w-11' : 'h-10'/)
  assert.match(view, /aria-label=\{`\$\{t\.churchName\} · \$\{t\.prototype\}`\}/)
  assert.match(css, /\.vc-camera-choice\[aria-pressed="true"\]/)
  assert.match(css, /:focus-visible[\s\S]*outline: 2px solid #f2f0ea/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*\.vc-keyboard-hint\s*\{\s*top: auto;/)
})

test('entrance and main-hall actions stay at the edge without a central banner', () => {
  const prompts = view.slice(view.indexOf('{nearEntranceInfoVisible ? ('), view.indexOf('<div className="vc-topbar'))
  assert.equal((prompts.match(/vc-edge-action/g) ?? []).length, 2)
  assert.doesNotMatch(prompts, /left-1\/2|translate-x|w-\[calc\(100vw/)
  assert.match(prompts, /className="sr-only"/)
  assert.match(prompts, /navigateFromChurch\('\/events'\)/)
  assert.match(prompts, /enterMainHallDoor\(nearMainHallDoor!\)/)
  assert.match(css, /\.vc-edge-action\s*\{[^}]*right: max\(\.75rem, env\(safe-area-inset-right\)\)/)
  assert.match(css, /\.vc-edge-action button\s*\{[^}]*min-height: 44px/)
})

test('release entrance validator rejects central placement, visible banners and undersized actions', () => {
  const validator = readFileSync(new URL('../../../tools/virtual-church/validate-gate-a-entrance-information.mjs', import.meta.url), 'utf8')
  const checks = validator.slice(validator.indexOf('for (const removedPhysicalFragment'), validator.indexOf('const report ='))
  const copy = readFileSync(new URL('../src/i18n/virtualChurch.ts', import.meta.url), 'utf8')
  const validateWithCopy = new Function('assert', 'viewSource', 'sceneSource', 'interactionSource', 'controlsSource', 'copySource', checks)
  const validate = (...args: unknown[]) => validateWithCopy(...args, copy)
  const scene = readFileSync(new URL('../src/views/virtualChurchScene.ts', import.meta.url), 'utf8')
  const interaction = readFileSync(new URL('../src/views/virtualChurchInteractionContract.ts', import.meta.url), 'utf8')
  assert.doesNotThrow(() => validate(assert, view, scene, interaction, css))
  assert.throws(() => validate(assert, view.replace('vc-tour-callout vc-edge-action', 'vc-tour-callout vc-edge-action left-1/2'), scene, interaction, css))
  assert.throws(() => validate(assert, view.replace('<div className="sr-only">\n              <p', '<div className="visible-banner">\n              <p'), scene, interaction, css))
  assert.throws(() => validate(assert, view, scene, interaction, css.replace('min-height: 44px;', 'min-height: 32px;')))
  assert.throws(() => validate(assert, view, scene, interaction, css.replace('right: max(.75rem, env(safe-area-inset-right));', 'left: 50%;')))
})

test('tour text and muted alpha label contrast on both white and black scene backgrounds', () => {
  const luminance = (channels: number[]) => channels.reduce((sum, channel, index) => {
    const value = channel / 255
    return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      * [0.2126, 0.7152, 0.0722][index]!
  }, 0)
  const surface = [23, 28, 30]
  for (const scene of [0, 255]) {
    const background = luminance(surface.map(channel => channel * 0.94 + scene * 0.06))
    for (const text of [[242, 240, 234], [195, 199, 198]]) {
      const ratio = (luminance(text) + 0.05) / (background + 0.05)
      assert.ok(ratio >= 4.5, `scene=${scene}, ratio=${ratio}`)
    }
  }
  assert.ok((luminance([242, 240, 234]) + 0.05) / (luminance(surface) + 0.05) >= 4.5)
})

test('deferred tour CSS is included in runtime and static critical payload accounting', () => {
  assert.equal(virtualChurchResourceBelongsToProfile({
    name: 'http://localhost/assets/VirtualChurchView-test.css', startTime: 120,
  }, 200), true)
  const validator = readFileSync(new URL('../../../tools/virtual-church/validate-static-critical-payload.mjs', import.meta.url), 'utf8')
  assert.match(validator, /findSingleChunk\('VirtualChurchView-', '\.css'\)/)
  assert.match(validator, /addResource\(resources, style, 'production-3d-style'\)/)
})

test('tour CSS stays out of install-time precache but retains the public shell runtime cache route', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(config, /globIgnores:[\s\S]*'\*\*\/assets\/VirtualChurchView-\*\.css'/)
  assert.equal(virtualChurchAppShellRequestMatches({
    request: { destination: 'style', mode: 'cors' },
    url: { origin: 'http://localhost', pathname: '/assets/VirtualChurchView-test.css' },
  }, 'http://localhost'), true)
  assert.equal(virtualChurchAppShellRequestMatches({
    request: { destination: 'style', mode: 'cors' },
    url: { origin: 'http://unrelated.test', pathname: '/assets/VirtualChurchView-test.css' },
  }, 'http://localhost'), false)
})
