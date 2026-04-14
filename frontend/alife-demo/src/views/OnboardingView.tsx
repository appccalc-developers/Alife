import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as Partial<ApiError> | undefined
  if (apiError?.status === 401) {
    return 'Session is not ready. Guest sign-in failed; please try again shortly.'
  }

  return apiError?.message || fallback
}

const OnboardingView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()

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
  const [existingPhoneDetected, setExistingPhoneDetected] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

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
  const canRegister = phoneConfirmed && !isRegistering

  useEffect(() => {
    if (startSucceeded) {
      codeInputRef.current?.focus()
    }
  }, [startSucceeded])

  useEffect(() => {
    if (phoneConfirmed) {
      nameInputRef.current?.focus()
    }
  }, [phoneConfirmed])

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
      setExistingPhoneDetected(false)
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
      setExistingPhoneDetected(
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

      {phoneConfirmed ? (
        <>
          <p className={`rounded px-3 py-2 text-sm font-medium ${existingPhoneDetected ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
            {existingPhoneDetected ? 'Existing account' : 'New account'}
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
              register().catch(() => undefined)
            }}
          >
            {existingPhoneDetected ? 'Login' : 'Complete Registration'}
          </button>
        </>
      ) : null}

      <p className="text-sm text-slate-600">{message}</p>
    </section>
  )
}

export default OnboardingView
