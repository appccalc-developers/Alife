import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FolderPlus, Images, Plus, Trash2, Upload } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { albumService, type AlbumDetail, type AlbumSummary, type AlbumVisibility } from '../services/albumService'
import { fileAssetService, resolveFileAssetAccessUrl } from '../services/fileAssetService'
import { deleteImageObject, isImageFile, uploadImage } from '../services/imageWorkerApi'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'

const AlbumCard = ({ album, language, basePath }: { album: AlbumSummary; language: string; basePath: string }) => (
  <Link to={`${basePath}/${encodeURIComponent(album.id)}`} className="group overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="aspect-[4/3] overflow-hidden bg-[#e3f0eb]">
      {album.coverUrl ? <img src={resolveFileAssetAccessUrl(album.coverUrl) ?? album.coverUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : (
        <div className="flex h-full items-center justify-center text-[#176b5a]"><Images className="h-12 w-12" /></div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-black text-[#18332d]">{localizeText(album.name, language)}</h3>
      <p className="mt-1 text-xs text-[#66766f]">{language === 'zh' ? `${album.childCount} 个子相册 · ${album.photoCount} 张图片` : `${album.childCount} subalbums · ${album.photoCount} photos`}</p>
    </div>
  </Link>
)

const AlbumView = () => {
  const { groupId: routeGroupId, albumId } = useParams<{ groupId?: string; albumId?: string }>()
  const { groupId } = useActiveEntityIds({ groupId: routeGroupId })
  const navigate = useNavigate()
  const auth = useAuthStore()
  const isZh = auth.language === 'zh'
  const canManage = auth.canManageGroup(groupId)
  const [roots, setRoots] = useState<AlbumSummary[]>([])
  const [detail, setDetail] = useState<AlbumDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [nameEn, setNameEn] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [visibility, setVisibility] = useState<AlbumVisibility>(detail?.album.visibility ?? 'groupVisible')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const albumBasePath = routeGroupId
    ? `/groups/${encodeURIComponent(routeGroupId)}/albums`
    : '/albums'

  const load = async () => {
    if (!groupId) return
    setLoading(true); setError('')
    try {
      if (albumId) {
        setDetail(await albumService.get(albumId))
      } else {
        setDetail(null); setRoots(await albumService.list(groupId))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isZh ? '无法加载相册。' : 'Unable to load albums.'))
    } finally { setLoading(false) }
  }

  useEffect(() => { load().catch(() => undefined) }, [groupId, albumId])
  useEffect(() => { setVisibility(detail?.album.visibility ?? 'groupVisible') }, [detail?.album.visibility])

  const createAlbum = async () => {
    if (!nameEn.trim() && !nameZh.trim()) return
    setBusy(true); setError('')
    try {
      const created = await albumService.create(groupId, {
        parentAlbumId: detail?.album.id ?? null,
        name: { en: nameEn.trim(), zh: nameZh.trim() },
        visibility,
      })
      setShowCreate(false); setNameEn(''); setNameZh('')
      navigate(`${albumBasePath}/${encodeURIComponent(created.album.id)}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create album.') }
    finally { setBusy(false) }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!detail || !files?.length) return
    const images = Array.from(files).filter(isImageFile)
    if (!images.length) { setError(isZh ? '请选择支持的图片文件。' : 'Choose supported image files.'); return }
    setBusy(true); setError('')
    try {
      let next = detail
      for (const file of images) {
        const uploaded = await uploadImage(file, `groups/${groupId}/albums/${detail.album.id}`)
        const asset = await fileAssetService.registerUploadedImage(file, uploaded, {
          visibility: detail.album.visibility === 'public' ? 'public' : 'groupVisible',
          purpose: 'albumPhoto', groupId, relatedEntityType: 'album', relatedEntityId: detail.album.id,
        })
        next = await albumService.addPhoto(detail.album.id, asset.id)
      }
      setDetail(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to upload images.') }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const movePhoto = async (index: number, direction: -1 | 1) => {
    if (!detail) return
    const target = index + direction
    if (target < 0 || target >= detail.photos.length) return
    const photos = [...detail.photos]; [photos[index], photos[target]] = [photos[target], photos[index]]
    setBusy(true)
    try { setDetail(await albumService.reorderPhotos(detail.album.id, photos.map(photo => photo.id))) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reorder photos.') }
    finally { setBusy(false) }
  }

  const removePhoto = async (photoId: string, objectKey: string) => {
    if (!detail || !window.confirm(isZh ? '确定删除这张图片吗？此操作无法撤销。' : 'Delete this image permanently?')) return
    setBusy(true)
    try {
      setDetail(await albumService.removePhoto(detail.album.id, photoId))
      deleteImageObject(objectKey).catch(() => undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete image.') }
    finally { setBusy(false) }
  }

  const albums = detail?.children ?? roots
  const pageTitle = detail ? localizeText(detail.album.name, auth.language) : (isZh ? '相册' : 'Albums')
  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  return (
    <AppPageShell
      title={pageTitle}
      subtitle={detail ? localizeText(detail.album.description, auth.language) : (isZh ? '用相册和子相册整理小组图片。' : 'Organize group images with albums and subalbums.')}
      actions={canManage ? <AppActionButton variant="primary" onClick={() => setShowCreate(value => !value)}><FolderPlus className="mr-2 h-4 w-4" />{isZh ? (detail ? '新建子相册' : '新建相册') : (detail ? 'New subalbum' : 'New album')}</AppActionButton> : undefined}
    >
      {detail ? (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-[#66766f]" aria-label={isZh ? '相册路径' : 'Album breadcrumbs'}>
          <Link className="rounded-lg px-2 py-1 hover:bg-[#e3f0eb]" to={albumBasePath}>{isZh ? '相册' : 'Albums'}</Link>
          {detail.breadcrumbs.map(item => <span key={item.id} className="flex items-center gap-1"><ChevronRight className="h-4 w-4" /><Link className="rounded-lg px-2 py-1 hover:bg-[#e3f0eb]" to={`${albumBasePath}/${encodeURIComponent(item.id)}`}>{localizeText(item.name, auth.language)}</Link></span>)}
        </nav>
      ) : null}
      {showCreate ? (
        <section className="grid gap-3 rounded-2xl border border-[#2f4b42]/10 bg-white p-4 md:grid-cols-2">
          <label className="text-sm font-bold text-[#40554e]">English name<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={nameEn} onChange={event => setNameEn(event.target.value)} /></label>
          <label className="text-sm font-bold text-[#40554e]">中文名称<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={nameZh} onChange={event => setNameZh(event.target.value)} /></label>
          <label className="text-sm font-bold text-[#40554e]">{isZh ? '可见范围' : 'Visibility'}<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={visibility} onChange={event => setVisibility(event.target.value as AlbumVisibility)}><option value="groupVisible">{isZh ? '小组成员' : 'Group members'}</option><option value="public">{isZh ? '公开' : 'Public'}</option></select></label>
          <div className="flex items-end gap-2"><AppActionButton variant="primary" disabled={busy || (!nameEn.trim() && !nameZh.trim())} onClick={createAlbum}><Plus className="mr-2 h-4 w-4" />{isZh ? '创建' : 'Create'}</AppActionButton><AppActionButton onClick={() => setShowCreate(false)}>{isZh ? '取消' : 'Cancel'}</AppActionButton></div>
        </section>
      ) : null}
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="rounded-xl bg-white p-5 text-sm text-[#66766f]">{isZh ? '正在加载…' : 'Loading…'}</p> : null}
      {!loading && albums.length ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.map(album => <AlbumCard key={album.id} album={album} language={auth.language} basePath={albumBasePath} />)}</section> : null}
      {!loading && !albums.length && !detail?.photos.length ? <AppEmptyState title={isZh ? '这里还是空的' : 'Nothing here yet'} description={isZh ? '创建相册或上传第一张图片。' : 'Create an album or upload the first image.'} /> : null}
      {detail ? (
        <section className="space-y-4">
          {detail.canManage ? <div className="flex justify-end"><input ref={fileInputRef} className="hidden" type="file" accept="image/*" multiple onChange={event => uploadFiles(event.target.files)} /><AppActionButton variant="primary" disabled={busy} onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{busy ? (isZh ? '处理中…' : 'Working…') : (isZh ? '上传图片' : 'Upload images')}</AppActionButton></div> : null}
          {detail.photos.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{detail.photos.map((photo, index) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm">
              <img src={resolveFileAssetAccessUrl(photo.url) ?? photo.url} alt={localizeText(photo.caption, auth.language) || photo.originalFileName} className="aspect-square w-full object-cover" loading="lazy" />
              {detail.canManage ? <figcaption className="flex items-center justify-between gap-2 p-2"><span className="truncate px-1 text-xs text-[#66766f]">{photo.originalFileName}</span><span className="flex gap-1"><button disabled={busy || index === 0} onClick={() => movePhoto(index, -1)} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30" aria-label={isZh ? '前移' : 'Move earlier'}><ChevronLeft className="h-4 w-4 sm:hidden" /><ChevronUp className="hidden h-4 w-4 sm:block" /></button><button disabled={busy || index === detail.photos.length - 1} onClick={() => movePhoto(index, 1)} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30" aria-label={isZh ? '后移' : 'Move later'}><ChevronRight className="h-4 w-4 sm:hidden" /><ChevronDown className="hidden h-4 w-4 sm:block" /></button><button disabled={busy} onClick={() => removePhoto(photo.id, photo.objectKey)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={isZh ? '删除' : 'Delete'}><Trash2 className="h-4 w-4" /></button></span></figcaption> : null}
            </figure>
          ))}</div> : null}
        </section>
      ) : null}
    </AppPageShell>
  )
}

export default AlbumView
