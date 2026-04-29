import { useNavigate, useParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import { useGroupScreen } from '../hooks/useGroupScreen'

const GroupManageView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const {
    activeTab,
    setActiveTab,
    group,
    subgroups,
    pages,
    loading,
    error,
    statusMessage,
    setStatusMessage,
    summary,
    membershipStatus,
    membershipRole,
    canManageGroup,
    canCreatePage,
    canEditAllPages,
    canPublishPages,
    addSubgroup: createSubgroup,
    inviteMember: inviteMemberByPhone,
    editSubgroup: runEditSubgroup,
    deleteSubgroup: runDeleteSubgroup,
    deletePage,
    togglePageVisibility,
  } = useGroupScreen(groupId)

  return (
    <GroupScreenShell
      group={group}
      subgroups={subgroups}
      pages={pages}
      loading={loading}
      error={error}
      activeTab={activeTab}
      summary={summary}
      membershipStatus={membershipStatus}
      membershipRole={membershipRole}
      managementMode
      canManageGroup={Boolean(canManageGroup)}
      canCreatePage={Boolean(canCreatePage)}
      canEditAllPages={Boolean(canEditAllPages)}
      canPublishPages={Boolean(canPublishPages)}
      statusMessage={statusMessage}
      onActiveTabChange={setActiveTab}
      onJoin={() => undefined}
      onManage={() => undefined}
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
        navigate(`/groups/${groupId}/pages/new?from=manage`)
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
        runDeleteSubgroup(subgroupId).catch((reason) => {
          setStatusMessage(reason instanceof Error ? reason.message : 'Subgroup delete is not available yet.')
        })
      }}
      onOpenPage={(slug) => {
        navigate(`/pages/${slug}`)
      }}
      onEditPage={(slug) => {
        navigate(`/pages/${slug}`)
      }}
      onDeletePage={(pageId) => {
        deletePage(pageId).catch(() => undefined)
      }}
      onTogglePageVisibility={(page) => {
        togglePageVisibility(page).catch(() => undefined)
      }}
    />
  )
}

export default GroupManageView
