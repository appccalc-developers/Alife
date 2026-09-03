import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppTitleBarAction from '../components/layout/AppTitleBarAction'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { groupService, type MemberSummaryDto } from '../services/groupService'
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import type { MembershipStatus } from '../types'
import { localizeText } from '../utils/localizedText'

const canInviteWithStatus = (status?: MembershipStatus | null) => !status || status === 'rejected' || status === 'removed'

const InviteMembersView = () => {
  const t = useUiText()
  const { language } = useAuthStore()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const navigate = useNavigate()
  const manageMembersPath = routeGroupId
    ? `/groups/${encodeURIComponent(routeGroupId)}/manage?section=members`
    : '/groups/manage?section=members'
  const { group, inviteMemberById } = useGroupScreen(groupId)

  const [allMembers, setAllMembers] = useState<MemberSummaryDto[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!groupId || group?.isChurch) {
      return
    }

    let cancelled = false
    setLoadingMembers(true)
    setLoadError('')
    groupService.getInviteCandidates(groupId)
      .then((members) => {
        if (!cancelled) setAllMembers(members)
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('loadMembersFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false)
      })
    return () => { cancelled = true }
  }, [group?.isChurch, groupId, t])

  const getInviteStatusLabel = (status?: MembershipStatus | null) => {
    if (status === 'invited') return t('waitingResponse')
    if (status === 'requested') return t('waitingApproval')
    if (status === 'approved') return t('alreadyInGroup')
    if (status === 'rejected') return t('rejected')
    if (status === 'removed') return t('removed')
    return t('canInvite')
  }

  const getInviteStatusVariant = (status?: MembershipStatus | null) => {
    if (status === 'approved') return 'success'
    if (status === 'requested') return 'warning'
    if (status === 'invited') return 'info'
    if (status === 'rejected' || status === 'removed') return 'danger'
    return 'neutral'
  }

  const handleToggle = (member: MemberSummaryDto) => {
    if (!canInviteWithStatus(member.membershipStatus)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(member.id)) {
        next.delete(member.id)
      } else {
        next.add(member.id)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    const inviteableMemberIds = new Set(allMembers.filter((member) => canInviteWithStatus(member.membershipStatus)).map((member) => member.id))
    const toInvite = [...selected].filter((id) => inviteableMemberIds.has(id))
    if (toInvite.length === 0) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await Promise.all(toInvite.map((id) => inviteMemberById(id)))
      navigate(manageMembersPath, { replace: true })
    } catch {
      setSubmitError(t('inviteSentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    !groupId ? <Navigate to="/groups/select" replace /> :
    group?.isChurch ? <Navigate to="/church/manage?section=members" replace /> :
    <AppPageShell
      title={t('inviteMembersTitle')}
      context={language === 'zh'
        ? `${group ? localizeText(group.name, language) : t('group')} / 成员管理`
        : `${group ? localizeText(group.name, language) : t('group')} / Member management`}
      subtitle={t('inviteMembersSubtitle')}
      status={<AppBadge variant={selected.size ? 'info' : 'neutral'}>{language === 'zh' ? `已选 ${selected.size} 人` : `${selected.size} selected`}</AppBadge>}
      backLink={{ label: t('backToGroup'), to: manageMembersPath }}
      primaryAction={(
        <AppTitleBarAction
          label={submitting ? t('sending') : t('sendInvites')}
          icon={<Send className="h-4 w-4" />}
          onClick={() => void handleSubmit()}
          disabled={submitting || loadingMembers || Boolean(loadError) || selected.size === 0}
        />
      )}
    >
      <AppSectionCard dense>
        {loadingMembers ? (
          <p className="text-sm text-slate-600">{t('loadingMembers')}</p>
        ) : loadError ? (
          <p className="text-sm text-rose-700">{loadError}</p>
        ) : allMembers.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noMembersAvailable')}</p>
        ) : (
          <div className="space-y-1">
            {allMembers.map((member) => {
              const canInvite = canInviteWithStatus(member.membershipStatus)
              const isChecked = selected.has(member.id)
              const label = member.displayName || t('unknownMember')
              return (
                <label
                  key={member.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    !canInvite
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                      : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canInvite}
                    onChange={() => handleToggle(member)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 disabled:cursor-not-allowed"
                  />
                  <span className="flex-1 text-sm font-medium text-slate-900">{label}</span>
                  <AppBadge variant={getInviteStatusVariant(member.membershipStatus)}>
                    {getInviteStatusLabel(member.membershipStatus)}
                  </AppBadge>
                </label>
              )
            })}
          </div>
        )}

        {submitError ? (
          <p className="mt-3 text-sm text-rose-700">{submitError}</p>
        ) : null}

      </AppSectionCard>
    </AppPageShell>
  )
}

export default InviteMembersView
