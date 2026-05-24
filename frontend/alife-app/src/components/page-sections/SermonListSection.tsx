import { PropertyPanel, TextInput, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const SermonListSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const title = readText(section.contentJson, 'title') || 'Sermons'
  const channelId = readText(section.contentJson, 'youtubeChannelId')
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">Sermons are synced into this section. Set a YouTube channel to drive updates.</p>
      {channelId ? <a className="mt-3 inline-flex rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50" href={`https://www.youtube.com/channel/${channelId}`} target="_blank" rel="noopener noreferrer">Open YouTube Channel</a> : null}
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="Title" value={title} disabled={disabled} onChange={(value) => updateContent({ title: value })} />
          <TextInput label="YouTube Channel ID" value={channelId} disabled={disabled} onChange={(value) => updateContent({ youtubeChannelId: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default SermonListSection
