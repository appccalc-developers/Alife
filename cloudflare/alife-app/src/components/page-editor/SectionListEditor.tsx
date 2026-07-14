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
  { type: 'LandingHero', label: { en: 'Landing Hero', zh: '首页视频主视觉' }, description: { en: 'Homepage-style video opening with headline and two actions.', zh: '首页风格的视频开场，包含主标题和两个行动按钮。' }, Icon: Video },
  { type: 'Spotlight', label: { en: 'Spotlight', zh: '重点推荐' }, description: { en: 'Homepage-style spotlight block using custom content or one event.', zh: '首页风格的重点内容，可手动填写或带入一个活动。' }, Icon: Type },
  { type: 'RichText', label: { en: 'Rich Text', zh: '图文说明' }, description: { en: 'Longer bilingual copy for welcome text, FAQ, or steps.', zh: '适合欢迎语、常见问题、流程说明等较长双语文字。' }, Icon: FileText },
  { type: 'CollectionShowcase', label: { en: 'List View', zh: '列表视图' }, description: { en: 'Show content from events, sermons, groups, pages, or members.', zh: '展示活动、讲道、小组、页面或成员等内容来源。' }, Icon: LayoutList },
  { type: 'Album', label: { en: 'Album', zh: '相册' }, description: { en: 'Display photos from one managed album.', zh: '引用并展示一个已管理的相册。' }, Icon: Images },
  { type: 'Countdown', label: { en: 'Countdown', zh: '倒数计时' }, description: { en: 'Homepage-style countdown for an event or custom target time.', zh: '首页风格的倒数区块，可绑定活动或自定义目标时间。' }, Icon: CalendarDays },
  { type: 'ContactLocation', label: { en: 'Contact Location', zh: '联系地点' }, description: { en: 'Homepage-style map section with customized location and contact details.', zh: '首页风格的地图区块，可自定义地点与联系信息。' }, Icon: MapPin },
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
  const isZh = language === 'zh'
  const createOpen = createInsertIndex !== null
  const activeIndex = controlledActiveIndex ?? internalActiveIndex
  const setActiveIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, Math.max(0, sections.length - 1)))
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
    setActiveIndex(insertIndex)
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
                languageIssueCount={languageIssueCounts?.[index] ?? 0}
                languageFixing={languageFixingSectionIndex === index}
                onSelect={() => setActiveIndex(index)}
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
