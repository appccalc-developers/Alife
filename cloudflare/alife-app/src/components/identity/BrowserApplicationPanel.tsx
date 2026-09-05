import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { identityAccessService, type BrowserApplicationStatus } from '../../services/identityAccessService'
import { useUiText } from '../../i18n/uiText'
import { normalizeApiError } from '../../services/http'
import { isLikelyMobileDevice } from '../../services/deviceClass'

export default function BrowserApplicationPanel({ applicationId, inviteId, children }: {
  applicationId?: string; inviteId?: string; children: ReactNode
}) {
  const t = useUiText()
  const navigate = useNavigate()
  const [value, setValue] = useState<BrowserApplicationStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [note, setNote] = useState('')
  const mounted = useRef(true)
  const pending = useRef(false)
  const refresh = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      const result = await identityAccessService.browserApplication(applicationId, inviteId)
      if (mounted.current) { setValue(result); setFailed(false); setUnavailable(false) }
    } catch (error) {
      if (mounted.current) {
        const missing = normalizeApiError(error).status === 404
        setFailed(true); setUnavailable(missing)
        if (missing) setValue(null)
      }
    } finally {
      pending.current = false
      if (mounted.current) { setLoaded(true); setBusy(false) }
    }
  }, [applicationId, inviteId])
  useEffect(() => {
    mounted.current = true
    void refresh()
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    return () => { mounted.current = false; window.removeEventListener('focus', focus) }
  }, [refresh])
  const activate = async () => {
    if (!value) return
    setBusy(true)
    try {
      await identityAccessService.activateBrowserApplication(value.application.id)
      navigate('/onboarding?intent=activation', { replace: true })
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  if (!loaded) return <p role="status">{t('identityLoading')}</p>
  if (!value && failed && !unavailable) return <div><p role="alert">{t('applicationCheckFailed')}</p><button type="button" disabled={busy} className="alife-secondary-button mt-3" onClick={() => void refresh()}>{t('applicationCheck')}</button></div>
  if (!value) return <div>{applicationId ? <p role="alert">{t('applicationBrowserLost')}</p> : <>{children}<p className="mt-4 text-sm text-[#66766f]">{t('applicationBrowserHint')}</p></>}</div>
  const application = value.application
  return <section className="mt-5 space-y-4">
    <p className="break-all rounded-xl bg-[#e3f0eb] p-3 text-sm"><strong>{t('applicationReceipt')}</strong><br />{application.id}</p>
    <p role="status">{t(application.status === 'approved' ? (value.canActivate ? 'applicationApproved' : 'applicationRecoveryRequired') : application.status === 'rejected' ? 'applicationRejected' : application.status === 'needsInfo' ? 'applicationResponseDescription' : 'applicationPending')}</p>
    <p className="text-sm leading-6 text-[#66766f]">{t('applicationBrowserHint')}</p>
    {failed ? <p role="alert" className="text-sm text-[#915040]">{t('applicationBrowserLost')}</p> : null}
    {application.status === 'needsInfo' ? <form onSubmit={(event) => {
      event.preventDefault(); setBusy(true)
      void identityAccessService.supplementBrowserApplication(application, note).then(async () => { setNote(''); await refresh() }).catch(() => setFailed(true)).finally(() => setBusy(false))
    }}>
      {application.history.filter(item => item.toStatus === 'needsInfo' && item.note).slice(-1).map(item => <p key={item.id} className="mb-3 whitespace-pre-wrap">{item.note}</p>)}
      <label className="block">{t('applicationResponseLabel')}<textarea required minLength={2} maxLength={2000} className="alife-input mt-2 min-h-24" value={note} onChange={event => setNote(event.target.value)} /></label>
      <button className="alife-primary-button mt-3" disabled={busy || note.trim().length < 2}>{t('applicationResponseSubmit')}</button>
    </form> : null}
    {value.canActivate ? <button type="button" className="alife-primary-button w-full" disabled={busy || !isLikelyMobileDevice()} onClick={() => void activate()}>{t('activateWithPasskey')}</button> : null}
    {value.canActivate && !isLikelyMobileDevice() ? <p>{t('applicationMobileRequired')}</p> : null}
    <button type="button" className="alife-secondary-button w-full" disabled={busy} onClick={() => void refresh()}>{busy ? t('identityLoading') : t('applicationCheck')}</button>
  </section>
}
