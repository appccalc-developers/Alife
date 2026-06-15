import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useUiText } from '../i18n/uiText'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { GroupDto } from '../types'
import { localizeText } from '../utils/localizedText'

const GroupJoinView = () => {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId } = useActiveEntityIds({ groupId: routeGroupId })
  const navigate = useNavigate()
  const t = useUiText()
  const auth = useAuthStore()
  const { language } = auth
  const { setCurrentGroup } = useCurrentGroupStore()
  const [group, setGroup] = useState<GroupDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const membership = useMemo(
    () => auth.memberships.find((item) => item.groupId === groupId),
    [auth.memberships, groupId],
  )
  const isApproved = membership?.status === 'approved'
  const canSubmit = Boolean(
    group &&
    !isApproved &&
    !submitting &&
    auth.isRegistered &&
    (group.accessType !== 'private' || Boolean(group.parentGroupId)),
  )

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setLoading(true)
    setError('')

    groupService
      .getGroup(groupId)
      .then((data) => {
        if (cancelled) return
        setGroup(data)
        setCurrentGroup(data)
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t('loadGroupFailed'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [groupId, setCurrentGroup, t])

  const submitJoin = async () => {
    if (!group) return

    setSubmitting(true)
    setError('')
    setStatusMessage('')

    try {
      const result = await groupService.requestJoin(group.id)
      await auth.fetchMe()
      if (result.status === 'approved') {
        activeEntityService.setGroup(group.id)
        navigate('/groups', { replace: true })
        return
      }

      const localizedStatus =
        result.status === 'requested'
          ? t('requested')
          : result.status === 'rejected'
            ? t('rejected')
            : result.status === 'invited'
              ? t('invited')
              : result.status
      setStatusMessage(t('joinStatus', { status: localizedStatus }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('joinRequestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!groupId) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return <p className="rounded bg-white p-3">{t('loadingGroup')}</p>
  }

  if (!group) {
    return (
      <AppPageShell>
        <AppEmptyState title={t('groupNotFound')} description={error || t('groupNotFoundDescription')} />
      </AppPageShell>
    )
  }

  const description =
    group.accessType === 'public'
      ? t('publicJoinDescription')
      : group.accessType === 'protected'
        ? t('protectedJoinDescription')
        : t('privateJoinDescription')

  return (
    <AppPageShell>
      <AppSectionCard>
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{t('joinGroup')}</p>
              <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950">{localizeText(group.name, language)}</h1>
              {localizeText(group.description, language) ? <p className="mt-2 text-sm text-slate-600">{localizeText(group.description, language)}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AccessTypeBadge accessType={group.accessType} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm leading-6 text-slate-700">{description}</p>
          </div>

          {!auth.isRegistered ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('registrationRequiredToJoin')}
            </div>
          ) : null}

          {isApproved ? (
            <div className="flex flex-wrap gap-2">
              <AppActionButton
                variant="primary"
                onClick={() => {
                  activeEntityService.setGroup(group.id)
                  navigate('/groups')
                }}
              >
                {t('openGroup')}
              </AppActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AppActionButton variant="primary" disabled={!canSubmit} onClick={submitJoin}>
                {submitting
                  ? t('submitting')
                  : group.accessType === 'protected'
                    ? t('submitJoinRequest')
                    : t('confirmJoinGroup')}
              </AppActionButton>
              <AppActionButton variant="ghost" onClick={() => navigate(-1)}>
                {t('back')}
              </AppActionButton>
            </div>
          )}

          {statusMessage ? <p className="text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        </div>
      </AppSectionCard>
    </AppPageShell>
  )
}

export default GroupJoinView
