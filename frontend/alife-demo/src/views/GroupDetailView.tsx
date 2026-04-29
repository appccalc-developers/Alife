import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import GroupToolsDrawer from '../components/group/GroupToolsDrawer'
import PageList from '../components/group/PageList'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useNavigationDrawer } from '../components/layout/NavigationDrawerContext'
import { useGroupScreen } from '../hooks/useGroupScreen'

const GroupDetailView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { setDrawer, closeDrawer } = useNavigationDrawer()

  const {
    group,
    subgroups,
    pages,
    memberships,
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
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    closeGroup,
  } = useGroupScreen(groupId)

  const drawerContent = useMemo(
    () => (
      <GroupToolsDrawer
        group={group}
        subgroups={subgroups}
        pages={pages}
        memberships={memberships}
        membershipStatus={membershipStatus}
        membershipRole={membershipRole}
        canManageGroup={Boolean(canManageGroup)}
        canCreatePage={Boolean(canCreatePage)}
        canEditAllPages={Boolean(canEditAllPages)}
        canPublishPages={Boolean(canPublishPages)}
        statusMessage={statusMessage}
        onJoin={() => {
          joinOrRequest().catch(() => undefined)
        }}
        onManage={() => {
          closeDrawer()
          navigate(`/groups/${groupId}/manage`)
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
        onCloseGroup={() => {
          if (!window.confirm('Deactivate this group?')) {
            return
          }

          closeGroup().catch(() => {
            setStatusMessage('Failed to deactivate group.')
          })
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
          closeDrawer()
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
        onAddPage={() => {
          closeDrawer()
          navigate(`/groups/${groupId}/pages/new`)
        }}
        onOpenPage={(slug) => {
          closeDrawer()
          navigate(`/pages/${slug}`)
        }}
        onEditPage={(pageId) => {
          closeDrawer()
          navigate(`/pages/${pageId}/edit?groupId=${groupId}`)
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
          if (!window.confirm('Kick this member from the group?')) {
            return
          }

          kickMember(memberId).catch(() => {
            setStatusMessage('Failed to kick member.')
          })
        }}
        onSetCoLeader={(memberId, isCoLeader) => {
          setCoLeader(memberId, isCoLeader).catch(() => {
            setStatusMessage('Failed to update co-leader.')
          })
        }}
      />
    ),
    [
      approveMember,
      canCreatePage,
      canEditAllPages,
      canManageGroup,
      canPublishPages,
      closeDrawer,
      closeGroup,
      createSubgroup,
      deletePage,
      group,
      groupId,
      inviteMemberByPhone,
      joinOrRequest,
      kickMember,
      memberships,
      membershipRole,
      membershipStatus,
      navigate,
      pages,
      rejectMember,
      runDeleteSubgroup,
      runEditSubgroup,
      setCoLeader,
      setStatusMessage,
      statusMessage,
      subgroups,
      togglePageVisibility,
    ],
  )

  useEffect(() => {
    setDrawer({
      title: group ? 'Group Tools' : 'Group',
      content: drawerContent,
    })
  }, [drawerContent, group, setDrawer])

  useEffect(
    () => () => {
      closeDrawer()
      setDrawer({})
    },
    [closeDrawer, setDrawer],
  )

  return (
    <AppPageShell
      title={group?.name || 'Group Pages'}
      subtitle={group?.description || 'Pages shared with this group.'}
    >
      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">Loading group...</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && group ? (
        <>
          <PageList
            items={pages}
            canManage={false}
            canPublish={false}
            showCreateAction={false}
            onCreate={() => undefined}
            onOpen={(slug) => {
              navigate(`/pages/${slug}`)
            }}
            onEdit={() => undefined}
            onDelete={() => undefined}
            onToggleVisibility={() => undefined}
          />

          {statusMessage ? (
            <AppSectionCard dense>
              <p className="text-sm text-slate-600">{statusMessage}</p>
            </AppSectionCard>
          ) : null}
        </>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState
          title="Group not found"
          description="Try returning to the group list and selecting a different group."
        />
      ) : null}
    </AppPageShell>
  )
}

export default GroupDetailView
