import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Layers3, PlusCircle } from 'lucide-react'
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
  onAdd: (type: SectionType, preset?: string) => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  contextGroupId?: string
}

const sectionPresets: Array<{ type: SectionType; preset?: string; label: LocalText; description: LocalText }> = [
  { type: 'LandingHeroSection', preset: 'landing-hero', label: { en: 'Landing hero', zh: '落地页主视觉' }, description: { en: 'Homepage-style video hero with headline, copy, and two calls to action.', zh: '使用首页视频主视觉样式，包含标题、说明和两个行动按钮。' } },
  { type: 'Hero', preset: 'hero-home', label: { en: 'Homepage opening', zh: '首页开场' }, description: { en: 'Large first screen with image, headline, copy, and a button.', zh: '用图片、标题、说明和按钮做页面第一屏。' } },
  { type: 'Hero', preset: 'hero-event', label: { en: 'Event opening', zh: '活动开场' }, description: { en: 'Poster-style opening for a gathering or announcement.', zh: '适合聚会、活动或公告的海报式开场。' } },
  { type: 'RichText', preset: 'rich-welcome', label: { en: 'Welcome message', zh: '欢迎文字' }, description: { en: 'Simple bilingual intro copy for a page.', zh: '用于页面简介、欢迎语或说明文字。' } },
  { type: 'RichText', preset: 'rich-faq', label: { en: 'Common questions', zh: '常见问题' }, description: { en: 'Questions about visit, language, children, and parking.', zh: '整理访问、语言、儿童、停车等常见问题。' } },
  { type: 'RichText', preset: 'rich-steps', label: { en: 'What to expect', zh: '流程说明' }, description: { en: 'Step-by-step guidance for visitors or members.', zh: '给访客或成员看的分步骤说明。' } },
  { type: 'Spotlight', preset: 'spotlight-visit', label: { en: 'Visit highlight', zh: '来访重点' }, description: { en: 'Image plus text for location or first visit info.', zh: '用图片和文字说明地点或首次来访信息。' } },
  { type: 'Spotlight', preset: 'spotlight-groups', label: { en: 'Group highlight', zh: '小组重点' }, description: { en: 'Feature small groups and belonging.', zh: '突出小组生活和归属感。' } },
  { type: 'Spotlight', preset: 'spotlight-sermons', label: { en: 'Sermon highlight', zh: '讲道重点' }, description: { en: 'Feature a message, series, or teaching theme.', zh: '突出一篇信息、系列或教导主题。' } },
  { type: 'ListView', preset: 'list-events', label: { en: 'Upcoming events', zh: '近期活动' }, description: { en: 'Automatically show upcoming events.', zh: '自动显示即将开始的活动。' } },
  { type: 'ListView', preset: 'list-event-coverflow', label: { en: 'Event coverflow', zh: '活动封面轮播' }, description: { en: 'Show events as a featured center card with side previews.', zh: '用主卡和左右预览展示近期活动。' } },
  { type: 'ListView', preset: 'list-groups', label: { en: 'Group cards', zh: '小组卡片' }, description: { en: 'Automatically show group cards.', zh: '自动显示小组卡片。' } },
  { type: 'ListView', preset: 'list-sermons', label: { en: 'Latest sermons', zh: '最新讲道' }, description: { en: 'Automatically show latest sermon cards.', zh: '自动显示最新讲道卡片。' } },
  { type: 'ListView', preset: 'list-pages', label: { en: 'Page links', zh: '页面链接' }, description: { en: 'Automatically show related pages.', zh: '自动显示相关页面入口。' } },
  { type: 'ListView', preset: 'list-members', label: { en: 'Member list', zh: '成员列表' }, description: { en: 'Show approved group members when the viewer has access.', zh: '在有权限时展示已批准的小组成员。' } },
  { type: 'ListView', preset: 'list-posts', label: { en: 'Post list', zh: '文章列表' }, description: { en: 'Reserve a list block for future post-style content.', zh: '为文章类内容预留自动列表区块。' } },
  { type: 'ListView', preset: 'list-carousel', label: { en: 'Scrolling cards', zh: '横向卡片' }, description: { en: 'Horizontally scrolling card list.', zh: '可横向滑动的一组卡片。' } },
  { type: 'Sermon', preset: 'sermon-embed', label: { en: 'Sermon video', zh: '讲道视频' }, description: { en: 'YouTube sermon embed with title.', zh: '嵌入 YouTube 讲道视频和标题。' } },
]

const sectionTypeLabel = (type: SectionType | '', isZh: boolean) => {
  if (type === 'LandingHeroSection') return isZh ? '落地页主视觉' : 'Landing hero'
  if (type === 'Hero') return isZh ? '开场横幅' : 'Opening banner'
  if (type === 'RichText') return isZh ? '文字说明' : 'Text block'
  if (type === 'Spotlight') return isZh ? '重点推荐' : 'Highlight'
  if (type === 'ListView') return isZh ? '自动列表' : 'Auto list'
  if (type === 'Sermon') return isZh ? '讲道视频' : 'Sermon video'
  return isZh ? '未选择样式' : 'No layout selected'
}

const SectionListEditor = ({ sections, canEdit, sectionTypeErrors, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId }: Props) => {
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

  const addAndSelect = (type: SectionType, preset?: string) => {
    onAdd(type, preset)
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
              {sectionPresets.map((item) => (
                <button
                  key={item.preset || item.type}
                  type="button"
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => addAndSelect(item.type, item.preset)}
                >
                  <span className="block font-bold text-slate-950">{isZh ? item.label.zh : item.label.en}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{isZh ? item.description.zh : item.description.en}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export default SectionListEditor
