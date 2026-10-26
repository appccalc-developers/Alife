import type { BibleVersion } from '@youversion/platform-core'

export const bibleVersionAttribution = (
  version: Pick<BibleVersion, 'copyright' | 'promotional_content'>,
): string | null => {
  for (const value of [version.copyright, version.promotional_content]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}
