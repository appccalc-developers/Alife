import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http, type ApiError } from '../api/http'
import { useAuthStore } from '../stores/auth'

type PhoneActionResponse = {
  ok: boolean
  phoneE164?: string
  displayName?: string
  sex?: string
  age?: number | null
  email?: string
  isRegistered?: boolean
}

type LineLoginResponse = {
  authUrl: string
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as Partial<ApiError> | undefined
  return apiError?.message || fallback
}

const OnboardingView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [phoneInput, setPhoneInput] = useState('')
  const [canonicalPhoneE164, setCanonicalPhoneE164] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sex, setSex] = useState('Unknown')
  const [age, setAge] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [startSucceeded, setStartSucceeded] = useState(false)
  const [phoneConfirmed, setPhoneConfirmed] = useState(false)
  const [lineConfirmed, setLineConfirmed] = useState(false)
  const [existingAccountDetected, setExistingAccountDetected] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLineLoading, setIsLineLoading] = useState(false)

  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const isPhoneValid = useMemo(() => {
    const input = phoneInput.trim()
    if (!input) {
      return false
    }

    if (!/^\+?[\d\s\-()]+$/.test(input)) {
      return false
    }

    const digitCount = input.replace(/\D/g, '').length
    return digitCount >= 7 && digitCount <= 15
  }, [phoneInput])

  const canStart = isPhoneValid && !isStarting
  const canConfirm = startSucceeded && code.trim().length > 0 && !isConfirming
  const canRegister = (phoneConfirmed || lineConfirmed) && !isRegistering

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
      setMessage('LINE verified. Please complete your profile.')
    }
  }, [searchParams])

  useEffect(() => {
    if (startSucceeded) {
      codeInputRef.current?.focus()
    }
  }, [startSucceeded])

  useEffect(() => {
    if (phoneConfirmed || lineConfirmed) {
      nameInputRef.current?.focus()
    }
  }, [phoneConfirmed, lineConfirmed])

  const start = async () => {
    if (!canStart) {
      return
    }

    setIsStarting(true)
    try {
      await auth.bootstrap()
      const { data } = await http.post<PhoneActionResponse>('/api/members/phone/start', {
        phoneE164: phoneInput.trim(),
      })

      const nextCanonical = data.phoneE164 ?? phoneInput.trim()
      setCanonicalPhoneE164(nextCanonical)
      setPhoneInput(nextCanonical)
      setStartSucceeded(true)
      setPhoneConfirmed(false)
      setExistingAccountDetected(false)
      setMessage('Verification started.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to start verification.'))
    } finally {
      setIsStarting(false)
    }
  }

  const confirm = async () => {
    if (!canConfirm) {
      return
    }

    setIsConfirming(true)
    try {
      await auth.bootstrap()
      const phoneForConfirm = canonicalPhoneE164 || phoneInput.trim()
      const { data } = await http.post<PhoneActionResponse>('/api/members/phone/confirm', {
        phoneE164: phoneForConfirm,
        code: code.trim(),
      })

      const nextCanonical = data.phoneE164 ?? phoneForConfirm
      setCanonicalPhoneE164(nextCanonical)
      setPhoneInput(nextCanonical)
      setName(data.displayName ?? '')
      setSex(data.sex ?? 'Unknown')
      setAge(data.age ?? null)
      setEmail(data.email ?? '')
      setExistingAccountDetected(
        Boolean(data.isRegistered) ||
          Boolean(data.displayName) ||
          Boolean(data.sex) ||
          data.age !== undefined ||
          Boolean(data.email),
      )
      setPhoneConfirmed(true)
      setMessage('Phone verified.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to confirm code.'))
    } finally {
      setIsConfirming(false)
    }
  }

  const loginWithLine = async () => {
    setIsLineLoading(true)
    try {
      await auth.bootstrap()
      const { data } = await http.get<LineLoginResponse>('/api/members/line/login')
      window.location.href = data.authUrl
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to start LINE login.'))
      setIsLineLoading(false)
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

  const loginExisting = async () => {
    setIsRegistering(true)
    try {
      await auth.bootstrap()
      await http.post('/api/auth/login')
      await auth.fetchMe()
      setMessage('Logged in successfully.')
      navigate('/')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to login.'))
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>

      {!lineConfirmed && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded bg-green-500 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLineLoading}
            onClick={() => {
              loginWithLine().catch(() => undefined)
            }}
          >
            {isLineLoading ? 'Redirecting...' : 'Login with LINE'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">or</span>
          </div>

          <input
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            className="w-full rounded border p-2"
            placeholder="Input your number here"
          />
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canStart}
            onClick={() => {
              start().catch(() => undefined)
            }}
          >
            Start Verification
          </button>

          {startSucceeded ? (
            <>
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-full rounded border p-2"
                placeholder="6 digit code"
              />
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-white"
                onClick={() => {
                  confirm().catch(() => undefined)
                }}
              >
                Confirm
              </button>
            </>
          ) : null}

        </>
      )}

      {(phoneConfirmed || lineConfirmed) ? (
        <>
          <p className={`rounded px-3 py-2 text-sm font-medium ${existingAccountDetected ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
            {existingAccountDetected ? 'Existing account' : 'New account'}
          </p>
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
              if (existingAccountDetected) {
                loginExisting().catch(() => undefined)
                return
              }

              register().catch(() => undefined)
            }}
          >
            {existingAccountDetected ? 'Login' : 'Complete Registration'}
          </button>
        </>
      ) : null}

      <p className="text-sm text-slate-600">{message}</p>
    </section>
  )
}

export default OnboardingView
