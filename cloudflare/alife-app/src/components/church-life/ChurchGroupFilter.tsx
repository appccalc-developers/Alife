import { ListFilter } from 'lucide-react'
import type { ChurchLifeGroup } from '../../services/churchLifeService'
import { churchGroupPath } from '../../utils/churchLifeGroups'

type Props = {
  groups: ChurchLifeGroup[]
  value: string
  language: string
  onChange: (groupId: string) => void
  disabled?: boolean
}

const ChurchGroupFilter = ({ groups, value, language, onChange, disabled = false }: Props) => {
  const isZh = language === 'zh'
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-black text-[#27473f] sm:flex-row sm:items-center">
      <span className="inline-flex shrink-0 items-center gap-2">
        <ListFilter className="h-4 w-4 text-[#176b5a]" aria-hidden="true" />
        {isZh ? '所属组' : 'Owning group'}
      </span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 min-w-0 rounded-xl border border-[#cddbd5] bg-white px-3 py-2 text-sm font-bold text-[#355149] outline-none transition hover:border-[#8fbbaa] focus:border-[#176b5a] focus:ring-4 focus:ring-[#176b5a]/10 disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-72"
      >
        <option value="">{isZh ? '教会与全部开放事工' : 'Church and all open ministries'}</option>
        {value && !groups.some(group => group.id === value && group.isSelectable !== false) ? <option value={value} disabled>{isZh ? '已选所属组' : 'Selected owning group'}</option> : null}
        {groups.filter((group) => group.isSelectable !== false).map((group) => (
          <option key={group.id} value={group.id}>{churchGroupPath(group.id, groups, language)}</option>
        ))}
      </select>
    </label>
  )
}

export default ChurchGroupFilter
