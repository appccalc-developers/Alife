import { PropertyPanel, TextInput, patchContent, readText, toYouTubeEmbedUrl } from './sectionUtils'
import type { SectionComponentProps } from './types'

const SermonSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const title = readText(section.contentJson, 'title') || 'Sermon'
  const youtubeUrl = readText(section.contentJson, 'youtubeUrl')
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {embedUrl ? <iframe src={embedUrl} title={title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex aspect-video items-center justify-center text-sm text-slate-500">No YouTube video linked yet.</div>}
      </div>
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="Title" value={title} disabled={disabled} onChange={(value) => updateContent({ title: value })} />
          <TextInput label="YouTube URL" value={youtubeUrl} disabled={disabled} onChange={(value) => updateContent({ youtubeUrl: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default SermonSection
