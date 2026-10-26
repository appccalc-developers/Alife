import { albumViewText } from '../i18n/albumView.ts'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ChevronUp, FolderPlus, Images, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppOverflowMenu from '../components/layout/AppOverflowMenu'
import AppPageShell from '../components/layout/AppPageShell'
import AppTitleBarAction from '../components/layout/AppTitleBarAction'
import AiLanguageAutofill from '../components/ai/AiLanguageAutofill'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { albumService, type AlbumDetail, type AlbumSummary, type AlbumVisibility } from '../services/albumService'
import { resolveFileAssetAccessUrl } from '../services/fileAssetService'
import AlbumPhotoImport from '../components/media/AlbumPhotoImport'
import { albumImportText } from '../i18n/albumImport'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { compactBilingualText, validateRequiredBilingualFields } from '../utils/bilingualValidation'
import useConfirmation from '../hooks/useConfirmation'
import { fetchGroupForViewer, groupQueryKey } from '../db/collections/groupCollection'

type AlbumEditorMode = 'create' | 'edit'

type AlbumFormDraft = {
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  visibility: AlbumVisibility
}

const emptyAlbumForm = (visibility: AlbumVisibility = 'groupVisible'): AlbumFormDraft => ({
  name: { en: '', zh: '' },
  description: { en: '', zh: '' },
  visibility,
})

