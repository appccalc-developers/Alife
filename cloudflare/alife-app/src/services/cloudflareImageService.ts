import { uploadImage } from './imageWorkerApi'
import type { SectionEditModel } from '../types/page-editor'

const isLocalImageDataUrl = (value: string) => value.startsWith('data:image/')

const sectionsHaveLocalDataImages = (sections: SectionEditModel[]) =>
  sections.some((section) => JSON.stringify(section.contentJson).includes('data:image/'))

const guessExtension = (dataUrl: string) => {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  if (mime.includes('png')) {
    return 'png'
  }
  if (mime.includes('webp')) {
    return 'webp'
  }
  if (mime.includes('gif')) {
    return 'gif'
  }
  if (mime.includes('avif')) {
    return 'avif'
  }
  return 'jpg'
}

const mimeFromDataUrl = (dataUrl: string) => {
  const semi = dataUrl.indexOf(';')
  if (semi < 5) {
    return 'image/jpeg'
  }
  return dataUrl.slice(5, semi) || 'image/jpeg'
}

const uploadDataUrlToWorker = async (dataUrl: string, filenamePrefix: string, index: number) => {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const ext = guessExtension(dataUrl)
  const filename = `${filenamePrefix}-${index}.${ext}`
  const type = blob.type || mimeFromDataUrl(dataUrl)
  const file = new File([blob], filename, { type })

  // Single entry point: convert editor data URLs into Files, then upload via imageWorkerApi.uploadImage -> POST /api/images.
  const image = await uploadImage(file)
  return image.url
}

const replaceLocalImages = async (
  value: unknown,
  cache: Map<string, string>,
  filenamePrefix: string,
  counter: { value: number },
): Promise<unknown> => {
  if (typeof value === 'string') {
    if (!isLocalImageDataUrl(value)) {
      return value
    }

    const cached = cache.get(value)
    if (cached) {
      return cached
    }

    counter.value += 1
    const uploadedUrl = await uploadDataUrlToWorker(value, filenamePrefix, counter.value)
    cache.set(value, uploadedUrl)
    return uploadedUrl
  }

  if (Array.isArray(value)) {
    const nextItems: unknown[] = []
    for (const item of value) {
      nextItems.push(await replaceLocalImages(item, cache, filenamePrefix, counter))
    }
    return nextItems
  }

  if (value && typeof value === 'object') {
    const nextRecord: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      nextRecord[key] = await replaceLocalImages(item, cache, filenamePrefix, counter)
    }
    return nextRecord
  }

  return value
}

export const cloudflareImageService = {
  sectionsHaveLocalDataImages,

  /**
    * Upload every `data:image/...` found in section contentJson to the Worker and replace it with the returned URL.
    * The same data URL is uploaded only once and processed sequentially to avoid concurrent write races.
   */
  async resolveSectionImages(sections: SectionEditModel[], filenamePrefix = 'page-image') {
    const cache = new Map<string, string>()
    const counter = { value: 0 }

    const nextSections: SectionEditModel[] = []
    for (const section of sections) {
      const nextContent = (await replaceLocalImages(section.contentJson, cache, filenamePrefix, counter)) as Record<string, unknown>
      nextSections.push({
        ...section,
        contentJson: nextContent,
      })
    }

    return nextSections
  },
}
