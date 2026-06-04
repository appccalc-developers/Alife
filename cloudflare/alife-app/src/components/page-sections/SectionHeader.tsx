import { useAuthStore } from '../../stores/auth'
import type { SectionHeader as SectionHeaderModel } from '../../types'
import { localizeText } from '../../utils/localizedText'
import { EditableText } from './sectionUtils'
import { getSectionIcon } from './sectionIcons'

type SectionHeaderVariant = 'normal' | 'hero'

type SectionHeaderProps = {
  header?: SectionHeaderModel
  variant?: SectionHeaderVariant
  titleFallback?: string
  subtitleFallback?: string
  disabled?: boolean
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
  onTitleChange,
  onSubtitleChange,
}: SectionHeaderProps) => {
  const auth = useAuthStore()
  const title = localizeText(header?.title, auth.language) || titleFallback
  const subtitle = localizeText(header?.subtitle, auth.language) || subtitleFallback
  const Icon = getSectionIcon(header?.icon)

  if (!Icon && !title && !subtitle) {
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

  return (
    <div className={containerClasses}>
      {Icon ? <Icon aria-hidden="true" className={`${scaleClasses.icon} ${toneClasses.icon}`} strokeWidth={1.8} /> : null}
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
