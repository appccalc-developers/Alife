import { sectionListEditorText } from '../../i18n/sectionListEditor.ts'
import { Fragment, useEffect, useState } from 'react'
import {
  CalendarDays,
  FileText,
  LayoutList,
  Images,
  MapPin,
  PlusCircle,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import SectionCardEditor from './SectionCardEditor'
import type { SectionEditModel, SectionType } from '../../types/page-editor'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { pageSectionDividerClass } from '../page-sections/sectionPresets'

type LocalText = { en: string; zh: string }

type Props = {
  sections: SectionEditModel[]
  canEdit: boolean
  sectionTypeErrors: string[]
  activeIndex?: number
  activeFocusToken?: number
  languageIssueCounts?: Record<number, number>
  languageFixingSectionIndex?: number | null
  onActiveIndexChange?: (index: number) => void
  onFixLanguageIssues?: (index: number) => void
  onAdd: (type: SectionType) => void
  onInsert: (index: number, type: SectionType) => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  contextGroupId?: string
  pageId?: string
}

const sectionTypeOptions: Array<{ type: SectionType; label: LocalText; description: LocalText; Icon: LucideIcon }> = [
  { type: 'LandingHero', label: { ...sectionListEditorText.label }, description: { ...sectionListEditorText.description }, Icon: Video },
  { type: 'Spotlight', label: { ...sectionListEditorText.labelSpotlight }, description: { ...sectionListEditorText.descriptionHomepageStyleSpotlightBlockUsingCustomContentOrOneEvent }, Icon: Type },
  { type: 'ReviewedPageCarousel', label: { ...sectionListEditorText.labelReviewedPageShowcase }, description: { ...sectionListEditorText.descriptionPresentReviewedPagesAsACarouselFloatingCommunityEditorialEventSpreadOrEditorialIndex }, Icon: LayoutList },
  { type: 'RichText', label: { ...sectionListEditorText.labelRichText }, description: { ...sectionListEditorText.descriptionLongerBilingualCopyForWelcomeTextFaqOrSteps }, Icon: FileText },
  { type: 'CollectionShowcase', label: { ...sectionListEditorText.labelListView }, description: { ...sectionListEditorText.descriptionShowContentFromEventsSermonsGroupsPagesOrMembers }, Icon: LayoutList },
  { type: 'Album', label: { ...sectionListEditorText.labelAlbum }, description: { ...sectionListEditorText.descriptionDisplayPhotosFromOneManagedAlbum }, Icon: Images },
  { type: 'Countdown', label: { ...sectionListEditorText.labelCountdown }, description: { ...sectionListEditorText.descriptionHomepageStyleCountdownForAnEventOrCustomTargetTime }, Icon: CalendarDays },
  { type: 'ContactLocation', label: { ...sectionListEditorText.labelContactLocation }, description: { ...sectionListEditorText.descriptionHomepageStyleMapSectionWithCustomizedLocationAndContactDetails }, Icon: MapPin },
]

const SectionListEditor = ({
  sections,
  canEdit,
  sectionTypeErrors,
  activeIndex: controlledActiveIndex,
  activeFocusToken,
  languageIssueCounts,
  languageFixingSectionIndex,
  onActiveIndexChange,
  onFixLanguageIssues,
  onAdd,
  onInsert,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  contextGroupId,
  pageId,
}: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const [internalActiveIndex, setInternalActiveIndex] = useState(0)
  const [createInsertIndex, setCreateInsertIndex] = useState<number | null>(null)
  const [editContentRequest, setEditContentRequest] = useState<{ index: number; token: number } | null>(null)
  const isZh = language === 'zh'
  const createOpen = createInsertIndex !== null
  const activeIndex = controlledActiveIndex ?? internalActiveIndex
  const setActiveIndex = (index: number, sectionCount = sections.length) => {
    const nextIndex = Math.max(0, Math.min(index, Math.max(0, sectionCount - 1)))
    if (controlledActiveIndex === undefined) {
      setInternalActiveIndex(nextIndex)
    }
    onActiveIndexChange?.(nextIndex)
  }

  const openCreateAt = (index: number) => {
    setCreateInsertIndex(Math.max(0, Math.min(index, sections.length)))
  }

  useEffect(() => {
    if (sections.length === 0) {
      setActiveIndex(0)
      return
    }
    if (activeIndex > sections.length - 1) {
      setActiveIndex(sections.length - 1)
    }
  }, [activeIndex, sections.length])

  const addAndSelect = (type: SectionType) => {
    const insertIndex = createInsertIndex ?? sections.length
    if (insertIndex >= sections.length) {
      onAdd(type)
    } else {
      onInsert(insertIndex, type)
    }
    setActiveIndex(insertIndex, sections.length + 1)
    setEditContentRequest((current) => ({
      index: insertIndex,
      token: (current?.token ?? 0) + 1,
    }))
    setCreateInsertIndex(null)
  }

  const removeAndSelect = (index: number) => {
    onRemove(index)
    setActiveIndex(Math.max(0, Math.min(index, sections.length - 2)))
  }

  const moveAndSelect = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= sections.length) {
      return
    }
    direction === -1 ? onMoveUp(index) : onMoveDown(index)
    setActiveIndex(index + direction)
  }

  return (
    <>
      {sections.length === 0 ? (
        <AppEmptyState
          title={t('noSectionsYet')}
          description={t('noSectionsDescription')}
          actionLabel={t('addSection')}
          onAction={() => openCreateAt(sections.length)}
        />
      ) : (
        <>
          {sections.map((section, index) => (
            <Fragment key={`${section.id ?? 'new'}-${index}`}>
              <SectionCardEditor
                section={section}
                index={index}
                total={sections.length}
                canEdit={canEdit}
                typeError={sectionTypeErrors[index]}
                contextGroupId={contextGroupId}
                pageId={pageId}
                isActive={activeIndex === index}
                focusToken={activeIndex === index ? activeFocusToken : undefined}
                editContentRequestToken={editContentRequest?.index === index ? editContentRequest.token : undefined}
                languageIssueCount={languageIssueCounts?.[index] ?? 0}
                languageFixing={languageFixingSectionIndex === index}
                onSelect={() => setActiveIndex(index)}
                onEditContentRequestHandled={() => {
                  setEditContentRequest((current) => current?.index === index ? null : current)
                }}
                onInsertBefore={() => openCreateAt(index)}
                onFixLanguageIssues={onFixLanguageIssues ? () => onFixLanguageIssues(index) : undefined}
                onUpdate={(nextSection) => onUpdate({ index, section: nextSection })}
                onRemove={() => removeAndSelect(index)}
                onMoveUp={() => moveAndSelect(index, -1)}
                onMoveDown={() => moveAndSelect(index, 1)}
              />
              {index < sections.length - 1 ? <hr className={pageSectionDividerClass} /> : null}
            </Fragment>
          ))}
        </>
      )}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t('selectedSectionOnly')}</p>
        <AppActionButton variant="primary" disabled={!canEdit} onClick={() => openCreateAt(sections.length)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('addSection')}
        </AppActionButton>
      </section>
      {createOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setCreateInsertIndex(null)} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t('chooseSectionType')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('chooseSectionTypeDescription')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setCreateInsertIndex(null)}
              >
                {t('close')}
              </button>
            </div>
            <div className="mt-5 grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {sectionTypeOptions.map((item) => {
                const Icon = item.Icon

                return (
                  <button
                    key={item.type}
                    type="button"
                    disabled={!canEdit}
                    className="flex min-h-32 gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => addAndSelect(item.type)}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e3f0eb] text-[#176b5a]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-950">{isZh ? item.label.zh : item.label.en}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{isZh ? item.description.zh : item.description.en}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default SectionListEditor
