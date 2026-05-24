import { EditableText, PropertyPanel, TextInput, patchContent, readText, toYouTubeEmbedUrl } from './sectionUtils'
import type { SectionComponentProps } from './types'

const SermonSpotlightSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const editable = mode === 'edit' && !disabled && onUpdate
  const title = readText(section.contentJson, 'title', 'headline')
  const subtitle = readText(section.contentJson, 'subtitle', 'subheadline')
  const body = readText(section.contentJson, 'centerText', 'body')
  const youtubeUrl = readText(section.contentJson, 'youtubeUrl')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div className="px-5 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <EditableText as="h2" value={title} fallback="Today's Sermon" disabled={!editable} className="text-2xl font-semibold text-slate-700 sm:text-4xl" onChange={(value) => updateContent({ title: value, headline: value })} />
          <EditableText as="p" value={subtitle} fallback="God loves us all" disabled={!editable} className="mt-1 block text-base text-slate-500 sm:text-xl" onChange={(value) => updateContent({ subtitle: value, subheadline: value })} />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {embedUrl ? <iframe src={embedUrl} referrerPolicy="strict-origin-when-cross-origin" title="Sermon video" className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex aspect-video items-center justify-center text-sm text-slate-500">No YouTube video linked yet.</div>}
          </div>
          <div className="space-y-4 text-center md:text-left">
            <EditableText as="p" multiline value={body} fallback="Sermon title and summary" disabled={!editable} className="text-lg font-semibold text-indigo-900 sm:text-2xl" onChange={(value) => updateContent({ centerText: value, body: value })} />
            {linkUrl || mode === 'edit' ? <a href={mode === 'render' ? linkUrl : undefined} target={mode === 'render' && linkUrl ? '_blank' : undefined} rel={mode === 'render' && linkUrl ? 'noopener noreferrer' : undefined} className="inline-flex rounded bg-red-500 px-6 py-2 text-sm font-medium text-white shadow hover:bg-red-400" onClick={(event) => mode === 'edit' && event.preventDefault()}>View</a> : null}
          </div>
        </div>
      </div>
      {mode === 'edit' ? (
        <PropertyPanel>
          <TextInput label="YouTube URL" value={youtubeUrl} disabled={disabled} onChange={(value) => updateContent({ youtubeUrl: value })} />
          <TextInput label="Button Link URL" value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default SermonSpotlightSection
