import { useAuthStore } from '../../stores/auth'
import { PropertyPanel, TextInput, parseLimit, patchContent, patchLocalizedContent, readLocalizedText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const PostFeedSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const title = readLocalizedText(section.contentJson, auth.language, 'title') || 'Posts'
  const limit = parseLimit(section.contentJson, 'limit', 6)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">Post feed section configured.</p>
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="Title" value={title} disabled={disabled} onChange={(value) => updateLocalizedContent({ title: value })} />
          <TextInput label="Limit" value={String(limit)} disabled={disabled} onChange={(value) => updateContent({ limit: Math.min(Math.max(parseInt(value) || 6, 1), 50) })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default PostFeedSection
