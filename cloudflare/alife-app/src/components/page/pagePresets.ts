import { pagePresetsText } from '../../i18n/pagePresets.ts'
import type { LocalizedText } from '../../types'
import type { ListViewLayout, PageEditModel, SectionEditModel } from '../../types/page-editor'
import { createEmptyPageSection, createPresetPageSection, normalizePageSections } from './PageContentRenderer'

export type PagePresetId = 'blank' | 'home' | 'ministry' | 'event' | 'sermon' | 'album' | 'post' | 'contact'

export type PagePresetDefinition = {
  id: PagePresetId
  name: LocalizedText
  description: LocalizedText
  sectionNames: LocalizedText[]
}

const localized = (en: string, zh: string): LocalizedText => ({ en, zh })

export const PAGE_PRESETS: PagePresetDefinition[] = [
  {
    id: 'blank',
    name: localized(pagePresetsText.blankPage.en, pagePresetsText.blankPage.zh),
    description: localized(pagePresetsText.startWithAnEmptyPageAndAddSectionsYourself.en, pagePresetsText.startWithAnEmptyPageAndAddSectionsYourself.zh),
    sectionNames: [],
  },
  {
    id: 'home',
    name: localized(pagePresetsText.homePage.en, pagePresetsText.homePage.zh),
    description: localized(pagePresetsText.welcomeVisitorsAndGuideThemToMinistriesAndYour.en, pagePresetsText.welcomeVisitorsAndGuideThemToMinistriesAndYour.zh),
    sectionNames: [localized(pagePresetsText.hero.en, pagePresetsText.hero.zh), localized(pagePresetsText.aboutRichText.en, pagePresetsText.aboutRichText.zh), localized(pagePresetsText.ministryCollection.en, pagePresetsText.ministryCollection.zh), localized(pagePresetsText.locationContact.en, pagePresetsText.locationContact.zh)],
  },
  {
    id: 'ministry',
    name: localized(pagePresetsText.ministryPage.en, pagePresetsText.ministryPage.zh),
    description: localized(pagePresetsText.introduceAMinistryItsWorkAndAClearContact.en, pagePresetsText.introduceAMinistryItsWorkAndAClearContact.zh),
    sectionNames: [localized(pagePresetsText.landingHero.en, pagePresetsText.landingHero.zh), localized(pagePresetsText.richText.en, pagePresetsText.richText.zh), localized(pagePresetsText.infoCards.en, pagePresetsText.infoCards.zh), localized(pagePresetsText.contactSpotlight.en, pagePresetsText.contactSpotlight.zh)],
  },
  {
    id: 'event',
    name: localized(pagePresetsText.eventPage.en, pagePresetsText.eventPage.zh),
    description: localized(pagePresetsText.featureAnEventWithDetailsPhotosAndContactInformation.en, pagePresetsText.featureAnEventWithDetailsPhotosAndContactInformation.zh),
    sectionNames: [localized(pagePresetsText.eventHero.en, pagePresetsText.eventHero.zh), localized(pagePresetsText.eventSpotlight.en, pagePresetsText.eventSpotlight.zh), localized(pagePresetsText.albumGallery.en, pagePresetsText.albumGallery.zh), localized(pagePresetsText.contact.en, pagePresetsText.contact.zh)],
  },
  {
    id: 'sermon',
    name: localized(pagePresetsText.sermonPage.en, pagePresetsText.sermonPage.zh),
    description: localized(pagePresetsText.featureOneMessageAndProvideASermonCollection.en, pagePresetsText.featureOneMessageAndProvideASermonCollection.zh),
    sectionNames: [localized(pagePresetsText.hero.en, pagePresetsText.hero.zh), localized(pagePresetsText.sermonSpotlight.en, pagePresetsText.sermonSpotlight.zh), localized(pagePresetsText.sermonCollection.en, pagePresetsText.sermonCollection.zh)],
  },
  {
    id: 'album',
    name: localized(pagePresetsText.albumPage.en, pagePresetsText.albumPage.zh),
    description: localized(pagePresetsText.buildAVisualPageFromAMainAlbumAnd.en, pagePresetsText.buildAVisualPageFromAMainAlbumAnd.zh),
    sectionNames: [localized(pagePresetsText.hero.en, pagePresetsText.hero.zh), localized(pagePresetsText.albumCollection.en, pagePresetsText.albumCollection.zh), localized(pagePresetsText.nestedAlbum.en, pagePresetsText.nestedAlbum.zh)],
  },
  {
    id: 'post',
    name: localized(pagePresetsText.postPage.en, pagePresetsText.postPage.zh),
    description: localized(pagePresetsText.startAFocusedBilingualArticleOrUpdate.en, pagePresetsText.startAFocusedBilingualArticleOrUpdate.zh),
    sectionNames: [localized(pagePresetsText.sectionHeader.en, pagePresetsText.sectionHeader.zh), localized(pagePresetsText.richText.en, pagePresetsText.richText.zh)],
  },
  {
    id: 'contact',
    name: localized(pagePresetsText.contactPage.en, pagePresetsText.contactPage.zh),
    description: localized(pagePresetsText.givePeopleClearContactAndLocationOptions.en, pagePresetsText.givePeopleClearContactAndLocationOptions.zh),
    sectionNames: [localized(pagePresetsText.hero.en, pagePresetsText.hero.zh), localized(pagePresetsText.contactList.en, pagePresetsText.contactList.zh), localized(pagePresetsText.locationContact.en, pagePresetsText.locationContact.zh)],
  },
]

