import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { EditableText, PropertyPanel, TextInput, patchContent, patchLocalizedContent, readLocalizedText, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const RichTextSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
  const title = readLocalizedText(section.contentJson, auth.language, 'title')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle')
  const text = readLocalizedText(section.contentJson, auth.language, 'text')
  const author = readLocalizedText(section.contentJson, auth.language, 'quoteAuthor')
  const variant = readText(section.styleJson, 'variant')
  const overlay = variant === 'quoteOverlay' || Boolean(bg)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))

  if (!overlay) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
        <EditableText as="p" multiline value={text} fallback={t('noRichTextContentYet')} disabled={!editable} className="block" onChange={(value) => updateLocalizedContent({ text: value })} />
        {mode === 'edit' ? <PropertyPanel><TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-cover bg-center px-5 py-10 text-white" style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg})` }}>
        <div className="mx-auto max-w-4xl text-center">
          <EditableText as="h2" value={title} fallback={t('quoteOfDay')} disabled={!editable} className="text-2xl font-semibold sm:text-4xl" onChange={(value) => updateLocalizedContent({ title: value })} />
          <EditableText as="p" value={subtitle} fallback={t('godLovesUsAll')} disabled={!editable} className="mt-1 block text-base text-slate-200 sm:text-lg" onChange={(value) => updateLocalizedContent({ subtitle: value })} />
          <EditableText as="p" multiline value={text} fallback={t('noQuoteContentYet')} disabled={!editable} className="mt-6 block text-2xl italic leading-relaxed text-slate-100 sm:mt-8 sm:text-4xl" onChange={(value) => updateLocalizedContent({ text: value })} />
          <EditableText as="p" value={author} fallback="" disabled={!editable} className="mt-4 block text-xl font-medium text-yellow-300 sm:text-3xl" onChange={(value) => updateLocalizedContent({ quoteAuthor: value })} />
        </div>
      </div>
      {mode === 'edit' ? <PropertyPanel><TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
    </section>
  )
}

export default RichTextSection
