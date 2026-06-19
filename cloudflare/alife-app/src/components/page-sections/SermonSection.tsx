import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { PropertyPanel, TextInput, patchContent, patchLocalizedContent, readLocalizedText, readText, toYouTubeEmbedUrl } from './sectionUtils'
import type { SectionComponentProps } from './types'

const SermonSection = ({ section, mode, disabled, propertiesOnly, showProperties = true, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const title = readLocalizedText(section.contentJson, auth.language, 'title') || t('sermons')
  const youtubeUrl = readText(section.contentJson, 'youtubeUrl')
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl)
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const renderProperties = () => (
    <PropertyPanel>
      <TextInput label={t('title')} value={title} disabled={disabled} onChange={(value) => updateLocalizedContent({ title: value })} />
      <TextInput label={t('youtubeUrl')} value={youtubeUrl} disabled={disabled} onChange={(value) => updateContent({ youtubeUrl: value })} />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {embedUrl ? <iframe src={embedUrl} title={title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex aspect-video items-center justify-center text-sm text-slate-500">{t('noYoutubeVideoLinked')}</div>}
      </div>
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </section>
  )
}

export default SermonSection
