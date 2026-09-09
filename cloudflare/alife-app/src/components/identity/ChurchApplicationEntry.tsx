import { useEffect, useRef, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { useUiText } from '../../i18n/uiText'
import { identityAccessService } from '../../services/identityAccessService'
import { normalizeApiError } from '../../services/http'
import RegionalPhoneInput from '../forms/RegionalPhoneInput'
import BrowserApplicationPanel from './BrowserApplicationPanel'
import ChurchApplicationGate from './ChurchApplicationGate'
import { validateChurchApplication, type ChurchApplicationForm } from '../../services/churchApplicationValidation'

export default function ChurchApplicationEntry({ mobile, language, authenticating, onSignIn, onRecovery }: {
  mobile: boolean; language: string; authenticating: boolean; onSignIn: () => void; onRecovery: () => void
}) {
  const t = useUiText()
  const navigate = useNavigate()
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(Date.now())
  const [form, setForm] = useState<ChurchApplicationForm>({
    displayName: '', sex: '', phoneE164: '', email: '', declaration: '', replyPreference: 'email',
    privacyConsent: false, notificationConsent: false, honeypot: '',
  })
  const url = `${window.location.origin}/onboarding?intent=churchApplication`
  useEffect(() => {
    if (mobile) return
    let active = true
    void QRCode.toDataURL(url, { width: 320, margin: 2 }).then(value => { if (active) setQr(value) }).catch(() => { if (active) setError('qr') })
    return () => { active = false }
  }, [mobile, url])
  const update = <K extends keyof ChurchApplicationForm>(key: K, value: ChurchApplicationForm[K]) => setForm(current => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const invalid = validateChurchApplication(form)
    if (invalid) { setError(invalid); return }
    setBusy(true); setError('')
    try {
      await identityAccessService.createFlow('', false, 'signIn')
      const result = await identityAccessService.submitChurchApplication({ ...form,
        preferredLanguage: language, privacyConsentVersion: 'church-application-v1',
        formStartedUnixMilliseconds: started.current,
      })
      navigate(`/onboarding?application=${encodeURIComponent(result.id)}&source=church`, { replace: true })
    } catch (caught) { setError(normalizeApiError(caught).code || 'submit') }
    finally { setBusy(false) }
  }
  if (!mobile) return <div className="mt-6 space-y-4 text-sm leading-6 text-[#66766f]">
    <p>{t('churchApplicationPhoneHandoff')}</p>
    {qr ? <img src={qr} width={320} height={320} className="mx-auto aspect-square w-full max-w-72 rounded-2xl border border-[#2f4b42]/10" alt={t('churchApplicationQr')} /> : <p role="status">{error ? t('churchApplicationQrFallback') : t('identityLoading')}</p>}
    <p className="break-all rounded-xl bg-[#e3f0eb] p-3 text-[#176b5a]">{url}</p>
    <p>{t('churchApplicationQrPrivacy')}</p>
  </div>
  return <BrowserApplicationPanel><ChurchApplicationGate busy={authenticating} onSignIn={onSignIn} onRecovery={onRecovery}><form className="mt-6 space-y-5" onSubmit={submit}>
    <p className="rounded-xl bg-[#e3f0eb] p-4 text-sm leading-6 text-[#314b43]">{t('churchApplicationJourney')}</p>
    <label className="block text-sm font-semibold">{t('churchApplicationName')}<input className="alife-input mt-2" autoComplete="name" required minLength={2} maxLength={150} value={form.displayName} onChange={event => update('displayName', event.target.value)} /></label>
    <label className="block text-sm font-semibold">{t('sex')}<select className="alife-input mt-2" required value={form.sex} onChange={event => update('sex', event.target.value)}><option value="">{t('churchApplicationChooseSex')}</option><option value="Male">{t('churchApplicationMale')}</option><option value="Female">{t('churchApplicationFemale')}</option><option value="Unknown">{t('churchApplicationPrivateSex')}</option></select></label>
    <RegionalPhoneInput language={language === 'zh' ? 'zh' : 'en'} label={t('phoneOptional')} value={form.phoneE164} onChange={value => update('phoneE164', value)} />
    <label className="block text-sm font-semibold">{t('email')}<input className="alife-input mt-2" type="email" required maxLength={320} autoComplete="email" value={form.email} onChange={event => update('email', event.target.value)} /></label>
    <label className="block text-sm font-semibold">{t('yourMessage')}<textarea className="alife-input mt-2 min-h-28 py-3" required minLength={2} maxLength={2000} value={form.declaration} onChange={event => update('declaration', event.target.value)} /></label>
    <fieldset className="space-y-3 rounded-2xl border border-[#2f4b42]/10 p-4"><legend className="px-1 text-sm font-semibold">{t('churchApplicationNotifyBy')}</legend>
      <label className="flex min-h-11 items-center gap-3"><input type="radio" name="notification" value="email" checked={form.replyPreference === 'email'} onChange={() => update('replyPreference', 'email')} />{t('email')}</label>
      <label className="flex min-h-11 items-center gap-3"><input type="radio" name="notification" value="sms" checked={form.replyPreference === 'sms'} onChange={() => update('replyPreference', 'sms')} />{t('textMessage')}</label>
      <p className="text-xs leading-5 text-[#66766f]">{t('churchApplicationManualNotice')}</p>
    </fieldset>
    <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.honeypot} onChange={event => update('honeypot', event.target.value)} />
    <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0 accent-[#176b5a]" type="checkbox" required checked={form.privacyConsent} onChange={event => update('privacyConsent', event.target.checked)} />{t('privacyConsent')}</label>
    <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0 accent-[#176b5a]" type="checkbox" required checked={form.notificationConsent} onChange={event => update('notificationConsent', event.target.checked)} />{t('churchApplicationNotificationConsent')}</label>
    {error ? <p role="alert" className="rounded-xl bg-[#fff2ed] p-3 text-sm leading-6 text-[#915040]">{t(error === 'phone' ? 'churchApplicationPhoneInvalid' : error === 'application_already_active' ? 'churchApplicationDuplicate' : error === 'required' ? 'requiredFieldsMissing' : 'churchApplicationSubmitFailed')}</p> : null}
    <button className="alife-primary-button w-full" type="submit" disabled={busy}>{busy ? t('sending') : t('submitApplication')}</button>
  </form></ChurchApplicationGate></BrowserApplicationPanel>
}
