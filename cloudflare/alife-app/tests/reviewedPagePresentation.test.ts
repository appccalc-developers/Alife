import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveReviewedPageContentWidth, resolveReviewedPagePresentation } from '../src/utils/reviewedPagePresentation.ts'

test('reviewed-page showcase width defaults safely and preserves explicit full width', () => {
  assert.equal(resolveReviewedPageContentWidth(undefined), 'contained')
  assert.equal(resolveReviewedPageContentWidth('contained'), 'contained')
  assert.equal(resolveReviewedPageContentWidth('full'), 'full')
  assert.equal(resolveReviewedPageContentWidth('future-width'), 'contained')
  assert.equal(resolveReviewedPageContentWidth({ width: 'full' }), 'contained')
})

test('legacy reviewed-page sections derive distinct presentations from existing menu placement', () => {
  assert.equal(resolveReviewedPagePresentation(undefined, 'churchOrganization'), 'floatingLoop')
  assert.equal(resolveReviewedPagePresentation(undefined, 'recentEvents'), 'editorialEvents')
  assert.equal(resolveReviewedPagePresentation(undefined, null), 'editorialIndex')
})

test('explicit compatible presentation overrides automatic placement', () => {
  assert.equal(resolveReviewedPagePresentation('carousel', 'churchOrganization'), 'carousel')
  assert.equal(resolveReviewedPagePresentation('carousel', 'recentEvents'), 'carousel')
  assert.equal(resolveReviewedPagePresentation('editorialIndex', 'churchOrganization'), 'editorialIndex')
  assert.equal(resolveReviewedPagePresentation('floatingLoop', 'recentEvents'), 'floatingLoop')
  assert.equal(resolveReviewedPagePresentation('eventStage', 'recentEvents'), 'eventStage')
  assert.equal(resolveReviewedPagePresentation('cinematicEvents', null), 'cinematicEvents')
  assert.equal(resolveReviewedPagePresentation('editorialEvents', null), 'editorialEvents')
})

test('unknown presentation values safely fall back to the legacy placement mapping', () => {
  assert.equal(resolveReviewedPagePresentation('future-layout', 'recentEvents'), 'editorialEvents')
  assert.equal(resolveReviewedPagePresentation({ mode: 'floatingLoop' }, null), 'editorialIndex')
})
