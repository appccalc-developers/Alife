import { DEFAULT_HERO_IMAGE, EditableText, PropertyPanel, SelectInput, TextInput, patchContent, patchStyle, readText } from './sectionUtils'
import type { SectionComponentProps } from './types'

const HeroSection = ({ section, mode, disabled, onUpdate }: SectionComponentProps) => {
  const editable = mode === 'edit' && !disabled && onUpdate
  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl') || DEFAULT_HERO_IMAGE
  const title = readText(section.contentJson, 'title', 'headline')
  const subtitle = readText(section.contentJson, 'subtitle', 'subheadline')
  const body = readText(section.contentJson, 'centerText', 'body')
  const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText', 'ctaLabel')
  const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const rawLayout = readText(section.styleJson, 'layout')
  const layout = rawLayout === 'classic' ? 'classic' : rawLayout === 'split' || rawLayout === 'mediaSpotlight' ? 'mediaSpotlight' : 'featured'
  const featured = layout === 'featured'

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateStyle = (patch: Record<string, unknown>) => onUpdate?.(patchStyle(section, patch))

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div
        className={`relative bg-cover bg-center px-5 py-8 text-white sm:py-12 ${featured ? 'min-h-[240px] sm:min-h-[320px]' : ''}`}
        style={{ backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${bg})` }}
      >
        {featured ? (
          <div className="flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
            <EditableText
              as="h2"
              value={title}
              fallback="Hero Section"
              disabled={!editable}
              className="text-3xl font-semibold tracking-wide text-yellow-300 sm:text-5xl"
              onChange={(value) => updateContent({ title: value, headline: value })}
            />
            <EditableText
              as="p"
              multiline
              value={body || subtitle}
              fallback="No hero content yet."
              disabled={!editable}
              className="text-sm text-slate-100"
              onChange={(value) => updateContent({ centerText: value, body: value })}
            />
          </div>
        ) : (
          <>
            <EditableText
              as="h2"
              value={title}
              fallback="Hero Section"
              disabled={!editable}
              className="inline-block text-2xl font-bold"
              onChange={(value) => updateContent({ title: value, headline: value })}
            />
            <EditableText
              as="p"
              value={subtitle}
              fallback="No subtitle yet."
              disabled={!editable}
              className="mt-2 block text-sm text-slate-100"
              onChange={(value) => updateContent({ subtitle: value, subheadline: value })}
            />
          </>
        )}
        {linkUrl || mode === 'edit' ? (
          <a
            href={mode === 'render' ? linkUrl : undefined}
            target={mode === 'render' && linkUrl ? '_blank' : undefined}
            rel={mode === 'render' && linkUrl ? 'noopener noreferrer' : undefined}
            className="mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400 sm:absolute sm:bottom-5 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2"
            onClick={(event) => {
              if (mode === 'edit') event.preventDefault()
            }}
          >
            <EditableText
              value={linkLabel}
              fallback={linkUrl || 'Button text'}
              disabled={!editable}
              className="text-sm"
              onChange={(value) => updateContent({ linkLabel: value, linkText: value, ctaLabel: value })}
            />
          </a>
        ) : null}
      </div>
      {mode === 'edit' ? (
        <PropertyPanel>
          <SelectInput
            label="Hero Style"
            value={layout}
            disabled={disabled}
            options={[
              { value: 'featured', label: 'Featured' },
              { value: 'classic', label: 'Classic' },
            ]}
            onChange={(value) => updateStyle({ layout: value })}
          />
          <TextInput label="Button Link URL" value={linkUrl} disabled={disabled} onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })} />
          <TextInput label="Background Image URL" value={bg} disabled={disabled} onChange={(value) => updateContent({ backgroundImage: value, backgroundImageUrl: value })} />
        </PropertyPanel>
      ) : null}
    </section>
  )
}

export default HeroSection
