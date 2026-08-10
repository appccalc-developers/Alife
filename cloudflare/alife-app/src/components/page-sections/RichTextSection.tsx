import { Suspense, lazy, useMemo } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { BackgroundMedia, EditableText, PropertyPanel, patchContent, patchLocalizedContent, patchLocalizedSectionHeader, patchSectionHeader, readLocalizedText, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { pageSectionShellClass, sectionSpacingClass } from './sectionPresets'
import { richTextAppearanceClass, richTextBodyClass, sanitizeRichTextHtml, type RichTextAppearance } from '../rich-text/richTextHtml'
import MediaPickerInput from '../media/MediaPickerInput'

const TinyMceRichTextEditor = lazy(() => import('../rich-text/TinyMceRichTextEditor'))

const RichTextHtml = ({ value, fallback, className }: { value: string; fallback: string; className: string }) => {
  const html = useMemo(() => sanitizeRichTextHtml(value || fallback), [fallback, value])

  return (
    <div className={`${richTextBodyClass} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

const TinyMceLoading = ({ focusKey }: { focusKey: string }) => (
  <div
    aria-hidden="true"
    className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-100 md:col-span-2"
    data-editor-focus-key={focusKey}
    tabIndex={-1}
  />
)

const pageImageUploadFolder = (groupId: string | undefined, pageId: string | undefined) => {
  const groupFolder = groupId ? `groups/${groupId}` : 'global'
  const pageFolder = pageId ? `pages/${pageId}` : 'pages/draft'
  return `${groupFolder}/${pageFolder}/rich-text`
}

const RichTextSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, contextGroupId, page, pageId, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
  const title = readLocalizedText(section.contentJson, auth.language, 'title')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle')
  const text = readLocalizedText(section.contentJson, auth.language, 'text')
  const author = readLocalizedText(section.contentJson, auth.language, 'quoteAuthor')
  const variant = readText(section.styleJson, 'variant')
  const quoteOverlay = variant === 'quoteOverlay'
  const overlay = quoteOverlay || Boolean(bg)
  const uploadFolder = pageImageUploadFolder(contextGroupId || page?.ownerGroupId || undefined, pageId || page?.id)
  const mediaGroupId = contextGroupId || page?.ownerGroupId || undefined
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
  const headerFallbackTitle = title || (overlay ? t('quoteOfDay') : mode === 'edit' ? t('previewNoTitle') : '')
  const headerFallbackSubtitle = subtitle || (overlay ? t('godLovesUsAll') : mode === 'edit' ? t('previewNoSubtitle') : '')
  const renderedText = text || (mode === 'edit' ? t('noRichTextContentYet') : '')
  const renderTextEditor = (appearance: RichTextAppearance = 'body') => (
    <Suspense fallback={<TinyMceLoading focusKey="rich-text-body" />}>
      <TinyMceRichTextEditor
        value={text}
        placeholder={appearance === 'quoteOverlay' ? t('noQuoteContentYet') : t('noRichTextContentYet')}
        disabled={!editable}
        compact={appearance === 'quoteOverlay'}
        appearance={appearance}
        focusKey="rich-text-body"
        imageUploadFolder={uploadFolder}
        imagePickerLabel={t('image')}
        groupId={mediaGroupId}
        onChange={(value) => updateLocalizedContent({ text: sanitizeRichTextHtml(value) })}
      />
    </Suspense>
  )
  const renderProperties = () => (
    <PropertyPanel>
      <MediaPickerInput
        focusKey="rich-text-background-media"
        label={t('backgroundImageUrl')}
        value={bg}
        disabled={disabled}
        groupId={mediaGroupId}
        accept="media"
        onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })}
      />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const hasSectionHeader = Boolean(section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header))

  if (!overlay) {
    return (
      <section id={domId} className={pageSectionShellClass}>
        <div className={`mx-auto max-w-6xl ${sectionSpacingClass(section)} rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-700`}>
          {hasSectionHeader ? (
            <SectionHeader
              header={section.contentJson.header}
              titleFallback={headerFallbackTitle}
              subtitleFallback={headerFallbackSubtitle}
              disabled={!editable}
              onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
              onTitleChange={editable ? updateHeaderTitle : undefined}
              onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
            />
          ) : null}
          <div className="mx-auto max-w-3xl">
            {mode === 'render' ? (
              <RichTextHtml value={renderedText} fallback={t('noRichTextContentYet')} className={richTextAppearanceClass.body} />
            ) : (
              renderTextEditor()
            )}
          </div>
          {mode === 'edit' && showProperties ? renderProperties() : null}
        </div>
      </section>
    )
  }

  return (
    <section id={domId} className={pageSectionShellClass}>
      <div className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-slate-200">
        <div className={`relative overflow-hidden px-5 text-white ${sectionSpacingClass(section)}`}>
          <BackgroundMedia src={bg} overlayClassName="bg-slate-950/70" />
          <div className={`relative mx-auto max-w-4xl ${quoteOverlay ? 'text-center' : 'text-left'}`}>
            {hasSectionHeader ? (
              <SectionHeader
                header={section.contentJson.header}
                variant="hero"
                titleFallback={headerFallbackTitle}
                subtitleFallback={headerFallbackSubtitle}
                disabled={!editable}
                onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
                onTitleChange={editable ? updateHeaderTitle : undefined}
                onSubtitleChange={editable ? updateHeaderSubtitle : undefined}
              />
            ) : null}
            {mode === 'edit' ? (
              <div className="mt-6 text-left sm:mt-8">
                {renderTextEditor(quoteOverlay ? 'quoteOverlay' : 'bodyOverlay')}
              </div>
            ) : (
              <RichTextHtml
                value={text}
                fallback={quoteOverlay ? t('noQuoteContentYet') : t('noRichTextContentYet')}
                className={quoteOverlay
                  ? `mx-auto mt-6 max-w-3xl sm:mt-8 ${richTextAppearanceClass.quoteOverlay}`
                  : `mx-auto mt-6 max-w-3xl sm:mt-8 ${richTextAppearanceClass.bodyOverlay}`}
              />
            )}
            <EditableText as="p" value={author} fallback="" disabled={!editable} className="mt-4 block text-xl font-medium text-yellow-300 sm:text-3xl" onChange={(value) => updateLocalizedContent({ quoteAuthor: value })} />
          </div>
        </div>
        {mode === 'edit' && showProperties ? renderProperties() : null}
      </div>
    </section>
  )
}

export default RichTextSection
