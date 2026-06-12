import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import AccessTypeBadge from './AccessTypeBadge'
import type { GroupSummaryDto } from '../../types/group'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'

type Props = {
  items: GroupSummaryDto[]
  canManage?: boolean
  onOpen: (subgroupId: string) => void
  onEdit: (subgroupId: string) => void
}

const SubgroupList = ({ items, canManage, onOpen, onEdit }: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()

  return (
  <AppSectionCard title={t('subgroups')} subtitle={t('browseSubgroupsSubtitle')}>
    {items.length === 0 ? (
      <AppEmptyState
        title={t('noSubgroupsYetTitle')}
        description={t('noSubgroupsYetDescription')}
      />
    ) : (
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((subgroup) => (
          <li key={subgroup.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{localizeText(subgroup.name, language)}</h3>
                {localizeText(subgroup.description, language) ? (
                  <p className="mt-1 text-sm text-slate-600">{localizeText(subgroup.description, language)}</p>
                ) : null}
                <div className="mt-1 flex items-center gap-2">
                  <AccessTypeBadge accessType={subgroup.accessType} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <AppActionButton size="sm" onClick={() => onOpen(subgroup.id)}>{t('open')}</AppActionButton>
                {canManage ? (
                  <>
                    <AppActionButton size="sm" variant="ghost" onClick={() => onEdit(subgroup.id)}>{t('edit')}</AppActionButton>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </AppSectionCard>
  )
}

export default SubgroupList
