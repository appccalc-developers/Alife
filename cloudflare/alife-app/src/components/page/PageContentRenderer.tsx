import SectionBlock from '../page-sections/SectionBlock'
import type { ReactNode } from 'react'
import type { GroupPageDto } from '../../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel, SectionType } from '../../types/page-editor'
import type { PageLinkItem } from '../page-sections/types'
import SectionListEditor from '../page-editor/SectionListEditor'
import { translateUi, useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { listViewContentDefaultsForSource, normalizeListViewSource } from '../../utils/sectionSourcePresets'
import { DEFAULT_HERO_ASPECT_RATIO, DEFAULT_HERO_IMAGE, EditableText } from '../page-sections/sectionUtils'

type GroupLinkItem = {
  id: string
  name: string
  accessType: string
}

type PageSectionChromeVariant = 'default' | 'home'

type Props = {
  page: GroupPageDto | PageEditModel
  sections: SectionEditModel[]
  subgroupItems: GroupLinkItem[]
  groupPageItems: PageLinkItem[]
  editing?: boolean
  canEdit?: boolean
  validation?: PageEditorValidation
  contextGroupId?: string
  showHeader?: boolean
  framed?: boolean
  sectionChrome?: PageSectionChromeVariant
  message?: string
  onPageChange?: (page: PageEditModel) => void
  onSectionsChange?: (sections: SectionEditModel[]) => void
  onEditPage?: (pageId: string, groupId: string) => void
}

const createDefaultSectionHeader = () => ({
  title: { en: '', zh: '' },
  subtitle: { en: '', zh: '' },
  align: 'center' as const,
  scale: 'normal' as const,
  tone: 'default' as const,
})

const localized = (en: string, zh: string) => ({ en, zh })
const HOME_HERO_VIDEO = '/media/homepage-hero.mp4'

export const createEmptyPageSection = (type: SectionType = 'Hero'): SectionEditModel => {
  if (type === 'RichText') {
    return {
      order: 0,
      type: 'RichText',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        title: '',
        subtitle: '',
        text: '',
      },
      styleJson: {},
    }
  }

  if (type === 'Spotlight') {
    return {
      order: 0,
      type: 'Spotlight',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        spotlight: {
          mode: 'manual',
          source: 'sermons',
          preset: 'latest',
        },
        media: {
          type: 'image',
          url: DEFAULT_HERO_IMAGE,
          position: 'left',
        },
        imageUrl: DEFAULT_HERO_IMAGE,
        backgroundImage: DEFAULT_HERO_IMAGE,
        backgroundImageUrl: DEFAULT_HERO_IMAGE,
        title: '',
        headline: '',
        subtitle: '',
        subheadline: '',
        centerText: '',
        body: '',
        text: '',
        youtubeUrl: '',
        linkLabel: '',
        linkText: '',
        ctaLabel: '',
        linkUrl: '',
        ctaUrl: '',
        href: '',
      },
      styleJson: {
        layout: 'spotlight',
        mediaPosition: 'left',
        imagePosition: 'left',
      },
    }
  }

  if (type === 'ListView') {
    return {
      order: 0,
      type: 'ListView',
      contentJson: {
        spacing: 'normal',
        layout: 'grid',
        ...listViewContentDefaultsForSource('sermons'),
      },
      styleJson: {},
    }
  }

  if (type === 'Sermon') {
    return {
      order: 0,
      type: 'Sermon',
      contentJson: {
        header: {
          icon: 'mic',
          title: localized('Featured message', '精选讲道'),
          subtitle: localized('Embed one sermon video from YouTube.', '嵌入一段 YouTube 讲道视频。'),
          align: 'left',
          scale: 'normal',
          tone: 'primary',
        },
        spacing: 'normal',
        title: localized('Featured message', '精选讲道'),
        youtubeUrl: '',
      },
      styleJson: {},
    }
  }

  return {
    order: 0,
    type: 'Hero',
    contentJson: {
      header: createDefaultSectionHeader(),
      spacing: 'normal',
      backgroundImage: DEFAULT_HERO_IMAGE,
      backgroundImageUrl: DEFAULT_HERO_IMAGE,
      title: '',
      headline: '',
      centerText: '',
      body: '',
      subtitle: '',
      subheadline: '',
      linkLabel: '',
      linkText: '',
      ctaLabel: '',
      linkUrl: '',
      ctaUrl: '',
      href: '',
    },
    styleJson: { layout: 'featured', aspectRatio: DEFAULT_HERO_ASPECT_RATIO },
  }
}

