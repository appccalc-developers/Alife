import { churchManagementViewText } from '../i18n/churchManagementView.ts'
import { useAuthStore } from '../stores/auth'
import { churchManagementTabs } from '../utils/groupManagementSections'
import AdminView from './AdminView'
import GroupManageView from './GroupManageView'

const ChurchManagementView = ({ churchGroupId }: { churchGroupId: string }) => {
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'

  return (
    <GroupManageView
      embeddedWorkspace
      explicitGroupId={churchGroupId}
      workspaceBasePath="/church/manage"
      sectionParamName="section"
      visibleSections={churchManagementTabs}
      sectionLabels={{
        group: isChinese ? churchManagementViewText.profileSettings.zh : churchManagementViewText.profileSettings.en,
        venues: isChinese ? churchManagementViewText.venuesRooms.zh : churchManagementViewText.venuesRooms.en,
        members: isChinese ? churchManagementViewText.memberManagement.zh : churchManagementViewText.memberManagement.en,
        contacts: isChinese ? churchManagementViewText.contacts.zh : churchManagementViewText.contacts.en,
        subgroups: isChinese ? churchManagementViewText.fellowships.zh : churchManagementViewText.fellowships.en,
        ministries: isChinese ? churchManagementViewText.ministries.zh : churchManagementViewText.ministries.en,
      }}
      membersContent={auth.hasAdminPermission('admin.members.view')
        ? <AdminView embedded sectionOverride="users" />
        : undefined}
      workspaceEyebrow={(
        <>
          <span className="desktop:hidden">{isChinese ? churchManagementViewText.churchManagement.zh : churchManagementViewText.churchManagement.en}</span>
          <span className="hidden desktop:inline">{isChinese ? churchManagementViewText.churchLifeChurchManagement.zh : churchManagementViewText.churchLifeChurchManagement.en}</span>
        </>
      )}
      workspaceDescription={isChinese
        ? churchManagementViewText.manageChurchProfileVenuesAndRoomsMembersContactsFellowships.zh
        : churchManagementViewText.manageChurchProfileVenuesAndRoomsMembersContactsFellowships.en}
      subgroupDetailBasePath={auth.isAdmin ? '/admin/groups' : undefined}
    />
  )
}

export default ChurchManagementView
