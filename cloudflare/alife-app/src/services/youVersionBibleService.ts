import { ApiClient, BibleClient, type BibleVersion } from '@youversion/platform-core'
import { YouVersionConfigurationError } from '../utils/bibleRequestFailure'

const appKey = import.meta.env.VITE_YOUVERSION_APP_KEY?.trim()

const createBibleClient = () => {
  if (!appKey) throw new YouVersionConfigurationError()
  return new BibleClient(new ApiClient({ appKey }))
}

export const getAvailableBibleVersions = async (language: 'zh' | 'en'): Promise<BibleVersion[]> => {
  const versions = await createBibleClient().getVersions(`${language}*`, undefined, { page_size: 99 })
  return [...versions.data]
}

export const getYouVersionBibleClient = createBibleClient
