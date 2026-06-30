import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  FileText,
  Layers3,
  LayoutList,
  Megaphone,
  PlusCircle,
  Type,
  type LucideIcon,
} from 'lucide-react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import SectionCardEditor from './SectionCardEditor'
import type { SectionEditModel, SectionType } from '../../types/page-editor'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'

type LocalText = { en: string; zh: string }

type Props = {
  sections: SectionEditModel[]
  canEdit: boolean
  sectionTypeErrors: string[]
  onAdd: (type: SectionType) => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  contextGroupId?: string
  pageId?: string
}

const sectionTypeOptions: Array<{ type: SectionType; label: LocalText; description: LocalText; Icon: LucideIcon }> = [
  { type: 'Hero', label: { en: 'Hero', zh: '主视觉' }, description: { en: 'A page opening with background media, headline, and action.', zh: '页面开场，可放背景媒体、主标题和行动按钮。' }, Icon: Megaphone },
  { type: 'RichText', label: { en: 'Rich Text', zh: '图文说明' }, description: { en: 'Longer bilingual copy for welcome text, FAQ, or steps.', zh: '适合欢迎语、常见问题、流程说明等较长双语文字。' }, Icon: FileText },
  { type: 'Spotlight', label: { en: 'Spotlight', zh: '重点推荐' }, description: { en: 'Feature one story with media, body copy, and an action.', zh: '用媒体、说明和行动按钮突出一个重点内容。' }, Icon: Type },
  { type: 'ListView', label: { en: 'List View', zh: '列表视图' }, description: { en: 'Show content from events, sermons, groups, pages, or members.', zh: '展示活动、讲道、小组、页面或成员等内容来源。' }, Icon: LayoutList },
  { type: 'Sermon', label: { en: 'Sermon Video', zh: '讲道视频' }, description: { en: 'Embed one YouTube sermon video with a title.', zh: '嵌入一段 YouTube 讲道视频和标题。' }, Icon: Clapperboard },
]

const sectionTypeLabel = (type: SectionType | '', isZh: boolean) => {
  if (type === 'Hero') return isZh ? '主视觉' : 'Hero'
  if (type === 'RichText') return isZh ? '图文说明' : 'Rich Text'
  if (type === 'Spotlight') return isZh ? '重点推荐' : 'Spotlight'
  if (type === 'ListView') return isZh ? '列表视图' : 'List View'
  if (type === 'Sermon') return isZh ? '讲道视频' : 'Sermon Video'
  return isZh ? '未选择类型' : 'No type selected'
}

const SectionListEditor = ({ sections, canEdit, sectionTypeErrors, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId, pageId }: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const [activeIndex, setActiveIndex] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const isZh = language === 'zh'
  const errorCount = sectionTypeErrors.filter(Boolean).length
  const hasSections = sections.length > 0
  const activeSection = hasSections ? sections[Math.min(activeIndex, sections.length - 1)] : null

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
    onAdd(type)
    setActiveIndex(sections.length)
    setCreateOpen(false)
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
    <section className="w-full min-w-0 space-y-3">
      <div className="rounded-2xl border border-[#2f4b42]/10 bg-white/80 p-4 shadow-[0_10px_26px_rgba(31,56,48,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">
              {isZh ? '区块编辑' : 'Section editor'}
            </p>
            <h2 className="mt-1 text-lg font-black text-[#18332d]">
              {isZh ? '按发布顺序整理页面内容' : 'Arrange page content in publishing order'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {isZh
                ? '每个区块都应回答一个清楚问题：访客需要知道什么，下一步可以做什么。'
                : 'Each section should answer one clear question: what visitors need to know and what they can do next.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-[#e3f0eb] px-3 py-2 text-xs font-black text-[#176b5a]">
              <Layers3 className="h-4 w-4" />
              {sections.length} {isZh ? '个区块' : 'sections'}
            </span>
            <span
              className={[
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black',
                errorCount ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700',
              ].join(' ')}
            >
              {errorCount ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {errorCount ? (isZh ? `${errorCount} 个需处理` : `${errorCount} to fix`) : (isZh ? '结构正常' : 'Structure ready')}
            </span>
          </div>
        </div>
        {activeSection ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            <span className="font-black text-slate-800">{isZh ? '当前区块' : 'Active section'}:</span>{' '}
            {activeIndex + 1}/{sections.length} · {sectionTypeLabel(activeSection.type, isZh)}
          </div>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <AppEmptyState
          title={t('noSectionsYet')}
          description={t('noSectionsDescription')}
          actionLabel={t('addSection')}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {sections.map((section, index) => (
            <SectionCardEditor
              key={`${section.id ?? 'new'}-${index}`}
              section={section}
              index={index}
              total={sections.length}
              canEdit={canEdit}
              typeError={sectionTypeErrors[index]}
              contextGroupId={contextGroupId}
              pageId={pageId}
              isActive={activeIndex === index}
              onSelect={() => setActiveIndex(index)}
              onUpdate={(nextSection) => onUpdate({ index, section: nextSection })}
              onRemove={() => removeAndSelect(index)}
              onMoveUp={() => moveAndSelect(index, -1)}
              onMoveDown={() => moveAndSelect(index, 1)}
            />
          ))}
        </div>
      )}
      <br />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t('selectedSectionOnly')}</p>
        <AppActionButton variant="primary" disabled={!canEdit} onClick={() => setCreateOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('addSection')}
        </AppActionButton>
      </div>
      {createOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setCreateOpen(false)} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t('chooseSectionType')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('chooseSectionTypeDescription')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setCreateOpen(false)}
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
    </section>
  )
}

export default SectionListEditor