export const createPresetPageSection = (preset: string): SectionEditModel => {
  const section = createEmptyPageSection(
    preset.startsWith('rich-') ? 'RichText' :
      preset.startsWith('spotlight-') ? 'Spotlight' :
        preset.startsWith('list-') ? 'ListView' :
          preset === 'sermon-embed' ? 'Sermon' :
            'Hero',
  )

  if (preset === 'hero-home') {
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        title: localized('Meet Christ here. Grow through real community.', '在基督里相遇，在真实关系中成长。'),
        headline: localized('Meet Christ here. Grow through real community.', '在基督里相遇，在真实关系中成长。'),
        centerText: localized('A welcoming first screen for visitors, seekers, and members.', '为访客、慕道朋友和成员准备的首页主视觉。'),
        body: localized('A welcoming first screen for visitors, seekers, and members.', '为访客、慕道朋友和成员准备的首页主视觉。'),
        linkLabel: localized('Plan your visit', '计划来访'),
        linkText: localized('Plan your visit', '计划来访'),
        ctaLabel: localized('Plan your visit', '计划来访'),
        backgroundImage: HOME_HERO_VIDEO,
        backgroundImageUrl: HOME_HERO_VIDEO,
        linkUrl: '#visit',
        ctaUrl: '#visit',
        href: '#visit',
      },
    }
  }

  if (preset === 'hero-event') {
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        title: localized('Upcoming gathering', '近期聚会'),
        headline: localized('Upcoming gathering', '近期聚会'),
        centerText: localized('Invite people into the next church-wide moment.', '邀请大家参与下一次全教会活动。'),
        body: localized('Invite people into the next church-wide moment.', '邀请大家参与下一次全教会活动。'),
        linkLabel: localized('See details', '查看详情'),
        linkText: localized('See details', '查看详情'),
        ctaLabel: localized('See details', '查看详情'),
      },
      styleJson: { ...section.styleJson, layout: 'poster' },
    }
  }

  if (preset === 'rich-welcome' || preset === 'rich-faq' || preset === 'rich-steps') {
    const title = preset === 'rich-faq'
      ? localized('Common questions', '常见问题')
      : preset === 'rich-steps'
        ? localized('What to expect', '你可以期待什么')
        : localized('Welcome', '欢迎你')
    const text = preset === 'rich-faq'
      ? localized('Add answers about language, children, parking, service time, and how to connect.', '可以补充语言、儿童、停车、聚会时间和如何连接等问题。')
      : preset === 'rich-steps'
        ? localized('Share the simple path: arrive, worship, meet people, and find a group.', '说明简单路径：抵达、敬拜、认识朋友、加入小组。')
        : localized('Write a warm introduction for people visiting this page for the first time.', '为第一次来到这个页面的人写一段温暖介绍。')
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        header: { title, subtitle: localized('', ''), align: 'left', scale: 'normal', tone: 'default' },
        title,
        text,
      },
    }
  }

  if (preset.startsWith('spotlight-')) {
    const visit = preset === 'spotlight-visit'
    const groups = preset === 'spotlight-groups'
    const sermons = preset === 'spotlight-sermons'
    const title = visit
      ? localized('Make your first visit simple.', '让第一次来访更简单。')
      : groups
        ? localized('Faith grows in groups.', '信仰在小组里成长。')
        : sermons
          ? localized('Keep reflecting through sermons.', '透过讲道继续思想。')
          : localized('Ministry spotlight', '事工重点')
    const body = visit
      ? localized('Add location, welcome details, and what people can expect.', '加入地点、欢迎信息和现场流程。')
      : groups
        ? localized('Highlight how people can find belonging and care.', '强调人如何找到归属与关怀。')
        : sermons
          ? localized('Feature a message, series, or teaching theme.', '展示一篇讲道、系列或教导主题。')
          : localized('Tell one focused story with text, media, and a clear action.', '用文字、媒体和行动按钮讲述一个重点故事。')
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        header: { title, subtitle: localized('', ''), align: 'left', scale: 'normal', tone: 'default' },
        title,
        headline: title,
        centerText: body,
        body,
        text: body,
        linkLabel: localized('Learn more', '了解更多'),
        linkText: localized('Learn more', '了解更多'),
        ctaLabel: localized('Learn more', '了解更多'),
      },
      styleJson: { ...section.styleJson, mediaPosition: visit ? 'right' : 'left', imagePosition: visit ? 'right' : 'left' },
    }
  }

  if (preset.startsWith('list-')) {
    const source =
      preset === 'list-events' || preset === 'list-event-coverflow' ? 'events'
        : preset === 'list-groups' ? 'groups'
          : preset === 'list-pages' ? 'pages'
            : preset === 'list-members' ? 'members'
              : preset === 'list-posts' ? 'posts'
                : 'sermons'
    const listSource = normalizeListViewSource(source)
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        ...listViewContentDefaultsForSource(listSource, section.contentJson.header),
        layout: preset === 'list-carousel' ? 'carousel' : preset === 'list-event-coverflow' ? 'coverflow' : 'grid',
      },
    }
  }

  if (preset === 'sermon-embed') {
    return {
      ...section,
      type: 'Sermon',
      contentJson: {
        ...section.contentJson,
        title: localized('Featured message', '精选讲道'),
        youtubeUrl: '',
      },
      styleJson: {},
    }
  }

  return section
}

