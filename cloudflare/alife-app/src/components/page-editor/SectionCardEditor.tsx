import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Clapperboard,
  FileText,
  ImageUp,
  LayoutList,
  Link2,
  Megaphone,
  MoveVertical,
  Settings2,
  Sparkles,
  Type,
} from 'lucide-react'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import AppActionButton from '../layout/AppActionButton'
import SectionBlock from '../page-sections/SectionBlock'
import { SelectInput } from '../page-sections/sectionUtils'
import type { JsonMap, SectionEditModel, SectionType } from '../../types/page-editor'
import type { SectionHeader, SectionSpacing } from '../../types'

type Props = {
  section: SectionEditModel
  index: number
  total: number
  canEdit: boolean
  typeError?: string
  onUpdate: (value: SectionEditModel) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  contextGroupId?: string
  pageId?: string
  isActive: boolean
  onSelect: () => void
}

const sectionTypeLabel = (type: SectionType, isZh: boolean) => {
  if (type === 'LandingHero') return isZh ? '首页视频主视觉' : 'Landing Hero'
  if (type === 'Hero') return isZh ? '主视觉' : 'Hero'
  if (type === 'Countdown') return isZh ? '倒数计时' : 'Countdown'
  if (type === 'RichText') return isZh ? '图文说明' : 'Rich Text'
  if (type === 'Spotlight') return isZh ? '重点推荐' : 'Spotlight'
  if (type === 'ListView') return isZh ? '列表视图' : 'List View'
  if (type === 'Sermon') return isZh ? '讲道视频' : 'Sermon Video'
  return type
}

const isJsonMap = (value: unknown): value is JsonMap => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const toHeaderText = (value: unknown): Record<string, string> => {
  if (typeof value === 'string') {
    return { en: value, zh: value }
  }

  if (isJsonMap(value)) {
    return {
      en: typeof value.en === 'string' ? value.en : '',
      zh: typeof value.zh === 'string' ? value.zh : '',
    }
  }

  return { en: '', zh: '' }
}

const createDefaultHeader = (contentJson: JsonMap = {}): SectionHeader => ({
  title: toHeaderText(contentJson.title ?? contentJson.headline),
  subtitle: toHeaderText(contentJson.subtitle ?? contentJson.subheadline ?? contentJson.body ?? contentJson.centerText),
  align: 'center',
  scale: 'normal',
  tone: 'default',
})

const createDefaultSpacing = (value: unknown): SectionSpacing =>
  value === 'compact' || value === 'large' ? value : 'normal'

const readHeader = (section: SectionEditModel): SectionHeader =>
  section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header)
    ? { ...createDefaultHeader(section.contentJson), ...section.contentJson.header }
    : createDefaultHeader(section.contentJson)

const textValue = (value: unknown, language: string) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (isJsonMap(value)) {
    const current = value[language]
    const fallback = language === 'zh' ? value.en : value.zh
    return (typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : '').trim()
  }

  return ''
}

type GuideTarget =
  | { type: 'preview'; index: number }
  | { type: 'properties'; tab: 'common' | 'section'; focusKey: string }

type GuideItem = {
  label: string
  ready: boolean
  icon: ReactNode
  target: GuideTarget
  detail?: string
}

const readContentText = (section: SectionEditModel, language: string, ...keys: string[]) => {
  for (const key of keys) {
    const value = textValue(section.contentJson[key], language)
    if (value) {
      return value
    }
  }

  return ''
}

const readHeaderText = (section: SectionEditModel, language: string, key: 'title' | 'subtitle') => {
  const header = readHeader(section)
  return textValue(header[key], language)
}

const isMediaValue = (value: string) => Boolean(value && /^(https?:\/\/|\/|data:(image|video)|blob:)/i.test(value))

const fallbackText = (isZh: boolean) => isZh ? '未设置' : 'Not set'

const summarizeValue = (value: string, isZh: boolean, maxLength = 34) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return fallbackText(isZh)
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed
}

