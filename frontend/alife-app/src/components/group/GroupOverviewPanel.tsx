import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto } from '../../types/group'

type Props = {
  group: GroupDto
  subgroupCount: number
  pageCount: number
}

const GroupOverviewPanel = ({ group, subgroupCount, pageCount }: Props) => (
  <AppSectionCard title="Overview" subtitle="Quick context and metadata for this group.">
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Metadata</p>
        <p className="text-sm text-slate-700">Group ID: {group.id}</p>
        <p className="text-sm text-slate-700">Access: {group.accessType}</p>
        <p className="text-sm text-slate-700">Status: {group.isClosed ? 'Closed' : 'Active'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Subgroups</p>
          <p className="text-2xl font-semibold text-slate-900">{subgroupCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Pages</p>
          <p className="text-2xl font-semibold text-slate-900">{pageCount}</p>
        </div>
      </div>
    </div>
  </AppSectionCard>
)

export default GroupOverviewPanel
