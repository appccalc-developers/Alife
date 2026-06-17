import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { BackgroundMedia, EditableText, PropertyPanel, TextInput, patchContent, patchLocalizedContent, patchLocalizedSectionHeader, readLocalizedText, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { sectionSpacingClass } from './sectionPresets'

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
  const updateHeaderTitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { title: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'title', value))
  }
  const updateHeaderSubtitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { subtitle: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'subtitle', value))
  }
  const headerFallbackTitle = title || (overlay ? t('quoteOfDay') : '')
  const headerFallbackSubtitle = subtitle || (overlay ? t('godLovesUsAll') : '')
  const renderedText = text || (mode === 'edit' ? t('noRichTextContentYet') : '')

  if (!overlay) {
    return (
      <section className={`${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-700`}>
        <SectionHeader
          header={section.contentJson.header}
          titleFallback={headerFallbackTitle}
          subtitleFallback={headerFallbackSubtitle}
          disabled={!editable}
          onTitleChange={editable ? updateHeaderTitle : undefined}
          onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
        />
        <div className="mx-auto max-w-3xl">
          {mode === 'render' ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p> }}>
              {renderedText || t('noRichTextContentYet')}
            </ReactMarkdown>
          ) : (
            <EditableText as="p" multiline value={text} fallback={t('noRichTextContentYet')} disabled={!editable} className="block whitespace-pre-wrap leading-7" onChange={(value) => updateLocalizedContent({ text: value })} />
          )}
        </div>
        {mode === 'edit' ? <PropertyPanel><TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className={`relative overflow-hidden px-5 text-white ${sectionSpacingClass(section)}`}>
        <BackgroundMedia src={bg} overlayClassName="bg-slate-950/70" />
        <div className="relative mx-auto max-w-4xl text-center">
          <SectionHeader
            header={section.contentJson.header}
            variant="hero"
            titleFallback={headerFallbackTitle}
            subtitleFallback={headerFallbackSubtitle}
            disabled={!editable}
            onTitleChange={editable ? updateHeaderTitle : undefined}
            onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
          />
          <EditableText as="p" multiline value={text} fallback={t('noQuoteContentYet')} disabled={!editable} className="mt-6 block text-2xl italic leading-relaxed text-slate-100 sm:mt-8 sm:text-4xl" onChange={(value) => updateLocalizedContent({ text: value })} />
          <EditableText as="p" value={author} fallback="" disabled={!editable} className="mt-4 block text-xl font-medium text-yellow-300 sm:text-3xl" onChange={(value) => updateLocalizedContent({ quoteAuthor: value })} />
        </div>
      </div>
      {mode === 'edit' ? <PropertyPanel><TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} /></PropertyPanel> : null}
    </section>
  )
}

export default RichTextSection
