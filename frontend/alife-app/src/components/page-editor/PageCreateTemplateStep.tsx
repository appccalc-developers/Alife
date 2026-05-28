import { useEffect, useRef, useState } from 'react'
import { useUiText } from '../../i18n/uiText'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import GroupPagePreview from './GroupPagePreview'
import { deriveTemplateStateFromSections, PAGE_TEMPLATES } from '../../lib/pageTemplates'
import type { PageEditModel, SectionEditModel } from '../../types/page-editor'
import { localizeText } from '../../utils/localizedText'

const heroDefaults = () => ({ ...(PAGE_TEMPLATES.find((t) => t.id === 'heroFeatured')?.defaultDraft ?? {}) })
const HERO_TEMPLATE = PAGE_TEMPLATES[0]

type Props = {
  model: PageEditModel
  /** Page sections at the time the wizard opens, used to restore a filled template or avoid accidental overwrite */
  initialSections: SectionEditModel[]
  canEdit: boolean
  onApplyTemplateSections: (sections: SectionEditModel[]) => void
  /** Hide the assistant after user continues to section editing */
  onDismiss: () => void
}

const PageCreateTemplateStep = ({ model, canEdit, initialSections, onApplyTemplateSections, onDismiss }: Props) => {
  const t = useUiText()
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const derived = deriveTemplateStateFromSections(initialSections)
    if (derived) {
      return derived.draft
    }
    return heroDefaults()
  })

  const skipInitialOverwriteRef = useRef(initialSections.length > 1)

  useEffect(() => {
    if (skipInitialOverwriteRef.current) {
      skipInitialOverwriteRef.current = false
      return
    }
    if (!HERO_TEMPLATE) {
      return
    }
    onApplyTemplateSections(HERO_TEMPLATE.buildSections(draft))
  }, [draft, onApplyTemplateSections])

  const updateDraft = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <AppSectionCard
      title={t('templateCreateSections')}
      subtitle={t('templateCreateSectionsSubtitle')}
    >
      {HERO_TEMPLATE ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className={`mb-2 h-10 rounded-md bg-gradient-to-br ${HERO_TEMPLATE.previewGradient}`} />
          <p className="text-sm font-semibold text-slate-900">{HERO_TEMPLATE.name}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{HERO_TEMPLATE.description}</p>
        </div>
      ) : null}

      {initialSections.length > 1 ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('templateMultipleSectionsWarning')}
          </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('templateVisualEditor')}</p>
          {!HERO_TEMPLATE ? (
            <p className="text-sm text-slate-600">{t('templateNoFields')}</p>
          ) : (
            <div className="space-y-3">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div
                  className="relative min-h-[320px] bg-cover bg-center px-5 py-12 text-white"
                  style={{
                    backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${(draft.backgroundUrl || '').trim()})`,
                  }}
                >
                  <div className="flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
                    <h2
                      role="textbox"
                      contentEditable={canEdit}
                      suppressContentEditableWarning
                      className="rounded px-2 py-1 text-5xl font-semibold tracking-wide text-yellow-300 outline-none focus:bg-black/20"
                      onBlur={(event) => updateDraft('heroText', event.currentTarget.textContent ?? '')}
                    >
                      {(draft.heroText || '').trim() || 'Hero Section'}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={canEdit}
                      suppressContentEditableWarning
                      className="whitespace-pre-wrap rounded px-2 py-1 text-sm text-slate-100 outline-none focus:bg-black/20"
                      onBlur={(event) => updateDraft('heroContent', event.currentTarget.textContent ?? '')}
                    >
                      {(draft.heroContent || '').trim() || 'No hero content yet.'}
                    </p>
                  </div>
                  <span className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow">
                    <span
                      role="textbox"
                      contentEditable={canEdit}
                      suppressContentEditableWarning
                      className="rounded px-1 outline-none focus:bg-white/20"
                      onBlur={(event) => updateDraft('linkLabel', event.currentTarget.textContent ?? '')}
                    >
                      {(draft.linkLabel || '').trim() || ((draft.linkUrl || '').trim() ? draft.linkUrl : 'Button text')}
                    </span>
                  </span>
                </div>
              </section>

              <div className="grid gap-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">{t('backgroundImageUrl')}</span>
                  <input
                    value={draft.backgroundUrl ?? ''}
                    disabled={!canEdit}
                    placeholder="https://..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    onChange={(e) => updateDraft('backgroundUrl', e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">{t('buttonLinkUrl')}</span>
                  <input
                    value={draft.linkUrl ?? ''}
                    disabled={!canEdit}
                    placeholder="https://..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    onChange={(e) => updateDraft('linkUrl', e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <AppActionButton variant="primary" disabled={!canEdit} onClick={onDismiss}>
              {t('finishTemplateEditAdvanced')}
            </AppActionButton>
          </div>
        </div>

        <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('livePreview')}</p>
          <div className="max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border border-slate-200 bg-slate-100/80 p-2">
            <GroupPagePreview
              compact
              title={localizeText(model.title)}
              description={localizeText(model.description)}
              visibility={model.visibility}
              sections={model.sections}
              previewGroupId={model.groupId}
            />
          </div>
        </div>
      </div>
    </AppSectionCard>
  )
}

export default PageCreateTemplateStep
