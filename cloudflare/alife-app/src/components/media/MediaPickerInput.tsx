import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Folder, FolderOpen, Image as ImageIcon, RefreshCw, Upload, Video, X } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import {
  imageKeyToAppPath,
  imageUrlToAppPath,
  isImageFile,
  isMediaFile,
  listMediaFolder,
  uploadMedia,
  uploadedImageToAppPath,
  type ListedMedia,
  type MediaFolderListing,
} from '../../services/imageWorkerApi'

type MediaAccept = 'image' | 'video' | 'media'
type MediaScope = 'group' | 'public'

type Props = {
  label: string
  value: string
  disabled?: boolean
  focusKey?: string
  groupId?: string
  accept?: MediaAccept
  trigger?: ReactNode
  pickerOnly?: boolean
  onOpen?: () => void
  onChange: (value: string) => void
}

export type MediaPickerInputHandle = {
  open: () => void
}

const emptyListing: MediaFolderListing = {
  path: '/',
  folders: [],
  media: [],
  images: [],
}

const normalizeFolderPath = (path: string) => path.replace(/^\/+|\/+$/g, '')

const parentFolderPath = (path: string, root: string) => {
  const normalized = normalizeFolderPath(path)
  const normalizedRoot = normalizeFolderPath(root)
  if (!normalized || normalized === normalizedRoot) {
    return normalizedRoot
  }

  const parts = normalized.split('/').filter(Boolean)
  parts.pop()
  const next = parts.join('/')
  return next.startsWith(normalizedRoot) ? next : normalizedRoot
}

