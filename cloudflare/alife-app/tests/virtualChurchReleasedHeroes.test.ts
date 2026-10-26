import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { selectVirtualChurchHeroReadyAssets } from '../src/views/virtualChurchCriticalAssets.ts'
import { productionHeroMappings } from '../../../tools/virtual-church/gate-a-character-delivery.mjs'

const service = readFileSync(new URL('../src/services/virtualChurchService.ts', import.meta.url), 'utf8')
const characters = productionHeroMappings(service)
const buildings = { churchHeroHigh: 'church-high', churchHeroLow: 'church-low' }
const config = { characters, buildings } as Parameters<typeof selectVirtualChurchHeroReadyAssets>[0]

test('released male selects Medium on desktop and Low on mobile, never High or a review URL', () => {
  for (const [mobile, quality] of [[false, 'Medium'], [true, 'Low']] as const) {
    const selected = selectVirtualChurchHeroReadyAssets(config, mobile, 'male')
    assert.equal(selected.characterHero, characters[`gateAMale${quality}`])
    assert.equal(selected.churchHero, mobile ? 'church-low' : 'church-high')
    assert.ok(!selected.characterHero.includes('__alife-review'))
    assert.notEqual(selected.characterHero, characters.gateAMaleHigh)
  }
  assert.equal(selectVirtualChurchHeroReadyAssets(config, false).characterHero, characters.gateAFemaleMedium)
})

test('released male bytes and portrait match the approved candidate manifest; deployment and shared-rig gates stay open', () => {
  const directory = new URL('../public/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('character-hero-male.manifest.json', directory), 'utf8'))
  assert.equal(manifest.deploymentApproved, false)
  assert.equal(manifest.rig.sharedWithFemale, false)
  assert.equal(manifest.provenance.sourceModel, 'AvatarSample_C')
  assert.equal(manifest.license.cc0, false)
  for (const asset of Object.values(manifest.assets) as Array<{ path: string; bytes: number; sha256: string }>) {
    const bytes = readFileSync(new URL(asset.path, directory))
    assert.equal(bytes.length, asset.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
  }
})

test('public picker is independent of DEV review, keeps session selection, and loads one avatar path', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
  assert.match(view, /characterReview \|\| isGateAPreview \? \(/)
  assert.match(view, /data-hero-id=\{characterReview \? undefined : choiceId\}/)
  assert.match(view, /onHeroChange\(choiceId\)/)
  assert.match(view, /virtualChurchCharacterHeroAssetPath\(characterReview, heroId\)/)
  assert.match(view, /characterReview=\{characterMotionProfile\}/)
  assert.match(view, /sessionStorage\.setItem\('alife:virtual-church:hero', nextHero\)/)
  assert.match(view, /const changeHero[\s\S]*?resetCharacterMovement\(\)[\s\S]*?setHeroId\(nextHero\)/)
  assert.doesNotMatch(view, /preload\([^\n]*gateAMale/)
})

test('picker identifies each accepted sample derivative without claiming original or CC0 ownership', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
  const models = [...view.matchAll(/id: reviewCharacterIds\[(\d)\],[\s\S]*?sourceModel: '([^']+)'/g)]
  const releases = ['gate-a-baseline-r9/characters/character-hero-female.manifest.json', 'male-hero-v14-r1/characters/character-hero-male.manifest.json']
  assert.equal(models.length, 2)
  for (const [index, path] of releases.entries()) {
    const manifest = JSON.parse(readFileSync(new URL(`../public/virtual-church-assets/v3/releases/${path}`, import.meta.url), 'utf8'))
    assert.equal(Number(models[index][1]), index)
    assert.equal(models[index][2], manifest.provenance.sourceModel)
    assert.equal(manifest.license.cc0, false)
  }
  assert.match(view, /data-hero-source=\{choiceId\}/)
  assert.match(view, /\{t\.characterSourceLabel\}[^\n]*VRoid Studio[^\n]*\{reviewCharacter\.sourceModel\}/)
  assert.equal([...view.matchAll(/characterSourceNote:/g)].length, 2)
  assert.match(view, /characterSourceNote: '[^']*pixiv VRoid Project[^']*并非从零原创[^']*'/)
  assert.match(view, /characterSourceNote: '[^']*pixiv VRoid Project[^']*not models created from scratch[^']*'/)
  assert.match(view, /\{\(characterReview \|\| isGateAPreview\) && \([\s\S]*?\{t\.characterSourceNote\}/)
})

test('editorial picker candidate requires DEV + V3 + exact opt-in and changes no public model loading', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
  const css = readFileSync(new URL('../src/views/virtualChurchCharacterReview.css', import.meta.url), 'utf8')
  assert.match(view, /const editorialCharacterPreview = import\.meta\.env\.DEV\s*&& config3D\.visualVersion === 'v3'\s*&& profile3DSearchParams\.get\('vcCharacterUi'\) === 'editorial'/)
  assert.match(view, /if \(editorialCharacterPreview\) void import\('\.\/virtualChurchCharacterReview\.css'\)/)
  assert.match(view, /data-vc-character-ui=\{editorialCharacterPreview \? 'editorial' : undefined\}/)
  assert.doesNotMatch(css, /url\(|@import|@font-face|animation:/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /button:focus-visible/)
  for (const block of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    if (!block[1].trim().startsWith('@')) assert.ok(block[1].includes('[data-vc-character-ui="editorial"]'), block[1])
  }
})