export const normalizePageSections = (items: SectionEditModel[]) =>
  items.map((section, index) => ({
    ...section,
    order: index,
  }))

export const getPageSectionDomId = (section: SectionEditModel, index: number) => {
  const rawId = typeof section.contentJson.anchorId === 'string' && section.contentJson.anchorId.trim()
    ? section.contentJson.anchorId.trim()
    : typeof section.contentJson.navId === 'string' && section.contentJson.navId.trim()
      ? section.contentJson.navId.trim()
      : ''
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || `home-section-${index + 1}`
}

export const validatePageContent = (model: PageEditModel, language = 'en'): PageEditorValidation => ({
  sectionTypeErrors: model.sections.map((section) => (section.type ? '' : translateUi(language, 'sectionTypeRequired'))),
})

const PageSectionChrome = ({
  children,
  domId,
  variant = 'default',
  separatorAfter = false,
}: {
  children: ReactNode
  domId: string
  variant?: PageSectionChromeVariant
  separatorAfter?: boolean
}) => {
  if (variant === 'home') {
    return (
      <>
        {children}
        {separatorAfter ? <hr className="mx-auto max-w-6xl border-t border-home-border/40" /> : null}
      </>
    )
  }

  return (
    <div id={domId} className="scroll-mt-24">
      {children}
    </div>
  )
}

