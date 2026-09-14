import { useRef } from 'react'
import { ArrowDown, ArrowRight, PlayCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import {
  EditableText,
  PropertyPanel,
  TextInput,
  isVideoSource,
  patchContent,
  patchLocalizedContent,
  patchLocalizedSectionHeader,
  patchStyle,
  readLocalizedText,
  readText,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import MediaPickerInput from '../media/MediaPickerInput'

const DEFAULT_LANDING_HERO_VIDEO = '/media/homepage-hero.mp4'
const DEFAULT_LANDING_HERO_POSTER = '/media/alife-church-community-hero.jpg'

const isExternalLink = (url: string) => Boolean(url && !url.startsWith('/') && !url.startsWith('#'))

const LandingHeroMedia = ({ src, poster }: { src: string; poster: string }) => {
  const source = src.trim()
  const posterSource = poster.trim()

  return (
    <div aria-hidden="true" className="alife-landing-hero__media">
      {source && isVideoSource(source) ? (
        <video
          className="alife-landing-hero__asset"
          src={source}
          poster={posterSource || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
      ) : source || posterSource ? (
        <div className="alife-landing-hero__asset bg-cover bg-center" style={{ backgroundImage: `url(${source || posterSource})` }} />
      ) : null}
      <div className="alife-landing-hero__veil" />
      <div className="alife-landing-hero__texture" />
    </div>
  )
}

const LandingHeroSection = ({ section, mode, domId, disabled, editorPreview, previewDensity = 'full', headingLevel = 'h1', propertiesOnly, showProperties = true, contextGroupId, page, onUpdate }: SectionComponentProps) => {
  const heroRef = useRef<HTMLElement>(null)
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const mediaUrl = readText(section.contentJson, 'backgroundVideo', 'videoUrl', 'backgroundImage', 'backgroundImageUrl') || DEFAULT_LANDING_HERO_VIDEO
  const posterUrl = readText(section.contentJson, 'posterImage', 'posterImageUrl', 'imageUrl') || DEFAULT_LANDING_HERO_POSTER
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body', 'subtitle', 'subheadline')
  const primaryLabel = readLocalizedText(section.contentJson, auth.language, 'linkLabel', 'linkText', 'ctaLabel')
  const primaryUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const secondaryLabel = readLocalizedText(section.contentJson, auth.language, 'secondaryLinkLabel', 'secondaryLabel', 'secondaryCtaLabel')
  const secondaryUrl = readText(section.contentJson, 'secondaryLinkUrl', 'secondaryUrl', 'secondaryCtaUrl')
  const bottomFade = typeof section.styleJson.bottomFade === 'boolean'
    ? section.styleJson.bottomFade
    : true
  const bottomGradient = typeof section.styleJson.bottomGradient === 'boolean'
    ? section.styleJson.bottomGradient
    : true
  const mediaGroupId = contextGroupId || page?.ownerGroupId || undefined

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateHeroTitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { title: value, headline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'title', value))
  }
  const updateHeroBody = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { centerText: value, body: value, subtitle: value, subheadline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'subtitle', value))
  }

  const renderLink = ({
    label,
    url,
    fallback,
    className,
    icon,
    onLabelChange,
  }: {
    label: string
    url: string
    fallback: string
    className: string
    icon: 'arrow' | 'play'
    onLabelChange: (value: string) => void
  }) => {
    const safeUrl = url.trim()

    if (!safeUrl && mode !== 'edit') {
      return null
    }

    return (
      <a
        href={mode === 'render' && safeUrl ? safeUrl : undefined}
        target={mode === 'render' && isExternalLink(safeUrl) ? '_blank' : undefined}
        rel={mode === 'render' && isExternalLink(safeUrl) ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={(event) => {
          if (mode === 'edit') event.preventDefault()
        }}
      >
        {icon === 'play' ? <PlayCircle className="h-4 w-4" /> : null}
        <EditableText
          value={label}
          fallback={safeUrl || fallback}
          disabled={!editable}
          className="text-sm"
          onChange={onLabelChange}
        />
        {icon === 'arrow' ? <ArrowRight className="h-3.5 w-3.5" /> : null}
      </a>
    )
  }

  const renderProperties = () => (
    <PropertyPanel>
      <MediaPickerInput
        focusKey="landing-hero-media"
        label={t('backgroundImageUrl')}
        value={mediaUrl}
        disabled={disabled}
        groupId={mediaGroupId}
        accept="media"
        onChange={(value) => updateContent({ backgroundVideo: value, videoUrl: value, backgroundImage: value, backgroundImageUrl: value })}
      />
      <MediaPickerInput
        focusKey="landing-hero-poster"
        label={auth.language === 'zh' ? '海报图片链接' : 'Poster image URL'}
        value={posterUrl}
        disabled={disabled}
        groupId={mediaGroupId}
        accept="image"
        onChange={(value) => updateContent({ posterImage: value, posterImageUrl: value, imageUrl: value })}
      />
      <TextInput
        focusKey="landing-hero-primary-url"
        label={t('buttonLinkUrl')}
        value={primaryUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })}
      />
      <TextInput
        focusKey="landing-hero-secondary-url"
        label={auth.language === 'zh' ? '次要按钮链接地址' : 'Secondary button link URL'}
        value={secondaryUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ secondaryLinkUrl: value, secondaryUrl: value, secondaryCtaUrl: value })}
      />
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2"
        data-field-key="landing-hero-bottom-fade"
      >
        <p className="text-sm font-bold text-slate-900">{t('landingHeroBottomFade')}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{t('landingHeroBottomFadeDescription')}</p>
        <div
          role="group"
          aria-label={t('landingHeroBottomFade')}
          className="mt-3 inline-flex rounded-lg bg-slate-200/70 p-1"
        >
          <button
            type="button"
            aria-pressed={bottomFade}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${bottomFade ? 'bg-white text-[#176b5a] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => updateStyle({ bottomFade: true })}
          >
            {auth.language === 'zh' ? '显示虚化' : 'Show blur'}
          </button>
          <button
            type="button"
            aria-pressed={!bottomFade}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!bottomFade ? 'bg-white text-[#176b5a] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => updateStyle({ bottomFade: false })}
          >
            {auth.language === 'zh' ? '关闭虚化' : 'Hide blur'}
          </button>
        </div>
      </div>
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2"
        data-field-key="landing-hero-bottom-gradient"
      >
        <p className="text-sm font-bold text-slate-900">
          {auth.language === 'zh' ? '底部过渡渐变' : 'Bottom transition gradient'}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {auth.language === 'zh'
            ? '让首屏影像自然融入下一段页面，而不是在底部突然截断。'
            : 'Blend the hero image naturally into the following section instead of ending abruptly.'}
        </p>
        <div
          role="group"
          aria-label={auth.language === 'zh' ? '底部过渡渐变' : 'Bottom transition gradient'}
          className="mt-3 inline-flex rounded-lg bg-slate-200/70 p-1"
        >
          <button
            type="button"
            aria-pressed={bottomGradient}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${bottomGradient ? 'bg-white text-[#176b5a] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => updateStyle({ bottomGradient: true })}
          >
            {auth.language === 'zh' ? '显示渐变' : 'Show gradient'}
          </button>
          <button
            type="button"
            aria-pressed={!bottomGradient}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!bottomGradient ? 'bg-white text-[#176b5a] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => updateStyle({ bottomGradient: false })}
          >
            {auth.language === 'zh' ? '关闭渐变' : 'Hide gradient'}
          </button>
        </div>
      </div>
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const compactPreview = previewDensity === 'compact' || editorPreview === true
  const showPrimaryAction = mode === 'edit' || Boolean(primaryUrl.trim())
  const showSecondaryAction = mode === 'edit' || Boolean(secondaryUrl.trim())
  const heroKicker = auth.language === 'zh' ? '基督城 · 丰盛生命' : 'Christchurch · Abundant Life'
  const exploreLabel = auth.language === 'zh' ? '继续探索' : 'Continue exploring'
  const scrollToNextSection = () => {
    const nextSection = heroRef.current?.nextElementSibling
    if (!(nextSection instanceof HTMLElement)) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nextSection.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section
      ref={heroRef}
      id={domId}
      className={[
        'alife-landing-hero',
        compactPreview ? 'alife-landing-hero--compact' : '',
      ].join(' ')}
    >
      <LandingHeroMedia src={mediaUrl} poster={posterUrl} />
      {bottomGradient ? <div className="alife-landing-hero__bottom-gradient" aria-hidden="true" /> : null}
      {bottomFade ? <div className="alife-landing-hero__bottom-blur" aria-hidden="true" /> : null}

      <div className="alife-landing-hero__content">
        <div className="alife-landing-hero__intro">
          <p className="alife-landing-hero__kicker">
            {heroKicker}
          </p>
          <EditableText
            as={headingLevel}
            multiline
            value={title}
            fallback={auth.language === 'zh' ? '在这里写下页面最重要的邀请。' : 'Write the page’s most important invitation here.'}
            disabled={!editable}
            className="alife-landing-hero__title whitespace-pre-line"
            onChange={updateHeroTitle}
          />
          <div className="alife-landing-hero__body-row">
            <EditableText
              as="p"
              multiline
              value={body}
              fallback={t('noHeroContentYet')}
              disabled={!editable}
              className="alife-landing-hero__body whitespace-pre-line"
              onChange={updateHeroBody}
            />
          </div>
          {showPrimaryAction || showSecondaryAction ? <div className="alife-landing-hero__actions">
            {showPrimaryAction ? renderLink({
              label: primaryLabel,
              url: primaryUrl,
              fallback: auth.language === 'zh' ? '计划来访' : 'Plan a Visit',
              className: 'inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f4e4bf] px-6 py-3 text-sm font-semibold text-home-dark shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              icon: 'arrow',
              onLabelChange: (value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value }),
            }) : null}
            {showSecondaryAction ? renderLink({
              label: secondaryLabel,
              url: secondaryUrl,
              fallback: auth.language === 'zh' ? '观看主日信息' : 'Watch Sermon',
              className: 'inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 bg-black/10 px-6 py-3 text-sm font-semibold text-white/82 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-white/55 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              icon: 'play',
              onLabelChange: (value) => updateLocalizedContent({ secondaryLinkLabel: value, secondaryLabel: value, secondaryCtaLabel: value }),
            }) : null}
          </div> : null}
        </div>
      </div>

      {!compactPreview ? (
        <button
          type="button"
          className="alife-landing-hero__explore"
          aria-label={exploreLabel}
          onClick={scrollToNextSection}
        >
          <span className="alife-landing-hero__explore-copy">
            <small>{auth.language === 'zh' ? 'SCROLL TO DISCOVER' : 'DISCOVER MORE'}</small>
            <strong>{exploreLabel}</strong>
          </span>
          <span className="alife-landing-hero__explore-indicator" aria-hidden="true">
            <ArrowDown className="h-5 w-5" />
          </span>
        </button>
      ) : null}

      {mode === 'edit' && showProperties ? (
        <div className="relative z-20 border-t border-white/10 bg-white/95 p-3 text-slate-900">
          {renderProperties()}
        </div>
      ) : null}
    </section>
  )
}

export default LandingHeroSection
