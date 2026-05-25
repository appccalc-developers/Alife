import { Link } from 'react-router-dom'
import { PropertyPanel, TextInput, parseLimit, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'

const PageListSection = ({ section, mode, disabled, groupPageItems = [], onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const title = readText(section.contentJson, 'title') || 'Pages'
  const limit = parseLimit(section.contentJson, 'limit', 8)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {groupPageItems.slice(0, limit).map((item) => (
          <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <Link className="font-medium text-blue-700 hover:underline" to={`/pages/${item.id}`}>{localizeText(item.title, auth.language)}</Link>
            <p className="text-xs text-slate-500">Visibility: {item.visibility}</p>
          </li>
        ))}
      </ul>
      {groupPageItems.length === 0 ? <p className="mt-3 text-sm text-slate-500">No pages available.</p> : null}
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="Title" value={title} disabled={disabled} onChange={(value) => updateContent({ title: value })} />
          <TextInput label="Limit" value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 8, 1), 50) })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default PageListSection
