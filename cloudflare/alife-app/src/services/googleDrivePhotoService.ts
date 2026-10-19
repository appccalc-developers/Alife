import { AlbumImportError, MAX_PHOTO_BYTES, PHOTO_TYPES } from './albumImportPolicy'

export type DrivePhoto = { id: string; name: string; mimeType: string; sizeBytes?: number; resourceKey?: string }
type Token = { access_token?: string; expires_in?: number; error?: string }
type PickerResult = { action: string; docs?: DrivePhoto[] }
type PickerBuilder = {
  setAppId(value: string): PickerBuilder; setDeveloperKey(value: string): PickerBuilder
  setOAuthToken(value: string): PickerBuilder; setOrigin(value: string): PickerBuilder
  setLocale(value: string): PickerBuilder; addView(value: unknown): PickerBuilder
  enableFeature(value: string): PickerBuilder; setCallback(callback: (value: PickerResult) => void): PickerBuilder
  build(): { setVisible(value: boolean): void }
}
type Google = {
  accounts: { oauth2: { initTokenClient(config: {
    client_id: string; scope: string; include_granted_scopes: boolean
    callback: (value: Token) => void; error_callback: () => void
  }): { requestAccessToken(): void } } }
  picker: {
    DocsView: new () => { setMimeTypes(value: string): unknown }
    PickerBuilder: new () => PickerBuilder
    Feature: { MULTISELECT_ENABLED: string }
  }
}
type GoogleWindow = Window & { google?: Google; gapi?: { load(name: string, options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void }): void } }
const config = () => ({
  client: (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? '').trim(),
  key: (import.meta.env.VITE_GOOGLE_DRIVE_API_KEY ?? '').trim(),
  app: (import.meta.env.VITE_GOOGLE_DRIVE_APP_ID ?? '').trim(),
})
export const isGoogleDriveConfigured = () => Object.values(config()).every(Boolean)
let libraries: Promise<void> | undefined
const script = (id: string, src: string) => new Promise<void>((resolve, reject) => {
  document.getElementById(id)?.remove()
  const element = document.createElement('script')
  element.id = id; element.src = src; element.async = true
  const timeout = window.setTimeout(() => { element.remove(); reject(new AlbumImportError('unavailable')) }, 20000)
  element.onload = () => { window.clearTimeout(timeout); resolve() }
  element.onerror = () => { window.clearTimeout(timeout); element.remove(); reject(new AlbumImportError('unavailable')) }
  document.head.append(element)
})
export const loadGoogleDrive = () => {
  if (!isGoogleDriveConfigured()) return Promise.reject(new AlbumImportError('configuration'))
  libraries ??= Promise.all([
    script('alife-google-identity', 'https://accounts.google.com/gsi/client'),
    script('alife-google-picker', 'https://apis.google.com/js/api.js'),
  ]).then(() => new Promise<void>((resolve, reject) => {
    const fail = () => reject(new AlbumImportError('unavailable'))
    const gapi = (window as GoogleWindow).gapi
    if (!gapi) return fail()
    gapi.load('picker', { callback: resolve, onerror: fail, timeout: 20000, ontimeout: fail })
  })).catch(cause => { libraries = undefined; throw cause })
  return libraries
}

// Must be called by a click after loadGoogleDrive, preserving popup user activation.
export function selectDrivePhotos(language: string, signal: AbortSignal, onPickerOpen?: () => void): Promise<{ photos: DrivePhoto[]; token: string }> {
  const settings = config()
  const google = (window as GoogleWindow).google
  if (!google?.accounts || !google.picker) return Promise.reject(new AlbumImportError('unavailable'))
  if (signal.aborted) return Promise.reject(new AlbumImportError('authorization'))
  return new Promise((resolve, reject) => {
    let picker: { setVisible(value: boolean): void } | undefined
    let finished = false
    const cleanup = () => { finished = true; signal.removeEventListener('abort', abort) }
    const fail = () => { if (!finished) { cleanup(); reject(new AlbumImportError('authorization')) } }
    const abort = () => { picker?.setVisible(false); fail() }
    const done = (value: { photos: DrivePhoto[]; token: string }) => { if (!finished) { cleanup(); resolve(value) } }
    signal.addEventListener('abort', abort, { once: true })
    const client = google.accounts.oauth2.initTokenClient({
      client_id: settings.client, scope: 'https://www.googleapis.com/auth/drive.file', include_granted_scopes: false,
      error_callback: fail,
      callback: response => {
        if (finished || signal.aborted) return
        if (response.error || !response.access_token) return fail()
        const token = response.access_token
        picker = new google.picker.PickerBuilder().setAppId(settings.app).setDeveloperKey(settings.key)
          .setOAuthToken(token).setOrigin(window.location.origin).setLocale(language === 'zh' ? 'zh-CN' : 'en')
          .addView(new google.picker.DocsView().setMimeTypes(PHOTO_TYPES.join(',')))
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED).setCallback(result => {
            if (result.action === 'cancel') done({ photos: [], token: '' })
            if (result.action === 'picked') done({ photos: [...new Map((result.docs ?? []).map(p => [p.id, p])).values()], token })
          }).build()
        picker.setVisible(true)
        if (!finished) onPickerOpen?.()
      },
    })
    client.requestAccessToken()
  })
}

export async function downloadDrivePhoto(photo: DrivePhoto, token: string, signal: AbortSignal): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.id)}`
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (photo.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${photo.id}/${photo.resourceKey}`
  const check = (response: Response) => {
    if (response.status === 401) throw new AlbumImportError('expired')
    if (!response.ok) throw new AlbumImportError('unavailable')
  }
  const metadataResponse = await fetch(`${url}?fields=name,mimeType,size,capabilities(canDownload)`, { headers, signal, cache: 'no-store' })
  check(metadataResponse)
  const metadata = await metadataResponse.json() as { name: string; mimeType: string; size: string; capabilities?: { canDownload?: boolean } }
  if (!PHOTO_TYPES.includes(metadata.mimeType as typeof PHOTO_TYPES[number]) || metadata.capabilities?.canDownload === false) throw new AlbumImportError('invalid')
  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) <= 0 || Number(metadata.size) > MAX_PHOTO_BYTES) throw new AlbumImportError('limit')
  const response = await fetch(`${url}?alt=media`, { headers, signal, cache: 'no-store' })
  check(response)
  const reader = response.body?.getReader()
  if (!reader) throw new AlbumImportError('unavailable')
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_PHOTO_BYTES) throw new AlbumImportError('limit')
      chunks.push(new Uint8Array(value))
    }
  } catch (cause) { await reader.cancel(); throw cause }
  return new File(chunks, metadata.name, { type: metadata.mimeType })
}
