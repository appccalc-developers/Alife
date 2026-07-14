/**
 * Aligns with the Cloudflare Worker image API:
 * - POST /api/images using multipart/form-data with the `file` field
 * - 201 response body: `{ image: { key, size, uploaded, contentType, url } }`
 */
const getDefaultImageApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'ccalc.live') {
    return `${window.location.origin}/images`
  }

  return 'https://ccalc.live/images'
}

const IMAGE_API_BASE_URL = (import.meta.env.VITE_IMAGE_API_BASE_URL ?? getDefaultImageApiBaseUrl()).trim().replace(/\/$/, '')

const LEGACY_IMAGE_HOST = 'images.ccalc.live'
const APP_IMAGE_BASE_URL = 'https://ccalc.live/images'

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'bmp',
  'svg',
  'tif',
  'tiff',
  'ico',
])

const TYPE_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogg', 'ogv'])

const VIDEO_TYPE_BY_EXTENSION: Record<string, string> = {
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  webm: 'video/webm',
}

export type UploadedImage = {
  type?: 'image' | 'video'
  kind?: 'image' | 'video'
  key: string
  name?: string
  folder?: string
  size: number
  uploaded: string
  contentType: string
  url: string
}

export type UploadedMedia = UploadedImage & {
  kind: 'image' | 'video'
}

export type MediaFolder = {
  type: 'folder'
  path: string
  name: string
}

export type ListedMedia = UploadedMedia & {
  type: 'image' | 'video'
  name: string
  etag?: string
}

export type MediaFolderListing = {
  path: string
  folders: MediaFolder[]
  media: ListedMedia[]
  images: ListedMedia[]
}