const folderLabel = (path: string, root: string) => {
  const normalized = normalizeFolderPath(path)
  const normalizedRoot = normalizeFolderPath(root)
  if (normalized === normalizedRoot) {
    return '/'
  }

  return normalized.slice(normalizedRoot.length).replace(/^\/+/, '') || '/'
}

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 KB'
  }

  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`
}

const formatDate = (value: string) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString()
}

const mediaUrlToAppPath = (item: ListedMedia) => {
  const path = item.url ? imageUrlToAppPath(item.url) : ''
  return path || imageKeyToAppPath(item.key)
}

const MediaPickerInput = forwardRef<MediaPickerInputHandle, Props>(({
  label: inputLabel,
  value,
  disabled,
  focusKey,
  groupId,
  accept = 'media',
  trigger,
  pickerOnly,
  onOpen,
  onChange,
}, ref) => {
  const { language } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<MediaScope>(groupId ? 'group' : 'public')
  const [folderPath, setFolderPath] = useState(groupId ? `groups/${groupId}` : 'global')
  const [listing, setListing] = useState<MediaFolderListing>(emptyListing)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const isZh = language === 'zh'
  const copy = useMemo(() => ({
    browse: isZh ? '选择' : 'Choose',
    close: isZh ? '关闭' : 'Close',
    public: isZh ? '公共' : 'Public',
    group: isZh ? '本小组' : 'Group',
    currentFolder: isZh ? '当前文件夹' : 'Current folder',
    parent: isZh ? '上一级' : 'Parent',
    refresh: isZh ? '刷新' : 'Refresh',
    upload: uploading ? (isZh ? '上传中...' : 'Uploading...') : (isZh ? '上传' : 'Upload'),
    empty: isZh ? '此文件夹没有可选媒体。' : 'No selectable media in this folder.',
    folders: isZh ? '文件夹' : 'Folders',
    media: isZh ? '媒体' : 'Media',
    select: isZh ? '使用' : 'Use',
    imageOnly: isZh ? '请选择图片文件。' : 'Please choose an image file.',
    mediaOnly: isZh ? '请选择图片或视频文件。' : 'Please choose an image or video file.',
    loadFailed: isZh ? '无法加载媒体文件夹。' : 'Unable to load media folder.',
    uploadFailed: isZh ? '上传失败。' : 'Upload failed.',
  }), [isZh, uploading])
  const publicRoot = 'global'
  const groupRoot = groupId ? `groups/${groupId}` : ''
  const rootPath = scope === 'group' && groupRoot ? groupRoot : publicRoot
  const canUseGroupScope = Boolean(groupRoot)
  const allowedMedia = listing.media.filter((item) => accept === 'media' || item.kind === accept)
  const fileAccept = accept === 'image' ? 'image/*' : accept === 'video' ? 'video/*' : 'image/*,video/*'
  const canGoParent = normalizeFolderPath(folderPath) !== normalizeFolderPath(rootPath)

  useEffect(() => {
    if (!groupId && scope === 'group') {
      setScope('public')
      setFolderPath(publicRoot)
      return
    }

    const normalizedFolder = normalizeFolderPath(folderPath)
    const isInsideGroupRoot = normalizedFolder === groupRoot || normalizedFolder.startsWith(`${groupRoot}/`)
    if (groupRoot && scope === 'group' && !isInsideGroupRoot) {
      setFolderPath(groupRoot)
    }
  }, [folderPath, groupId, groupRoot, scope])

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true
    setLoading(true)
    setError('')

    listMediaFolder(folderPath)
      .then((result) => {
        if (active) {
          setListing(result)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setListing(emptyListing)
          setError(err instanceof Error && err.message ? err.message : copy.loadFailed)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [copy.loadFailed, folderPath, open, refreshToken])

  const openPicker = () => {
    onOpen?.()
    const nextScope: MediaScope = groupRoot ? 'group' : 'public'
    setScope(nextScope)
    setFolderPath(nextScope === 'group' && groupRoot ? groupRoot : publicRoot)
    setOpen(true)
  }

  useImperativeHandle(ref, () => ({ open: openPicker }))

  const switchScope = (nextScope: MediaScope) => {
    setScope(nextScope)
    setFolderPath(nextScope === 'group' && groupRoot ? groupRoot : publicRoot)
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    if (accept === 'image' && !isImageFile(file)) {
      setError(copy.imageOnly)
      return
    }

    if (accept !== 'image' && !isMediaFile(file)) {
      setError(copy.mediaOnly)
      return
    }

    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadMedia(file, folderPath || rootPath)
      onChange(uploadedImageToAppPath(uploaded))
      setRefreshToken((token) => token + 1)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  const selectMedia = (item: ListedMedia) => {
    onChange(mediaUrlToAppPath(item))
    setOpen(false)
  }

  return (
    <div className={pickerOnly ? 'contents' : trigger ? 'shrink-0' : 'block space-y-1 md:col-span-2'} data-field-key={focusKey}>
      {pickerOnly ? null : trigger ? (
        <button
          type="button"
          disabled={disabled}
          className="block overflow-hidden rounded-xl text-left transition focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={inputLabel}
          onClick={openPicker}
        >
          {trigger}
        </button>
      ) : (
        <>
          <span className="text-xs font-medium text-slate-600">{inputLabel}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={value}
              disabled={disabled}
              className="h-9 min-w-0 flex-1 rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
              onChange={(event) => onChange(event.target.value)}
            />
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={openPicker}
            >
              <FolderOpen className="h-4 w-4" />
              {copy.browse}
            </button>
          </div>
        </>
      )}

      {open ? (
        <div className={`fixed inset-0 flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4 ${pickerOnly ? 'z-[1400]' : 'z-[85]'}`}>
          <button type="button" className="absolute inset-0" aria-label={copy.close} onClick={() => setOpen(false)} />
          <section className="relative z-10 flex h-[86vh] max-h-[86vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl sm:h-[min(78vh,720px)] sm:max-h-[78vh]">
            <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-950">{inputLabel}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {copy.currentFolder}: {scope === 'group' ? copy.group : copy.public}/{folderLabel(folderPath, rootPath)}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-semibold ${scope === 'public' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => switchScope('public')}
                >
                  {copy.public}
                </button>
                {canUseGroupScope ? (
                  <button
                    type="button"
                    className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-semibold ${scope === 'group' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => switchScope('group')}
                  >
                    {copy.group}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canGoParent}
                  className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setFolderPath(parentFolderPath(folderPath, rootPath))}
                >
                  <Folder className="h-4 w-4" />
                  {copy.parent}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setRefreshToken((token) => token + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                  {copy.refresh}
                </button>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded bg-[#176b5a] px-3 text-sm font-semibold text-white transition hover:bg-[#125648]">
                  <Upload className="h-4 w-4" />
                  {copy.upload}
                  <input type="file" accept={fileAccept} className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
              </div>
              {error ? <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {loading ? (
                <div className="grid min-h-48 place-items-center text-sm text-slate-500">{isZh ? '正在加载...' : 'Loading...'}</div>
              ) : (
                <div className="space-y-5">
                  {listing.folders.length > 0 ? (
                    <section>
                      <h3 className="mb-2 text-xs font-black uppercase text-slate-500">{copy.folders}</h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {listing.folders.map((folder) => (
                          <button
                            key={folder.path}
                            type="button"
                            className="flex min-h-12 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                            onClick={() => setFolderPath(normalizeFolderPath(folder.path))}
                          >
                            <Folder className="h-4 w-4 shrink-0 text-[#176b5a]" />
                            <span className="min-w-0 truncate">{folder.name || folder.path}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section>
                    <h3 className="mb-2 text-xs font-black uppercase text-slate-500">{copy.media}</h3>
                    {allowedMedia.length === 0 ? (
                      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{copy.empty}</div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {allowedMedia.map((item) => (
                          <article key={item.key} className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
                            <button
                              type="button"
                              className="relative block aspect-video w-full overflow-hidden bg-slate-100 text-left transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-emerald-200"
                              aria-label={`${copy.select}: ${item.name}`}
                              onClick={() => selectMedia(item)}
                            >
                              {item.kind === 'video' ? (
                                <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                              ) : (
                                <img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                              )}
                              <span className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm">
                                {item.kind === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                              </span>
                            </button>
                            <div className="p-3">
                              <p className="truncate text-sm font-bold text-slate-900" title={item.name}>{item.name}</p>
                              <p className="truncate text-xs text-slate-500">{formatBytes(item.size)} {formatDate(item.uploaded) ? `/ ${formatDate(item.uploaded)}` : ''}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
})

MediaPickerInput.displayName = 'MediaPickerInput'

export default MediaPickerInput
