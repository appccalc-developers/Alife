import { useLayoutEffect, useState } from 'react'
import { KeyRound, QrCode, ShieldAlert } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useUiText } from '../i18n/uiText'
import { identityAccessService } from '../services/identityAccessService'
import { normalizeApiError } from '../services/http'

const IdentityLinkEntryView = () => {
  const t = useUiText()
  const location = useLocation()
  const navigate = useNavigate()
  const { selector = '' } = useParams()
  const kind = location.pathname.startsWith('/activate/')
    ? 'activation'
    : location.pathname.startsWith('/join/')
      ? 'groupJoin'
      : 'applicationResponse'
  const [secret] = useState(() => window.location.hash.slice(1))
  const [publicDevice, setPublicDevice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    const cleanUrl = `/onboarding?intent=${kind}&link=ready`
    window.history.replaceState(window.history.state, '', cleanUrl)
  }, [kind])

  const continueFlow = async () => {
    if (!selector || !secret) {
      setError(t('identityLinkInvalid'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (kind === 'activation') {
        await identityAccessService.resolveActivation(selector, secret, publicDevice)
      } else if (kind === 'groupJoin') {
        await identityAccessService.resolveGroupInvite(selector, secret, publicDevice)
      } else {
        await identityAccessService.resolveApplicationResponse(selector, secret)
      }
      navigate(`/onboarding?intent=${kind}`, { replace: true })
    } catch (caught) {
      setError(normalizeApiError(caught).message || t('identityLinkInvalid'))
    } finally {
      setBusy(false)
    }
  }

  const Icon = kind === 'groupJoin' ? QrCode : kind === 'activation' ? KeyRound : ShieldAlert
  const title = kind === 'groupJoin' ? t('groupApplicationTitle', { group: t('group') }) : kind === 'activation' ? t('activationTitle') : t('applicationResponseTitle')
  const description = kind === 'groupJoin' ? t('groupApplicationDescription') : kind === 'activation' ? t('activationDescription') : t('applicationResponseDescription')

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-xl items-center px-4 py-8">
      <div className="w-full rounded-[2rem] border border-[#2f4b42]/10 bg-[#fffdf8]/95 p-6 shadow-[0_24px_70px_rgba(31,56,48,0.12)] sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-[#18332d]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#66766f]">{description}</p>
        {kind !== 'applicationResponse' ? (
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#2f4b42]/10 bg-[#f5f2eb] p-4">
            <input className="mt-1 h-4 w-4 accent-[#176b5a]" type="checkbox" checked={publicDevice} onChange={(event) => setPublicDevice(event.target.checked)} />
            <span><strong className="block text-sm text-[#18332d]">{t('publicDevice')}</strong><span className="mt-1 block text-xs leading-5 text-[#66766f]">{t('publicDeviceHint')}</span></span>
          </label>
        ) : null}
        <button className="alife-primary-button mt-6 w-full" type="button" disabled={busy} onClick={() => void continueFlow()}>
          {busy ? t('identityLoading') : t('continueSecurely')}
        </button>
        {error ? <p role="alert" className="mt-4 rounded-2xl border border-[#e37b63]/25 bg-[#fff2ed] px-4 py-3 text-sm text-[#915040]">{error}</p> : null}
      </div>
    </section>
  )
}

export default IdentityLinkEntryView
