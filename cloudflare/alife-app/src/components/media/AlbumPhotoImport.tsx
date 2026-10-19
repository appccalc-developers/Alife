import { useEffect, useRef, useState } from 'react'
import AppModal from '../layout/AppModal'
import AppActionButton from '../layout/AppActionButton'
import { albumImportText as text } from '../../i18n/albumImport'
import { albumService, type AlbumSummary } from '../../services/albumService'
import { AlbumImportError, MAX_BATCH_BYTES, MAX_PHOTOS, validateDecodedPhoto, type ImportFailure } from '../../services/albumImportPolicy'
import { downloadDrivePhoto, isGoogleDriveConfigured, loadGoogleDrive, selectDrivePhotos } from '../../services/googleDrivePhotoService'
import { localizeText } from '../../utils/localizedText'

type Item = { id: string; digest: string; file: File; preview: string; status: 'pending' | 'uploading' | 'done' | 'failed'; error?: ImportFailure }
type PreparationFailure = { name: string; error: ImportFailure }
type Props = { album: AlbumSummary; language: string; files?: File[]; onClose: () => void; onComplete: () => Promise<void> }
const failure = (cause: unknown): ImportFailure => {
  if (cause instanceof AlbumImportError) return cause.code
  const status = (cause as { status?: number })?.status
  return status === 401 || status === 403 || status === 404 || status === 409 ? 'changed' : 'upload'
}

