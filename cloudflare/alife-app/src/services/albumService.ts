import { http } from './http'
import { invalidateChurchLifeQueries } from './churchLifeService'

export type AlbumVisibility = 'public' | 'groupVisible'
export type AlbumSummary = {
  id: string
  groupId: string
  parentAlbumId?: string | null
  name: Record<string, string>
  description?: Record<string, string> | null
  visibility: AlbumVisibility
  sortOrder: number
  coverUrl?: string | null
  photoCount: number
  childCount: number
}
export type AlbumPhoto = {
  id: string
  fileAssetId: string
  caption?: Record<string, string> | null
  sortOrder: number
  url: string
  objectKey: string
  originalFileName: string
  width: number
  height: number
}
export type AlbumDetail = {
  album: AlbumSummary
  breadcrumbs: AlbumSummary[]
  children: AlbumSummary[]
  photos: AlbumPhoto[]
  canManage: boolean
}

export const albumService = {
  async list(groupId: string, includeAll = false) {
    const { data } = await http.get<AlbumSummary[]>(`/api/groups/${groupId}/albums${includeAll ? '?includeAll=true' : ''}`)
    return data
  },
  async get(albumId: string) {
    const { data } = await http.get<AlbumDetail>(`/api/albums/${albumId}`)
    return data
  },
  async create(groupId: string, input: { parentAlbumId?: string | null; name: Record<string, string>; description?: Record<string, string>; visibility: AlbumVisibility }) {
    const { data } = await http.post<AlbumDetail>(`/api/groups/${groupId}/albums`, input)
    await invalidateChurchLifeQueries()
    return data
  },
  async addPhoto(albumId: string, fileAssetId: string) {
    const { data } = await http.post<AlbumDetail>(`/api/albums/${albumId}/photos`, { fileAssetId, caption: null })
    await invalidateChurchLifeQueries()
    return data
  },
  async removePhoto(albumId: string, photoId: string) {
    const { data } = await http.delete<AlbumDetail>(`/api/albums/${albumId}/photos/${photoId}`)
    await invalidateChurchLifeQueries()
    return data
  },
  async reorderPhotos(albumId: string, photoIds: string[]) {
    const { data } = await http.put<AlbumDetail>(`/api/albums/${albumId}/photos/order`, { photoIds })
    await invalidateChurchLifeQueries()
    return data
  },
}
