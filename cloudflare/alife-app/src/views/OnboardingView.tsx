import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Church,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MessageCircleMore,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useUiText } from '../i18n/uiText'
import { identityAccessService, type OnboardingContext } from '../services/identityAccessService'
import { normalizeIdentityReturnPath } from '../services/identityPathPolicy'
import { http, normalizeApiError } from '../services/http'
import { visitContactService } from '../services/visitContactService'
import { useAuthStore } from '../stores/auth'

type ViewMode = 'choices' | 'visitor' | 'recovery' | 'firstTime' | 'lineRegistration' | 'success'

const getLineLoginRedirectUrl = () => {
  if (import.meta.env.DEV) return `${window.location.origin}/api/members/line/login/redirect`
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
  return baseUrl ? `${baseUrl}/api/members/line/login/redirect` : '/api/members/line/login/redirect'
}

const OnboardingView = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const safeReturnPath = normalizeIdentityReturnPath(searchParams.get('returnTo'))
  const [mode, setMode] = useState<ViewMode>('choices')
  const [context, setContext] = useState<OnboardingContext | null>(null)
  const [capabilities, setCapabilities] = useState({ passkeysEnabled: true, lineLegacyEnabled: true, activationMessagingAvailable: true })
  const [publicDevice, setPublicDevice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [successTarget, setSuccessTarget] = useState('/')
  const [lineConfirmed, setLineConfirmed] = useState(false)
  const [supplement, setSupplement] = useState('')
  const [lineProfile, setLineProfile] = useState({ name: '', sex: 'Unknown', age: '', email: '' })
  const formStarted = useRef(Date.now())

  const [contact, setContact] = useState<ContactState>({
    displayName: '', email: '', phone: '', message: '', replyPreference: 'sms', consent: false, website: '',
  })
  const [application, setApplication] = useState<ApplicationState>({
    displayName: auth.me?.displayName ?? '',
    phoneE164: auth.me?.phoneE164 ?? '',
    replyPreference: 'sms',
    declaration: '',
    privacyConsent: false,
    website: '',
  })

  useEffect(() => {
    let active = true
    const prepare = async () => {
      setBusy(true)
      try {
        const available = await identityAccessService.capabilities()
        if (!active) return
        setCapabilities(available)

        const intent = searchParams.get('intent')
        const lineLogin = searchParams.get('line_login')
        const lineError = searchParams.get('line_error')
        if (lineError) setStatus(t('lineLoginFailed', { error: lineError }))
        if (lineLogin === 'true') {
          try {
            const resumed = await identityAccessService.resume()
            if (resumed.intent !== 'lineLegacy') setContext(resumed)
          } catch {
            // A standalone legacy registration can continue without a resumable workflow.
          }
          setLineConfirmed(true)
          setMode('lineRegistration')
          return
        }

        if (intent === 'activation' || intent === 'groupJoin' || intent === 'applicationResponse') {
          const resumed = await identityAccessService.resume()
          if (!active) return
          setContext(resumed)
          setPublicDevice(resumed.isPublicDevice)
          return
        }

        const created = await identityAccessService.createFlow(safeReturnPath, false, 'signIn')
        if (active) setContext(created)
      } catch (error) {
        if (active) setStatus(normalizeIdentityError(error, t('identityLinkInvalid'), t))
      } finally {
        if (active) setBusy(false)
      }
    }
    void prepare()
    return () => { active = false }
  }, [safeReturnPath, searchParams, t])

  useEffect(() => {
    setApplication((current) => ({
      ...current,
      displayName: current.displayName || auth.me?.displayName || '',
      phoneE164: current.phoneE164 || auth.me?.phoneE164 || '',
    }))
  }, [auth.me?.displayName, auth.me?.phoneE164])

  const runPasskeyAuthentication = async () => {
    setBusy(true)
    setStatus('')
    try {
      if (!context || context.intent === 'signIn') {
        const created = await identityAccessService.createFlow(safeReturnPath, publicDevice, 'signIn')
        setContext(created)
      }
      const result = await identityAccessService.authenticatePasskey()
      await auth.fetchMe()
      if (context?.intent === 'groupJoin') {
        setApplication((current) => ({
          ...current,
          displayName: current.displayName || auth.me?.displayName || '',
          phoneE164: current.phoneE164 || auth.me?.phoneE164 || '',
        }))
        return
      }
      navigate(normalizeIdentityReturnPath(result.returnPath) || safeReturnPath || '/enter', { replace: true })
    } catch (error) {
      setStatus(normalizeIdentityError(error, t('passkeyFailed'), t))
    } finally {
      setBusy(false)
    }
  }

  const completeActivation = async () => {
    setBusy(true)
    setStatus('')
    try {
      const result = context?.isPublicDevice
        ? await identityAccessService.completePublicDeviceActivation()
        : await identityAccessService.registerPasskey()
      await auth.fetchMe()
      const destination = normalizeIdentityReturnPath(result.returnPath) || '/enter'
      if (context?.isPublicDevice) {
        setContext(null)
        setSuccessTarget(destination)
        setMode('success')
        setStatus(t('publicDeviceActivationReminder'))
      } else {
        navigate(destination, { replace: true })
      }
    } catch (error) {
      setStatus(normalizeIdentityError(error, t('passkeyFailed'), t))
    } finally {
      setBusy(false)
    }
  }

  const markNotMe = async () => {
    setBusy(true)
    try {
      await identityAccessService.activationNotMe()
      setContext(null)
      setMode('success')
      setStatus(t('activationNotMeDone'))
    } catch (error) {
      setStatus(normalizeIdentityError(error, t('identityLinkInvalid'), t))
    } finally {
      setBusy(false)
    }
  }

  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contact.displayName.trim() || (!contact.email.trim() && !contact.phone.trim()) || !contact.message.trim() || !contact.consent) {
      setStatus(t('requiredFieldsMissing'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      await visitContactService.create({
        displayName: contact.displayName,
        email: contact.email || null,
        phone: contact.phone || null,
        preferredLanguage: auth.language,
        message: contact.message,
        sourcePage: '/onboarding',
        requestKind: mode === 'recovery' ? 'accessRecovery' : 'visitorMessage',
        replyPreference: contact.replyPreference,
        privacyConsent: true,
        privacyConsentVersion: 'onboarding-v1',
        honeypot: contact.website,
        formStartedUnixMilliseconds: formStarted.current,
      })
      setMode('success')
      setStatus(t('visitorMessageSent'))
    } catch (error) {
      setStatus(normalizeApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!application.displayName.trim() || !application.phoneE164.trim() || !application.declaration.trim() || !application.privacyConsent) {
      setStatus(t('requiredFieldsMissing'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      await identityAccessService.submitGroupApplication({
        ...application,
        preferredLanguage: auth.language,
        privacyConsentVersion: 'group-application-v1',
        honeypot: application.website,
        formStartedUnixMilliseconds: formStarted.current,
      })
      setMode('success')
      setStatus(t('applicationSubmitted'))
    } catch (error) {
      setStatus(normalizeApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitSupplement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (supplement.trim().length < 2) {
      setStatus(t('requiredFieldsMissing'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      await identityAccessService.supplementAnonymousApplication(supplement.trim())
      setSupplement('')
      setMode('success')
      setStatus(t('applicationResponseSent'))
    } catch (error) {
      setStatus(normalizeApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const startLine = async (preserveFlow = false) => {
    setBusy(true)
    if (!preserveFlow) {
      try {
        await identityAccessService.createFlow(safeReturnPath, publicDevice, 'lineLegacy')
      } catch (error) {
        setBusy(false)
        setStatus(normalizeApiError(error).message)
        return
      }
    }
    window.location.assign(getLineLoginRedirectUrl())
  }

  const registerLineProfile = async () => {
    setBusy(true)
    try {
      await http.post('/api/members/register', {
        name: lineProfile.name,
        sex: lineProfile.sex,
        age: lineProfile.age ? Number(lineProfile.age) : null,
        email: lineProfile.email || null,
      })
      await auth.fetchMe()
      if (context?.intent === 'groupJoin' || context?.intent === 'activation' || context?.intent === 'applicationResponse') {
        setLineConfirmed(false)
        setMode('choices')
      } else {
        navigate(normalizeIdentityReturnPath(context?.returnPath) || safeReturnPath || '/enter', { replace: true })
      }
    } catch (error) {
      setStatus(normalizeApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const content = (() => {
    if (busy && !context && mode === 'choices') {
      return <IdentityMessage icon={ShieldCheck} title={t('identityLoading')} />
    }
    if (context?.intent === 'activation') {
      return (
        <div>
          <ScreenHeading icon={KeyRound} title={t('activationTitle')} description={t('activationDescription')} />
          {context.isPublicDevice ? <PublicDeviceNotice t={t} /> : <PasskeyPrivacy t={t} />}
          <button className="alife-primary-button mt-6 w-full" type="button" disabled={busy} onClick={() => void completeActivation()}>
            {busy ? t('checkingPasskey') : context.isPublicDevice ? t('activatePublicDevice') : t('activateWithPasskey')}
          </button>
          <button className="mt-4 min-h-11 w-full text-sm font-semibold text-[#915040] underline-offset-4 hover:underline" type="button" disabled={busy} onClick={() => void markNotMe()}>
            {t('activationNotMe')}
          </button>
        </div>
      )
    }
    if (context?.intent === 'groupJoin') {
      const groupName = auth.language === 'zh' ? context.groupNameZh || context.groupNameEn : context.groupNameEn || context.groupNameZh
      return (
        <div>
          <ScreenHeading icon={UserPlus} title={t('groupApplicationTitle', { group: groupName || t('group') })} description={t('groupApplicationDescription')} />
          {auth.isGuest ? (
            <div className="mt-6 rounded-2xl border border-[#176b5a]/15 bg-[#e3f0eb]/70 p-4">
              <p className="text-sm leading-6 text-[#314b43]">{t('existingMemberSignInFirst')}</p>
              <button className="alife-primary-button mt-4 w-full" type="button" disabled={busy} onClick={() => void runPasskeyAuthentication()}>
                <Fingerprint className="h-5 w-5" aria-hidden="true" /> {t('usePasskey')}
              </button>
              {capabilities.lineLegacyEnabled ? <button className="alife-secondary-button mt-3 w-full" type="button" disabled={busy} onClick={() => void startLine(true)}>{t('continueWithLine')}</button> : null}
            </div>
          ) : null}
          <ApplicationForm value={application} onChange={setApplication} onSubmit={submitApplication} busy={busy} t={t} />
        </div>
      )
    }
    if (context?.intent === 'applicationResponse') {
      const groupName = auth.language === 'zh' ? context.groupNameZh || context.groupNameEn : context.groupNameEn || context.groupNameZh
      return (
        <div>
          <ScreenHeading icon={MessageSquareText} title={t('applicationResponseTitle')} description={groupName ? `${groupName} · ${t('applicationResponseDescription')}` : t('applicationResponseDescription')} />
          <form className="mt-6 space-y-4" onSubmit={submitSupplement}>
            <label className="block text-sm font-semibold text-[#314b43]">{t('applicationResponseLabel')}<textarea className="alife-input mt-2 min-h-32 py-3" maxLength={2000} required value={supplement} onChange={(event) => setSupplement(event.target.value)} /></label>
            <button className="alife-primary-button w-full" type="submit" disabled={busy || supplement.trim().length < 2}>{busy ? t('identityLoading') : t('applicationResponseSubmit')}</button>
          </form>
        </div>
      )
    }
    if (mode === 'visitor' || mode === 'recovery') {
      return (
        <div>
          <BackButton onClick={() => { setMode('choices'); setStatus('') }} label={t('backToChoices')} />
          <ScreenHeading
            icon={mode === 'recovery' ? KeyRound : MessageSquareText}
            title={mode === 'recovery' ? t('recoveryTitle') : t('visitorFormTitle')}
            description={mode === 'recovery' ? t('recoveryDescription') : t('visitorFormDescription')}
          />
          <ContactForm value={contact} onChange={setContact} onSubmit={submitContact} busy={busy} t={t} />
        </div>
      )
    }
    if (mode === 'firstTime') {
      return (
        <div>
          <BackButton onClick={() => setMode('choices')} label={t('backToChoices')} />
          <ScreenHeading icon={UserPlus} title={t('firstTimeTitle')} description={t('firstTimeDescription')} />
          <button className="alife-secondary-button mt-6 w-full" type="button" onClick={() => setMode('visitor')}>
            <MessageSquareText className="h-5 w-5" aria-hidden="true" /> {t('visitorMessage')}
          </button>
        </div>
      )
    }
    if (mode === 'lineRegistration' && lineConfirmed) {
      return (
        <div>
          <ScreenHeading icon={MessageCircleMore} title={t('completeRegistration')} description={t('lineLegacyHint')} />
          <div className="mt-6 space-y-4">
            <input className="alife-input" aria-label={t('displayName')} value={lineProfile.name} onChange={(event) => setLineProfile({ ...lineProfile, name: event.target.value })} placeholder={t('displayName')} />
            <input className="alife-input" aria-label={t('sex')} value={lineProfile.sex} onChange={(event) => setLineProfile({ ...lineProfile, sex: event.target.value })} placeholder={t('sex')} />
            <input className="alife-input" aria-label={t('age')} type="number" value={lineProfile.age} onChange={(event) => setLineProfile({ ...lineProfile, age: event.target.value })} placeholder={t('age')} />
            <input className="alife-input" aria-label={t('email')} type="email" value={lineProfile.email} onChange={(event) => setLineProfile({ ...lineProfile, email: event.target.value })} placeholder={t('email')} />
            <button className="alife-primary-button w-full" type="button" disabled={busy || !lineProfile.name.trim()} onClick={() => void registerLineProfile()}>{t('completeRegistration')}</button>
          </div>
        </div>
      )
    }
    if (mode === 'success') {
      return <IdentityMessage icon={CheckCircle2} title={status} action={<button className="alife-secondary-button mt-6" type="button" onClick={() => navigate(successTarget, { replace: true })}>{successTarget === '/' ? t('home') : t('enterAlife')}</button>} />
    }
    return (
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e3f0eb] px-3 py-1.5 text-xs font-bold text-[#176b5a]">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> {t('onboardingEyebrow')}
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em] text-[#18332d]">{t('onboardingTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#66766f]">{t('onboardingSubtitle')}</p>
        <div className="mt-7 divide-y divide-[#2f4b42]/10 overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white/75">
          <IntentButton icon={Fingerprint} title={t('enterMyAlife')} hint={t('enterMyAlifeHint')} disabled={busy || !capabilities.passkeysEnabled} onClick={() => void runPasskeyAuthentication()} />
          <IntentButton icon={MessageSquareText} title={t('visitorMessage')} hint={t('visitorMessageHint')} onClick={() => { formStarted.current = Date.now(); setMode('visitor') }} />
          <IntentButton icon={Church} title={t('learnAboutChurch')} hint={t('learnAboutChurchHint')} onClick={() => navigate('/')} />
        </div>
        {!capabilities.passkeysEnabled ? <p className="mt-3 text-sm text-[#915040]">{t('passkeyUnavailable')}</p> : null}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#2f4b42]/10 bg-[#f5f2eb]/75 p-4">
          <input className="mt-1 h-4 w-4 accent-[#176b5a]" type="checkbox" checked={publicDevice} onChange={(event) => setPublicDevice(event.target.checked)} />
          <span><strong className="block text-sm text-[#18332d]">{t('publicDevice')}</strong><span className="mt-1 block text-xs leading-5 text-[#66766f]">{t('publicDeviceHint')}</span></span>
        </label>
        <PasskeyPrivacy t={t} />
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#176b5a]">
          <button type="button" onClick={() => setMode('firstTime')}>{t('firstTimeHere')}</button>
          <button type="button" onClick={() => { formStarted.current = Date.now(); setMode('recovery') }}>{t('lostPasskey')}</button>
          {capabilities.lineLegacyEnabled ? <button type="button" disabled={busy} onClick={() => void startLine()}>{t('lineLegacyAccess')}</button> : null}
        </div>
      </div>
    )
  })()

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-[#fffdf8]/95 shadow-[0_28px_80px_rgba(31,56,48,0.13)] lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="relative hidden overflow-hidden bg-[#123e35] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#e37b63]/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white"><img src={logo} alt={t('appName')} className="h-10 w-auto" /></span><div><p className="text-xl font-bold">ALIFE</p><p className="text-sm text-white/60">{t('secureMemberAccess')}</p></div></div>
        <div className="relative">
          <ShieldCheck className="h-10 w-10 text-[#8dd0bd]" aria-hidden="true" />
          <p className="mt-5 text-3xl font-bold leading-tight tracking-[-0.04em]">{t('loginPageIntro')}</p>
          <p className="mt-4 text-sm leading-6 text-white/65">{t('identitySecurityFooter')}</p>
        </div>
      </aside>
      <main className="flex items-start px-5 py-8 sm:px-10 lg:items-center lg:px-14 lg:py-12">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-7 flex items-center gap-3 lg:hidden"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e3f0eb]"><img src={logo} alt={t('appName')} className="h-9 w-auto" /></span><span className="text-xl font-bold text-[#18332d]">ALIFE</span></div>
          {content}
          {status && mode !== 'success' ? <p role="status" aria-live="polite" className="mt-5 rounded-2xl border border-[#e37b63]/25 bg-[#fff2ed] px-4 py-3 text-sm leading-6 text-[#915040]">{status}</p> : null}
        </div>
      </main>
    </section>
  )
}

const IntentButton = ({ icon: Icon, title, hint, disabled, onClick }: { icon: typeof Fingerprint; title: string; hint: string; disabled?: boolean; onClick: () => void }) => (
  <button className="group flex min-h-[5.25rem] w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[#e3f0eb]/55 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={disabled} onClick={onClick}>
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><strong className="block text-sm text-[#18332d]">{title}</strong><span className="mt-1 block text-xs leading-5 text-[#66766f]">{hint}</span></span>
    <ArrowRight className="h-4 w-4 shrink-0 text-[#92a099] transition group-hover:translate-x-0.5" aria-hidden="true" />
  </button>
)

const ScreenHeading = ({ icon: Icon, title, description }: { icon: typeof Fingerprint; title: string; description: string }) => (
  <div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Icon className="h-6 w-6" aria-hidden="true" /></span><h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-[#18332d]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#66766f]">{description}</p></div>
)

const PasskeyPrivacy = ({ t }: { t: ReturnType<typeof useUiText> }) => <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#66766f]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" aria-hidden="true" />{t('passkeyPrivacy')}</p>
const PublicDeviceNotice = ({ t }: { t: ReturnType<typeof useUiText> }) => <div className="mt-5 rounded-2xl border border-[#e37b63]/20 bg-[#fff2ed] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#915040]"><Smartphone className="h-5 w-5" />{t('publicDevice')}</p><p className="mt-2 text-xs leading-5 text-[#915040]">{t('publicDeviceHint')}</p></div>
const BackButton = ({ onClick, label }: { onClick: () => void; label: string }) => <button className="mb-6 flex min-h-10 items-center gap-2 text-sm font-semibold text-[#176b5a]" type="button" onClick={onClick}><ArrowLeft className="h-4 w-4" />{label}</button>
const IdentityMessage = ({ icon: Icon, title, action }: { icon: typeof ShieldCheck; title: string; action?: React.ReactNode }) => <div className="py-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e3f0eb] text-[#176b5a]"><Icon className="h-7 w-7" aria-hidden="true" /></span><p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#314b43]">{title}</p>{action}</div>

type ContactState = { displayName: string; email: string; phone: string; message: string; replyPreference: 'email' | 'phone' | 'sms' | 'line'; consent: boolean; website: string }
const ContactForm = ({ value, onChange, onSubmit, busy, t }: { value: ContactState; onChange: (value: ContactState) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; t: ReturnType<typeof useUiText> }) => (
  <form className="mt-6 space-y-4" onSubmit={onSubmit}>
    <input className="alife-input" aria-label={t('displayName')} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} placeholder={t('displayName')} autoComplete="name" />
    <div className="grid gap-4 sm:grid-cols-2"><input className="alife-input" aria-label={t('email')} type="email" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} placeholder={t('email')} autoComplete="email" /><input className="alife-input" aria-label={t('phone')} value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} placeholder={t('phone')} autoComplete="tel" /></div>
    <select className="alife-input" aria-label={t('replyPreference')} value={value.replyPreference} onChange={(event) => onChange({ ...value, replyPreference: event.target.value as ContactState['replyPreference'] })}><option value="sms">{t('textMessage')}</option><option value="phone">{t('phoneCall')}</option><option value="email">{t('email')}</option><option value="line">LINE</option></select>
    <textarea className="alife-input min-h-32 resize-y" aria-label={t('yourMessage')} value={value.message} onChange={(event) => onChange({ ...value, message: event.target.value })} placeholder={t('yourMessage')} />
    <input className="hidden" tabIndex={-1} autoComplete="off" value={value.website} onChange={(event) => onChange({ ...value, website: event.target.value })} aria-hidden="true" />
    <label className="flex items-start gap-3 text-xs leading-5 text-[#66766f]"><input className="mt-1 h-4 w-4 accent-[#176b5a]" type="checkbox" checked={value.consent} onChange={(event) => onChange({ ...value, consent: event.target.checked })} />{t('privacyConsent')}</label>
    <button className="alife-primary-button w-full" type="submit" disabled={busy}>{busy ? t('sending') : t('sendVisitorMessage')}</button>
  </form>
)

type ApplicationState = { displayName: string; phoneE164: string; replyPreference: string; declaration: string; privacyConsent: boolean; website: string }
const ApplicationForm = ({ value, onChange, onSubmit, busy, t }: { value: ApplicationState; onChange: (value: ApplicationState) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; t: ReturnType<typeof useUiText> }) => (
  <form className="mt-6 space-y-4" onSubmit={onSubmit}>
    <input className="alife-input" aria-label={t('displayName')} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} placeholder={t('displayName')} autoComplete="name" />
    <input className="alife-input" aria-label={t('phone')} value={value.phoneE164} onChange={(event) => onChange({ ...value, phoneE164: event.target.value })} placeholder="+64…" autoComplete="tel" />
    <select className="alife-input" aria-label={t('replyPreference')} value={value.replyPreference} onChange={(event) => onChange({ ...value, replyPreference: event.target.value })}><option value="sms">{t('textMessage')}</option><option value="phone">{t('phoneCall')}</option><option value="line">LINE</option></select>
    <textarea className="alife-input min-h-28 resize-y" aria-label={t('applicantDeclaration')} value={value.declaration} onChange={(event) => onChange({ ...value, declaration: event.target.value })} placeholder={t('applicantDeclaration')} />
    <input className="hidden" tabIndex={-1} autoComplete="off" value={value.website} onChange={(event) => onChange({ ...value, website: event.target.value })} aria-hidden="true" />
    <label className="flex items-start gap-3 text-xs leading-5 text-[#66766f]"><input className="mt-1 h-4 w-4 accent-[#176b5a]" type="checkbox" checked={value.privacyConsent} onChange={(event) => onChange({ ...value, privacyConsent: event.target.checked })} />{t('privacyConsent')}</label>
    <button className="alife-primary-button w-full" type="submit" disabled={busy}>{t('submitApplication')}</button>
  </form>
)

const normalizeIdentityError = (error: unknown, fallback: string, t: ReturnType<typeof useUiText>) => {
  if (error instanceof Error && error.message === 'passkey_not_supported') return t('passkeyUnavailable')
  if (error instanceof DOMException && error.name === 'NotAllowedError') return t('passkeyCancelled')
  const api = normalizeApiError(error)
  if (api.code === 'rate_limited') return api.message
  return api.message || fallback
}

export default OnboardingView
