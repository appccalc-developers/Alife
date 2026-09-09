import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'

// A missing session is not proof that this phone has no passkey.
export default function ChurchApplicationGate({ children, busy, onSignIn, onRecovery }: {
  children: ReactNode; busy: boolean; onSignIn: () => void; onRecovery: () => void
}) {
  const { fetchMe } = useAuthStore()
  const t = useUiText()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'checking' | 'failed' | 'existing' | 'unknown'>('checking')
  const [firstApplication, setFirstApplication] = useState(false)
  useEffect(() => {
    let active = true
    setState('checking')
    void fetchMe().then(profile => {
      if (active) setState(!profile.isGuest ? 'existing' : 'unknown')
    }).catch(() => { if (active) setState('failed') })
    return () => { active = false }
  }, [fetchMe, attempt])
  if (state === 'checking') return <p role="status" className="mt-6">{t('identityLoading')}</p>
  if (state === 'failed') return <div className="mt-6 space-y-4">
    <p role="alert">{t('applicationCheckFailed')}</p>
    <button type="button" className="alife-secondary-button w-full" onClick={() => setAttempt(value => value + 1)}>{t('applicationCheck')}</button>
  </div>
  if (state === 'existing') return <div className="mt-6 space-y-4">
    <p>{t('churchApplicationExistingSession')}</p>
    <button type="button" className="alife-primary-button w-full" onClick={() => navigate('/enter', { replace: true })}>{t('enterMyAlife')}</button>
  </div>
  if (firstApplication) return <>{children}</>
  return <section className="mt-6 space-y-4">
    <p className="rounded-xl bg-[#e3f0eb] p-4 text-sm leading-6 text-[#314b43]">{t('churchApplicationCheckAccount')}</p>
    <button type="button" className="alife-primary-button w-full" disabled={busy} onClick={onSignIn}>{t('usePasskey')}</button>
    <button type="button" className="alife-secondary-button w-full" disabled={busy} onClick={onRecovery}>{t('churchApplicationExistingHelp')}</button>
    <p className="text-sm leading-6 text-[#66766f]">{t('churchApplicationFirstTimeHint')}</p>
    <button type="button" className="alife-secondary-button w-full" disabled={busy} onClick={() => setFirstApplication(true)}>{t('churchApplicationFirstTimeConfirm')}</button>
  </section>
}
