import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('guest-enabled homepage has one low-key bilingual 3D link without preloading scene assets', () => {
  const managedHome = source('../src/views/home/ManagedHomePageContent.tsx')
  const renderer = source('../src/components/page/PageContentRenderer.tsx')
  const hero = source('../src/components/page-sections/LandingHeroSection.tsx')

  assert.match(managedHome, /virtualChurchEntryVisible=\{virtualChurchGuestVisitEnabled\(\)\}/)
  assert.match(renderer, /virtualChurchEntryVisible && index === 0 && section\.type === 'LandingHero'/)
  assert.match(hero, /virtualChurchEntryVisible && mode === 'render' && !compactPreview/)
  assert.match(hero, /to="\/virtual-church\?vcVisual=v3"/)
  assert.match(hero, /参观 3D 教堂/)
  assert.match(hero, /Explore the 3D church/)
  assert.match(hero, /min-h-11/)
  assert.match(hero, /rounded-full border border-white\/45 bg-white\/10 px-4/, 'quiet entry remains discoverable on the hero')
  assert.doesNotMatch(managedHome, /VirtualChurchView|virtual-church-assets|import\('.*VirtualChurch/)
  assert.doesNotMatch(hero, /VirtualChurchView|virtual-church-assets|import\('.*VirtualChurch/)
})

test('3D and study-room reading use the same guarded guest-release condition', () => {
  const routes = source('../src/app/routing/AppRoutes.tsx')
  assert.match(routes, /const VirtualChurchPreviewRoute = .*\n\s*virtualChurchGuestVisitEnabled\(\) \? children : <MemberRoute>\{children\}<\/MemberRoute>/)
  assert.match(routes, /<VirtualChurchPreviewRoute>\s*<VirtualChurchRouteBoundary>\s*<VirtualChurchRouteEntry/)
  assert.match(routes, /path="\/virtual-church\/study-room" element=\{<VirtualChurchPreviewRoute>/)
  assert.match(routes, /path="\/virtual-church\/main-hall" element=\{<VirtualChurchPreviewRoute>/)
  assert.match(routes, /path="\/study"\s*element=\{\s*<VirtualChurchReadingRoute>/)
  assert.match(routes, /virtualChurchGuestVisitEnabled\(\) && isVirtualChurchStudyRoomReading\(location\.search\)/)
  const reader = source('../src/views/BibleStudyView.tsx')
  assert.match(reader, /if \(!memberId \|\| auth\.isGuest\)/)
  assert.match(reader, /if \(!memberId \|\| auth\.isGuest \|\| restoredReadingMemberId !== memberId\) return/)
})

test('direct 3D links return to Alife instead of leaving the browser on a blank page', () => {
  const view = source('../src/views/VirtualChurchView.tsx')
  assert.match(view, /const returnToAlife = \(\) => navigate\('\/', \{ replace: true \}\)/)
  assert.match(view, /onClick=\{returnToAlife\} aria-label=\{t\.back\}/)
})
