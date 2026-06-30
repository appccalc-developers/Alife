import { useRef, type MouseEvent } from 'react'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useAuthStore } from '../../stores/auth'
import type { LocalizedText } from '../../types'
import { localizeText } from '../../utils/localizedText'
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

const DEFAULT_LANDING_HERO_MEDIA = '/media/homepage-hero.mp4'
const DEFAULT_LANDING_HERO_POSTER = '/media/alife-church-community-hero.jpg'

const labels = (isZh: boolean) => ({
  title: isZh ? '在南岛的光里，\n找到一个属灵的家。' : 'A spiritual home\nin the light of the South Island.',
  body: isZh
    ? '我们是一群在基督城同行的华人基督徒，欢迎你一起敬拜、认识耶稣、进入真实的团契生活。'
    : 'We are a Chinese Christian community in Christchurch, welcoming people to worship, know Jesus, and grow in real fellowship.',
  primary: isZh ? '计划首次来访' : 'Plan a Visit',
  secondary: isZh ? '观看主日信息' : 'Watch Sermon',
  backgroundMedia: isZh ? '背景图片/视频链接' : 'Background image/video URL',
  posterImage: isZh ? '视频封面图片链接' : 'Video poster image URL',
  primaryUrl: isZh ? '主要按钮链接' : 'Primary button URL',
  secondaryUrl: isZh ? '次要按钮链接' : 'Secondary button URL',
})

const readHeaderText = (header: unknown, language: string, field: 'title' | 'subtitle') => {
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    return ''
  }

  const value = (header as Record<string, unknown>)[field]
  return localizeText(value as LocalizedText | string | undefined, language)
}

