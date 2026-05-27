import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { groupService, type MemberSummaryDto } from '../services/groupService'
import { useUiText } from '../i18n/uiText'

const InviteMembersView = () => {
  const t = useUiText()
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { memberships, inviteMemberById } = useGroupScreen(groupId)

  const [allMembers, setAllMembers] = useState<MemberSummaryDto[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadingMembers(true)
    groupService.getMembers()
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
  }, [t])

  const existingMemberIds = new Set(memberships.map((m) => m.memberId))

  const handleToggle = (memberId: string) => {
    if (existingMemberIds.has(memberId)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    const toInvite = [...selected].filter((id) => !existingMemberIds.has(id))
    if (toInvite.length === 0) {
      navigate(`/groups/${groupId}/manage?section=members`, { replace: true })
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await Promise.all(toInvite.map((id) => inviteMemberById(id)))
      navigate(`/groups/${groupId}/manage?section=members`, { replace: true })
    } catch {
      setSubmitError(t('inviteSentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppPageShell>
      <div className="mb-5">
        <button
          type="button"
          onClick={() => navigate(`/groups/${groupId}/manage?section=members`, { replace: true })}
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
              const isExisting = existingMemberIds.has(member.id)
              const isChecked = isExisting || selected.has(member.id)
              const label = member.displayName || t('unknownMember')
              return (
                <label
                  key={member.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    isExisting
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                      : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isExisting}
                    onChange={() => handleToggle(member.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 disabled:cursor-not-allowed"
                  />
                  <span className="flex-1 text-sm font-medium text-slate-900">{label}</span>
                  {isExisting && (
                    <span className="text-xs text-slate-400">{t('alreadyInGroup')}</span>
                  )}
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
            onClick={() => navigate(`/groups/${groupId}/manage?section=members`, { replace: true })}
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