export function normalizeImageUrl(value: string): string {
  if (!value) {
    return value
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && url.hostname === LEGACY_IMAGE_HOST) {
      return `${APP_IMAGE_BASE_URL}${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return value
  }

  return value
}

export function imageKeyToAppPath(key: string): string {
  const normalizedKey = key
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')

  return normalizedKey ? `/images/${normalizedKey}` : '/images'
}

export function imageUrlToAppPath(value: string): string {
  if (!value) {
    return value
  }

  try {
    const url = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'https://ccalc.live')
    if (url.hostname === LEGACY_IMAGE_HOST) {
      return `/images${url.pathname}${url.search}${url.hash}`
    }
    if (url.hostname === 'ccalc.live' && url.pathname.startsWith('/images/')) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return value
  }

  return value
}

export function uploadedImageToAppPath(image: UploadedImage): string {
  return image.key ? imageKeyToAppPath(image.key) : imageUrlToAppPath(normalizeImageUrl(image.url))
}

export function getKeyExtension(fileName: string): string {
  const tokens = fileName.toLowerCase().split('.')
  return tokens.length > 1 ? (tokens.at(-1) ?? '') : ''
}

export function isImageObject(objectKey: string, contentType: string): boolean {
  if (typeof contentType === 'string' && contentType.toLowerCase().startsWith('image/')) {
    return true
  }
  return IMAGE_EXTENSIONS.has(getKeyExtension(objectKey))
}

/** Mirrors Worker `isImageObject` so uploads can be validated before submission. */
export function isImageFile(file: File): boolean {
  const ext = getKeyExtension(file.name)
  const candidateType = file.type || TYPE_BY_EXTENSION[ext] || ''
  return isImageObject(file.name, candidateType)
}

export function isVideoFile(file: File): boolean {
  const ext = getKeyExtension(file.name)
  const candidateType = file.type || VIDEO_TYPE_BY_EXTENSION[ext] || ''
  return candidateType.toLowerCase().startsWith('video/') || VIDEO_EXTENSIONS.has(ext)
}

export function isMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file)
}

export function mediaKindFromMetadata(objectKey: string, contentType: string): UploadedMedia['kind'] {
  return isVideoObject(objectKey, contentType) ? 'video' : 'image'
}

function isVideoObject(objectKey: string, contentType: string): boolean {
  if (typeof contentType === 'string' && contentType.toLowerCase().startsWith('video/')) {
    return true
  }
  return VIDEO_EXTENSIONS.has(getKeyExtension(objectKey))
}

function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${IMAGE_API_BASE_URL}${p}`
}

function pathSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

const normalizeListedMedia = (item: Partial<ListedMedia>): ListedMedia => {
  const key = item.key || ''
  const contentType = item.contentType || ''
  const kind = item.kind === 'video' || item.type === 'video'
    ? 'video'
    : mediaKindFromMetadata(key, contentType)

  return {
    type: kind,
    kind,
    key,
    name: item.name || storedFileNameFromKey(key),
    size: typeof item.size === 'number' ? item.size : 0,
    uploaded: item.uploaded || '',
    etag: item.etag,
    contentType,
    url: normalizeImageUrl(item.url || imageKeyToAppPath(key)),
  }
}

const storedFileNameFromKey = (key: string) => key.split('/').filter(Boolean).at(-1) || key

export async function listMediaFolder(folderPath = ''): Promise<MediaFolderListing> {
  const normalizedFolderPath = pathSegments(folderPath)
  const endpoint = normalizedFolderPath ? `/api/images/list/${normalizedFolderPath}` : '/api/images/list'
  const response = await fetch(apiUrl(endpoint))
  const data = await readJson<{
    error?: string
    path?: string
    folders?: MediaFolder[]
    media?: Array<Partial<ListedMedia>>
    images?: Array<Partial<ListedMedia>>
  }>(response)

  if (!response.ok) {
    throw new Error(data.error || `Media list failed (${response.status})`)
  }

  const mediaItems = Array.isArray(data.media) ? data.media : Array.isArray(data.images) ? data.images : []

  return {
    path: data.path || (normalizedFolderPath || '/'),
    folders: Array.isArray(data.folders) ? data.folders : [],
    media: mediaItems.map(normalizeListedMedia),
    images: mediaItems.map(normalizeListedMedia),
  }
}

/**
 * Upload a single image and return the complete metadata payload from the Worker.
 */
export async function uploadImage(file: File, folderPath = ''): Promise<UploadedImage> {
  if (!(file instanceof File)) {
    throw new Error('Missing file.')
  }
  if (!isImageFile(file)) {
    throw new Error('Only image files can be uploaded.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const normalizedFolderPath = pathSegments(folderPath)
  const endpoint = normalizedFolderPath ? `/api/images/${normalizedFolderPath}` : '/api/images'

  const response = await fetch(apiUrl(endpoint), {
    method: 'POST',
    body: formData,
  })

  const data = await readJson<{ error?: string; image?: UploadedImage }>(response)

  if (!response.ok) {
    throw new Error(data.error || `Upload failed (${response.status})`)
  }

  const image = data.image
  if (!image?.url) {
    throw new Error('Invalid upload response: missing image.url')
  }

  return {
    ...image,
    url: normalizeImageUrl(image.url),
  }
}

export async function uploadMedia(file: File, folderPath = ''): Promise<UploadedMedia> {
  if (!(file instanceof File)) {
    throw new Error('Missing file.')
  }
  if (!isMediaFile(file)) {
    throw new Error('Only image and video files can be uploaded.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const normalizedFolderPath = pathSegments(folderPath)
  const endpoint = normalizedFolderPath ? `/api/images/${normalizedFolderPath}` : '/api/images'

  const response = await fetch(apiUrl(endpoint), {
    method: 'POST',
    body: formData,
  })

  const data = await readJson<{ error?: string; media?: UploadedImage; image?: UploadedImage }>(response)

  if (!response.ok) {
    throw new Error(data.error || `Upload failed (${response.status})`)
  }

  const image = data.media || data.image
  if (!image?.url) {
    throw new Error('Invalid upload response: missing media.url')
  }

  return {
    ...image,
    kind: image.kind === 'video' || isVideoFile(file) ? 'video' : 'image',
    contentType: file.type || image.contentType || (isVideoFile(file) ? 'video/mp4' : 'image/jpeg'),
    url: normalizeImageUrl(image.url),
  }
}

export async function uploadForumMedia(file: File, folderPath = ''): Promise<UploadedMedia> {
  return uploadMedia(file, folderPath)
}

export async function deleteImageObject(objectKey: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/images/${pathSegments(objectKey)}`), { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    const data = await readJson<{ error?: string }>(response)
    throw new Error(data.error || 'Unable to delete the stored image.')
  }
}
