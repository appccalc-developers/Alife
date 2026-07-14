import { http } from './http'
import type { UploadedImage } from './imageWorkerApi'

export type FileAssetVisibility = 'public' | 'groupVisible' | 'memberPrivate'

export type FileAssetPurpose =
  | 'general'
  | 'pageMedia'
  | 'eventPoster'
  | 'eventGallery'
  | 'enrollmentPaymentProof'
  | 'reviewPhoto'
  | 'groupCover'
  | 'memberAvatar'
  | 'albumPhoto'

export type FileAsset = {
  id: string
  storageProvider: string
  bucketName: string
  objectKey: string
  publicUrl?: string | null
  accessUrl?: string | null
  originalFileName: string
  storedFileName: string
  contentType: string
  sizeBytes: number
  eTag?: string | null
  visibility: FileAssetVisibility
  purpose: FileAssetPurpose
  groupId?: string | null
  ownerMemberId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  uploadedUtc: string
  createdUtc: string
  updatedUtc: string
}

type RegisterUploadedImageContext = {
  visibility: FileAssetVisibility
  purpose: FileAssetPurpose
  groupId?: string | null
  ownerMemberId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
}

export type ListFileAssetsParams = {
  groupId?: string | null
  visibility?: FileAssetVisibility | null
  purpose?: FileAssetPurpose | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  unassignedOnly?: boolean | null
  page?: number | null
  pageSize?: number | null
  sortBy?: FileAssetSortBy | null
  sortDirection?: SortDirection | null
}

export type FileAssetSortBy = 'uploadedUtc' | 'createdUtc' | 'sizeBytes' | 'originalFileName' | 'purpose' | 'visibility'
export type SortDirection = 'desc' | 'asc'

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

const storedFileNameFromKey = (key: string) => key.split('/').filter(Boolean).at(-1) || key

const productionBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const fileStorageProvider = (import.meta.env.VITE_FILE_STORAGE_PROVIDER ?? 'local-dev').trim() || 'local-dev'

export const resolveFileAssetAccessUrl = (url?: string | null) => {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (import.meta.env.DEV || !productionBaseUrl || !url.startsWith('/api/')) return url
  return `${productionBaseUrl.replace(/\/$/, '')}${url}`
}

const toQueryString = (params: ListFileAssetsParams) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export const fileAssetService = {
  async list(params: ListFileAssetsParams): Promise<PagedResult<FileAsset>> {
    const { data } = await http.get<PagedResult<FileAsset>>(`/api/file-assets${toQueryString(params)}`)
    return data
  },

  async registerUploadedImage(
    file: File,
    image: UploadedImage,
    context: RegisterUploadedImageContext,
  ): Promise<FileAsset> {
    const { data } = await http.post<FileAsset>('/api/file-assets', {
      storageProvider: fileStorageProvider,
      bucketName: '',
      objectKey: image.key,
      publicUrl: context.visibility === 'memberPrivate' ? null : image.url,
      originalFileName: file.name,
      storedFileName: storedFileNameFromKey(image.key),
      contentType: file.type || image.contentType || 'application/octet-stream',
      sizeBytes: image.size || file.size,
      eTag: null,
      uploadedUtc: image.uploaded || new Date().toISOString(),
      visibility: context.visibility,
      purpose: context.purpose,
      groupId: context.groupId || null,
      ownerMemberId: context.ownerMemberId || null,
      relatedEntityType: context.relatedEntityType || null,
      relatedEntityId: context.relatedEntityId || null,
    })

    return data
  },
}
