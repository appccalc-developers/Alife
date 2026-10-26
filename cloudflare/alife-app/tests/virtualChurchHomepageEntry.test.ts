import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('guest-enabled homepage has one quiet bilingual footer link without preloading scene assets', () => {
  const managedHome = source('../src/views/home/ManagedHomePageContent.tsx')
  const renderer = source('../src/components/page/PageContentRenderer.tsx')
  const hero = source('../src/components/page-sections/LandingHeroSection.tsx')
  const footer = source('../src/views/home/HomeFooter.tsx')
  const copy = source('../src/i18n/home.ts')

  assert.match(footer, /virtualChurchGuestVisitEnabled\(\) \? \(/)
  assert.equal((footer.match(/to="\/virtual-church\?vcVisual=v3"/g) ?? []).length, 1)
  assert.match(footer, /copy\.virtualChurchTourLabel/)
  assert.match(copy, /virtualChurchTourLabel: '参观 3D 教堂'/)
  assert.match(copy, /virtualChurchTourLabel: 'Explore the 3D church'/)
  assert.match(footer, /min-h-11/)
  assert.match(footer, /text-xs font-normal/)
  assert.match(footer, /focus-visible:/)
  for (const code of [managedHome, renderer, hero]) {
    assert.doesNotMatch(code, /virtualChurchEntryVisible|to="\/virtual-church/, 'only the footer owns the public homepage entry')
  }
  for (const code of [managedHome, hero, footer]) {
    assert.doesNotMatch(code, /VirtualChurchView|virtual-church-assets|import\('.*VirtualChurch/)
  }
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
