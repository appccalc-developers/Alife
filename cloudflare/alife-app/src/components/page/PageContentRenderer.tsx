import SectionBlock from '../page-sections/SectionBlock'
import { Fragment } from 'react'
import type { GroupPageDto } from '../../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel, SectionType } from '../../types/page-editor'
import type { PageLinkItem } from '../page-sections/types'
import SectionListEditor from '../page-editor/SectionListEditor'
import { translateUi, useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { listViewContentDefaultsForSource, normalizeListViewSource } from '../../utils/sectionSourcePresets'
import { defaultContactLocationMapEmbedUrl, defaultContactLocationMapUrl, defaultContactLocationStreetAddress } from '../../utils/contactLocation'
import { DEFAULT_HERO_IMAGE, EditableText } from '../page-sections/sectionUtils'
import { pageSectionDividerClass, pageSectionShellClass } from '../page-sections/sectionPresets'

type GroupLinkItem = {
  id: string
  name: string
  accessType: string
}

type Props = {
  page: GroupPageDto | PageEditModel
  sections: SectionEditModel[]
  subgroupItems: GroupLinkItem[]
  groupPageItems: PageLinkItem[]
  editing?: boolean
  canEdit?: boolean
  validation?: PageEditorValidation
  contextGroupId?: string
  allowGroupDataSources?: boolean
  showHeader?: boolean
  framed?: boolean
  activeSectionIndex?: number
  activeSectionFocusToken?: number
  sectionLanguageIssueCounts?: Record<number, number>
  languageFixingSectionIndex?: number | null
  message?: string
  onActiveSectionIndexChange?: (index: number) => void
  onFixSectionLanguageIssues?: (index: number) => void
  onPageChange?: (page: PageEditModel) => void
  onSectionsChange?: (sections: SectionEditModel[]) => void
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
const HOME_HERO_POSTER = '/media/alife-church-community-hero.jpg'
const HOME_VISIT_IMAGE = '/media/alife-visit.jpg'

const createEmptyRichTextSection = (): SectionEditModel => ({
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
})

export const createEmptyPageSection = (type: SectionType = 'RichText'): SectionEditModel => {
  if (type === 'Album') {
    return { order: 0, type: 'Album', contentJson: { spacing: 'normal', albumId: '' }, styleJson: { layout: 'grid' } }
  }
  if (type === 'LandingHero') {
    const title = localized('A spiritual home in the light of the South Island.', '在南岛的光里，找到一个属灵的家。')
    const body = localized(
      'Welcome visitors, seekers, and members with a warm video opening and clear next steps.',
      '用温暖的视频开场欢迎访客、慕道朋友和成员，并提供清楚的下一步。',
    )

    return {
      order: 0,
      type: 'LandingHero',
      contentJson: {
        sectionKind: 'landingHero',
        header: {
          ...createDefaultSectionHeader(),
          title,
          subtitle: body,
          align: 'left',
          scale: 'feature',
          tone: 'primary',
        },
        spacing: 'large',
        backgroundVideo: HOME_HERO_VIDEO,
        videoUrl: HOME_HERO_VIDEO,
        backgroundImage: HOME_HERO_VIDEO,
        backgroundImageUrl: HOME_HERO_VIDEO,
        posterImage: HOME_HERO_POSTER,
        posterImageUrl: HOME_HERO_POSTER,
        imageUrl: HOME_HERO_POSTER,
        title,
        headline: title,
        centerText: body,
        body,
        subtitle: body,
        subheadline: body,
        linkLabel: localized('Plan a Visit', '计划来访'),
        linkText: localized('Plan a Visit', '计划来访'),
        ctaLabel: localized('Plan a Visit', '计划来访'),
        linkUrl: '#visit',
        ctaUrl: '#visit',
        href: '#visit',
        secondaryLinkLabel: localized('Watch Sermon', '观看主日信息'),
        secondaryLabel: localized('Watch Sermon', '观看主日信息'),
        secondaryCtaLabel: localized('Watch Sermon', '观看主日信息'),
        secondaryLinkUrl: '/sermons',
        secondaryUrl: '/sermons',
        secondaryCtaUrl: '/sermons',
      },
      styleJson: {
        layout: 'landingHero',
        frontendType: 'LandingHero',
      },
    }
  }

  if (type === 'RichText') {
    return createEmptyRichTextSection()
  }

  if (type === 'Countdown') {
    const headerTitle = localized('Prepare for the next gathering.', '为下一次相聚预备。')
    const headerSubtitle = localized(
      'Use a focused countdown to help people remember the date and take the next step.',
      '用清楚的倒数提醒大家记得时间，并回应下一步。',
    )
    const cardTitle = localized('Next gathering', '下一次相聚')
    const cardBody = localized(
      'Add event details, registration timing, or a ministry invitation here.',
      '在这里加入活动详情、报名时间或服事邀请。',
    )

    return {
      order: 0,
      type: 'Countdown',
      contentJson: {
        sectionKind: 'countdown',
        header: {
          ...createDefaultSectionHeader(),
          title: headerTitle,
          subtitle: headerSubtitle,
          align: 'left',
          scale: 'normal',
          tone: 'warm',
        },
        spacing: 'large',
        countdown: {
          mode: 'custom',
          preset: 'upcoming',
          targetField: 'startDate',
          eventId: '',
        },
        eyebrow: localized('Countdown', '倒数计时'),
        title: cardTitle,
        headline: cardTitle,
        body: cardBody,
        centerText: cardBody,
        text: cardBody,
        cardEyebrow: localized('Save the date', '请预留时间'),
        countdownLabel: localized('Until it begins', '距离开始'),
        currentLabel: localized('Happening now', '正在进行'),
        completeLabel: localized('Countdown complete', '倒数已结束'),
        metaLabel: localized('Target time', '目标时间'),
        metaValue: localized('To be confirmed', '时间待确认'),
        footerText: localized('Confirm details before publishing.', '发布前请确认详情。'),
        items: [
          { text: localized('Clarify who should respond and what the next step is.', '说明谁需要回应，以及下一步是什么。') },
          { text: localized('Keep the message short enough for mobile readers.', '让信息足够简短，方便手机阅读。') },
          { text: localized('Use the button to send people to details, enrollment, or contact.', '用按钮带大家前往详情、报名或联系入口。') },
        ],
        targetDateTime: '',
        countdownTarget: '',
        endDateTime: '',
        imageUrl: '/media/alife-message-poster.jpg',
        backgroundImage: '/media/alife-message-poster.jpg',
        backgroundImageUrl: '/media/alife-message-poster.jpg',
        linkLabel: localized('Learn more', '了解更多'),
        linkText: localized('Learn more', '了解更多'),
        ctaLabel: localized('Learn more', '了解更多'),
        linkUrl: '',
        ctaUrl: '',
        href: '',
      },
      styleJson: {
        layout: 'countdown',
        frontendType: 'Countdown',
      },
    }
  }

  if (type === 'ContactLocation') {
    const locationName = localized('Chinese Abundant Life Church', '基督城华人丰盛生命教会')
    const address = localized(defaultContactLocationStreetAddress, defaultContactLocationStreetAddress)
    const addressNote = localized('Christchurch, New Zealand', 'Christchurch, New Zealand')
    const openMapLabel = localized('Open in Google Maps', '在 Google Maps 打开')

    return {
      order: 0,
      type: 'ContactLocation',
      contentJson: {
        sectionKind: 'contactLocation',
        header: {
          ...createDefaultSectionHeader(),
          title: locationName,
          subtitle: address,
          align: 'left',
          scale: 'normal',
          tone: 'primary',
        },
        datasource: 'custom',
        location: {
          mode: 'custom',
        },
        spacing: 'large',
        locationTitle: localized('Church Location', '教会地点'),
        locationName,
        title: locationName,
        streetAddress: address,
        address,
        locationAddress: addressNote,
        addressNote,
        body: addressNote,
        openMapLabel,
        linkLabel: openMapLabel,
        linkText: openMapLabel,
        ctaLabel: openMapLabel,
        mapUrl: defaultContactLocationMapUrl,
        linkUrl: defaultContactLocationMapUrl,
        ctaUrl: defaultContactLocationMapUrl,
        href: defaultContactLocationMapUrl,
        mapEmbedUrl: defaultContactLocationMapEmbedUrl,
        embedUrl: defaultContactLocationMapEmbedUrl,
      },
      styleJson: {
        layout: 'contactLocation',
        frontendType: 'ContactLocation',
      },
    }
  }

  if (type === 'Spotlight') {
    return {
      order: 0,
      type: 'Spotlight',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        presentation: 'visit',
        spotlight: {
          mode: 'manual',
          source: 'events',
          preset: 'upcoming',
        },
        media: {
          type: 'image',
          url: HOME_VISIT_IMAGE,
          position: 'left',
        },
        imageUrl: HOME_VISIT_IMAGE,
        backgroundImage: HOME_VISIT_IMAGE,
        backgroundImageUrl: HOME_VISIT_IMAGE,
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
        layout: 'visitSpotlight',
        presentation: 'visit',
        mediaPosition: 'left',
        imagePosition: 'left',
      },
    }
  }

  if (type === 'CollectionShowcase') {
    return {
      order: 0,
      type: 'CollectionShowcase',
      contentJson: {
        spacing: 'normal',
        layout: 'grid',
        ...listViewContentDefaultsForSource('sermons'),
      },
      styleJson: {},
    }
  }

  return createEmptyRichTextSection()
}

export const createPresetPageSection = (preset: string): SectionEditModel => {
  const section = createEmptyPageSection(
    preset === 'hero-home' ? 'LandingHero' :
      preset.startsWith('rich-') ? 'RichText' :
        preset === 'contact-location' ? 'ContactLocation' :
      preset.startsWith('spotlight-') ? 'Spotlight' :
        preset.startsWith('list-') ? 'CollectionShowcase' :
          'RichText',
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
        backgroundVideo: HOME_HERO_VIDEO,
        videoUrl: HOME_HERO_VIDEO,
        posterImage: HOME_HERO_POSTER,
        posterImageUrl: HOME_HERO_POSTER,
        imageUrl: HOME_HERO_POSTER,
        linkUrl: '#visit',
        ctaUrl: '#visit',
        href: '#visit',
      },
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
    const spotlightSource = groups ? 'groups' : sermons ? 'sermons' : 'events'
    const spotlightPreset = groups ? 'featured' : sermons ? 'latest' : 'upcoming'
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        presentation: visit ? 'visit' : 'spotlight',
        anchorId: visit ? 'visit' : section.contentJson.anchorId,
        spotlight: {
          mode: 'manual',
          source: spotlightSource,
          preset: spotlightPreset,
        },
        media: {
          type: 'image',
          url: visit ? HOME_VISIT_IMAGE : DEFAULT_HERO_IMAGE,
          position: visit ? 'right' : 'left',
        },
        imageUrl: visit ? HOME_VISIT_IMAGE : DEFAULT_HERO_IMAGE,
        backgroundImage: visit ? HOME_VISIT_IMAGE : DEFAULT_HERO_IMAGE,
        backgroundImageUrl: visit ? HOME_VISIT_IMAGE : DEFAULT_HERO_IMAGE,
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
      styleJson: {
        ...section.styleJson,
        layout: visit ? 'visitSpotlight' : 'spotlight',
        presentation: visit ? 'visit' : 'spotlight',
        mediaPosition: visit ? 'right' : 'left',
        imagePosition: visit ? 'right' : 'left',
      },
    }
  }

  if (preset === 'contact-location') {
    return section
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

const PageContentRenderer = ({
  page,
  sections,
  groupPageItems,
  editing = false,
  canEdit = false,
  validation = { sectionTypeErrors: [] },
  contextGroupId,
  allowGroupDataSources = true,
  showHeader = true,
  framed = true,
  activeSectionIndex,
  activeSectionFocusToken,
  sectionLanguageIssueCounts,
  languageFixingSectionIndex,
  message,
  onActiveSectionIndexChange,
  onFixSectionLanguageIssues,
  onSectionsChange,
}: Props) => {
  const auth = useAuthStore()
  const t = useUiText()
  const pageTitle = localizeText(page.title, auth.language)
  const pageDescription = localizeText(page.description, auth.language)
  const pageId = page.id || undefined

  const updateSections = (nextSections: SectionEditModel[]) => onSectionsChange?.(normalizePageSections(nextSections))

  const addSection = (type: SectionType) => updateSections([...sections, createEmptyPageSection(type)])

  const insertSection = (index: number, type: SectionType) => {
    const nextSections = [...sections]
    const targetIndex = Math.max(0, Math.min(index, nextSections.length))
    nextSections.splice(targetIndex, 0, createEmptyPageSection(type))
    updateSections(nextSections)
  }

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

  const useFlatSectionRender = !editing && !showHeader && !framed
  const useFlatEditingChrome = editing && !showHeader && !framed
  const articleClassName = framed
    ? 'w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
    : 'w-full min-w-0'
  if (useFlatSectionRender) {
    return (
      <>
        {sections.map((section, index) => (
          <Fragment key={section.id || `${section.order}-${section.type}`}>
            <SectionBlock
              section={section}
              mode="render"
              page={page as GroupPageDto}
              groupPageItems={groupPageItems}
              contextGroupId={contextGroupId}
              allowGroupDataSources={allowGroupDataSources}
              pageId={pageId}
              domId={getPageSectionDomId(section, index)}
            />
            {index < sections.length - 1 ? <hr className={pageSectionDividerClass} /> : null}
          </Fragment>
        ))}

        {sections.length === 0 ? (
          <section className={pageSectionShellClass}>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">{t('noSectionsYet')}</div>
          </section>
        ) : null}
      </>
    )
  }

  if (useFlatEditingChrome) {
    return (
      <SectionListEditor
        sections={sections}
        canEdit={canEdit}
        sectionTypeErrors={validation.sectionTypeErrors}
        contextGroupId={contextGroupId}
        pageId={pageId}
        activeIndex={activeSectionIndex}
        activeFocusToken={activeSectionFocusToken}
        languageIssueCounts={sectionLanguageIssueCounts}
        languageFixingSectionIndex={languageFixingSectionIndex}
        onActiveIndexChange={onActiveSectionIndexChange}
        onFixLanguageIssues={onFixSectionLanguageIssues}
        onAdd={addSection}
        onInsert={insertSection}
        onUpdate={({ index, section }) => updateSection(index, section)}
        onRemove={removeSection}
        onMoveUp={(index) => moveSection(index, -1)}
        onMoveDown={(index) => moveSection(index, 1)}
      />
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
          activeIndex={activeSectionIndex}
          activeFocusToken={activeSectionFocusToken}
          languageIssueCounts={sectionLanguageIssueCounts}
          languageFixingSectionIndex={languageFixingSectionIndex}
          onActiveIndexChange={onActiveSectionIndexChange}
          onFixLanguageIssues={onFixSectionLanguageIssues}
          onAdd={addSection}
          onInsert={insertSection}
          onUpdate={({ index, section }) => updateSection(index, section)}
          onRemove={removeSection}
          onMoveUp={(index) => moveSection(index, -1)}
          onMoveDown={(index) => moveSection(index, 1)}
        />
      ) : (
        <>
          {sections.map((section, index) => (
            <Fragment key={section.id || `${section.order}-${section.type}`}>
              <SectionBlock
                section={section}
                mode="render"
                page={page as GroupPageDto}
                groupPageItems={groupPageItems}
                contextGroupId={contextGroupId}
                allowGroupDataSources={allowGroupDataSources}
                pageId={pageId}
                domId={getPageSectionDomId(section, index)}
              />
              {index < sections.length - 1 ? <hr className={pageSectionDividerClass} /> : null}
            </Fragment>
          ))}

          {sections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">{t('noSectionsYet')}</div>
          ) : null}
        </>
      )}

    </article>
  )
}

export default PageContentRenderer
