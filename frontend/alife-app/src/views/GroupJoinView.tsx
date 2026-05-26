import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useUiText } from '../i18n/uiText'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { GroupDto } from '../types'

const GroupJoinView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const t = useUiText()
  const auth = useAuthStore()
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
  const isRequested = membership?.status === 'requested'
  const isInvited = membership?.status === 'invited'
  const canSubmit = Boolean(group && group.accessType !== 'private' && !isApproved && !submitting && auth.isRegistered)

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
        navigate(`/groups/${group.id}`, { replace: true })
        return
      }

      setStatusMessage(t('joinRequestSubmitted'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('joinRequestFailed'))
    } finally {
      setSubmitting(false)
    }
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

  const statusBadge = isApproved ? (
    <AppBadge variant="success">{t('approved')}</AppBadge>
  ) : isRequested ? (
    <AppBadge variant="warning">{t('requested')}</AppBadge>
  ) : isInvited ? (
    <AppBadge variant="info">{t('invited')}</AppBadge>
  ) : (
    <AppBadge>{t('notJoined')}</AppBadge>
  )

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
              <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950">{group.name}</h1>
              {group.description ? <p className="mt-2 text-sm text-slate-600">{group.description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AccessTypeBadge accessType={group.accessType} />
              {statusBadge}
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
              <AppActionButton variant="primary" onClick={() => navigate(`/groups/${group.id}`)}>
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
