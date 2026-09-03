import { useAuthStore } from '../stores/auth'
import AdminView from './AdminView'
import GroupManageView from './GroupManageView'

const churchManagementSections = ['group', 'members', 'contacts', 'subgroups'] as const

const ChurchManagementView = ({ churchGroupId }: { churchGroupId: string }) => {
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'

  return (
    <GroupManageView
      embeddedWorkspace
      explicitGroupId={churchGroupId}
      workspaceBasePath="/church/manage"
      sectionParamName="section"
      visibleSections={churchManagementSections}
      sectionLabels={{
        group: isChinese ? '资料与设置' : 'Profile & settings',
        members: isChinese ? '成员管理' : 'Member management',
        contacts: isChinese ? '联系人' : 'Contacts',
        subgroups: isChinese ? '组织架构' : 'Organization',
      }}
      membersContent={auth.hasAdminPermission('admin.members.view')
        ? <AdminView embedded sectionOverride="users" />
        : undefined}
      workspaceEyebrow={isChinese ? '教会管理' : 'Church Management'}
      workspaceDescription={isChinese
        ? '在同一页面维护教会资料、成员、联系人和组织架构。'
        : 'Manage church profile, members, contacts, and organization in one place.'}
      subgroupDetailBasePath={auth.isAdmin ? '/admin/groups' : undefined}
    />
  )
}

export default ChurchManagementView
