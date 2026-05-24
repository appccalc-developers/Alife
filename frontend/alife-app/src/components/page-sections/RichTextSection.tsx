import { EditableText, PropertyPanel, TextInput, patchContent, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const RichTextSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const editable = mode === 'edit' && !disabled && onUpdate
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
  const title = readText(section.contentJson, 'title')
  const subtitle = readText(section.contentJson, 'subtitle')
  const text = readText(section.contentJson, 'text')
  const author = readText(section.contentJson, 'quoteAuthor')
  const variant = readText(section.styleJson, 'variant')
  const overlay = variant === 'quoteOverlay' || Boolean(bg)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))

  if (!overlay) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
        <EditableText as="p" multiline value={text} fallback="No rich text content yet." disabled={!editable} className="block" onChange={(value) => updateContent({ text: value })} />
        {mode === 'edit' ? <PropertyPanel><TextInput label="Background Image URL" value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-cover bg-center px-5 py-10 text-white" style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg})` }}>
        <div className="mx-auto max-w-4xl text-center">
          <EditableText as="h2" value={title} fallback="Quote of the day" disabled={!editable} className="text-2xl font-semibold sm:text-4xl" onChange={(value) => updateContent({ title: value })} />
          <EditableText as="p" value={subtitle} fallback="God loves us all" disabled={!editable} className="mt-1 block text-base text-slate-200 sm:text-lg" onChange={(value) => updateContent({ subtitle: value })} />
          <EditableText as="p" multiline value={text} fallback="No quote content yet." disabled={!editable} className="mt-6 block text-2xl italic leading-relaxed text-slate-100 sm:mt-8 sm:text-4xl" onChange={(value) => updateContent({ text: value })} />
          <EditableText as="p" value={author} fallback="" disabled={!editable} className="mt-4 block text-xl font-medium text-yellow-300 sm:text-3xl" onChange={(value) => updateContent({ quoteAuthor: value })} />
        </div>
      </div>
      {mode === 'edit' ? <PropertyPanel><TextInput label="Background Image URL" value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
    </section>
  )
}

export default RichTextSection
