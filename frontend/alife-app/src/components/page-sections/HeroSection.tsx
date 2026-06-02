import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { DEFAULT_HERO_ASPECT_RATIO, DEFAULT_HERO_IMAGE, DEFAULT_POSTER_ASPECT_RATIO, EditableText, PropertyPanel, SelectInput, TextInput, patchContent, patchLocalizedContent, patchStyle, readLocalizedText, readNumber, readText, resolveImageAspectRatio } from './sectionUtils'
import type { SectionComponentProps } from './types'

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

const HeroSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
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
  const featured = layout === 'featured'
  const poster = layout === 'poster'
  const sectionRef = useRef(section)
  const onUpdateRef = useRef(onUpdate)

  sectionRef.current = section
  onUpdateRef.current = onUpdate

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, auth.language, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))
  const aspectRatioLabel = formatAspectRatio(aspectRatio)

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
    if (!sourceBg || !/^(https?:\/\/|\/|data:image|blob:)/i.test(sourceBg)) {
      if (!currentAspectRatio || Math.abs(currentAspectRatio - fallbackAspectRatio) >= 0.01) {
        onUpdateRef.current?.(patchStyle(currentSection, { aspectRatio: fallbackAspectRatio }))
      }
      return
    }

    let active = true

    void resolveImageAspectRatio(sourceBg).then((nextAspectRatio) => {
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
    if (!linkUrl && mode !== 'edit') {
      return null
    }

    return (
      <a
        href={mode === 'render' ? linkUrl : undefined}
        target={mode === 'render' && linkUrl ? '_blank' : undefined}
        rel={mode === 'render' && linkUrl ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={(event) => {
          if (mode === 'edit') event.preventDefault()
        }}
      >
        <EditableText
          value={linkLabel}
          fallback={linkUrl || t('buttonText')}
          disabled={!editable}
          className="text-sm"
          onChange={(value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value })}
        />
      </a>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div
        className={`relative w-full ${poster ? 'mx-auto max-w-3xl' : ''}`}
        style={{ aspectRatio: reservedAspectRatio }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center text-white"
          style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${bg})` }}
        >
          <div className={`relative flex h-full px-5 py-8 sm:py-12 ${featured ? 'items-center justify-center text-center' : poster ? 'items-end' : ''}`}>
            {poster ? (
              <div className="w-full">
                <div className="rounded-2xl bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent p-5 sm:p-8">
                  <EditableText
                    as="p"
                    value={subtitle}
                    fallback={t('noSubtitleYet')}
                    disabled={!editable}
                    className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-200 sm:text-sm"
                    onChange={(value) => updateLocalizedContent({ subtitle: value, subheadline: value })}
                  />
                  <EditableText
                    as="h2"
                    value={title}
                    fallback={t('heroSectionTitle')}
                    disabled={!editable}
                    className="mt-3 block text-3xl font-semibold tracking-wide text-white sm:text-5xl"
                    onChange={(value) => updateLocalizedContent({ title: value, headline: value })}
                  />
                  <EditableText
                    as="p"
                    multiline
                    value={body}
                    fallback={t('noHeroContentYet')}
                    disabled={!editable}
                    className="mt-4 block max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-slate-100 sm:text-base"
                    onChange={(value) => updateLocalizedContent({ centerText: value, body: value })}
                  />
                  {renderLink('mt-5 inline-flex rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400')}
                </div>
              </div>
            ) : featured ? (
              <div className="flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
                <EditableText
                  as="h2"
                  value={title}
                  fallback={t('heroSectionTitle')}
                  disabled={!editable}
                  className="text-3xl font-semibold tracking-wide text-yellow-300 sm:text-5xl"
                  onChange={(value) => updateLocalizedContent({ title: value, headline: value })}
                />
                <EditableText
                  as="p"
                  multiline
                  value={body || subtitle}
                  fallback={t('noHeroContentYet')}
                  disabled={!editable}
                  className="text-sm text-slate-100"
                  onChange={(value) => updateLocalizedContent({ centerText: value, body: value })}
                />
              </div>
            ) : (
              <div className="w-full text-left">
                <EditableText
                  as="h2"
                  value={title}
                  fallback={t('heroSectionTitle')}
                  disabled={!editable}
                  className="inline-block text-2xl font-bold"
                  onChange={(value) => updateLocalizedContent({ title: value, headline: value })}
                />
                <EditableText
                  as="p"
                  value={subtitle}
                  fallback={t('noSubtitleYet')}
                  disabled={!editable}
                  className="mt-2 block text-sm text-slate-100"
                  onChange={(value) => updateLocalizedContent({ subtitle: value, subheadline: value })}
                />
              </div>
            )}
            {!poster ? renderLink('mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400 sm:absolute sm:bottom-5 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2') : null}
          </div>
        </div>
      </div>
      {mode === 'edit' ? (
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
          <TextInput label={t('buttonLinkUrl')} value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
          <TextInput label={t('backgroundImageUrl')} value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default HeroSection
