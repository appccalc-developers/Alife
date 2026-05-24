import { PropertyPanel, TextInput, parseLimit, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const PostFeedSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const title = readText(section.contentJson, 'title') || 'Posts'
  const limit = parseLimit(section.contentJson, 'limit', 6)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">Post feed section configured.</p>
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="Title" value={title} disabled={disabled} onChange={(value) => updateContent({ title: value })} />
          <TextInput label="Limit" value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 6, 1), 50) })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default PostFeedSection
