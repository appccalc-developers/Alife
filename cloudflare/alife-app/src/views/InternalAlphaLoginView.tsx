import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUiText } from '../i18n/uiText'
import { identityAccessService } from '../services/identityAccessService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'

const InternalAlphaLoginView = () => {
  const t = useUiText()
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Array<{ accountId: string; label: string }>>([])
  const [accountId, setAccountId] = useState('')
  const [passkeyBootstrapCode, setPasskeyBootstrapCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    identityAccessService.listAlphaAccounts()
      .then((items) => setAccounts(items))
      .catch(() => setError(t('alphaUnavailable')))
      .finally(() => setLoading(false))
  }, [t])

  const login = async () => {
    if (!accounts.some((account) => account.accountId === accountId)) return
    setSubmitting(true)
    setError('')
    try {
      const result = await identityAccessService.alphaLogin(accountId, passkeyBootstrapCode.trim() || undefined)
      await auth.fetchMe()
      navigate(result.returnPath || '/enter', { replace: true })
    } catch (caught) {
      const apiError = normalizeApiError(caught)
      setError(apiError.code === 'alpha_passkey_bootstrap_invalid'
        ? t('alphaPasskeyBootstrapInvalid')
        : apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-lg items-center px-4 py-8">
      <div className="w-full rounded-[2rem] border border-[#2f4b42]/10 bg-[#fffdf8]/95 p-6 shadow-[0_24px_70px_rgba(31,56,48,0.12)] sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff2ed] text-[#915040]"><FlaskConical className="h-6 w-6" /></span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-[#18332d]">{t('internalAlphaLogin')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#66766f]">{t('internalAlphaDescription')}</p>
        {loading ? <p className="mt-6 text-sm text-[#66766f]">{t('identityLoading')}</p> : accounts.length ? (
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void login() }}>
            <label className="block text-sm font-semibold text-[#314b43]">{t('configuredAccount')}<select className="alife-input mt-2" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">{t('selectConfiguredAccount')}</option>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.label}</option>)}</select></label>
            <label className="block text-sm font-semibold text-[#314b43]">
              {t('alphaPasskeyBootstrapCode')}
              <input
                className="alife-input mt-2"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={200}
                placeholder={t('alphaPasskeyBootstrapPlaceholder')}
                value={passkeyBootstrapCode}
                onChange={(event) => setPasskeyBootstrapCode(event.target.value)}
              />
            </label>
            <p className="rounded-2xl bg-[#f1f6f3] px-4 py-3 text-xs leading-5 text-[#52675f]">{t('alphaPasskeyBootstrapHelp')}</p>
            <button className="alife-primary-button w-full" type="submit" disabled={submitting || !accountId}>{submitting ? t('loggingIn') : t('login')}</button>
          </form>
        ) : <p className="mt-6 text-sm text-[#915040]">{t('alphaUnavailable')}</p>}
        {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#fff2ed] px-4 py-3 text-sm text-[#915040]">{error}</p> : null}
      </div>
    </section>
  )
}

export default InternalAlphaLoginView
