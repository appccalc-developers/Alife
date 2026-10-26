import { pageContentRendererText } from '../../i18n/pageContentRenderer.ts'
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
import {
  defaultContactLocationMapEmbedUrl,
  defaultContactLocationMapUrl,
  defaultContactLocationStreetAddress,
  defaultLocationInquiryContactName,
  defaultLocationInquiryContactPhone,
} from '../../utils/contactLocation'
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
  sectionHeroHeadingLevel?: 'h1' | 'h2'
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
    const title = localized(pageContentRendererText.aSpiritualHomeInTheLightOfTheSouth.en, pageContentRendererText.aSpiritualHomeInTheLightOfTheSouth.zh)
    const body = localized(
      pageContentRendererText.welcomeVisitorsSeekersAndMembersWithAWarmVideo.en,
      pageContentRendererText.welcomeVisitorsSeekersAndMembersWithAWarmVideo.zh,
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
        linkLabel: localized(pageContentRendererText.planAVisit.en, pageContentRendererText.planAVisit.zh),
        linkText: localized(pageContentRendererText.planAVisit.en, pageContentRendererText.planAVisit.zh),
        ctaLabel: localized(pageContentRendererText.planAVisit.en, pageContentRendererText.planAVisit.zh),
        linkUrl: '#visit',
        ctaUrl: '#visit',
        href: '#visit',
        secondaryLinkLabel: localized(pageContentRendererText.watchSermon.en, pageContentRendererText.watchSermon.zh),
        secondaryLabel: localized(pageContentRendererText.watchSermon.en, pageContentRendererText.watchSermon.zh),
        secondaryCtaLabel: localized(pageContentRendererText.watchSermon.en, pageContentRendererText.watchSermon.zh),
        secondaryLinkUrl: '/sermons',
        secondaryUrl: '/sermons',
        secondaryCtaUrl: '/sermons',
      },
      styleJson: {
        layout: 'landingHero',
        frontendType: 'LandingHero',
        bottomFade: true,
        bottomGradient: true,
      },
    }
  }

  if (type === 'RichText') {
    return createEmptyRichTextSection()
  }

  if (type === 'Countdown') {
    const headerTitle = localized(pageContentRendererText.prepareForTheNextGathering.en, pageContentRendererText.prepareForTheNextGathering.zh)
    const headerSubtitle = localized(
      pageContentRendererText.useAFocusedCountdownToHelpPeopleRememberThe.en,
      pageContentRendererText.useAFocusedCountdownToHelpPeopleRememberThe.zh,
    )
    const cardTitle = localized(pageContentRendererText.nextGathering.en, pageContentRendererText.nextGathering.zh)
    const cardBody = localized(
      pageContentRendererText.addEventDetailsRegistrationTimingOrAMinistryInvitation.en,
      pageContentRendererText.addEventDetailsRegistrationTimingOrAMinistryInvitation.zh,
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
        eyebrow: localized(pageContentRendererText.countdown.en, pageContentRendererText.countdown.zh),
        title: cardTitle,
        headline: cardTitle,
        body: cardBody,
        centerText: cardBody,
        text: cardBody,
        cardEyebrow: localized(pageContentRendererText.saveTheDate.en, pageContentRendererText.saveTheDate.zh),
        countdownLabel: localized(pageContentRendererText.untilItBegins.en, pageContentRendererText.untilItBegins.zh),
        currentLabel: localized(pageContentRendererText.happeningNow.en, pageContentRendererText.happeningNow.zh),
        completeLabel: localized(pageContentRendererText.countdownComplete.en, pageContentRendererText.countdownComplete.zh),
        metaLabel: localized(pageContentRendererText.targetTime.en, pageContentRendererText.targetTime.zh),
        metaValue: localized(pageContentRendererText.toBeConfirmed.en, pageContentRendererText.toBeConfirmed.zh),
        footerText: localized(pageContentRendererText.confirmDetailsBeforePublishing.en, pageContentRendererText.confirmDetailsBeforePublishing.zh),
        items: [
          { text: localized(pageContentRendererText.clarifyWhoShouldRespondAndWhatTheNextStep.en, pageContentRendererText.clarifyWhoShouldRespondAndWhatTheNextStep.zh) },
          { text: localized(pageContentRendererText.keepTheMessageShortEnoughForMobileReaders.en, pageContentRendererText.keepTheMessageShortEnoughForMobileReaders.zh) },
          { text: localized(pageContentRendererText.useTheButtonToSendPeopleToDetailsEnrollment.en, pageContentRendererText.useTheButtonToSendPeopleToDetailsEnrollment.zh) },
        ],
        targetDateTime: '',
        countdownTarget: '',
        endDateTime: '',
        imageUrl: '/media/alife-message-poster.jpg',
        backgroundImage: '/media/alife-message-poster.jpg',
        backgroundImageUrl: '/media/alife-message-poster.jpg',
        linkLabel: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
        linkText: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
        ctaLabel: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
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
    const locationName = localized(pageContentRendererText.chineseAbundantLifeChurch.en, pageContentRendererText.chineseAbundantLifeChurch.zh)
    const address = localized(defaultContactLocationStreetAddress, defaultContactLocationStreetAddress)
    const addressNote = localized('Christchurch, New Zealand', 'Christchurch, New Zealand')
    const contactName = localized(defaultLocationInquiryContactName, defaultLocationInquiryContactName)
    const contactNameLabel = localized(pageContentRendererText.inquiryContact.en, pageContentRendererText.inquiryContact.zh)
    const contactPhoneLabel = localized(pageContentRendererText.phone.en, pageContentRendererText.phone.zh)
    const openMapLabel = localized(pageContentRendererText.openInGoogleMaps.en, pageContentRendererText.openInGoogleMaps.zh)

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
        locationTitle: localized(pageContentRendererText.churchLocation.en, pageContentRendererText.churchLocation.zh),
        locationName,
        title: locationName,
        streetAddress: address,
        address,
        locationAddress: addressNote,
        addressNote,
        body: addressNote,
        contactName,
        contactNameLabel,
        contactPhone: defaultLocationInquiryContactPhone,
        contactPhoneLabel,
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
        presentation: 'spotlight',
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
        presentation: 'spotlight',
        mediaPosition: 'left',
        imagePosition: 'left',
      },
    }
  }

  if (type === 'ReviewedPageCarousel') {
    return {
      order: 0,
      type: 'ReviewedPageCarousel',
      contentJson: {
        sectionKind: 'reviewedPageCarousel',
        header: {
          ...createDefaultSectionHeader(),
          title: localized(pageContentRendererText.exploreOurCommunity.en, pageContentRendererText.exploreOurCommunity.zh),
          subtitle: localized(
            pageContentRendererText.discoverMoreThroughThePagesInThisMenu.en,
            pageContentRendererText.discoverMoreThroughThePagesInThisMenu.zh,
          ),
          align: 'left',
          tone: 'fresh',
        },
        spacing: 'normal',
        primaryMenuId: '',
      },
      styleJson: {
        layout: 'reviewedPageCarousel',
        frontendType: 'ReviewedPageCarousel',
        contentWidth: 'contained',
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
  const isSpotlightPreset = preset === 'spotlight-event' || preset === 'spotlight-groups' || preset === 'spotlight-sermons'
  const section = createEmptyPageSection(
    preset === 'hero-home' ? 'LandingHero' :
      preset.startsWith('rich-') ? 'RichText' :
        preset === 'contact-location' ? 'ContactLocation' :
      isSpotlightPreset ? 'Spotlight' :
        preset.startsWith('list-') ? 'CollectionShowcase' :
          'RichText',
  )

  if (preset === 'hero-home') {
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        title: localized(pageContentRendererText.meetChristHereGrowThroughRealCommunity.en, pageContentRendererText.meetChristHereGrowThroughRealCommunity.zh),
        headline: localized(pageContentRendererText.meetChristHereGrowThroughRealCommunity.en, pageContentRendererText.meetChristHereGrowThroughRealCommunity.zh),
        centerText: localized(pageContentRendererText.aWelcomingFirstScreenForVisitorsSeekersAndMembers.en, pageContentRendererText.aWelcomingFirstScreenForVisitorsSeekersAndMembers.zh),
        body: localized(pageContentRendererText.aWelcomingFirstScreenForVisitorsSeekersAndMembers.en, pageContentRendererText.aWelcomingFirstScreenForVisitorsSeekersAndMembers.zh),
        linkLabel: localized(pageContentRendererText.planYourVisit.en, pageContentRendererText.planYourVisit.zh),
        linkText: localized(pageContentRendererText.planYourVisit.en, pageContentRendererText.planYourVisit.zh),
        ctaLabel: localized(pageContentRendererText.planYourVisit.en, pageContentRendererText.planYourVisit.zh),
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
      ? localized(pageContentRendererText.commonQuestions.en, pageContentRendererText.commonQuestions.zh)
      : preset === 'rich-steps'
        ? localized(pageContentRendererText.whatToExpect.en, pageContentRendererText.whatToExpect.zh)
        : localized(pageContentRendererText.welcome.en, pageContentRendererText.welcome.zh)
    const text = preset === 'rich-faq'
      ? localized(pageContentRendererText.addAnswersAboutLanguageChildrenParkingServiceTimeAnd.en, pageContentRendererText.addAnswersAboutLanguageChildrenParkingServiceTimeAnd.zh)
      : preset === 'rich-steps'
        ? localized(pageContentRendererText.shareTheSimplePathArriveWorshipMeetPeopleAnd.en, pageContentRendererText.shareTheSimplePathArriveWorshipMeetPeopleAnd.zh)
        : localized(pageContentRendererText.writeAWarmIntroductionForPeopleVisitingThisPage.en, pageContentRendererText.writeAWarmIntroductionForPeopleVisitingThisPage.zh)
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

  if (isSpotlightPreset) {
    const groups = preset === 'spotlight-groups'
    const sermons = preset === 'spotlight-sermons'
    const title = groups
      ? localized(pageContentRendererText.faithGrowsInGroups.en, pageContentRendererText.faithGrowsInGroups.zh)
      : sermons
        ? localized(pageContentRendererText.keepReflectingThroughSermons.en, pageContentRendererText.keepReflectingThroughSermons.zh)
        : localized(pageContentRendererText.ministrySpotlight.en, pageContentRendererText.ministrySpotlight.zh)
    const body = groups
      ? localized(pageContentRendererText.highlightHowPeopleCanFindBelongingAndCare.en, pageContentRendererText.highlightHowPeopleCanFindBelongingAndCare.zh)
      : sermons
        ? localized(pageContentRendererText.featureAMessageSeriesOrTeachingTheme.en, pageContentRendererText.featureAMessageSeriesOrTeachingTheme.zh)
        : localized(pageContentRendererText.tellOneFocusedStoryWithTextMediaAndA.en, pageContentRendererText.tellOneFocusedStoryWithTextMediaAndA.zh)
    const spotlightSource = groups ? 'groups' : sermons ? 'sermons' : 'events'
    const spotlightPreset = groups ? 'featured' : sermons ? 'latest' : 'upcoming'
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        presentation: 'spotlight',
        spotlight: {
          mode: 'manual',
          source: spotlightSource,
          preset: spotlightPreset,
        },
        media: {
          type: 'image',
          url: DEFAULT_HERO_IMAGE,
          position: 'left',
        },
        imageUrl: DEFAULT_HERO_IMAGE,
        backgroundImage: DEFAULT_HERO_IMAGE,
        backgroundImageUrl: DEFAULT_HERO_IMAGE,
        header: { title, subtitle: localized('', ''), align: 'left', scale: 'normal', tone: 'default' },
        title,
        headline: title,
        centerText: body,
        body,
        text: body,
        linkLabel: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
        linkText: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
        ctaLabel: localized(pageContentRendererText.learnMore.en, pageContentRendererText.learnMore.zh),
      },
      styleJson: {
        ...section.styleJson,
        layout: 'spotlight',
        presentation: 'spotlight',
        mediaPosition: 'left',
        imagePosition: 'left',
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
  sectionHeroHeadingLevel = 'h1',
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
              headingLevel={sectionHeroHeadingLevel}
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
                headingLevel={sectionHeroHeadingLevel}
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
