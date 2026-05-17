/**
 * 与 Cloudflare Worker 图床 API 对齐：
 * - POST /api/images — multipart/form-data，字段名 `file`
 * - 响应 201：`{ image: { key, size, uploaded, contentType, url } }`
 */
const IMAGE_API_BASE_URL = (import.meta.env.VITE_IMAGE_API_BASE_URL ?? 'https://images.ccalc.live').trim().replace(/\/$/, '')

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

/** 与 Worker `isImageObject` 一致，用于上传前校验 */
export function isImageFile(file: File): boolean {
  const ext = getKeyExtension(file.name)
  const candidateType = file.type || TYPE_BY_EXTENSION[ext] || ''
  return isImageObject(file.name, candidateType)
}

function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${IMAGE_API_BASE_URL}${p}`
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

/**
 * 上传单张图片，返回完整元数据（与 Worker `uploadImage` 响应体一致）。
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  if (!(file instanceof File)) {
    throw new Error('Missing file.')
  }
  if (!isImageFile(file)) {
    throw new Error('Only image files can be uploaded.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(apiUrl('/api/images'), {
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
