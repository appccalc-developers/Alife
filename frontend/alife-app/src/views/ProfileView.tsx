import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useAuthStore } from '../stores/auth'
import { useUiText } from '../i18n/uiText'

const ProfileView = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const me = auth.me

  if (!me) {
    return <AppEmptyState title={t('profile')} description={t('loadingIdentity')} />
  }

  return (
    <AppPageShell>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-950">{t('profile')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('profileSubtitle')}</p>
      </div>

      <AppSectionCard dense title={me.displayName || t('guest')} subtitle={me.email || me.phoneE164 || undefined}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('displayName')}</p>
            <p className="mt-1 text-sm text-slate-900">{me.displayName || t('guest')}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('email')}</p>
            <p className="mt-1 text-sm text-slate-900">{me.email || '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('phone')}</p>
            <p className="mt-1 text-sm text-slate-900">{me.phoneE164 || '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('status')}</p>
            <div className="mt-1">
              <AppBadge variant={me.isRegistered ? 'success' : 'neutral'}>
                {me.isRegistered ? t('registered') : t('guest')}
              </AppBadge>
            </div>
          </div>
        </div>
      </AppSectionCard>
    </AppPageShell>
  )
}

export default ProfileView