// The role names document how a section is used by a preset. They are intentionally
// not persisted: after initialization every section is just a normal CMS section.
const withRole = (section: SectionEditModel, _presetRole: string): SectionEditModel => section

const createHero = (role: string, title: LocalizedText, body: LocalizedText) => {
  const section = createEmptyPageSection('LandingHero')
  return withRole({
    ...section,
    contentJson: {
      ...section.contentJson,
      header: { ...section.contentJson.header as object, title, subtitle: body },
      title,
      headline: title,
      centerText: body,
      body,
      subtitle: body,
      subheadline: body,
      linkLabel: localized('', ''),
      linkText: localized('', ''),
      ctaLabel: localized('', ''),
      linkUrl: '',
      ctaUrl: '',
      href: '',
      secondaryLinkLabel: localized('', ''),
      secondaryLabel: localized('', ''),
      secondaryCtaLabel: localized('', ''),
      secondaryLinkUrl: '',
      secondaryUrl: '',
      secondaryCtaUrl: '',
    },
  }, role)
}

const createRichText = (role: string, title: LocalizedText, text: LocalizedText) => {
  const section = createEmptyPageSection('RichText')
  return withRole({
    ...section,
    contentJson: {
      ...section.contentJson,
      header: { ...section.contentJson.header as object, title, subtitle: localized('', ''), align: 'left' },
      title,
      text,
    },
  }, role)
}

const createList = (preset: string, role: string, title: LocalizedText, subtitle: LocalizedText, layout: ListViewLayout = 'cards') => {
  const section = createPresetPageSection(preset)
  return withRole({
    ...section,
    contentJson: {
      ...section.contentJson,
      header: { ...section.contentJson.header as object, title, subtitle, align: 'left' },
      layout,
    },
  }, role)
}

const createSpotlight = (source: 'events' | 'sermons', role: string) => {
  const section = createPresetPageSection(source === 'events' ? 'spotlight-event' : 'spotlight-sermons')
  return withRole({
    ...section,
    contentJson: {
      ...section.contentJson,
      spotlight: { mode: 'data', source, preset: source === 'events' ? 'upcoming' : 'latest' },
    },
  }, role)
}

const createContactSpotlight = (role: string) => {
  const section = createEmptyPageSection('Spotlight')
  const title = localized(pagePresetsText.getInTouch.en, pagePresetsText.getInTouch.zh)
  const body = localized(pagePresetsText.addTheBestContactPersonAndAClearNext.en, pagePresetsText.addTheBestContactPersonAndAClearNext.zh)
  return withRole({
    ...section,
    contentJson: {
      ...section.contentJson,
      header: { ...section.contentJson.header as object, title, subtitle: localized('', ''), align: 'left' },
      title,
      headline: title,
      centerText: body,
      body,
      text: body,
      presentation: 'spotlight',
    },
    styleJson: { ...section.styleJson, layout: 'spotlight', presentation: 'spotlight' },
  }, role)
}

export const isPagePresetId = (value: string | null): value is PagePresetId =>
  PAGE_PRESETS.some((preset) => preset.id === value)