const formatSource = (value: string, isZh: boolean) => {
  const labels: Record<string, { en: string; zh: string }> = {
    events: { en: 'Events', zh: '活动' },
    sermons: { en: 'Sermons', zh: '讲道' },
    groups: { en: 'Groups', zh: '小组' },
    media: { en: 'Media', zh: '媒体' },
    pages: { en: 'Pages', zh: '页面' },
    posts: { en: 'Posts', zh: '帖子' },
    members: { en: 'Members', zh: '成员' },
  }
  const key = value.trim()
  const label = labels[key]
  return label ? (isZh ? label.zh : label.en) : summarizeValue(key, isZh)
}

const formatPreset = (value: string, isZh: boolean) => {
  const labels: Record<string, { en: string; zh: string }> = {
    latest: { en: 'Latest', zh: '最新' },
    upcoming: { en: 'Upcoming', zh: '即将开始' },
    featured: { en: 'Featured', zh: '精选' },
    recent: { en: 'Recent', zh: '最近' },
    all: { en: 'All', zh: '全部' },
  }
  const key = value.trim()
  const label = labels[key]
  return label ? (isZh ? label.zh : label.en) : summarizeValue(key, isZh)
}

const formatMode = (value: string, isZh: boolean) => value === 'data'
  ? (isZh ? '从已有内容带入' : 'Filled from existing content')
  : (isZh ? '手动内容' : 'Manual')

