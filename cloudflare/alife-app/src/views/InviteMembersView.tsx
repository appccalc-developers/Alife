import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { groupService, type MemberSummaryDto } from '../services/groupService'
import { useUiText } from '../i18n/uiText'
import type { MembershipStatus } from '../types'

const canInviteWithStatus = (status?: MembershipStatus | null) => !status || status === 'rejected' || status === 'removed'

const InviteMembersView = () => {
  const t = useUiText()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const navigate = useNavigate()
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
    if (toInvite.length === 0) {
      navigate('/groups/manage?section=members', { replace: true })
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await Promise.all(toInvite.map((id) => inviteMemberById(id)))
      navigate('/groups/manage?section=members', { replace: true })
    } catch {
      setSubmitError(t('inviteSentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    !groupId ? <Navigate to="/groups/select" replace /> :
    group?.isChurch ? <Navigate to="/admin?church=members" replace /> :
    <AppPageShell>
      <div className="mb-5">
        <button
          type="button"
          onClick={() => navigate('/groups/manage?section=members', { replace: true })}
          className="text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          {t('backToGroup')}
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{t('inviteMembersTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('inviteMembersSubtitle')}</p>
      </div>

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

        <div className="mt-5 flex gap-3">
          <AppActionButton
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || loadingMembers || !!loadError}
          >
            {submitting ? t('sending') : t('sendInvites')}
          </AppActionButton>
          <AppActionButton
            variant="secondary"
            onClick={() => navigate('/groups/manage?section=members', { replace: true })}
            disabled={submitting}
          >
            {t('cancel')}
          </AppActionButton>
        </div>
      </AppSectionCard>
    </AppPageShell>
  )
}

export default InviteMembersView