export const createPagePresetSections = (preset: PagePresetId): SectionEditModel[] => {
  const sections: SectionEditModel[] = (() => {
    switch (preset) {
      case 'home':
        return [
          withRole(createPresetPageSection('hero-home'), 'hero'),
          createRichText('about-rich-text', localized(pagePresetsText.aboutUs.en, pagePresetsText.aboutUs.zh), localized(pagePresetsText.introduceYourChurchCommunityItsFaithAndItsWelcome.en, pagePresetsText.introduceYourChurchCommunityItsFaithAndItsWelcome.zh)),
          createList('list-pages', 'ministry-collection', localized(pagePresetsText.ourMinistries.en, pagePresetsText.ourMinistries.zh), localized(pagePresetsText.exploreWaysToBelongGrowAndServe.en, pagePresetsText.exploreWaysToBelongGrowAndServe.zh)),
          withRole(createPresetPageSection('contact-location'), 'location-contact'),
        ]
      case 'ministry':
        return [
          createHero('landing-hero', localized(pagePresetsText.ministryName.en, pagePresetsText.ministryName.zh), localized(pagePresetsText.shareAShortInvitationAndTheHeartBehindThis.en, pagePresetsText.shareAShortInvitationAndTheHeartBehindThis.zh)),
          createRichText('rich-text', localized(pagePresetsText.aboutThisMinistry.en, pagePresetsText.aboutThisMinistry.zh), localized(pagePresetsText.describeWhoThisMinistryServesWhatItDoesAnd.en, pagePresetsText.describeWhoThisMinistryServesWhatItDoesAnd.zh)),
          createList('list-pages', 'info-cards', localized(pagePresetsText.ministryInformation.en, pagePresetsText.ministryInformation.zh), localized(pagePresetsText.connectPeopleWithRelatedTeamsResourcesOrNextSteps.en, pagePresetsText.connectPeopleWithRelatedTeamsResourcesOrNextSteps.zh)),
          createContactSpotlight('contact-spotlight'),
        ]
      case 'event':
        return [
          createHero('event-hero', localized(pagePresetsText.eventName.en, pagePresetsText.eventName.zh), localized(pagePresetsText.shareTheDatePurposeAndInvitationForThisEvent.en, pagePresetsText.shareTheDatePurposeAndInvitationForThisEvent.zh)),
          createSpotlight('events', 'event-spotlight'),
          withRole(createEmptyPageSection('Album'), 'album-gallery'),
          createContactSpotlight('contact'),
        ]
      case 'sermon':
        return [
          createHero('hero', localized(pagePresetsText.sermons.en, pagePresetsText.sermons.zh), localized(pagePresetsText.listenReflectAndContinueGrowingInGodSWord.en, pagePresetsText.listenReflectAndContinueGrowingInGodSWord.zh)),
          createSpotlight('sermons', 'sermon-spotlight'),
          createList('list-sermons', 'sermon-collection', localized(pagePresetsText.sermonCollectionLabel.en, pagePresetsText.sermonCollectionLabel.zh), localized(pagePresetsText.browseRecentMessagesAndTeaching.en, pagePresetsText.browseRecentMessagesAndTeaching.zh)),
        ]
      case 'album':
        return [
          createHero('hero', localized(pagePresetsText.photoAlbums.en, pagePresetsText.photoAlbums.zh), localized(pagePresetsText.rememberAndShareTheLifeOfOurCommunity.en, pagePresetsText.rememberAndShareTheLifeOfOurCommunity.zh)),
          withRole(createEmptyPageSection('Album'), 'album-collection'),
          withRole(createEmptyPageSection('Album'), 'nested-album'),
        ]
      case 'post':
        return [
          createRichText('section-header', localized(pagePresetsText.postTitle.en, pagePresetsText.postTitle.zh), localized('', '')),
          createRichText('rich-text', localized('', ''), localized(pagePresetsText.writeYourPostHere.en, pagePresetsText.writeYourPostHere.zh)),
        ]
      case 'contact':
        return [
          createHero('hero', localized(pagePresetsText.contactUs.en, pagePresetsText.contactUs.zh), localized(pagePresetsText.weWouldBeGladToHearFromYouAnd.en, pagePresetsText.weWouldBeGladToHearFromYouAnd.zh)),
          createRichText('contact-list', localized(pagePresetsText.waysToConnect.en, pagePresetsText.waysToConnect.zh), localized(pagePresetsText.pStrongEmailStrongAddAnEmailAddressP.en, pagePresetsText.pStrongEmailStrongAddAnEmailAddressP.zh)),
          withRole(createPresetPageSection('contact-location'), 'location-contact'),
        ]
      case 'blank':
      default:
        return []
    }
  })()

  return normalizePageSections(sections)
}

export const createPagePresetModel = (preset: PagePresetId, groupId: string): PageEditModel => ({
  groupId,
  title: preset === 'home' ? localized(pagePresetsText.home.en, pagePresetsText.home.zh) : localized('', ''),
  description: preset === 'home'
    ? localized(pagePresetsText.publicHomePageForVisitorsSeekersAndMembers.en, pagePresetsText.publicHomePageForVisitorsSeekersAndMembers.zh)
    : localized('', ''),
  tags: preset === 'home' ? ['home'] : [],
  titleDisplayStyle: 'Default',
  visibility: preset === 'home' ? 'public' : 'draft',
  sections: createPagePresetSections(preset),
})
