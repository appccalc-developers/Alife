import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import type { SectionHeader as SectionHeaderModel, SectionIconKey } from '../../types'
import { SECTION_ICON_KEYS } from '../../types/models'
import { localizeText } from '../../utils/localizedText'
import { EditableText } from './sectionUtils'
import { getSectionIcon, getSectionIconLabel } from './sectionIcons'

type SectionHeaderVariant = 'normal' | 'hero'

type SectionHeaderProps = {
  header?: SectionHeaderModel
  variant?: SectionHeaderVariant
  titleFallback?: string
  subtitleFallback?: string
  disabled?: boolean
  onIconChange?: (value: SectionIconKey | undefined) => void
  onTitleChange?: (value: string) => void
  onSubtitleChange?: (value: string) => void
}

const normalScaleClasses: Record<NonNullable<SectionHeaderModel['scale']>, { icon: string; title: string; subtitle: string }> = {
  compact: {
    icon: 'h-8 w-8',
    title: 'text-2xl md:text-3xl',
    subtitle: 'text-sm md:text-base',
  },
  normal: {
    icon: 'h-10 w-10',
    title: 'text-3xl md:text-4xl',
    subtitle: 'text-base md:text-lg',
  },
  feature: {
    icon: 'h-12 w-12',
    title: 'text-4xl md:text-5xl',
    subtitle: 'text-lg md:text-xl',
  },
}

const heroScaleClasses: Record<NonNullable<SectionHeaderModel['scale']>, { icon: string; title: string; subtitle: string }> = {
  compact: {
    icon: 'h-10 w-10',
    title: 'text-3xl md:text-5xl',
    subtitle: 'text-base md:text-lg',
  },
  normal: {
    icon: 'h-12 w-12',
    title: 'text-4xl md:text-6xl',
    subtitle: 'text-lg md:text-xl',
  },
  feature: {
    icon: 'h-14 w-14 md:h-16 md:w-16',
    title: 'text-5xl md:text-7xl',
    subtitle: 'text-xl md:text-2xl',
  },
}

const normalToneClasses: Record<NonNullable<SectionHeaderModel['tone']>, { icon: string; title: string; subtitle: string }> = {
  default: {
    icon: 'text-slate-500',
    title: 'text-slate-950',
    subtitle: 'text-slate-600',
  },
  primary: {
    icon: 'text-blue-600',
    title: 'text-blue-950',
    subtitle: 'text-blue-800',
  },
  warm: {
    icon: 'text-amber-600',
    title: 'text-amber-950',
    subtitle: 'text-amber-800',
  },
  fresh: {
    icon: 'text-emerald-600',
    title: 'text-emerald-950',
    subtitle: 'text-emerald-800',
  },
  rose: {
    icon: 'text-rose-600',
    title: 'text-rose-950',
    subtitle: 'text-rose-800',
  },
}

const heroToneClasses = {
  icon: 'text-white',
  title: 'text-white',
  subtitle: 'text-slate-100',
}

const SectionHeader = ({
  header,
  variant = 'normal',
  titleFallback = '',
  subtitleFallback = '',
  disabled,
  onIconChange,
  onTitleChange,
  onSubtitleChange,
}: SectionHeaderProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const iconPickerRef = useRef<HTMLDivElement>(null)
  const title = localizeText(header?.title, auth.language) || titleFallback
  const subtitle = localizeText(header?.subtitle, auth.language) || subtitleFallback
  const Icon = getSectionIcon(header?.icon)
  const canEditIcon = !disabled && Boolean(onIconChange)

  useEffect(() => {
    if (!iconPickerOpen) {
      return undefined
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!iconPickerRef.current?.contains(event.target as Node)) {
        setIconPickerOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIconPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [iconPickerOpen])

  if (!Icon && !title && !subtitle && !canEditIcon) {
    return null
  }

  const scale = header?.scale ?? 'normal'
  const align = variant === 'hero' ? 'center' : header?.align ?? 'center'
  const tone = header?.tone ?? 'default'
  const scaleClasses = variant === 'hero' ? heroScaleClasses[scale] : normalScaleClasses[scale]
  const toneClasses = variant === 'hero' ? heroToneClasses : normalToneClasses[tone]
  const alignmentClasses = align === 'left' ? 'items-start text-left' : 'items-center text-center'
  const containerClasses =
    variant === 'hero'
      ? `mx-auto flex max-w-4xl flex-col gap-4 px-5 ${alignmentClasses}`
      : `mx-auto mb-8 flex max-w-3xl flex-col gap-3 px-4 ${alignmentClasses}`
  const selectedIconLabel = header?.icon ? getSectionIconLabel(header.icon, auth.language) : t('none')
  const renderIcon = () => {
    if (!canEditIcon) {
      return Icon ? <Icon aria-hidden="true" className={`${scaleClasses.icon} ${toneClasses.icon}`} strokeWidth={1.8} /> : null
    }

    const ButtonIcon = Icon ?? Plus

    return (
      <div ref={iconPickerRef} className="relative inline-flex">
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full p-1 outline-none transition hover:bg-black/10 focus:ring-2 focus:ring-blue-300 ${toneClasses.icon}`}
          aria-haspopup="listbox"
          aria-expanded={iconPickerOpen}
          aria-label={`${t('icon')}: ${selectedIconLabel}`}
          title={`${t('icon')}: ${selectedIconLabel}`}
          onClick={(event) => {
            event.stopPropagation()
            setIconPickerOpen((open) => !open)
          }}
        >
          <ButtonIcon aria-hidden="true" className={scaleClasses.icon} strokeWidth={1.8} />
        </button>
        {iconPickerOpen ? (
          <div
            role="listbox"
            aria-label={t('icon')}
            className="absolute left-1/2 top-full z-30 mt-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="option"
              aria-selected={!header?.icon}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 ${!header?.icon ? 'bg-blue-50 text-blue-700' : ''}`}
              onClick={() => {
                onIconChange?.(undefined)
                setIconPickerOpen(false)
              }}
            >
              <span aria-hidden="true" className="h-4 w-4 rounded-full border border-slate-300" />
              <span>{t('none')}</span>
            </button>
            {SECTION_ICON_KEYS.map((iconKey) => {
              const OptionIcon = getSectionIcon(iconKey)
              const optionLabel = getSectionIconLabel(iconKey, auth.language)
              const selected = header?.icon === iconKey

              return (
                <button
                  key={iconKey}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 ${selected ? 'bg-blue-50 text-blue-700' : ''}`}
                  onClick={() => {
                    onIconChange?.(iconKey)
                    setIconPickerOpen(false)
                  }}
                >
                  {OptionIcon ? <OptionIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                  <span>{optionLabel}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {renderIcon()}
      {title || onTitleChange ? (
        <EditableText
          as={variant === 'hero' ? 'h1' : 'h2'}
          value={title}
          fallback={titleFallback}
          disabled={disabled}
          className={`block font-semibold leading-tight tracking-normal ${scaleClasses.title} ${toneClasses.title}`}
          onChange={onTitleChange}
        />
      ) : null}
      {subtitle || onSubtitleChange ? (
        <EditableText
          as="p"
          multiline
          value={subtitle}
          fallback={subtitleFallback}
          disabled={disabled}
          className={`block max-w-2xl leading-relaxed ${scaleClasses.subtitle} ${toneClasses.subtitle}`}
          onChange={onSubtitleChange}
        />
      ) : null}
    </div>
  )
}

export default SectionHeader
