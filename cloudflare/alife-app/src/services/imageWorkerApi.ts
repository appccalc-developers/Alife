/**
 * Aligns with the Cloudflare Worker image API:
 * - POST /api/images using multipart/form-data with the `file` field
 * - 201 response body: `{ image: { key, size, uploaded, contentType, url } }`
 */
const getDefaultImageApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'ccalc.live') {
    return `${window.location.origin}/images`
  }

  return 'https://images.ccalc.live'
}

const IMAGE_API_BASE_URL = (import.meta.env.VITE_IMAGE_API_BASE_URL ?? getDefaultImageApiBaseUrl()).trim().replace(/\/$/, '')

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

export type UploadedImage = {
  key: string
  size: number
  uploaded: string
  contentType: string
  url: string
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

  return image
}
