import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { groupService } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useLeaderUiPreferences } from '../stores/leaderUiPreferences'
import { useUiText } from '../i18n/uiText'
import { localizeText } from '../utils/localizedText'

const ProfileView = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const navigate = useNavigate()
  const me = auth.me
  const { preferences: leaderUiPreferences, setPreferences: setLeaderUiPreferences } = useLeaderUiPreferences(me?.id)
  const [draftLanguage, setDraftLanguage] = useState(auth.language)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [languageError, setLanguageError] = useState('')
  const [languageSaved, setLanguageSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [inviteActionGroupId, setInviteActionGroupId] = useState('')
  const [inviteError, setInviteError] = useState('')

  const invitations = me?.memberships.filter((membership) => membership.status === 'invited') ?? []

  useEffect(() => {
    setDraftLanguage(auth.language)
  }, [auth.language])

  const saveLanguage = async () => {
    setSavingLanguage(true)
    setLanguageError('')
    setLanguageSaved(false)

    try {
      await auth.updateLanguage(draftLanguage)
      setLanguageSaved(true)
    } catch (error) {
      setLanguageError(normalizeApiError(error).message)
    } finally {
      setSavingLanguage(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')

    try {
      await auth.logout()
      navigate('/onboarding', { replace: true })
    } catch (error) {
      setLogoutError(normalizeApiError(error).message)
    } finally {
      setLoggingOut(false)
    }
  }

  const respondToInvite = async (groupId: string, accept: boolean) => {
    setInviteActionGroupId(groupId)
    setInviteError('')

    try {
      if (accept) {
        await groupService.acceptInvite(groupId)
      } else {
        await groupService.declineInvite(groupId)
      }
      await auth.fetchMe()
    } catch (error) {
      setInviteError(normalizeApiError(error).message)
    } finally {
      setInviteActionGroupId('')
    }
  }

  if (!me) {
    return <AppEmptyState title={t('profile')} description={t('loadingIdentity')} />
  }

  const hasLeaderUiOptions = me.memberships.some(
    (membership) =>
      membership.status === 'approved' &&
      (membership.role === 'leader' || membership.role === 'coLeader'),
  )

  return (
    <AppPageShell>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-950">{t('profile')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('profileSubtitle')}</p>
      </div>

      <AppSectionCard dense title={me.displayName || t('profile')} subtitle={me.email || me.phoneE164 || undefined}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('displayName')}</p>
            <p className="mt-1 text-sm text-slate-900">{me.displayName || '-'}</p>
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

      {invitations.length > 0 ? (
        <div className="mt-4">
          <AppSectionCard dense title={t('groupInvitations')} subtitle={t('groupInvitationsSubtitle')}>
            <div className="space-y-2">
              {invitations.map((membership) => {
                const groupName = localizeText(membership.groupName, auth.language) || t('group')
                const isBusy = inviteActionGroupId === membership.groupId
                return (
                  <div key={membership.groupId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-950">{groupName}</p>
                      <p className="mt-1 text-xs text-slate-500">{t('invited')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AppActionButton size="sm" variant="primary" disabled={isBusy} onClick={() => void respondToInvite(membership.groupId, true)}>
                        {isBusy ? t('saving') : t('acceptInvite')}
                      </AppActionButton>
                      <AppActionButton size="sm" variant="danger" disabled={isBusy} onClick={() => void respondToInvite(membership.groupId, false)}>
                        {t('declineInvite')}
                      </AppActionButton>
                    </div>
                  </div>
                )
              })}
              {inviteError ? <p className="text-sm text-rose-600">{inviteError}</p> : null}
      {hasLeaderUiOptions ? (
        <div className="mt-4">
          <AppSectionCard dense title={t('profileLeaderUiTitle')} subtitle={t('profileLeaderUiSubtitle')}>
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                  checked={leaderUiPreferences.exerciseGroupManagement}
                  onChange={(event) =>
                    setLeaderUiPreferences((current) => ({
                      ...current,
                      exerciseGroupManagement: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{t('exerciseGroupManagement')}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{t('exerciseGroupManagementHelp')}</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                  checked={leaderUiPreferences.exercisePageEditing}
                  onChange={(event) =>
                    setLeaderUiPreferences((current) => ({
                      ...current,
                      exercisePageEditing: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{t('exercisePageEditing')}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{t('exercisePageEditingHelp')}</span>
                </span>
              </label>
            </div>
          </AppSectionCard>
        </div>
      ) : null}

      <div className="mt-4">
        <AppSectionCard
          dense
          title={t('language')}
          subtitle={t('profileLanguageSubtitle')}
          action={
            <AppActionButton variant="primary" disabled={savingLanguage || draftLanguage === auth.language} onClick={() => void saveLanguage()}>
              {savingLanguage ? t('saving') : t('saveChanges')}
            </AppActionButton>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="profile-language">
              {t('language')}
            </label>
            <select
              id="profile-language"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={draftLanguage}
              disabled={savingLanguage}
              onChange={(event) => {
                setDraftLanguage(event.target.value === 'en' ? 'en' : 'zh')
                setLanguageError('')
                setLanguageSaved(false)
              }}
            >
              <option value="zh">{t('chinese')}</option>
              <option value="en">{t('english')}</option>
            </select>
            {languageSaved ? <p className="text-sm text-emerald-600">{t('profileLanguageSaved')}</p> : null}
            {languageError ? <p className="text-sm text-rose-600">{languageError}</p> : null}
          </div>
        </AppSectionCard>
      </div>

      <div className="mt-4">
        <AppSectionCard dense title={t('logout')}>
          <div className="space-y-3">
            <AppActionButton variant="danger" disabled={loggingOut} onClick={() => void handleLogout()}>
              {loggingOut ? t('loggingOut') : t('logout')}
            </AppActionButton>
            {logoutError ? <p className="text-sm text-rose-600">{logoutError}</p> : null}
          </div>
        </AppSectionCard>
      </div>
    </AppPageShell>
  )
}

export default ProfileView
