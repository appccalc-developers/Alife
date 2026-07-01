import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { BackgroundMedia, DEFAULT_HERO_ASPECT_RATIO, DEFAULT_HERO_IMAGE, DEFAULT_POSTER_ASPECT_RATIO, EditableText, PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedContent, patchLocalizedSectionHeader, patchSectionHeader, patchStyle, readLocalizedText, readNumber, readText, resolveMediaAspectRatio } from './sectionUtils'
import type { SectionComponentProps } from './types'
import SectionHeader from './SectionHeader'
import { pageSectionShellClass } from './sectionPresets'

type HeroLayout = 'featured' | 'classic' | 'poster'

const normalizeHeroLayout = (value: string): HeroLayout => {
  if (value === 'classic') {
    return 'classic'
  }

  if (value === 'poster') {
    return 'poster'
  }

  return 'featured'
}

const defaultAspectRatio = (layout: HeroLayout) => (layout === 'poster' ? DEFAULT_POSTER_ASPECT_RATIO : DEFAULT_HERO_ASPECT_RATIO)

const formatAspectRatio = (value: number | undefined) => {
  if (!value || !Number.isFinite(value)) {
    return ''
  }

  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

const HeroSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, onUpdate }: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editable = mode === 'edit' && !disabled && onUpdate
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl') || DEFAULT_HERO_IMAGE
  const title = readLocalizedText(section.contentJson, auth.language, 'title', 'headline')
  const subtitle = readLocalizedText(section.contentJson, auth.language, 'subtitle', 'subheadline')
  const body = readLocalizedText(section.contentJson, auth.language, 'centerText', 'body')
  const linkLabel = readLocalizedText(section.contentJson, auth.language, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const layout = normalizeHeroLayout(readText(section.styleJson, 'layout'))
  const aspectRatio = readNumber(section.styleJson, 'aspectRatio')
  const reservedAspectRatio = aspectRatio ?? defaultAspectRatio(layout)
  const poster = layout === 'poster'
  const sectionRef = useRef(section)
  const onUpdateRef = useRef(onUpdate)

  sectionRef.current = section
  onUpdateRef.current = onUpdate

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))
  const aspectRatioLabel = formatAspectRatio(aspectRatio)
  const header = section.contentJson.header
  const updateHeroTitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { title: value, headline: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'title', value))
  }
  const updateHeroSubtitle = (value: string) => {
    const nextSection = patchLocalizedContent(section, auth.language, { centerText: value, body: value })
    onUpdate?.(patchLocalizedSectionHeader(nextSection, auth.language, 'subtitle', value))
  }

  useEffect(() => {
    const currentSection = sectionRef.current
    const currentAspectRatio = readNumber(currentSection.styleJson, 'aspectRatio')
    const fallbackAspectRatio = defaultAspectRatio(layout)

    if (mode !== 'edit') {
      return
    }

    if (!poster) {
      if (currentAspectRatio && Math.abs(currentAspectRatio - fallbackAspectRatio) < 0.01) {
        return
      }

      onUpdateRef.current?.(patchStyle(currentSection, { aspectRatio: fallbackAspectRatio }))
      return
    }

    const sourceBg = bg.trim()
    if (!sourceBg || !/^(https?:\/\/|\/|data:(image|video)|blob:)/i.test(sourceBg)) {
      if (!currentAspectRatio || Math.abs(currentAspectRatio - fallbackAspectRatio) >= 0.01) {
        onUpdateRef.current?.(patchStyle(currentSection, { aspectRatio: fallbackAspectRatio }))
      }
      return
    }

    let active = true

    void resolveMediaAspectRatio(sourceBg).then((nextAspectRatio) => {
      if (!active || !nextAspectRatio) {
        return
      }

      const latestSection = sectionRef.current
      const currentBg = readText(latestSection.contentJson, 'backgroundImage', 'backgroundImageUrl').trim()
      if (currentBg !== sourceBg || normalizeHeroLayout(readText(latestSection.styleJson, 'layout')) !== 'poster') {
        return
      }

      const latestAspectRatio = readNumber(latestSection.styleJson, 'aspectRatio')
      if (latestAspectRatio && Math.abs(latestAspectRatio - nextAspectRatio) < 0.01) {
        return
      }

      onUpdateRef.current?.(patchStyle(latestSection, { aspectRatio: nextAspectRatio }))
    })

    return () => {
      active = false
    }
  }, [bg, layout, mode, poster])

  const renderLink = (className: string) => {
    const safeLinkUrl = typeof linkUrl === 'string' ? linkUrl.trim() : ''
    const isExternalLink = Boolean(safeLinkUrl && !safeLinkUrl.startsWith('/') && !safeLinkUrl.startsWith('#'))

    if (!safeLinkUrl && mode !== 'edit') {
      return null
    }

    return (
      <a
        href={mode === 'render' && safeLinkUrl ? safeLinkUrl : undefined}
        target={mode === 'render' && isExternalLink ? '_blank' : undefined}
        rel={mode === 'render' && isExternalLink ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={(event) => {
          if (mode === 'edit') event.preventDefault()
        }}
      >
        <EditableText
          value={linkLabel}
          fallback={safeLinkUrl || t('buttonText')}
          disabled={!editable}
          className="text-sm"
          onChange={(value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value })}
        />
      </a>
    )
  }

  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        label={t('heroStyle')}
        value={layout}
        disabled={disabled}
        options={[
          { value: 'featured', label: t('featured') },
          { value: 'classic', label: t('classic') },
          { value: 'poster', label: t('poster') },
        ]}
        onChange={(value) => updateStyle({ layout: value, aspectRatio: defaultAspectRatio(normalizeHeroLayout(value)) })}
      />
      <div className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">{t('aspectRatio')}</span>
        <div className="flex h-9 items-center rounded border border-slate-300 bg-slate-50 px-2 text-sm text-slate-600">
          {aspectRatioLabel || t('aspectRatioPending')}
        </div>
      </div>
      <TextInput focusKey="hero-cta-url" label={t('buttonLinkUrl')} value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
      <TextInput focusKey="hero-media" label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  return (
    <section id={domId} className={pageSectionShellClass}>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div
          className={`relative w-full ${poster ? 'mx-auto' : mode === 'render' ? 'min-h-[20rem] sm:min-h-0' : ''}`}
          style={{ aspectRatio: reservedAspectRatio }}
        >
          <div className="absolute inset-0 text-white">
            <BackgroundMedia src={bg} overlayClassName="bg-slate-950/45" />
            <div className="relative flex h-full items-center justify-center px-4 py-7 text-center sm:px-5 sm:py-12">
              <div className="flex w-full flex-col items-center justify-center">
                <SectionHeader
                  header={header}
                  variant="hero"
                  titleFallback={title || t('heroSectionTitle')}
                  subtitleFallback={body || subtitle || t('noHeroContentYet')}
                  disabled={!editable}
                  onIconChange={editable ? (icon) => onUpdate?.(patchSectionHeader(section, { icon })) : undefined}
                  onTitleChange={editable ? updateHeroTitle : undefined}
                  onSubtitleChange={editable ? updateHeroSubtitle : undefined}
                />
                {renderLink('mt-6 inline-flex rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400')}
              </div>
            </div>
          </div>
        </div>
        {mode === 'edit' && showProperties ? renderProperties() : null}
      </div>
    </section>
  )
}

export default HeroSection
