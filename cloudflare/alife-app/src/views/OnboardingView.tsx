import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, MessageCircleMore, Sparkles, UsersRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUiText } from '../i18n/uiText'
import { http, type ApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import logo from '../assets/logo.png'

const getLineLoginRedirectUrl = () => {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/api/members/line/login/redirect`
  }
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return normalizedBaseUrl ? `${normalizedBaseUrl}/api/members/line/login/redirect` : '/api/members/line/login/redirect'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as Partial<ApiError> | undefined
  return apiError?.message || fallback
}

const OnboardingView = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const { fetchMe } = auth
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [name, setName] = useState('')
  const [sex, setSex] = useState('Unknown')
  const [age, setAge] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [lineConfirmed, setLineConfirmed] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLineLoading, setIsLineLoading] = useState(false)
  const [displayNameLogin, setDisplayNameLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isDisplayNameLoading, setIsDisplayNameLoading] = useState(false)

  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const canRegister = lineConfirmed && !isRegistering

  useEffect(() => {
    const lineLogin = searchParams.get('line_login')
    const lineError = searchParams.get('line_error')
    const lineDisplayName = searchParams.get('line_display_name')
    const lineEmail = searchParams.get('line_email')

    if (lineError) {
      setMessage(t('lineLoginFailed', { error: lineError }))
      return
    }

    if (lineLogin === 'true') {
      fetchMe().catch(() => undefined)
      if (lineDisplayName) {
        setName(lineDisplayName)
      }
      if (lineEmail) {
        setEmail(lineEmail)
      }
      setLineConfirmed(true)
      setMessage(t('lineVerified'))
    }
  }, [fetchMe, searchParams, t])

  useEffect(() => {
    if (lineConfirmed) {
      nameInputRef.current?.focus()
    }
  }, [lineConfirmed])

  const loginWithLine = async () => {
    setIsLineLoading(true)
    try {
      await auth.bootstrap()
      window.location.assign(getLineLoginRedirectUrl())
    } catch (error) {
      setMessage(getErrorMessage(error, t('lineLoginStartFailed')))
      setIsLineLoading(false)
    }
  }

  const loginWithDisplayName = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!displayNameLogin.trim()) {
      setMessage(t('enterDisplayName'))
      return
    }
    const scrollTop = window.scrollY
    setIsDisplayNameLoading(true)
    setMessage('')
    try {
      await auth.bootstrap()
      await http.post('/api/members/login/display-name', {
        account: displayNameLogin.trim(),
        displayName: displayNameLogin.trim(),
        password,
      })
      await auth.fetchMe()
      navigate('/')
    } catch (error) {
      setMessage(getErrorMessage(error, t('displayNameLoginFailed')))
    } finally {
      setIsDisplayNameLoading(false)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.scrollTo({ top: scrollTop, behavior: 'auto' }))
      })
    }
  }

  const register = async () => {
    if (!canRegister) {
      return
    }

    setIsRegistering(true)
    try {
      await auth.bootstrap()
      await http.post('/api/members/register', {
        name,
        sex,
        age,
        email,
      })
      await auth.fetchMe()
      setMessage(t('registeredSuccessfully'))
      navigate('/')
    } catch (error) {
      setMessage(getErrorMessage(error, t('registrationFailed')))
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-[#fffdf8]/90 shadow-[0_28px_80px_rgba(31,56,48,0.13)] [overflow-anchor:none] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-[#123e35] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#e37b63]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#57a38e]/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 shadow-lg">
              <img src={logo} alt={t('appName')} className="h-10 w-auto" />
            </span>
            <div>
              <p className="text-xl font-bold tracking-[-0.03em]">Alife</p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">{t('secureMemberAccess')}</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-md text-5xl font-bold leading-[1.05] tracking-[-0.055em]">
            {t('loginPageIntro')}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">{t('accountLoginDescription')}</p>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          {[UsersRound, MessageCircleMore, Sparkles].map((Icon, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <Icon className="h-5 w-5 text-[#8dd0bd]" aria-hidden="true" />
              <div className="mt-7 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#e37b63]" style={{ width: `${52 + index * 16}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start px-5 py-8 sm:px-10 lg:items-center lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e3f0eb]">
                <img src={logo} alt={t('appName')} className="h-9 w-auto" />
              </span>
              <span className="text-xl font-bold tracking-[-0.04em] text-[#18332d]">Alife</span>
            </div>
          </div>

          {!lineConfirmed ? (
            <>
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e3f0eb] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-[#176b5a]">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('secureMemberAccess')}
                </span>
                <h2 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-[#18332d]">{t('welcomeBack')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#66766f]">{t('accountLoginDescription')}</p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={(event) => void loginWithDisplayName(event)}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#314b43]">{t('account')}</span>
                  <input
                    value={displayNameLogin}
                    onChange={(event) => setDisplayNameLogin(event.target.value)}
                    className="alife-input"
                    placeholder={t('accountPlaceholder')}
                    autoComplete="username"
                    disabled={isDisplayNameLoading}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#314b43]">{t('password')}</span>
                  <span className="relative block">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="alife-input pr-12"
                      placeholder={t('passwordPlaceholder')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isDisplayNameLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#66766f] transition hover:bg-[#e3f0eb] hover:text-[#176b5a]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <p className="rounded-2xl border border-[#e37b63]/15 bg-[#fff2ed] px-4 py-3 text-xs leading-5 text-[#915040]">
                  {t('passwordOptionalNotice')}
                </p>

                <button
                  type="submit"
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#176b5a] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(23,107,90,0.24)] transition hover:-translate-y-0.5 hover:bg-[#0d4f43] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  disabled={isDisplayNameLoading || !displayNameLogin.trim()}
                >
                  {isDisplayNameLoading ? t('loggingIn') : t('login')}
                  {!isDisplayNameLoading ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <hr className="flex-1 border-[#2f4b42]/12" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#92a099]">{t('or')}</span>
                <hr className="flex-1 border-[#2f4b42]/12" />
              </div>

              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#2f4b42]/15 bg-white/80 px-5 py-3 font-semibold text-[#314b43] shadow-sm transition hover:-translate-y-0.5 hover:border-[#176b5a]/30 hover:text-[#176b5a] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLineLoading}
                onClick={() => void loginWithLine()}
              >
                <MessageCircleMore className="h-5 w-5" aria-hidden="true" />
                {isLineLoading ? t('redirecting') : t('loginWithLine')}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[#7b8983]">{t('lineOnlyDescription')}</p>
            </>
          ) : (
            <div>
              <span className="inline-flex rounded-full bg-[#e3f0eb] px-3 py-1.5 text-xs font-bold text-[#176b5a]">
                {t('loggedWithLine')}
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-[#18332d]">{t('completeRegistration')}</h2>
              <div className="mt-7 space-y-4">
                <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} className="alife-input" placeholder={t('displayName')} />
                <input value={sex} onChange={(event) => setSex(event.target.value)} className="alife-input" placeholder={t('sex')} />
                <input value={age ?? ''} onChange={(event) => setAge(event.target.value ? Number(event.target.value) : null)} className="alife-input" type="number" placeholder={t('age')} />
                <input value={email} onChange={(event) => setEmail(event.target.value)} className="alife-input" placeholder={t('email')} />
                <button
                  type="button"
                  className="min-h-12 w-full rounded-full bg-[#176b5a] px-5 py-3 font-semibold text-white shadow-[0_12px_28px_rgba(23,107,90,0.24)] transition hover:bg-[#0d4f43] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canRegister}
                  onClick={() => void register()}
                >
                  {t('completeRegistration')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 min-h-[4.25rem]" aria-live="polite">
            {message ? (
              <p role="status" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default OnboardingView
