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
    name: localized('Blank Page', '空白页面'),
    description: localized('Start with an empty page and add sections yourself.', '从空白页面开始，自行添加所需区块。'),
    sectionNames: [],
  },
  {
    id: 'home',
    name: localized('Home Page', '首页'),
    description: localized('Welcome visitors and guide them to ministries and your location.', '欢迎访客，并引导他们了解事工和聚会地点。'),
    sectionNames: [localized('Hero', '主视觉'), localized('About Rich Text', '关于我们富文本'), localized('Ministry Collection', '事工集合'), localized('Location Contact', '地点联系')],
  },
  {
    id: 'ministry',
    name: localized('Ministry Page', '事工页面'),
    description: localized('Introduce a ministry, its work, and a clear contact path.', '介绍事工、服事内容和清楚的联系入口。'),
    sectionNames: [localized('Landing Hero', '落地主视觉'), localized('Rich Text', '富文本'), localized('Info Cards', '信息卡片'), localized('Contact Spotlight', '联系重点')],
  },
  {
    id: 'event',
    name: localized('Event Page', '活动页面'),
    description: localized('Feature an event with details, photos, and contact information.', '展示活动详情、照片和联系信息。'),
    sectionNames: [localized('Event Hero', '活动主视觉'), localized('Event Spotlight', '活动重点'), localized('Album / Gallery', '相册 / 图集'), localized('Contact', '联系')],
  },
  {
    id: 'sermon',
    name: localized('Sermon Page', '讲道页面'),
    description: localized('Feature one message and provide a sermon collection.', '突出一篇信息，并提供讲道集合。'),
    sectionNames: [localized('Hero', '主视觉'), localized('Sermon Spotlight', '讲道重点'), localized('Sermon Collection', '讲道集合')],
  },
  {
    id: 'album',
    name: localized('Album Page', '相册页面'),
    description: localized('Build a visual page from a main album and a nested album.', '使用主相册和嵌套相册创建视觉页面。'),
    sectionNames: [localized('Hero', '主视觉'), localized('Album Collection', '相册集合'), localized('Nested Album', '嵌套相册')],
  },
  {
    id: 'post',
    name: localized('Post Page', '文章页面'),
    description: localized('Start a focused bilingual article or update.', '开始撰写一篇聚焦的双语文章或动态。'),
    sectionNames: [localized('Section Header', '区块标题'), localized('Rich Text', '富文本')],
  },
  {
    id: 'contact',
    name: localized('Contact Page', '联系页面'),
    description: localized('Give people clear contact and location options.', '为访客提供清楚的联系和地点信息。'),
    sectionNames: [localized('Hero', '主视觉'), localized('Contact List', '联系列表'), localized('Location Contact', '地点联系')],
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
  const title = localized('Get in touch', '欢迎联系')
  const body = localized('Add the best contact person and a clear next step.', '填写合适的联系人和清楚的下一步。')
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
          createRichText('about-rich-text', localized('About us', '关于我们'), localized('Introduce your church community, its faith, and its welcome.', '介绍教会群体、信仰和欢迎信息。')),
          createList('list-pages', 'ministry-collection', localized('Our ministries', '我们的事工'), localized('Explore ways to belong, grow, and serve.', '探索归属、成长和服事的机会。')),
          withRole(createPresetPageSection('contact-location'), 'location-contact'),
        ]
      case 'ministry':
        return [
          createHero('landing-hero', localized('Ministry name', '事工名称'), localized('Share a short invitation and the heart behind this ministry.', '用简短的话介绍这项事工及其异象。')),
          createRichText('rich-text', localized('About this ministry', '关于这项事工'), localized('Describe who this ministry serves, what it does, and how people can participate.', '介绍这项事工服务谁、做什么，以及如何参与。')),
          createList('list-pages', 'info-cards', localized('Ministry information', '事工信息'), localized('Connect people with related teams, resources, or next steps.', '引导大家查看相关团队、资源或下一步。')),
          createContactSpotlight('contact-spotlight'),
        ]
      case 'event':
        return [
          createHero('event-hero', localized('Event name', '活动名称'), localized('Share the date, purpose, and invitation for this event.', '介绍活动日期、目的和邀请。')),
          createSpotlight('events', 'event-spotlight'),
          withRole(createEmptyPageSection('Album'), 'album-gallery'),
          createContactSpotlight('contact'),
        ]
      case 'sermon':
        return [
          createHero('hero', localized('Sermons', '讲道信息'), localized('Listen, reflect, and continue growing in God’s word.', '聆听、思想，并在神的话语中继续成长。')),
          createSpotlight('sermons', 'sermon-spotlight'),
          createList('list-sermons', 'sermon-collection', localized('Sermon collection', '讲道集合'), localized('Browse recent messages and teaching.', '浏览近期信息和教导。')),
        ]
      case 'album':
        return [
          createHero('hero', localized('Photo albums', '照片相册'), localized('Remember and share the life of our community.', '记录并分享群体生活的美好时刻。')),
          withRole(createEmptyPageSection('Album'), 'album-collection'),
          withRole(createEmptyPageSection('Album'), 'nested-album'),
        ]
      case 'post':
        return [
          createRichText('section-header', localized('Post title', '文章标题'), localized('', '')),
          createRichText('rich-text', localized('', ''), localized('Write your post here.', '在这里撰写文章内容。')),
        ]
      case 'contact':
        return [
          createHero('hero', localized('Contact us', '联系我们'), localized('We would be glad to hear from you and help you connect.', '欢迎与我们联系，我们很乐意帮助你建立连接。')),
          createRichText('contact-list', localized('Ways to connect', '联系方式'), localized('<p><strong>Email:</strong> Add an email address</p><p><strong>Phone:</strong> Add a phone number</p>', '<p><strong>电邮：</strong>填写电邮地址</p><p><strong>电话：</strong>填写电话号码</p>')),
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
  title: preset === 'home' ? localized('Home', '首页') : localized('', ''),
  description: preset === 'home'
    ? localized('Public home page for visitors, seekers, and members.', '面向访客、慕道朋友和成员的公共首页。')
    : localized('', ''),
  tags: preset === 'home' ? ['home'] : [],
  titleDisplayStyle: 'Default',
  visibility: preset === 'home' ? 'public' : 'draft',
  sections: createPagePresetSections(preset),
})
