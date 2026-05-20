import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import EnrollmentChatDialog from '../components/group/EnrollmentChatDialog'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'

const GroupDetailView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setCurrentGroup } = useCurrentGroupStore()
  const { language, me } = useAuthStore()
  const [enrollingEventId, setEnrollingEventId] = useState('')

  const {
    activeTab,
    group,
    subgroups,
    pages,
    memberships,
    events,
    loading,
    error,
    statusMessage,
    setStatusMessage,
    membershipStatus,
    membershipRole,
    canManageGroup,
    canCreatePage,
    canEditAllPages,
    canPublishPages,
    joinOrRequest,
    addSubgroup: createSubgroup,
    inviteMember: inviteMemberByPhone,
    editSubgroup: runEditSubgroup,
    deleteSubgroup: runDeleteSubgroup,
    deletePage,
    togglePageVisibility,
    refreshPages,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    deleteEvent,
  } = useGroupScreen(groupId)

  const enrollingEvent = useMemo(
    () => events.find((event) => event.id === enrollingEventId) ?? null,
    [enrollingEventId, events],
  )

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  return (
    <>
      <GroupScreenShell
        group={group}
        subgroups={subgroups}
        pages={pages}
        memberships={memberships}
        events={events}
        loading={loading}
        error={error}
        activeTab={activeTab}
        membershipStatus={membershipStatus}
        membershipRole={membershipRole}
        canManageGroup={Boolean(canManageGroup)}
        canCreatePage={Boolean(canCreatePage)}
        canEditAllPages={Boolean(canEditAllPages)}
        canPublishPages={Boolean(canPublishPages)}
        contentMode="pages"
        selectedPageId={searchParams.get('page') ?? ''}
        statusMessage={statusMessage}
        onJoin={() => {
          joinOrRequest().catch(() => undefined)
        }}
        onAddSubgroup={() => {
          const subgroupName = window.prompt('Subgroup name')
          if (!subgroupName?.trim()) {
            return
          }

          createSubgroup(subgroupName.trim(), 'Protected').catch(() => {
            setStatusMessage('Failed to add subgroup.')
          })
        }}
        onAddPage={() => {
          navigate(`/groups/${groupId}/pages/new`)
        }}
        onInviteMember={() => {
          const phone = window.prompt('Invite member by phone (E.164), e.g. +10000000008')
          if (!phone?.trim()) {
            return
          }

          inviteMemberByPhone(phone.trim()).catch(() => {
            setStatusMessage('Failed to send invite.')
          })
        }}
        onOpenSubgroup={(subgroupId) => {
          navigate(`/groups/${subgroupId}`)
        }}
        onEditSubgroup={(subgroupId) => {
          runEditSubgroup(subgroupId).catch((reason) => {
            setStatusMessage(reason instanceof Error ? reason.message : 'Subgroup edit is not available yet.')
          })
        }}
        onDeleteSubgroup={(subgroupId) => {
          if (!window.confirm('Remove this subgroup?')) {
            return
          }

          runDeleteSubgroup(subgroupId).catch((reason) => {
            setStatusMessage(reason instanceof Error ? reason.message : 'Subgroup delete is not available yet.')
          })
        }}
        onDeletePage={(pageId) => {
          if (!window.confirm('Remove this page?')) {
            return
          }

          deletePage(pageId).catch(() => {
            setStatusMessage('Failed to remove page.')
          })
        }}
        onTogglePageVisibility={(page) => {
          togglePageVisibility(page).catch(() => {
            setStatusMessage('Failed to update page visibility.')
          })
        }}
        onPageSaved={() => {
          refreshPages().catch(() => undefined)
        }}
        onApproveMember={(memberId) => {
          approveMember(memberId).catch(() => {
            setStatusMessage('Failed to approve member.')
          })
        }}
        onRejectMember={(memberId) => {
          rejectMember(memberId).catch(() => {
            setStatusMessage('Failed to reject member.')
          })
        }}
        onKickMember={(memberId) => {
          if (!window.confirm('Remove this member from the group?')) {
            return
          }

          kickMember(memberId).catch(() => {
            setStatusMessage('Failed to remove member.')
          })
        }}
        onSetCoLeader={(memberId, isCoLeader) => {
          setCoLeader(memberId, isCoLeader).catch(() => {
            setStatusMessage('Failed to update co-leader.')
          })
        }}
        onDeleteEvent={(eventId) => {
          if (!window.confirm('Delete this event?')) {
            return
          }

          deleteEvent(eventId).catch(() => {
            setStatusMessage('Failed to delete event.')
          })
        }}
        onOpenEnrollDialog={(eventId) => {
          setEnrollingEventId(eventId)
        }}
      />
      {enrollingEvent ? (
        <EnrollmentChatDialog
          open
          groupId={groupId}
          event={enrollingEvent}
          memberId={me?.id}
          language={language}
          onClose={() => setEnrollingEventId('')}
          onSuccess={(message) => setStatusMessage(message)}
        />
      ) : null}
    </>
  )
}

export default GroupDetailView
