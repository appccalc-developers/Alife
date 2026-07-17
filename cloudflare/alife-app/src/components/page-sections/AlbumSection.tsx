import { useEffect, useState } from 'react'
import { Images } from 'lucide-react'
import { albumService, type AlbumDetail, type AlbumSummary } from '../../services/albumService'
import { resolveFileAssetAccessUrl } from '../../services/fileAssetService'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import type { SectionComponentProps } from './types'
import { pageSectionShellClass } from './sectionPresets'

const AlbumSection = ({ section, contextGroupId, page, mode, propertiesOnly, disabled, onUpdate, domId, allowGroupDataSources = true }: SectionComponentProps) => {
  const auth = useAuthStore()
  const groupId = contextGroupId || page?.ownerGroupId || ''
  const albumId = typeof section.contentJson.albumId === 'string' ? section.contentJson.albumId : ''
  // Public page rendering may request the configured album because the API
  // independently filters anonymous access to public albums and assets.
  const canLoadAlbum = allowGroupDataSources || page?.visibility === 'public'
  const [albums, setAlbums] = useState<AlbumSummary[]>([])
  const [detail, setDetail] = useState<AlbumDetail | null>(null)
  const [error, setError] = useState('')
  const isZh = auth.language === 'zh'

  useEffect(() => {
    if (!canLoadAlbum || mode !== 'edit' || !groupId) return
    albumService.list(groupId, true).then(setAlbums).catch(() => setAlbums([]))
  }, [canLoadAlbum, groupId, mode])
  useEffect(() => {
    setError('')
    if (!canLoadAlbum) { setDetail(null); return }
    if (!albumId) { setDetail(null); return }
    albumService.get(albumId).then(setDetail).catch(() => { setDetail(null); setError(isZh ? '此相册不可用或你没有查看权限。' : 'This album is unavailable or you do not have access.') })
  }, [albumId, canLoadAlbum, isZh])

  if (propertiesOnly) {
    return (
      <label className="block text-sm font-bold text-slate-800">
        {isZh ? '引用相册' : 'Referenced album'}
        <select
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"
          value={albumId}
          disabled={disabled}
          onChange={event => onUpdate?.({ ...section, contentJson: { ...section.contentJson, albumId: event.target.value } })}
        >
          <option value="">{isZh ? '请选择相册' : 'Choose an album'}</option>
          {albums.map(album => <option key={album.id} value={album.id}>{album.parentAlbumId ? '— ' : ''}{localizeText(album.name, auth.language)} · {album.photoCount}</option>)}
        </select>
        <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">{isZh ? '公开页面只能向访客展示公开相册；成员相册仍会要求登录和小组权限。' : 'Public pages can show public albums to guests; member albums still require sign-in and group access.'}</span>
      </label>
    )
  }

  return (
    <section id={domId} className={pageSectionShellClass}>
      <div className="mx-auto max-w-6xl">
        {detail ? (
          <>
            <header className="mb-5 text-center"><h2 className="text-2xl font-black text-[#18332d]">{localizeText(detail.album.name, auth.language)}</h2>{detail.album.description ? <p className="mt-2 text-sm text-[#66766f]">{localizeText(detail.album.description, auth.language)}</p> : null}</header>
            {detail.photos.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{detail.photos.map(photo => <img key={photo.id} src={resolveFileAssetAccessUrl(photo.url) ?? photo.url} alt={localizeText(photo.caption, auth.language) || photo.originalFileName} className="aspect-square w-full rounded-2xl object-cover shadow-sm" loading="lazy" />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{isZh ? '相册中还没有图片。' : 'This album has no photos yet.'}</p>}
          </>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500"><Images className="mb-3 h-9 w-9 text-[#176b5a]" /><p>{error || (isZh ? '请在区块属性中选择一个相册。' : 'Choose an album in section properties.')}</p></div>
        )}
      </div>
    </section>
  )
}

export default AlbumSection
