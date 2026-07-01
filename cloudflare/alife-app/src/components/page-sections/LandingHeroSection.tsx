import { ArrowRight, PlayCircle } from 'lucide-react'
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
  readLocalizedText,
  readText,
} from './sectionUtils'
import type { SectionComponentProps } from './types'

const DEFAULT_LANDING_HERO_VIDEO = '/media/homepage-hero.mp4'
const DEFAULT_LANDING_HERO_POSTER = '/media/alife-church-community-hero.jpg'

const isExternalLink = (url: string) => Boolean(url && !url.startsWith('/') && !url.startsWith('#'))

const LandingHeroMedia = ({ src, poster }: { src: string; poster: string }) => {
  const source = src.trim()
  const posterSource = poster.trim()

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden bg-home-dark">
      {source && isVideoSource(source) ? (
        <video
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-60"
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
        <div className="absolute inset-0 scale-105 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${source || posterSource})` }} />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(30,18,10,0.78)_0%,rgba(30,18,10,0.2)_50%,rgba(30,18,10,0.12)_100%)]" />
    </div>
  )
}

const LandingHeroSection = ({ section, mode, domId, disabled, editorPreview, propertiesOnly, showProperties = true, onUpdate }: SectionComponentProps) => {
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

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
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
      <TextInput
        focusKey="landing-hero-media"
        label={t('backgroundImageUrl')}
        value={mediaUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ backgroundVideo: value, videoUrl: value, backgroundImage: value, backgroundImageUrl: value })}
      />
      <TextInput
        focusKey="landing-hero-poster"
        label={auth.language === 'zh' ? '海报图片链接' : 'Poster image URL'}
        value={posterUrl}
        disabled={disabled}
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
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const compactPreview = mode === 'edit' || editorPreview || disabled !== undefined

  return (
    <section
      id={domId}
      className={[
        'relative isolate overflow-hidden bg-home-dark text-white',
        compactPreview ? 'min-h-[30rem] rounded-2xl shadow-[0_14px_36px_rgba(31,56,48,0.12)]' : 'min-h-[72svh]',
      ].join(' ')}
    >
      <LandingHeroMedia src={mediaUrl} poster={posterUrl} />
      {!compactPreview ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-48 bg-gradient-to-t from-home-surface to-transparent" /> : null}

      <div className={['relative z-10 mx-auto flex max-w-6xl items-end px-5 sm:px-8 lg:px-10', compactPreview ? 'min-h-[30rem] pb-12 pt-20' : 'min-h-[72svh] pb-24 pt-24'].join(' ')}>
        <div className="max-w-xl">
          <EditableText
            as="h1"
            multiline
            value={title}
            fallback={auth.language === 'zh' ? '在这里写下页面最重要的邀请。' : 'Write the page’s most important invitation here.'}
            disabled={!editable}
            className="whitespace-pre-line text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.5rem]"
            onChange={updateHeroTitle}
          />
          <EditableText
            as="p"
            multiline
            value={body}
            fallback={t('noHeroContentYet')}
            disabled={!editable}
            className="mt-5 block max-w-md whitespace-pre-line text-base leading-7 text-white/70"
            onChange={updateHeroBody}
          />
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {renderLink({
              label: primaryLabel,
              url: primaryUrl,
              fallback: auth.language === 'zh' ? '计划来访' : 'Plan a Visit',
              className: 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-home-dark transition hover:bg-white/90',
              icon: 'arrow',
              onLabelChange: (value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value }),
            })}
            {renderLink({
              label: secondaryLabel,
              url: secondaryUrl,
              fallback: auth.language === 'zh' ? '观看主日信息' : 'Watch Sermon',
              className: 'inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white',
              icon: 'play',
              onLabelChange: (value) => updateLocalizedContent({ secondaryLinkLabel: value, secondaryLabel: value, secondaryCtaLabel: value }),
            })}
          </div>
        </div>
      </div>

      {mode === 'edit' && showProperties ? (
        <div className="relative z-20 border-t border-white/10 bg-white/95 p-3 text-slate-900">
          {renderProperties()}
        </div>
      ) : null}
    </section>
  )
}

export default LandingHeroSection
