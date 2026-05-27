import type { ReactNode } from 'react'
import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import AccessTypeBadge from './AccessTypeBadge'
import MembershipStatusBadge from './MembershipStatusBadge'
import type { GroupDto } from '../../types/group'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'

type Props = {
  group: GroupDto
  membershipStatus: 'Not joined' | 'requested' | 'approved' | 'invited'
  membershipRole: 'member' | 'coLeader' | 'leader' | null
  summary: string
  actions?: ReactNode
}

const GroupHeaderCard = ({ group, membershipStatus, membershipRole, summary, actions }: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const groupName = localizeText(group.name, language)
  const groupDescription = localizeText(group.description, language)

  return (
  <AppSectionCard>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{group.isChurch ? t('churchGroup') : t('group')}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{groupName}</h1>
        {groupDescription ? <p className="max-w-2xl text-sm text-slate-600">{groupDescription}</p> : null}
        <p className="max-w-2xl text-sm text-slate-600">{summary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AccessTypeBadge accessType={group.accessType} />
        <MembershipStatusBadge status={membershipStatus} />
        {membershipRole ? <AppBadge variant="info">{t('role', { role: membershipRole })}</AppBadge> : null}
      </div>
    </div>
    {actions ? <div className="mt-4">{actions}</div> : null}
  </AppSectionCard>
  )
}

export default GroupHeaderCard
