import { useEffect, useMemo, useState } from 'react'
import { DoorOpen, UserPlus } from 'lucide-react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppTitleBarAction from '../components/layout/AppTitleBarAction'
import { useUiText } from '../i18n/uiText'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { GroupDto } from '../types'
import { normalizeRouteGroupId } from '../utils/groupRouteIds'
import { localizeText } from '../utils/localizedText'

const GroupJoinView = () => {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const [searchParams] = useSearchParams()
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
  const isRequested = membership?.status === 'requested'
  const isInvited = membership?.status === 'invited'
  const isRejected = membership?.status === 'rejected'
  const returnGroupId = normalizeRouteGroupId(searchParams.get('returnGroupId'))
  const canSubmit = Boolean(
    group &&
    !isApproved &&
    !isRequested &&
    !isInvited &&
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
        if (isApproved) {
          setCurrentGroup(data)
        }
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
  }, [groupId, isApproved, setCurrentGroup, t])

  const submitJoin = async () => {
    if (!group) return

    setSubmitting(true)
    setError('')
    setStatusMessage('')

    try {
      const result = await groupService.requestJoin(group.id, auth.me?.id)
      await auth.fetchMe()
      if (result.status === 'approved') {
        activeEntityService.setGroup(group.id)
        navigate('/groups?view=overview', { replace: true })
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
    return <Navigate to="/groups/select" replace />
  }

  if (loading) {
    return <AppPageShell title={t('joinGroup')} context={language === 'zh' ? '小组生活 / 加入小组' : 'Group Life / Join group'}><p className="rounded bg-white p-3">{t('loadingGroup')}</p></AppPageShell>
  }

  if (!group) {
    return (
      <AppPageShell title={t('joinGroup')} context={language === 'zh' ? '小组生活 / 加入小组' : 'Group Life / Join group'}>
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
  ) : isRejected ? (
    <AppBadge variant="danger">{t('rejected')}</AppBadge>
  ) : (
    <AppBadge>{t('notJoined')}</AppBadge>
  )

  const description =
    group.accessType === 'public'
      ? t('publicJoinDescription')
      : group.accessType === 'protected'
        ? t('protectedJoinDescription')
        : t('privateJoinDescription')
  const backPath = returnGroupId ? '/groups?view=overview' : '/groups/select'
  const primaryAction = isApproved ? (
    <AppTitleBarAction
      label={t('openGroup')}
      icon={<DoorOpen className="h-4 w-4" />}
      onClick={() => {
        activeEntityService.setGroup(group.id)
        navigate('/groups?view=overview')
      }}
    />
  ) : auth.isGuest ? (
    <AppTitleBarAction label={language === 'zh' ? '登录或注册' : 'Sign in or register'} icon={<UserPlus className="h-4 w-4" />} to="/onboarding" />
  ) : canSubmit ? (
    <AppTitleBarAction
      label={submitting ? t('submitting') : group.accessType === 'protected' ? t('submitJoinRequest') : t('confirmJoinGroup')}
      icon={<UserPlus className="h-4 w-4" />}
      disabled={submitting}
      onClick={() => void submitJoin()}
    />
  ) : undefined

  return (
    <AppPageShell
      title={localizeText(group.name, language)}
      context={language === 'zh' ? '小组生活 / 加入小组' : 'Group Life / Join group'}
      subtitle={localizeText(group.description, language) || description}
      status={<div className="flex flex-wrap items-center gap-2"><AccessTypeBadge accessType={group.accessType} showProtected />{statusBadge}</div>}
      primaryAction={primaryAction}
      backLink={{
        label: language === 'zh' ? '返回小组选择' : 'Back to group selection',
        to: backPath,
        onClick: returnGroupId ? () => activeEntityService.setGroup(returnGroupId) : undefined,
      }}
    >
      <AppSectionCard>
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm leading-6 text-slate-700">{description}</p>
          </div>

          {!auth.isRegistered ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('registrationRequiredToJoin')}
            </div>
          ) : null}

          {statusMessage ? <p className="text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        </div>
      </AppSectionCard>
    </AppPageShell>
  )
}

export default GroupJoinView
