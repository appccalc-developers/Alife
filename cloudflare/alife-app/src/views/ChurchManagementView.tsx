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
        group: isChinese ? '资料与设置' : 'Profile & settings',
        venues: isChinese ? '场地与房间管理' : 'Venues & rooms',
        members: isChinese ? '成员管理' : 'Member management',
        contacts: isChinese ? '联系人' : 'Contacts',
        subgroups: isChinese ? '团契' : 'Fellowships',
        ministries: isChinese ? '事工' : 'Ministries',
      }}
      membersContent={auth.hasAdminPermission('admin.members.view')
        ? <AdminView embedded sectionOverride="users" />
        : undefined}
      workspaceEyebrow={(
        <>
          <span className="desktop:hidden">{isChinese ? '教会生活 / 管理' : 'Church / Management'}</span>
          <span className="hidden desktop:inline">{isChinese ? '教会生活 / 教会管理' : 'Church Life / Church Management'}</span>
        </>
      )}
      workspaceDescription={isChinese
        ? '在同一页面维护教会资料、场地与房间、成员、联系人、团契与事工。'
        : 'Manage church profile, venues and rooms, members, contacts, fellowships, and ministries in one place.'}
      subgroupDetailBasePath={auth.isAdmin ? '/admin/groups' : undefined}
    />
  )
}

export default ChurchManagementView
