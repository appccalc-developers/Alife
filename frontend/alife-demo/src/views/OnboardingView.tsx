import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiBaseUrl, http, type ApiError } from '../api/http'
import { useAuthStore } from '../stores/auth'

const getLineLoginRedirectUrl = () => {
  return apiBaseUrl ? `${apiBaseUrl}/api/members/line/login/redirect` : '/api/members/line/login/redirect'
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as Partial<ApiError> | undefined
  return apiError?.message || fallback
}

const OnboardingView = () => {
  const auth = useAuthStore()
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
  const [isDisplayNameLoading, setIsDisplayNameLoading] = useState(false)

  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const canRegister = lineConfirmed && !isRegistering

  useEffect(() => {
    const lineLogin = searchParams.get('line_login')
    const lineError = searchParams.get('line_error')
    const lineDisplayName = searchParams.get('line_display_name')
    const lineEmail = searchParams.get('line_email')

    if (lineError) {
      setMessage(`LINE login failed: ${lineError}`)
      return
    }

    if (lineLogin === 'true') {
      if (lineDisplayName) {
        setName(lineDisplayName)
      }
      if (lineEmail) {
        setEmail(lineEmail)
      }
      setLineConfirmed(true)
      setMessage('LINE verified. Please complete your profile to finish onboarding.')
    }
  }, [searchParams])

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
      setMessage(getErrorMessage(error, 'Unable to start LINE login.'))
      setIsLineLoading(false)
    }
  }

  const loginWithDisplayName = async () => {
    if (!displayNameLogin.trim()) {
      setMessage('Please enter your display name.')
      return
    }
    setIsDisplayNameLoading(true)
    setMessage('')
    try {
      await auth.bootstrap()
      await http.post('/api/members/login/display-name', { displayName: displayNameLogin.trim() })
      await auth.fetchMe()
      navigate('/')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to login with display name.'))
    } finally {
      setIsDisplayNameLoading(false)
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
      setMessage('Registered successfully.')
      navigate('/')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to complete registration.'))
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>

      <>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded bg-green-500 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLineLoading || lineConfirmed}
          onClick={() => {
            loginWithLine().catch(() => undefined)
          }}
        >
          {lineConfirmed ? 'Logged with LINE' : isLineLoading ? 'Redirecting...' : 'Login with LINE'}
        </button>
        <p className="text-sm text-slate-600">
          LINE is the only sign-in method. Your LINE account will be used to securely authenticate and match your member profile.
        </p>
      </>

      {!lineConfirmed ? (
        <>
          <div className="flex items-center gap-2">
            <hr className="flex-1 border-slate-300" />
            <span className="text-sm text-slate-400">or</span>
            <hr className="flex-1 border-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-700">Already a member? Login with your display name:</p>
          <div className="flex gap-2">
            <input
              value={displayNameLogin}
              onChange={(event) => setDisplayNameLogin(event.target.value)}
              className="flex-1 rounded border p-2"
              placeholder="Display Name"
              disabled={isDisplayNameLoading}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loginWithDisplayName().catch(() => undefined)
                }
              }}
            />
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isDisplayNameLoading || !displayNameLogin.trim()}
              onClick={() => {
                loginWithDisplayName().catch(() => undefined)
              }}
            >
              {isDisplayNameLoading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </>
      ) : null}

      {lineConfirmed ? (
        <>
          <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded border p-2" placeholder="Display Name" />
          <input value={sex} onChange={(event) => setSex(event.target.value)} className="w-full rounded border p-2" placeholder="Sex" />
          <input
            value={age ?? ''}
            onChange={(event) => setAge(event.target.value ? Number(event.target.value) : null)}
            className="w-full rounded border p-2"
            type="number"
            placeholder="Age"
          />
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded border p-2" placeholder="Email" />
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRegister}
            onClick={() => {
              register().catch(() => undefined)
            }}
          >
            Complete Registration
          </button>
        </>
      ) : null}

      <p className="text-sm text-slate-600">{message}</p>
    </section>
  )
}

export default OnboardingView