export default function AlbumPhotoImport({ album, language, files, onClose, onComplete }: Props) {
  const lang = language === 'zh' ? 'zh' : 'en'
  const copy = (key: Exclude<keyof typeof text, 'count'>) => text[key][lang]
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<ImportFailure>()
  const [preparationFailures, setPreparationFailures] = useState<PreparationFailure[]>([])
  const localInput = useRef<HTMLInputElement>(null)
  const initialFocus = useRef<HTMLParagraphElement>(null)
  const controller = useRef(new AbortController())
  const cancelled = useRef(false)
  const locked = useRef(false)
  const previews = useRef<string[]>([])
  const latest = useRef(items)
  latest.current = items

  const prepareFiles = async (selected: File[], signal = controller.current.signal, failures: PreparationFailure[] = []) => {
    if (selected.length + latest.current.length > MAX_PHOTOS || selected.reduce((sum, f) => sum + f.size, 0) + latest.current.reduce((sum, item) => sum + item.file.size, 0) > MAX_BATCH_BYTES) throw new AlbumImportError('limit')
    const next: Item[] = []
    for (const file of selected) {
      if (signal.aborted) return
      try { await validateDecodedPhoto(file) }
      catch (cause) { failures.push({ name: file.name, error: failure(cause) }); continue }
      if (signal.aborted) return
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      if (signal.aborted) return
      const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
      if ([...latest.current, ...next].some(item => item.digest === digest)) continue
      const preview = URL.createObjectURL(file)
      previews.current.push(preview)
      next.push({ id: crypto.randomUUID(), digest, file, preview, status: 'pending' })
    }
    if (!signal.aborted) { setItems(current => [...current, ...next]); setPreparationFailures(failures) }
  }

  useEffect(() => {
    const active = new AbortController()
    controller.current = active
    if (files) {
      setPreparing(true)
      prepareFiles(files, active.signal).catch(cause => { if (!active.signal.aborted) setError(failure(cause)) }).finally(() => { if (!active.signal.aborted) setPreparing(false) })
    } else {
      loadGoogleDrive().then(() => { if (!active.signal.aborted) setReady(true) })
        .catch(cause => { if (!active.signal.aborted) setError(failure(cause)) })
    }
    return () => { active.abort(); cancelled.current = true; previews.current.forEach(url => URL.revokeObjectURL(url)) }
    // This panel is keyed by album, actor and opening; language switches preserve its work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = async () => {
    if (locked.current) return
    locked.current = true; setError(undefined); setPreparing(true); setAuthorizing(true)
    try {
      let selection = await selectDrivePhotos(language, controller.current.signal, () => {
        if (!controller.current.signal.aborted) { setAuthorizing(false); setPicking(true) }
      })
      if (!controller.current.signal.aborted) { setAuthorizing(false); setPicking(false) }
      if (controller.current.signal.aborted || !selection.photos.length) return
      if (selection.photos.length > MAX_PHOTOS) throw new AlbumImportError('limit')
      const downloaded: File[] = []
      const failures: PreparationFailure[] = []
      let size = 0
      try {
        for (const photo of selection.photos) {
          try {
            const file = await downloadDrivePhoto(photo, selection.token, controller.current.signal)
            size += file.size
            if (size > MAX_BATCH_BYTES) throw new AlbumImportError('limit')
            downloaded.push(file)
          } catch (cause) {
            if (controller.current.signal.aborted) return
            const code = failure(cause)
            if (code === 'limit' || code === 'expired') throw cause
            failures.push({ name: photo.name, error: code })
          }
        }
      } finally { selection = { photos: [], token: '' } }
      await prepareFiles(downloaded, controller.current.signal, failures)
    } catch (cause) { if (!controller.current.signal.aborted) setError(failure(cause)) }
    finally { locked.current = false; if (!controller.current.signal.aborted) { setPreparing(false); setPicking(false); setAuthorizing(false) } }
  }

  const start = async () => {
    if (locked.current) return
    locked.current = true; cancelled.current = false; setBusy(true); setError(undefined)
    const pending = latest.current.filter(item => item.status === 'pending' || item.status === 'failed')
    const update = (id: string, status: Item['status'], itemError?: ImportFailure) => setItems(current => current.map(item => item.id === id ? { ...item, status, error: itemError } : item))
    try {
      for (const item of pending) {
        if (cancelled.current || controller.current.signal.aborted) break
        update(item.id, 'uploading')
        try {
          const current = await albumService.get(album.id)
          if (!current.canManage || current.album.visibility !== album.visibility) throw new AlbumImportError('changed')
          await albumService.uploadPhoto(album.id, item.file, item.id, album.visibility, controller.current.signal)
          if (!controller.current.signal.aborted) update(item.id, 'done')
        } catch (cause) {
          if (controller.current.signal.aborted) break
          const code = failure(cause)
          update(item.id, 'failed', code)
          if (code === 'changed') { setError(code); break }
        }
      }
    } finally {
      locked.current = false
      if (!controller.current.signal.aborted) { setBusy(false); await onComplete() }
    }
  }
  const completed = items.filter(item => item.status === 'done').length
  const pending = items.some(item => item.status === 'pending' || item.status === 'failed')
  const closeBlocked = busy || (preparing && !authorizing)
  return <AppModal open={!picking} title={copy(files ? 'title' : 'drive')} description={copy('copy')} closeLabel={copy('close')}
    initialFocusRef={initialFocus}
    onClose={onClose} closeDisabled={closeBlocked} closeOnEscape={!closeBlocked} closeOnBackdrop={!closeBlocked}
    footer={<div className="flex flex-wrap justify-end gap-2">
      {busy ? <AppActionButton onClick={() => { cancelled.current = true }}>{copy('cancel')}</AppActionButton> : <AppActionButton disabled={closeBlocked} onClick={onClose}>{copy('close')}</AppActionButton>}
      {!busy && pending ? <AppActionButton variant="primary" disabled={preparing || error === 'changed'} onClick={() => void start()}>{copy(items.some(item => item.status === 'failed') ? 'retry' : 'confirm')}</AppActionButton> : null}
    </div>}>
    <div className="space-y-4">
      <p ref={initialFocus} tabIndex={-1} className="text-sm font-bold">{copy('target')}: {localizeText(album.name, language)}</p>
      <p className={`rounded-xl p-3 text-sm ${album.visibility === 'public' ? 'bg-amber-50 text-amber-900' : 'bg-[#e3f0eb] text-[#18332d]'}`}>{copy(album.visibility === 'public' ? 'public' : 'group')}</p>
      {!files && (!items.length || preparationFailures.length > 0) ? <AppActionButton block disabled={!ready || preparing || busy || !isGoogleDriveConfigured()} onClick={() => void choose()}>{copy(preparing ? 'preparing' : ready ? 'select' : 'loading')}</AppActionButton> : null}
      {files && preparationFailures.length > 0 ? <>
        <input ref={localInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => {
          const selected = Array.from(event.target.files ?? []); event.target.value = ''
          setPreparing(true); void prepareFiles(selected).catch(cause => setError(failure(cause))).finally(() => setPreparing(false))
        }} />
        <AppActionButton disabled={preparing || busy} onClick={() => localInput.current?.click()}>{copy('select')}</AppActionButton>
      </> : null}
      {preparing ? <p role="status">{copy(authorizing ? 'authorizing' : 'preparing')}</p> : null}
      {error ? <p role="alert" className="text-sm text-rose-700">{copy(error)}</p> : null}
      {preparationFailures.map((item, index) => <p key={index} role="alert" className="break-all text-sm text-rose-700">{item.name}: {copy(item.error)}</p>)}
      {items.length ? <p role="status" aria-live="polite" className="text-sm">{text.count[lang](completed, items.length)}</p> : null}
      <ul className="space-y-3">{items.map(item => <li key={item.id} className="flex items-center gap-3 rounded-xl border border-[#d6e3dd] p-2">
        <img src={item.preview} alt={item.file.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1"><p className="break-all text-sm">{item.file.name}</p><p className="text-xs text-[#66766f]">{copy(item.status)}{item.error ? ` · ${copy(item.error)}` : ''}</p></div>
        {!busy && item.status !== 'done' ? <AppActionButton size="sm" onClick={() => setItems(current => current.filter(row => row.id !== item.id))}>{copy('remove')}</AppActionButton> : null}
      </li>)}</ul>
    </div>
  </AppModal>
}