const LandingHeroSection = ({
  section,
  mode,
  disabled,
  editorPreview,
  propertiesOnly,
  showProperties = true,
  onUpdate,
}: SectionComponentProps) => {
  const auth = useAuthStore()
  const isZh = auth.language === 'zh'
  const l = labels(isZh)
  const editable = mode === 'edit' && !disabled && onUpdate
  const heroRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroTextY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion || editorPreview ? 0 : 80])
  const heroGlow = useTransform(scrollYProgress, [0, 1], [1, editorPreview ? 0.8 : 0.4])
  const media = readText(section.contentJson, 'backgroundVideo', 'backgroundImage', 'backgroundImageUrl', 'imageUrl') || DEFAULT_LANDING_HERO_MEDIA
  const poster = readText(section.contentJson, 'posterImage', 'posterImageUrl', 'poster') || DEFAULT_LANDING_HERO_POSTER
  const title = readHeaderText(section.contentJson.header, auth.language, 'title') || readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const body = readHeaderText(section.contentJson.header, auth.language, 'subtitle') || readLocalizedText(section.contentJson, auth.language, 'centerText', 'body', 'subtitle', 'subheadline')
  const primaryLabel = readLocalizedText(section.contentJson, auth.language, 'primaryLabel', 'linkLabel', 'linkText', 'ctaLabel')
  const primaryUrl = readText(section.contentJson, 'primaryUrl', 'linkUrl', 'ctaUrl', 'href')
  const secondaryLabel = readLocalizedText(section.contentJson, auth.language, 'secondaryLabel', 'secondaryLinkText')
  const secondaryUrl = readText(section.contentJson, 'secondaryUrl', 'secondaryLinkUrl')
  const shouldAnimate = mode === 'render' && !editorPreview && !prefersReducedMotion

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateTitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { title: value, headline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'title', value))
  }
  const updateBody = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, {
      centerText: value,
      body: value,
      subtitle: value,
      subheadline: value,
    })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'subtitle', value))
  }

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    const safeUrl = url.trim()
    if (mode === 'edit' || !safeUrl) {
      event.preventDefault()
      return
    }

    if (!safeUrl.startsWith('#')) {
      return
    }

    event.preventDefault()
    let target: Element | null = null
    try {
      target = document.querySelector(safeUrl)
    } catch {
      target = null
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    window.location.href = safeUrl
  }

  const renderBackground = () => {
    const source = media.trim()

    if (source && isVideoSource(source)) {
      return (
        <video
          className="absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-60"
          src={source}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )
    }

    if (source) {
      return (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 h-full w-full scale-105 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${source})` }}
        />
      )
    }

    return <div aria-hidden="true" className="absolute inset-0 z-0 bg-home-dark" />
  }

  const renderAction = (
    kind: 'primary' | 'secondary',
    label: string,
    fallback: string,
    url: string,
    onLabelChange: (value: string) => void,
  ) => {
    const safeUrl = url.trim()
    if (!safeUrl && mode !== 'edit') {
      return null
    }

    const isExternalLink = Boolean(safeUrl && !safeUrl.startsWith('/') && !safeUrl.startsWith('#'))
    const className = kind === 'primary'
      ? 'inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-home-dark transition hover:bg-white/90'
      : 'inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white'

    return (
      <a
        href={mode === 'render' && safeUrl ? safeUrl : undefined}
        target={mode === 'render' && isExternalLink ? '_blank' : undefined}
        rel={mode === 'render' && isExternalLink ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={(event) => handleLinkClick(event, safeUrl)}
      >
        {kind === 'secondary' ? <PlayCircle className="h-4 w-4 shrink-0" /> : null}
        <EditableText
          value={label}
          fallback={fallback || safeUrl}
          disabled={!editable}
          className="text-sm"
          onChange={onLabelChange}
        />
        {kind === 'primary' ? <ArrowRight className="h-3.5 w-3.5 shrink-0" /> : null}
      </a>
    )
  }

  const renderProperties = () => (
    <PropertyPanel>
      <TextInput
        focusKey="landing-hero-media"
        label={l.backgroundMedia}
        value={media}
        disabled={disabled}
        onChange={(value) => updateContent({ backgroundVideo: value, backgroundImage: value, backgroundImageUrl: value, imageUrl: value })}
      />
      <TextInput
        focusKey="landing-hero-poster"
        label={l.posterImage}
        value={poster}
        disabled={disabled}
        onChange={(value) => updateContent({ posterImage: value, posterImageUrl: value, poster: value })}
      />
      <TextInput
        focusKey="landing-hero-primary-url"
        label={l.primaryUrl}
        value={primaryUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ primaryUrl: value, linkUrl: value, ctaUrl: value, href: value })}
      />
      <TextInput
        focusKey="landing-hero-secondary-url"
        label={l.secondaryUrl}
        value={secondaryUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ secondaryUrl: value, secondaryLinkUrl: value })}
      />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const heightClass = editorPreview ? 'min-h-[28rem]' : 'min-h-dvh'

  return (
    <section ref={heroRef} className={`relative isolate overflow-hidden bg-home-dark text-white ${heightClass}`}>
      {renderBackground()}
      <motion.div
        style={{ opacity: heroGlow }}
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(0deg,rgba(30,18,10,0.78)_0%,rgba(30,18,10,0.2)_50%,rgba(30,18,10,0.12)_100%)]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-48 bg-gradient-to-t from-home-surface to-transparent" />

      <div className={`relative z-10 mx-auto flex max-w-6xl items-end px-5 pb-16 pt-20 sm:px-8 lg:px-10 ${heightClass}`}>
        <motion.div style={{ y: heroTextY }} className="max-w-xl">
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <EditableText
              as="h1"
              multiline
              value={title}
              fallback={l.title}
              disabled={!editable}
              className="block whitespace-pre-line text-4xl font-bold leading-[1.08] tracking-normal text-white sm:text-5xl lg:text-[3.5rem]"
              onChange={updateTitle}
            />
          </motion.div>
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <EditableText
              as="p"
              multiline
              value={body}
              fallback={l.body}
              disabled={!editable}
              className="mt-5 block max-w-md text-base leading-7 text-white/65"
              onChange={updateBody}
            />
          </motion.div>
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            {renderAction('primary', primaryLabel, l.primary, primaryUrl, (value) =>
              updateLocalizedContent({ primaryLabel: value, linkLabel: value, linkText: value, ctaLabel: value }))}
            {renderAction('secondary', secondaryLabel, l.secondary, secondaryUrl, (value) =>
              updateLocalizedContent({ secondaryLabel: value, secondaryLinkText: value }))}
          </motion.div>
        </motion.div>
      </div>
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </section>
  )
}

export default LandingHeroSection
