import type { FocusEvent } from 'react'
import type { EditableTextProps, PropertyPanelProps } from './types'
import type { JsonMap, SectionEditModel } from '../../types/page-editor'
import { languageKey, localizeText } from '../../utils/localizedText'

export const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80'
export const DEFAULT_HERO_ASPECT_RATIO = 16 / 9
export const DEFAULT_POSTER_ASPECT_RATIO = 3 / 4

export const readText = (source: JsonMap | undefined, ...keys: string[]) => {
  if (!source) {
    return ''
  }

  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      return value
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const map = value as Record<string, unknown>
      const text = map.en || map.zh || Object.values(map)[0]
      if (typeof text === 'string') {
        return text
      }
    }
  }

  return ''
}

export const readLocalizedText = (source: JsonMap | undefined, language: string, ...keys: string[]) => {
  if (!source) {
    return ''
  }

  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      return value
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const text = localizeText(value as Record<string, string>, language)
      if (text) {
        return text
      }
    }
  }

  return ''
}

export const readNumber = (source: JsonMap | undefined, key: string) => {
  const value = source?.[key]
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

export const resolveImageAspectRatio = (src: string): Promise<number | null> =>
  new Promise((resolve) => {
    const value = src.trim()
    if (!value || typeof Image === 'undefined') {
      resolve(null)
      return
    }

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        resolve(null)
        return
      }

      resolve(img.naturalWidth / img.naturalHeight)
    }
    img.onerror = () => resolve(null)
    img.src = value
  })

export const isVideoSource = (src: string) => {
  const value = src.trim()
  if (!value) {
    return false
  }

  if (/^data:video\//i.test(value)) {
    return true
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.href : 'https://alife.local/'
    return /\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(new URL(value, baseUrl).pathname)
  } catch {
    return /\.(mp4|webm|ogv|ogg|mov|m4v)(?:[?#].*)?$/i.test(value)
  }
}

const resolveVideoAspectRatio = (src: string): Promise<number | null> =>
  new Promise((resolve) => {
    const value = src.trim()
    if (!value || typeof document === 'undefined') {
      resolve(null)
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        resolve(null)
        return
      }

      resolve(video.videoWidth / video.videoHeight)
    }
    video.onerror = () => resolve(null)
    video.src = value
  })

export const resolveMediaAspectRatio = (src: string): Promise<number | null> =>
  isVideoSource(src) ? resolveVideoAspectRatio(src) : resolveImageAspectRatio(src)

export const BackgroundMedia = ({
  src,
  overlayClassName,
  className = '',
}: {
  src: string
  overlayClassName: string
  className?: string
}) => {
  const source = src.trim()

  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`}>
      {source && isVideoSource(source) ? (
        <video
          src={source}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
      ) : source ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${source})` }} />
      ) : (
        <div className="absolute inset-0 bg-slate-950" />
      )}
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  )
}

export const parseLimit = (source: JsonMap | undefined, key = 'limit', fallback = 8) => {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const toYouTubeEmbedUrl = (rawUrl: string) => {
  const value = rawUrl.trim()
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim()
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v')?.trim()
      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
      const shortsMatch = url.pathname.match(/\/shorts\/([^/]+)/)
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`
      }
    }
  } catch {
    return ''
  }

  return ''
}

export const patchContent = (section: SectionEditModel, patch: JsonMap): SectionEditModel => ({
  ...section,
  contentJson: { ...section.contentJson, ...patch },
})

export const toLocalizedValue = (current: unknown, language: string, value: string) => {
  const key = languageKey(language)
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    const map = current as Record<string, string>
    return {
      en: key === 'en' ? value : map.en ?? '',
      zh: key === 'zh' ? value : map.zh ?? '',
    }
  }

  const previous = typeof current === 'string' ? current : ''
  const fallbackKey = key === 'en' ? 'zh' : 'en'
  return {
    [fallbackKey]: previous,
    [key]: value,
  }
}

export const patchLocalizedSectionHeader = (
  section: SectionEditModel,
  language: string,
  field: 'title' | 'subtitle',
  value: string,
): SectionEditModel => {
  const currentHeader = section.contentJson.header && typeof section.contentJson.header === 'object' && !Array.isArray(section.contentJson.header)
    ? section.contentJson.header
    : {}

  return patchContent(section, {
    header: {
      ...currentHeader,
      [field]: toLocalizedValue(currentHeader[field], language, value),
    },
  })
}

export const patchLocalizedContent = (
  section: SectionEditModel,
  language: string,
  patch: Record<string, string>,
): SectionEditModel => {
  const nextContent = { ...section.contentJson }

  for (const [key, value] of Object.entries(patch)) {
    nextContent[key] = toLocalizedValue(section.contentJson[key], language, value)
  }

  return {
    ...section,
    contentJson: nextContent,
  }
}

export const patchStyle = (section: SectionEditModel, patch: JsonMap): SectionEditModel => ({
  ...section,
  styleJson: { ...section.styleJson, ...patch },
})

export const EditableText = ({ value, fallback, disabled, className, as = 'span', multiline, onChange }: EditableTextProps) => {
  const Tag = as
  const editable = !disabled && Boolean(onChange)
  const handleBlur = (event: FocusEvent<HTMLElement>) => onChange?.(event.currentTarget.textContent ?? '')

  return (
    <Tag
      role={editable ? 'textbox' : undefined}
      contentEditable={editable}
      suppressContentEditableWarning={editable}
      className={`${className} ${editable ? 'rounded px-1 outline-none focus:bg-black/10 focus:ring-2 focus:ring-blue-300' : ''} ${multiline ? 'whitespace-pre-wrap' : ''}`}
      onBlur={editable ? handleBlur : undefined}
    >
      {value || fallback}
    </Tag>
  )
}

export const PropertyPanel = ({ children }: PropertyPanelProps) => (
  <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white/90 p-3 md:grid-cols-2">
    {children}
  </div>
)

export const TextInput = ({
  label,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) => (
  <label className="block space-y-1">
    <span className="text-xs font-medium text-slate-600">{label}</span>
    <input
      value={value}
      disabled={disabled}
      className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
)

export const TextAreaInput = ({
  label,
  value,
  disabled,
  placeholder,
  rows = 4,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  placeholder?: string
  rows?: number
  onChange: (value: string) => void
}) => (
  <label className="block space-y-1 md:col-span-2">
    <span className="text-xs font-medium text-slate-600">{label}</span>
    <textarea
      value={value}
      disabled={disabled}
      rows={rows}
      className="w-full rounded border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
)

export const SelectInput = ({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) => (
  <label className="block space-y-1">
    <span className="text-xs font-medium text-slate-600">{label}</span>
    <select
      value={value}
      disabled={disabled}
      className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
)