const AlbumCard = ({ album, language, basePath }: { album: AlbumSummary; language: string; basePath: string }) => (
  <Link to={`${basePath}/${encodeURIComponent(album.id)}`} className="group overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="aspect-[4/3] overflow-hidden bg-[#e3f0eb]">
      {album.coverUrl ? <img src={resolveFileAssetAccessUrl(album.coverUrl) ?? album.coverUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : (
        <div className="flex h-full items-center justify-center text-[#176b5a]"><Images className="h-12 w-12" /></div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-black text-[#18332d]">{localizeText(album.name, language)}</h3>
      <p className="mt-1 text-xs text-[#66766f]">{language === 'zh' ? albumViewText.subalbumsPhotos.zh(album.childCount, album.photoCount) : albumViewText.subalbumsPhotos.en(album.childCount, album.photoCount)}</p>
    </div>
  </Link>
)

const AlbumView = () => {
  const { groupId: routeGroupId, albumId } = useParams<{ groupId?: string; albumId?: string }>()
  const { groupId } = useActiveEntityIds({ groupId: routeGroupId })
  const navigate = useNavigate()
  const churchSite = useLocation().pathname.startsWith('/church/')
  const auth = useAuthStore()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const isZh = auth.language === 'zh'
  const canManage = auth.canManageGroup(groupId)
  const [roots, setRoots] = useState<AlbumSummary[]>([])
  const [detail, setDetail] = useState<AlbumDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [photoImport, setPhotoImport] = useState<{ album: AlbumSummary; files?: File[]; actor: string } | null>(null)
  const [error, setError] = useState('')
  const [editorMode, setEditorMode] = useState<AlbumEditorMode | null>(null)
  const [albumForm, setAlbumForm] = useState<AlbumFormDraft>(() => emptyAlbumForm())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ownerGroupQuery = useQuery({
    queryKey: groupQueryKey(groupId),
    queryFn: () => fetchGroupForViewer(groupId, auth.me?.id),
    enabled: Boolean(groupId),
    staleTime: 5 * 60_000,
  })
  const albumBasePath = routeGroupId
    ? `${churchSite ? '/church' : ''}/groups/${encodeURIComponent(routeGroupId)}/albums`
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
      setError(cause instanceof Error ? cause.message : (isZh ? albumViewText.unableToLoadAlbums.zh : albumViewText.unableToLoadAlbums.en))
    } finally { setLoading(false) }
  }

  useEffect(() => { load().catch(() => undefined) }, [groupId, albumId])
  useEffect(() => { setPhotoImport(null) }, [albumId, auth.me?.id])

  const openCreate = () => {
    setAlbumForm(emptyAlbumForm(detail?.album.visibility ?? 'groupVisible'))
    setEditorMode('create')
  }

  const openEdit = () => {
    if (!detail) return
    setAlbumForm({
      name: { en: detail.album.name.en ?? '', zh: detail.album.name.zh ?? '' },
      description: { en: detail.album.description?.en ?? '', zh: detail.album.description?.zh ?? '' },
      visibility: detail.album.visibility,
    })
    setEditorMode('edit')
  }

  const saveAlbum = async () => {
    if (!albumForm.name.en.trim() && !albumForm.name.zh.trim()) return
    setBusy(true); setError('')
    try {
      const input = {
        name: compactBilingualText(albumForm.name),
        description: compactBilingualText(albumForm.description),
        visibility: albumForm.visibility,
      }
      if (editorMode === 'edit' && detail) {
        setDetail(await albumService.update(detail.album.id, input))
        setEditorMode(null)
      } else {
        const created = await albumService.create(groupId, {
          ...input,
          parentAlbumId: detail?.album.id ?? null,
        })
        setEditorMode(null)
        navigate(`${albumBasePath}/${encodeURIComponent(created.album.id)}`)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isZh ? albumViewText.unableToSaveAlbum.zh : albumViewText.unableToSaveAlbum.en)) }
    finally { setBusy(false) }
  }

  const uploadFiles = (files: FileList | null) => {
    if (!detail || !files?.length || !auth.me?.id) return
    setPhotoImport({ album: detail.album, files: Array.from(files), actor: auth.me.id })
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const removePhoto = async (photoId: string) => {
    if (!detail || !await requestConfirmation({
      title: isZh ? albumViewText.deletePhoto.zh : albumViewText.deletePhoto.en,
      description: isZh ? albumViewText.thisPhotoWillBeDeletedPermanentlyThisCannotBe.zh : albumViewText.thisPhotoWillBeDeletedPermanentlyThisCannotBe.en,
      confirmLabel: isZh ? albumViewText.deletePhotoLabel.zh : albumViewText.deletePhotoLabel.en,
      tone: 'danger',
    })) return
    setBusy(true)
    try {
      setDetail(await albumService.removePhoto(detail.album.id, photoId))

    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete image.') }
    finally { setBusy(false) }
  }

  const albums = detail?.children ?? roots
  const pageTitle = detail ? localizeText(detail.album.name, auth.language) : (isZh ? albumViewText.albums.zh : albumViewText.albums.en)
  const ownerGroupName = localizeText(ownerGroupQuery.data?.name, auth.language)
  const albumContext = churchSite ? (isZh ? albumViewText.churchLifeAlbums.zh : albumViewText.churchLifeAlbums.en) : ownerGroupName ? (
    <>
      <span className="desktop:hidden">{ownerGroupName} / {isZh ? albumViewText.albums.zh : albumViewText.albums.en}</span>
      <span className="hidden desktop:inline">{ownerGroupQuery.data?.isChurch ? (isZh ? albumViewText.churchLife.zh : albumViewText.churchLife.en) : (isZh ? albumViewText.groupLife.zh : albumViewText.groupLife.en)} / {ownerGroupName} / {isZh ? albumViewText.albums.zh : albumViewText.albums.en}</span>
    </>
  ) : (isZh ? albumViewText.groupContentAlbums.zh : albumViewText.groupContentAlbums.en)
  const missingAlbumTranslations = validateRequiredBilingualFields(
    { name: albumForm.name, description: albumForm.description },
    [
      { field: 'name', textType: 'albumName' },
      { field: 'description', textType: 'albumDescription' },
    ],
  ).missingTranslatableFields
  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  return (
    <AppPageShell
      title={pageTitle}
      context={albumContext}
      backLink={churchSite
        ? { to: '/church/albums', label: isZh ? albumViewText.backToChurchAlbums.zh : albumViewText.backToChurchAlbums.en }
        : albumId ? { to: albumBasePath, label: isZh ? albumViewText.backToAlbums.zh : albumViewText.backToAlbums.en } : undefined}
      subtitle={detail ? localizeText(detail.album.description, auth.language) : (isZh ? albumViewText.organizeGroupImagesWithAlbumsAndSubalbums.zh : albumViewText.organizeGroupImagesWithAlbumsAndSubalbums.en)}
      status={detail ? <AppBadge variant={detail.album.visibility === 'public' ? 'info' : 'neutral'}>{detail.album.visibility === 'public' ? (isZh ? albumViewText.public.zh : albumViewText.public.en) : (isZh ? albumViewText.groupVisible.zh : albumViewText.groupVisible.en)}</AppBadge> : undefined}
      controls={detail?.canManage && !editorMode ? <AppActionButton disabled={busy || Boolean(photoImport)} onClick={() => { if (auth.me?.id) setPhotoImport({ album: detail.album, actor: auth.me.id }) }}>{isZh ? albumImportText.drive.zh : albumImportText.drive.en}</AppActionButton> : undefined}
      primaryAction={canManage && !editorMode ? (
        detail ? (
          <AppTitleBarAction
            label={busy ? (isZh ? albumViewText.working.zh : albumViewText.working.en) : (isZh ? albumViewText.uploadImages.zh : albumViewText.uploadImages.en)}
            icon={<Upload className="h-4 w-4" />}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <AppTitleBarAction label={isZh ? albumViewText.newAlbum.zh : albumViewText.newAlbum.en} icon={<FolderPlus className="h-4 w-4" />} onClick={openCreate} />
        )
      ) : undefined}
      overflowLabel={isZh ? albumViewText.moreActions.zh : albumViewText.moreActions.en}
      overflowActions={detail && canManage && !editorMode ? [{
        label: isZh ? albumViewText.editAlbum.zh : albumViewText.editAlbum.en,
        icon: <Pencil className="h-4 w-4" />,
        onSelect: openEdit,
      }, {
        label: isZh ? albumViewText.newSubalbum.zh : albumViewText.newSubalbum.en,
        icon: <FolderPlus className="h-4 w-4" />,
        onSelect: openCreate,
      }] : []}
    >
      <input ref={fileInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => uploadFiles(event.target.files)} />
      {detail ? (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-[#66766f]" aria-label={isZh ? albumViewText.albumBreadcrumbs.zh : albumViewText.albumBreadcrumbs.en}>
          <Link className="rounded-lg px-2 py-1 hover:bg-[#e3f0eb]" to={albumBasePath}>{isZh ? albumViewText.albums.zh : albumViewText.albums.en}</Link>
          {detail.breadcrumbs.map(item => <span key={item.id} className="flex items-center gap-1"><ChevronRight className="h-4 w-4" /><Link className="rounded-lg px-2 py-1 hover:bg-[#e3f0eb]" to={`${albumBasePath}/${encodeURIComponent(item.id)}`}>{localizeText(item.name, auth.language)}</Link></span>)}
        </nav>
      ) : null}
      {editorMode ? (
        <section className="rounded-2xl border border-[#2f4b42]/10 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-black text-[#18332d]">
              {editorMode === 'edit'
                ? (isZh ? albumViewText.editAlbum.zh : albumViewText.editAlbum.en)
                : (isZh ? (detail ? albumViewText.albumView : albumViewText.albumView2) : (detail ? 'New subalbum' : 'New album'))}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold text-[#40554e]">English name<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={albumForm.name.en} onChange={event => setAlbumForm((current) => ({ ...current, name: { ...current.name, en: event.target.value } }))} /></label>
            <label className="text-sm font-bold text-[#40554e]">{albumViewText.label}<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={albumForm.name.zh} onChange={event => setAlbumForm((current) => ({ ...current, name: { ...current.name, zh: event.target.value } }))} /></label>
            <label className="text-sm font-bold text-[#40554e]">English description <span className="font-normal text-slate-400">(optional)</span><textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={albumForm.description.en} onChange={event => setAlbumForm((current) => ({ ...current, description: { ...current.description, en: event.target.value } }))} /></label>
            <label className="text-sm font-bold text-[#40554e]">{albumViewText.label2}<span className="font-normal text-slate-400">{albumViewText.label3}</span><textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={albumForm.description.zh} onChange={event => setAlbumForm((current) => ({ ...current, description: { ...current.description, zh: event.target.value } }))} /></label>
            <AiLanguageAutofill
              key={`${editorMode}-${detail?.album.id ?? 'root'}`}
              className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 md:col-span-2"
              groupId={groupId}
              fields={missingAlbumTranslations}
              disabled={busy}
              onTranslated={(translations) => {
                setAlbumForm((current) => {
                  const next = { ...current }
                  translations.forEach((translation) => {
                    if (translation.field !== 'name' && translation.field !== 'description') return
                    if (next[translation.field][translation.language].trim()) return
                    next[translation.field] = { ...next[translation.field], [translation.language]: translation.text }
                  })
                  return next
                })
              }}
            />
            <label className="text-sm font-bold text-[#40554e]">{isZh ? albumViewText.visibility.zh : albumViewText.visibility.en}<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" value={albumForm.visibility} onChange={event => setAlbumForm((current) => ({ ...current, visibility: event.target.value as AlbumVisibility }))}><option value="groupVisible">{isZh ? albumViewText.groupMembers.zh : albumViewText.groupMembers.en}</option><option value="public">{isZh ? albumViewText.public.zh : albumViewText.public.en}</option></select></label>
            <div className="flex items-end gap-2"><AppActionButton variant="primary" disabled={busy || (!albumForm.name.en.trim() && !albumForm.name.zh.trim())} onClick={saveAlbum}><Plus className="mr-2 h-4 w-4" />{editorMode === 'edit' ? (isZh ? albumViewText.saveChanges.zh : albumViewText.saveChanges.en) : (isZh ? albumViewText.create.zh : albumViewText.create.en)}</AppActionButton><AppActionButton onClick={() => setEditorMode(null)}>{isZh ? albumViewText.cancel.zh : albumViewText.cancel.en}</AppActionButton></div>
          </div>
        </section>
      ) : null}
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="rounded-xl bg-white p-5 text-sm text-[#66766f]">{isZh ? albumViewText.loading.zh : albumViewText.loading.en}</p> : null}
      {!loading && albums.length ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{albums.map(album => <AlbumCard key={album.id} album={album} language={auth.language} basePath={albumBasePath} />)}</section> : null}
      {!loading && !albums.length && !detail?.photos.length ? <AppEmptyState title={isZh ? albumViewText.nothingHereYet.zh : albumViewText.nothingHereYet.en} description={isZh ? albumViewText.createAnAlbumOrUploadTheFirstImage.zh : albumViewText.createAnAlbumOrUploadTheFirstImage.en} /> : null}
      {detail ? (
        <section className="space-y-4">
          {detail.photos.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{detail.photos.map((photo, index) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm">
              <img src={resolveFileAssetAccessUrl(photo.url) ?? photo.url} alt={localizeText(photo.caption, auth.language) || photo.originalFileName} className="aspect-square w-full object-cover" loading="lazy" />
              {detail.canManage ? (
                <figcaption className="flex items-center justify-between gap-2 p-2">
                  <span className="truncate px-1 text-xs text-[#66766f]">{photo.originalFileName}</span>
                  <AppOverflowMenu
                    label={isZh ? albumViewText.photoActions.zh : albumViewText.photoActions.en}
                    actions={[{
                      label: isZh ? albumViewText.moveEarlier.zh : albumViewText.moveEarlier.en,
                      icon: <ChevronUp className="h-4 w-4" />,
                      disabled: busy || index === 0,
                      onSelect: () => { void movePhoto(index, -1) },
                    }, {
                      label: isZh ? albumViewText.moveLater.zh : albumViewText.moveLater.en,
                      icon: <ChevronDown className="h-4 w-4" />,
                      disabled: busy || index === detail.photos.length - 1,
                      onSelect: () => { void movePhoto(index, 1) },
                    }, {
                      label: isZh ? albumViewText.deletePhotoLabel.zh : albumViewText.deletePhotoLabel.en,
                      icon: <Trash2 className="h-4 w-4" />,
                      tone: 'danger',
                      disabled: busy,
                      onSelect: () => { void removePhoto(photo.id) },
                    }]}
                  />
                </figcaption>
              ) : null}
            </figure>
          ))}</div> : null}
        </section>
      ) : null}
      {photoImport && photoImport.actor === auth.me?.id && photoImport.album.id === albumId ? <AlbumPhotoImport
        key={`${photoImport.album.id}:${photoImport.actor}`}
        album={photoImport.album} files={photoImport.files} language={auth.language}
        onClose={() => setPhotoImport(null)} onComplete={load} /> : null}
      {confirmationModal}
    </AppPageShell>
  )
}

export default AlbumView
