import type { GroupTab } from '../../types/group'

type Props = {
  value: GroupTab
  onChange: (value: GroupTab) => void
}

const tabs: Array<{ key: GroupTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'subgroups', label: 'Subgroups' },
  { key: 'pages', label: 'Pages' },
]

const GroupTabs = ({ value, onChange }: Props) => (
  <nav className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Group sections">
    <ul className="grid grid-cols-3 gap-1">
      {tabs.map((tab) => (
        <li key={tab.key}>
          <button
            className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition ${
              value === tab.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            type="button"
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        </li>
      ))}
    </ul>
  </nav>
)

export default GroupTabs