const getSectionGuide = (section: SectionEditModel, language: string) => {
  const isZh = language === 'zh'
  const title = readHeaderText(section, language, 'title') || readContentText(section, language, 'title', 'headline')
  const subtitle = readHeaderText(section, language, 'subtitle') || readContentText(section, language, 'subtitle', 'subheadline', 'centerText', 'body')
  const media = readContentText(section, language, 'backgroundVideo', 'videoUrl', 'backgroundImage', 'backgroundImageUrl', 'imageUrl', 'imageOverrideUrl')
  const linkLabel = readContentText(section, language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readContentText(section, language, 'linkUrl', 'ctaUrl', 'href')
  const secondaryLinkLabel = readContentText(section, language, 'secondaryLinkLabel', 'secondaryLabel', 'secondaryCtaLabel')
  const secondaryLinkUrl = readContentText(section, language, 'secondaryLinkUrl', 'secondaryUrl', 'secondaryCtaUrl')
  const source = readContentText(section, language, 'source', 'sourceType')
  const layout = readContentText(section, language, 'layout')
  const spotlight = section.contentJson.spotlight && typeof section.contentJson.spotlight === 'object' && !Array.isArray(section.contentJson.spotlight)
    ? section.contentJson.spotlight as Record<string, unknown>
    : {}
  const spotlightMode = textValue(spotlight.mode, language) || 'manual'
  const spotlightSource = textValue(spotlight.source, language)
  const spotlightPreset = textValue(spotlight.preset, language)
  const spotlightItemId = textValue(spotlight.itemId, language)
  const countdown = section.contentJson.countdown && typeof section.contentJson.countdown === 'object' && !Array.isArray(section.contentJson.countdown)
    ? section.contentJson.countdown as Record<string, unknown>
    : {}
  const countdownMode = textValue(countdown.mode, language) || 'custom'
  const countdownEventId = textValue(countdown.eventId, language) || textValue(countdown.itemId, language)
  const countdownPreset = textValue(countdown.preset, language) || 'upcoming'
  const countdownTarget = readContentText(section, language, 'targetDateTime', 'countdownTarget', 'endDateTime')
  const limit = typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 0
  const youtubeUrl = readContentText(section, language, 'youtubeUrl')
  const richText = readContentText(section, language, 'text')

  if (section.type === 'LandingHero') {
    return {
      title: isZh ? '首页式视频主视觉引导' : 'Landing hero guidance',
      description: isZh ? '适合页面第一屏，用视频、短文案和两个行动入口承载最重要邀请。' : 'Use this as a first-screen video invitation with concise copy and two clear actions.',
      items: [
        { label: isZh ? '主标题' : 'Main headline', ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
        { label: isZh ? '说明文案' : 'Supporting copy', ready: Boolean(subtitle), detail: summarizeValue(subtitle, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
        { label: isZh ? '背景视频/图片' : 'Background video/image', ready: isMediaValue(media), detail: summarizeValue(media, isZh), icon: <ImageUp className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-media' } },
        { label: isZh ? '主要行动' : 'Primary action', ready: Boolean(linkLabel && linkUrl), detail: linkUrl ? summarizeValue(linkUrl, isZh) : summarizeValue(linkLabel, isZh), icon: <Link2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-primary-url' } },
        { label: isZh ? '次要行动' : 'Secondary action', ready: Boolean(secondaryLinkLabel && secondaryLinkUrl), detail: secondaryLinkUrl ? summarizeValue(secondaryLinkUrl, isZh) : summarizeValue(secondaryLinkLabel, isZh), icon: <Clapperboard className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'landing-hero-secondary-url' } },
      ] satisfies GuideItem[],
      advice: isZh ? '建议只用于页面顶部；视频要有海报图，避免慢网络下出现空白。' : 'Use near the top of the page and keep a poster image set so slow networks do not show a blank hero.',
    }
  }

  if (section.type === 'Countdown') {
    return {
      title: isZh ? '倒数区块引导' : 'Countdown guidance',
      description: isZh ? '适合活动报名、聚会开始、截止日期或其他需要提醒回应的时间点。' : 'Use this for event registration, gathering starts, deadlines, or any time-sensitive invitation.',
      items: [
        {
          label: isZh ? '数据来源' : 'Datasource',
          ready: countdownMode === 'custom' || countdownMode === 'event',
          detail: countdownMode === 'event' ? (isZh ? '绑定活动' : 'Event-bound') : (isZh ? '自定义' : 'Customized'),
          icon: <LayoutList className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: 'countdown-source-mode' },
        },
        {
          label: isZh ? '目标时间' : 'Target time',
          ready: countdownMode === 'event' || Boolean(countdownTarget),
          detail: countdownMode === 'event'
            ? (countdownEventId ? (isZh ? `活动 ID: ${summarizeValue(countdownEventId, true)}` : `Event ID: ${summarizeValue(countdownEventId, false)}`) : (isZh ? `下一个活动 · ${formatPreset(countdownPreset, true)}` : `Next event · ${formatPreset(countdownPreset, false)}`))
            : summarizeValue(countdownTarget, isZh),
          icon: <Settings2 className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: countdownMode === 'event' ? 'countdown-event-id' : 'countdown-target-date' },
        },
        { label: isZh ? '说明文案' : 'Intro copy', ready: Boolean(title || subtitle || richText), detail: summarizeValue(title || subtitle || richText, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
        {
          label: isZh ? '图片/媒体' : 'Media',
          ready: countdownMode === 'event' || isMediaValue(media),
          detail: countdownMode === 'event' ? (isZh ? '来自活动海报或覆盖链接' : 'From event poster or override') : summarizeValue(media, isZh),
          icon: <ImageUp className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: countdownMode === 'event' ? 'countdown-image-override' : 'countdown-image' },
        },
        {
          label: isZh ? '行动链接' : 'Action link',
          ready: countdownMode === 'event' || Boolean(linkLabel || linkUrl),
          detail: countdownMode === 'event' ? (isZh ? '默认打开活动详情' : 'Defaults to event details') : summarizeValue(linkUrl || linkLabel, isZh),
          icon: <Link2 className="h-4 w-4" />,
          target: { type: 'properties', tab: 'section', focusKey: 'countdown-action-url' },
        },
      ] satisfies GuideItem[],
      advice: isZh ? '绑定活动时会自动带入标题、说明、地点、海报与倒数目标；发布前请确认活动时间正确。' : 'When event-bound, title, copy, location, poster, and target time are auto-filled; confirm the event time before publishing.',
    }
  }

  if (section.type === 'Hero') {
    return {
      title: isZh ? '开场横幅引导' : 'Opening banner guidance',
      description: isZh ? '适合承载页面最重要的邀请，文案要短，行动要明确。' : 'Use this for the page’s primary invitation: short copy and a clear action.',
      items: [
        { label: isZh ? '主标题' : 'Main headline', ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
        { label: isZh ? '说明文案' : 'Supporting copy', ready: Boolean(subtitle), detail: summarizeValue(subtitle, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
        { label: isZh ? '背景图片/视频' : 'Background media', ready: isMediaValue(media), detail: summarizeValue(media, isZh), icon: <ImageUp className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'hero-media' } },
        { label: isZh ? '行动按钮' : 'Call to action', ready: Boolean(linkLabel && linkUrl), detail: linkUrl ? summarizeValue(linkUrl, isZh) : summarizeValue(linkLabel, isZh), icon: <Link2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'hero-cta-url' } },
      ] satisfies GuideItem[],
      advice: isZh ? '发布前请确认手机上文字不会遮挡人物或重要画面。' : 'Before publishing, check that mobile text does not cover important faces or visuals.',
    }
  }

  if (section.type === 'RichText') {
    return {
      title: isZh ? '文字内容引导' : 'Rich text guidance',
      description: isZh ? '适合欢迎词、说明、FAQ 或流程介绍。每段只讲一个重点。' : 'Best for welcome copy, explanations, FAQ, or steps. Keep each paragraph focused.',
      items: [
        { label: isZh ? '区块标题' : 'Section title', ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
        { label: isZh ? '正文内容' : 'Body content', ready: Boolean(richText), detail: summarizeValue(richText, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 2 } },
        { label: isZh ? '阅读长度' : 'Readable length', ready: !richText || richText.length <= 900, detail: isZh ? `${richText.length} 字符` : `${richText.length} chars`, icon: <Sparkles className="h-4 w-4" />, target: { type: 'preview', index: 2 } },
      ] satisfies GuideItem[],
      advice: isZh ? '如果内容超过三四段，可以考虑拆成两个区块或 FAQ。' : 'If this grows past a few paragraphs, consider splitting it into another section or FAQ.',
    }
  }

  if (section.type === 'ListView') {
    return {
      title: isZh ? '自动列表引导' : 'Auto list guidance',
      description: isZh ? '适合展示最新讲道、活动或小组，让内容自动保持新鲜。' : 'Use this for latest sermons, events, or groups so the page stays fresh.',
      items: [
        { label: isZh ? '内容来源' : 'Content source', ready: Boolean(source), detail: formatSource(source, isZh), icon: <LayoutList className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-source' } },
        { label: isZh ? '展示方式' : 'Display layout', ready: Boolean(layout), detail: summarizeValue(layout, isZh), icon: <MoveVertical className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-layout' } },
        { label: isZh ? '数量限制' : 'Item limit', ready: limit > 0 && limit <= 50, detail: limit ? (isZh ? `${limit} 项` : `${limit} items`) : fallbackText(isZh), icon: <Settings2 className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'list-limit' } },
      ] satisfies GuideItem[],
      advice: isZh ? '首页建议显示 3 到 6 项，管理页或列表页可以更多。' : 'For home pages, 3 to 6 items usually scans best; directory pages can show more.',
    }
  }

  if (section.type === 'Sermon') {
    return {
      title: isZh ? '讲道嵌入引导' : 'Sermon embed guidance',
      description: isZh ? '适合突出一篇信息、系列或主日讲道。' : 'Use this to feature one message, series, or Sunday sermon.',
      items: [
        { label: isZh ? '讲道标题' : 'Sermon title', ready: Boolean(title || readContentText(section, language, 'title')), detail: summarizeValue(title || readContentText(section, language, 'title'), isZh), icon: <Type className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'sermon-title' } },
        { label: isZh ? 'YouTube 链接' : 'YouTube URL', ready: Boolean(youtubeUrl), detail: summarizeValue(youtubeUrl, isZh), icon: <Clapperboard className="h-4 w-4" />, target: { type: 'properties', tab: 'section', focusKey: 'sermon-youtube-url' } },
      ] satisfies GuideItem[],
      advice: isZh ? '建议使用官方频道视频链接，并在发布后确认播放器可正常打开。' : 'Use the official channel URL and confirm the player opens after publishing.',
    }
  }

  return {
    title: isZh ? '重点内容引导' : 'Spotlight guidance',
    description: isZh ? '适合用图片、短文和按钮讲一个服事重点。' : 'Use image, concise copy, and one action to tell a focused ministry story.',
    items: [
      { label: isZh ? '标题' : 'Title', ready: Boolean(title), detail: summarizeValue(title, isZh), icon: <Type className="h-4 w-4" />, target: { type: 'preview', index: 0 } },
      { label: isZh ? '说明文案' : 'Supporting copy', ready: Boolean(subtitle || richText), detail: summarizeValue(subtitle || richText, isZh), icon: <FileText className="h-4 w-4" />, target: { type: 'preview', index: 1 } },
      {
        label: isZh ? '自动带入' : 'Auto-filled content',
        ready: spotlightMode === 'manual' || Boolean(spotlightSource),
        detail: spotlightMode === 'data'
          ? `${formatSource(spotlightSource, isZh)} · ${formatPreset(spotlightPreset, isZh)}`
          : formatMode(spotlightMode, isZh),
        icon: <LayoutList className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: spotlightMode === 'data' ? 'spotlight-source' : 'spotlight-mode' },
      },
      {
        label: isZh ? '图片/媒体' : 'Media',
        ready: spotlightMode === 'data' || isMediaValue(media),
        detail: spotlightMode === 'data'
          ? (isZh ? `来自 ${formatSource(spotlightSource, true)} / ${formatPreset(spotlightPreset, true)}` : `From ${formatSource(spotlightSource, false)} / ${formatPreset(spotlightPreset, false)}`)
          : summarizeValue(media, isZh),
        icon: <ImageUp className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: spotlightMode === 'data' ? 'spotlight-preset' : 'spotlight-media-url' },
      },
      {
        label: isZh ? '行动链接' : 'Action link',
        ready: spotlightMode === 'data' || Boolean(linkLabel || linkUrl),
        detail: spotlightMode === 'data'
          ? (spotlightItemId ? (isZh ? `指定 ID: ${summarizeValue(spotlightItemId, true)}` : `Pinned ID: ${summarizeValue(spotlightItemId, false)}`) : (isZh ? '使用来源默认行动' : 'Uses source default action'))
          : summarizeValue(linkUrl || linkLabel, isZh),
        icon: <Link2 className="h-4 w-4" />,
        target: { type: 'properties', tab: 'section', focusKey: spotlightMode === 'data' ? 'spotlight-reference-id' : 'spotlight-action-url' },
      },
    ] satisfies GuideItem[],
    advice: isZh ? '用一个清楚行动收尾，比如了解更多、报名、联系同工。' : 'End with one clear action, such as learn more, register, or contact a leader.',
  }
}

const SectionCardEditor = ({ section, index, total, canEdit, typeError, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId, pageId, isActive, onSelect }: Props) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [propertyTab, setPropertyTab] = useState<'common' | 'section'>('common')
  const [pendingFocusKey, setPendingFocusKey] = useState('')
  const [activeGuideLabel, setActiveGuideLabel] = useState('')
  const cardRef = useRef<HTMLDivElement | null>(null)
  const modalContentRef = useRef<HTMLDivElement | null>(null)
  const patchSection = (patch: Partial<SectionEditModel>) => onUpdate({ ...section, ...patch })
  const patchContentJson = (patch: JsonMap) => patchSection({ contentJson: { ...section.contentJson, ...patch } })
  const patchHeader = (patch: Partial<SectionHeader>) => patchContentJson({ header: { ...readHeader(section), ...patch } })
  const header = readHeader(section)
  const guide = getSectionGuide(section, language)
  const readyCount = guide.items.filter((item) => item.ready).length
  const guideComplete = readyCount === guide.items.length
  const isZh = language === 'zh'
  const focusInlineEditable = (index: number) => {
    window.setTimeout(() => {
      const editables = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('[contenteditable="true"], [data-editor-focus-target="true"]') ?? [])
      const target = editables[Math.min(index, Math.max(0, editables.length - 1))]
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus()
    }, 50)
  }
  const handleGuideItemClick = (item: GuideItem) => {
    setActiveGuideLabel(item.label)
    if (item.target.type === 'preview') {
      setPropertiesOpen(false)
      focusInlineEditable(item.target.index)
      return
    }

    setPendingFocusKey(item.target.focusKey)
    setPropertyTab(item.target.tab)
    setPropertiesOpen(true)
  }
  const renderGuide = (compact = false) => (
    <div className={compact ? 'rounded-xl border border-slate-200 bg-slate-50 p-3' : 'border-y border-slate-100 bg-[#f8faf7] px-4 py-3'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={['flex h-8 w-8 items-center justify-center rounded-lg', guideComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'].join(' ')}>
              {guideComplete ? <CheckCircle2 className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-black text-slate-950">{guide.title}</p>
              <p className="text-xs leading-5 text-slate-500">{guide.description}</p>
            </div>
          </div>
        </div>
        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-[#176b5a] shadow-sm">
          {readyCount}/{guide.items.length}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {guide.items.map((item: GuideItem) => (
          <button
            key={item.label}
            type="button"
            className={['flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#176b5a]/30', item.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600', activeGuideLabel === item.label ? 'ring-2 ring-[#176b5a]/30' : ''].join(' ')}
            onClick={(event) => {
              event.stopPropagation()
              handleGuideItemClick(item)
            }}
          >
            <span className={item.ready ? 'text-emerald-700' : 'text-slate-500'}>
              {item.ready ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{item.label}</span>
              {item.detail ? (
                <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-70">{item.detail}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
        <span className="font-black text-slate-700">{isZh ? '发布建议' : 'Publishing tip'}: </span>
        {guide.advice}
      </p>
    </div>
  )
  const renderCommonProperties = () => (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">{t('sectionType')}</span>
        <div className="flex h-9 items-center rounded border border-slate-300 bg-slate-50 px-2 text-sm text-slate-700">
          {section.type ? sectionTypeLabel(section.type, isZh) : t('selectType')}
        </div>
        <p className="text-xs text-slate-500">{t('sectionTypeLocked')}</p>
        {typeError ? <p className="text-xs text-red-600">{typeError}</p> : null}
      </div>
      <SelectInput
        label={t('spacing')}
        value={createDefaultSpacing(section.contentJson.spacing)}
        disabled={!canEdit}
        options={[
          { value: 'compact', label: t('compact') },
          { value: 'normal', label: t('normal') },
          { value: 'large', label: t('large') },
        ]}
        onChange={(value) => patchContentJson({ spacing: value })}
      />
      <SelectInput
        label={t('alignment')}
        value={header.align ?? 'center'}
        disabled={!canEdit}
        options={[{ value: 'left', label: t('left') }, { value: 'center', label: t('center') }]}
        onChange={(value) => patchHeader({ align: value as SectionHeader['align'] })}
      />
      <SelectInput
        label={t('scale')}
        value={header.scale ?? 'normal'}
        disabled={!canEdit}
        options={[
          { value: 'compact', label: t('compact') },
          { value: 'normal', label: t('normal') },
          { value: 'feature', label: t('feature') },
        ]}
        onChange={(value) => patchHeader({ scale: value as SectionHeader['scale'] })}
      />
      <SelectInput
        label={t('tone')}
        value={header.tone ?? 'default'}
        disabled={!canEdit}
        options={[
          { value: 'default', label: t('defaultTone') },
          { value: 'primary', label: t('primary') },
          { value: 'warm', label: t('warm') },
          { value: 'fresh', label: t('fresh') },
          { value: 'rose', label: t('rose') },
        ]}
        onChange={(value) => patchHeader({ tone: value as SectionHeader['tone'] })}
      />
    </div>
  )
  const openProperties = () => {
    setPendingFocusKey('')
    setActiveGuideLabel('')
    setPropertyTab('common')
    setPropertiesOpen(true)
  }

  useEffect(() => {
    if (!propertiesOpen || !pendingFocusKey) {
      return
    }

    const timer = window.setTimeout(() => {
      const target = modalContentRef.current?.querySelector<HTMLElement>(`[data-field-key="${pendingFocusKey}"]`)
      const input = target?.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"]')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.classList.add('ring-2', 'ring-[#176b5a]/35', 'bg-emerald-50')
      input?.focus()
      window.setTimeout(() => {
        target?.classList.remove('ring-2', 'ring-[#176b5a]/35', 'bg-emerald-50')
      }, 1400)
    }, 100)

    return () => window.clearTimeout(timer)
  }, [pendingFocusKey, propertiesOpen, propertyTab])

  return (
    <div
      ref={cardRef}
      role={isActive ? undefined : 'button'}
      tabIndex={isActive ? undefined : 0}
      className={`relative w-full min-w-0 outline-none transition ${isActive ? '' : 'cursor-pointer hover:ring-2 hover:ring-blue-200 focus-visible:ring-2 focus-visible:ring-blue-500'}`}
      onClick={(event) => {
        if (isActive) {
          return
        }
        if ((event.target as HTMLElement).closest('a')) {
          event.preventDefault()
        }
        onSelect()
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      {isActive ? (
        <section className="rounded-2xl border border-[#2f4b42]/10 bg-white/90 shadow-[0_10px_26px_rgba(31,56,48,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t('sectionHeading', { number: index + 1, type: section.type ? sectionTypeLabel(section.type, isZh) : t('selectType') })}</h3>
              {typeError ? <p className="mt-1 text-xs text-red-600">{typeError}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
              <AppActionButton size="sm" disabled={!section.type} onClick={openProperties}>{t('properties')}</AppActionButton>
              <AppActionButton size="sm" disabled={index === 0 || !canEdit} onClick={onMoveUp}>{t('moveUp')}</AppActionButton>
              <AppActionButton size="sm" disabled={index === total - 1 || !canEdit} onClick={onMoveDown}>{t('moveDown')}</AppActionButton>
              <AppActionButton size="sm" variant="danger" disabled={!canEdit} onClick={onRemove}>{t('remove')}</AppActionButton>
            </div>
          </div>
          {renderGuide()}
        </section>
      ) : null}

      <SectionBlock
        section={section}
        mode={isActive ? 'edit' : 'render'}
        disabled={!canEdit}
        editorPreview={isActive ? true : undefined}
        contextGroupId={contextGroupId}
        pageId={pageId}
        onUpdate={onUpdate}
        showProperties={false}
      />
      {propertiesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setPropertiesOpen(false)} />
          <section className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{t('properties')}</h2>
                <p className="text-sm text-slate-500">{section.type ? sectionTypeLabel(section.type, isZh) : t('selectType')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPropertiesOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="border-b border-slate-200 px-5 pt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${propertyTab === 'common' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => setPropertyTab('common')}
                >
                  {t('commonProperties')}
                </button>
                <button
                  type="button"
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${propertyTab === 'section' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => setPropertyTab('section')}
                >
                  {t('sectionProperties')}
                </button>
              </div>
            </div>
            <div ref={modalContentRef} className="overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {activeGuideLabel ? (
                  <div className="rounded-xl border border-[#176b5a]/20 bg-[#e3f0eb] px-3 py-2 text-xs font-bold text-[#176b5a]">
                    {isZh ? '正在配置：' : 'Configuring: '}{activeGuideLabel}
                  </div>
                ) : null}
                {renderGuide(true)}
                {propertyTab === 'common' ? renderCommonProperties() : (
                  <SectionBlock
                    section={section}
                    mode="edit"
                    disabled={!canEdit}
                    contextGroupId={contextGroupId}
                    pageId={pageId}
                    onUpdate={onUpdate}
                    propertiesOnly
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default SectionCardEditor
