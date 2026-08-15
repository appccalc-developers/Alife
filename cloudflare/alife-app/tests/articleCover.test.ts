import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { generatedArticleCoverUrl } from '../src/views/articles/articleCover.ts'
import { generatedArticleCoverSlugs } from '../src/views/articles/articleCoverManifest.ts'

test('generated article covers use the public slug-based WebP path', () => {
  assert.equal(
    generatedArticleCoverUrl('  Warm-Reward  '),
    '/article-covers/generated/warm-reward.webp',
  )
})

test('posts without generated files keep the existing placeholder behavior', () => {
  assert.equal(generatedArticleCoverUrl('post-without-a-generated-cover'), null)
})

test('the cover manifest exactly matches the generated public WebP files', async () => {
  const directory = path.resolve('public/article-covers/generated')
  const filenames = await readdir(directory)
  const fileSlugs = filenames
    .filter((filename) => filename.endsWith('.webp'))
    .map((filename) => filename.slice(0, -'.webp'.length))
    .sort()

  assert.deepEqual([...generatedArticleCoverSlugs].sort(), fileSlugs)
})