const PageContentRenderer = ({
  page,
  sections,
  groupPageItems,
  editing = false,
  canEdit = false,
  validation = { sectionTypeErrors: [] },
  contextGroupId,
  showHeader = true,
  framed = true,
  sectionChrome = 'default',
  message,
  onSectionsChange,
  onEditPage,
}: Props) => {
  const auth = useAuthStore()
  const t = useUiText()
  const pageTitle = localizeText(page.title, auth.language)
  const pageDescription = localizeText(page.description, auth.language)
  const pageId = page.id || undefined

  const updateSections = (nextSections: SectionEditModel[]) => onSectionsChange?.(normalizePageSections(nextSections))

  const addSection = (type: SectionType) => updateSections([...sections, createEmptyPageSection(type)])

  const updateSection = (index: number, section: SectionEditModel) => {
    const nextSections = [...sections]
    nextSections[index] = section
    updateSections(nextSections)
  }

  const removeSection = (index: number) => {
    const nextSections = [...sections]
    nextSections.splice(index, 1)
    updateSections(nextSections)
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= sections.length) {
      return
    }

    const nextSections = [...sections]
    const [item] = nextSections.splice(index, 1)
    if (!item) {
      return
    }

    nextSections.splice(nextIndex, 0, item)
    updateSections(nextSections)
  }

  const useHomeSectionChrome = sectionChrome === 'home' && !editing
  const articleClassName = framed
    ? 'w-full min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
    : useHomeSectionChrome
      ? 'w-full min-w-0'
      : 'w-full min-w-0 space-y-4'
  const sectionsClassName = useHomeSectionChrome ? undefined : 'space-y-4'
  const editPageAction = 'ownerGroupId' in page && page.ownerGroupId && onEditPage ? (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
        type="button"
        onClick={() => onEditPage(page.id, page.ownerGroupId as string)}
      >
        {t('editPage')}
      </button>
    </div>
  ) : null
  const renderedSections = (
    <>
      {sections.map((section, index) => {
        const domId = getPageSectionDomId(section, index)

        return (
          <PageSectionChrome
            key={section.id || `${section.order}-${section.type}`}
            domId={domId}
            variant={useHomeSectionChrome ? 'home' : 'default'}
            separatorAfter={useHomeSectionChrome && index < sections.length - 1}
          >
            <SectionBlock
              section={section}
              mode="render"
              page={page as GroupPageDto}
              groupPageItems={groupPageItems}
              contextGroupId={contextGroupId}
              pageId={pageId}
              sectionDomId={useHomeSectionChrome ? domId : undefined}
              sectionRootClassName={useHomeSectionChrome ? 'scroll-mt-24' : undefined}
            />
          </PageSectionChrome>
        )
      })}

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">{t('noSectionsYet')}</div>
      ) : null}
    </>
  )

  if (useHomeSectionChrome && !showHeader) {
    return (
      <>
        {renderedSections}
        {editPageAction}
      </>
    )
  }

  return (
    <article className={articleClassName}>
      {showHeader ? (
        <header className="space-y-2 border-b border-slate-200 pb-3">
          <EditableText
            as="h1"
            value={pageTitle}
            fallback={t('untitledPage')}
            className="text-2xl font-bold text-slate-900 sm:text-3xl"
          />
          <EditableText
            as="p"
            multiline
            value={pageDescription}
            fallback={t('pageDescriptionEmpty')}
            className="text-sm text-slate-600"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t('visibilityLabel', { visibility: page.visibility })}</span>
          </div>
          {message ? <p className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-sm text-blue-700">{message}</p> : null}
        </header>
      ) : null}

      {editing ? (
        <SectionListEditor
          sections={sections}
          canEdit={canEdit}
          sectionTypeErrors={validation.sectionTypeErrors}
          contextGroupId={contextGroupId}
          pageId={pageId}
          onAdd={addSection}
          onUpdate={({ index, section }) => updateSection(index, section)}
          onRemove={removeSection}
          onMoveUp={(index) => moveSection(index, -1)}
          onMoveDown={(index) => moveSection(index, 1)}
        />
      ) : (
        <div className={sectionsClassName}>
          {renderedSections}
        </div>
      )}

      {editPageAction}
    </article>
  )
}

export default PageContentRenderer
