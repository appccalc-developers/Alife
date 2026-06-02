import { useEffect, useState } from 'react'
import { useUiText } from '../../i18n/uiText'
import AppActionButton from '../layout/AppActionButton'
import RawJsonEditor from './RawJsonEditor'
import SectionBlock from '../page-sections/SectionBlock'
import type { JsonMap, SectionEditModel, SectionType } from '../../types/page-editor'

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
  isActive: boolean
  onSelect: () => void
}

const sectionTypes: SectionType[] = ['Hero', 'MediaSpotlight', 'IconFeatureGrid', 'SermonSpotlight', 'RichText', 'PostFeed', 'Sermon', 'ListView']
const sectionTypeLabel = (type: SectionType) =>
  type === 'IconFeatureGrid' ? 'Icon Feature Grid'
    : type === 'SermonSpotlight' ? 'Sermon Spotlight'
      : type

const stringifyPretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2)
const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80'
const DEFAULT_HERO_ASPECT_RATIO = 16 / 9

const isInteractiveKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
}

const parseJson = (value: string, messages: { jsonObjectRequired: string; invalidJsonSyntax: string }): { ok: true; data: JsonMap } | { ok: false; error: string } => {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: messages.jsonObjectRequired }
    }

    return { ok: true, data: parsed as JsonMap }
  } catch {
    return { ok: false, error: messages.invalidJsonSyntax }
  }
}

const SectionCardEditor = ({ section, index, total, canEdit, typeError, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId, isActive, onSelect }: Props) => {
  const t = useUiText()
  const [contentText, setContentText] = useState(stringifyPretty(section.contentJson))
  const [styleText, setStyleText] = useState(stringifyPretty(section.styleJson))
  const [contentError, setContentError] = useState('')
  const [styleError, setStyleError] = useState('')
  const [rawOpen, setRawOpen] = useState(false)

  useEffect(() => {
    setContentText(stringifyPretty(section.contentJson))
    setContentError('')
  }, [section.contentJson])

  useEffect(() => {
    setStyleText(stringifyPretty(section.styleJson))
    setStyleError('')
  }, [section.styleJson])

  const patchSection = (patch: Partial<SectionEditModel>) => onUpdate({ ...section, ...patch })

  const applyTypeDefaults = (nextType: SectionEditModel['type']) => {
    if (nextType === 'RichText') {
      patchSection({
        type: 'RichText',
        contentJson: {
          ...section.contentJson,
          backgroundImage: (section.contentJson.backgroundImage as string) || (section.contentJson.backgroundImageUrl as string) || DEFAULT_HERO_IMAGE,
          backgroundImageUrl: (section.contentJson.backgroundImageUrl as string) || (section.contentJson.backgroundImage as string) || DEFAULT_HERO_IMAGE,
          title: (section.contentJson.title as string) || '',
          subtitle: (section.contentJson.subtitle as string) || '',
          text: (section.contentJson.text as string) || '',
          quoteAuthor: (section.contentJson.quoteAuthor as string) || '',
        },
        styleJson: {
          ...section.styleJson,
          variant: 'quoteOverlay',
        },
      })
      return
    }

    if (nextType === 'ListView') {
      patchSection({
        type: 'ListView',
        contentJson: {
          ...section.contentJson,
          sourceType: (section.contentJson.sourceType as string) || 'sermons',
          sourceScope: (section.contentJson.sourceScope as string) || 'global',
          limit: typeof section.contentJson.limit === 'number' ? section.contentJson.limit : 10,
          sortBy: (section.contentJson.sortBy as string) || 'title',
          sortDirection: (section.contentJson.sortDirection as string) || 'desc',
          filterText: (section.contentJson.filterText as string) || '',
        },
        styleJson: {},
      })
      return
    }

    if (nextType !== 'Hero' && nextType !== 'MediaSpotlight' && nextType !== 'IconFeatureGrid' && nextType !== 'SermonSpotlight') {
      patchSection({ type: nextType })
      return
    }

    if (nextType === 'IconFeatureGrid') {
      patchSection({
        type: 'IconFeatureGrid',
        contentJson: {
          ...section.contentJson,
          backgroundImage: (section.contentJson.backgroundImage as string) || (section.contentJson.backgroundImageUrl as string) || DEFAULT_HERO_IMAGE,
          backgroundImageUrl: (section.contentJson.backgroundImageUrl as string) || (section.contentJson.backgroundImage as string) || DEFAULT_HERO_IMAGE,
          title: (section.contentJson.title as string) || (section.contentJson.headline as string) || '',
          headline: (section.contentJson.headline as string) || (section.contentJson.title as string) || '',
          subtitle: (section.contentJson.subtitle as string) || (section.contentJson.subheadline as string) || '',
          subheadline: (section.contentJson.subheadline as string) || (section.contentJson.subtitle as string) || '',
          iconItems: Array.isArray(section.contentJson.iconItems) ? section.contentJson.iconItems : [],
        },
        styleJson: {
          ...section.styleJson,
          layout: 'iconFeatureGrid',
          displayStyle: (section.styleJson.displayStyle as string) || 'iconGrid',
          imageShape: (section.styleJson.imageShape as string) || 'square',
        },
      })
      return
    }

    if (nextType === 'SermonSpotlight') {
      patchSection({
        type: 'SermonSpotlight',
        contentJson: {
          ...section.contentJson,
          title: (section.contentJson.title as string) || (section.contentJson.headline as string) || '',
          headline: (section.contentJson.headline as string) || (section.contentJson.title as string) || '',
          subtitle: (section.contentJson.subtitle as string) || (section.contentJson.subheadline as string) || '',
          subheadline: (section.contentJson.subheadline as string) || (section.contentJson.subtitle as string) || '',
          centerText: (section.contentJson.centerText as string) || (section.contentJson.body as string) || '',
          body: (section.contentJson.body as string) || (section.contentJson.centerText as string) || '',
          youtubeUrl: (section.contentJson.youtubeUrl as string) || '',
          linkLabel: (section.contentJson.linkLabel as string) || (section.contentJson.linkText as string) || (section.contentJson.ctaLabel as string) || '',
          linkText: (section.contentJson.linkText as string) || (section.contentJson.linkLabel as string) || (section.contentJson.ctaLabel as string) || '',
          ctaLabel: (section.contentJson.ctaLabel as string) || (section.contentJson.linkLabel as string) || (section.contentJson.linkText as string) || '',
          linkUrl: (section.contentJson.linkUrl as string) || (section.contentJson.ctaUrl as string) || (section.contentJson.href as string) || '',
          ctaUrl: (section.contentJson.ctaUrl as string) || (section.contentJson.linkUrl as string) || (section.contentJson.href as string) || '',
          href: (section.contentJson.href as string) || (section.contentJson.linkUrl as string) || (section.contentJson.ctaUrl as string) || '',
        },
        styleJson: {
          ...section.styleJson,
          layout: 'sermonSpotlight',
        },
      })
      return
    }

    patchSection({
      type: nextType,
      contentJson: {
        ...section.contentJson,
        backgroundImage: (section.contentJson.backgroundImage as string) || (section.contentJson.backgroundImageUrl as string) || DEFAULT_HERO_IMAGE,
        backgroundImageUrl: (section.contentJson.backgroundImageUrl as string) || (section.contentJson.backgroundImage as string) || DEFAULT_HERO_IMAGE,
        title: (section.contentJson.title as string) || (section.contentJson.headline as string) || '',
        headline: (section.contentJson.headline as string) || (section.contentJson.title as string) || '',
        subtitle: (section.contentJson.subtitle as string) || (section.contentJson.subheadline as string) || '',
        subheadline: (section.contentJson.subheadline as string) || (section.contentJson.subtitle as string) || '',
        centerText: (section.contentJson.centerText as string) || (section.contentJson.body as string) || '',
        body: (section.contentJson.body as string) || (section.contentJson.centerText as string) || '',
        linkLabel:
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.linkText as string) ||
          (section.contentJson.ctaLabel as string) ||
          '',
        linkText:
          (section.contentJson.linkText as string) ||
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.ctaLabel as string) ||
          '',
        ctaLabel:
          (section.contentJson.ctaLabel as string) ||
          (section.contentJson.linkLabel as string) ||
          (section.contentJson.linkText as string) ||
          '',
        linkUrl:
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.ctaUrl as string) ||
          (section.contentJson.href as string) ||
          '',
        ctaUrl:
          (section.contentJson.ctaUrl as string) ||
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.href as string) ||
          '',
        href:
          (section.contentJson.href as string) ||
          (section.contentJson.linkUrl as string) ||
          (section.contentJson.ctaUrl as string) ||
          '',
      },
      styleJson: {
        ...section.styleJson,
        layout: nextType === 'MediaSpotlight' ? 'mediaSpotlight' : 'featured',
        aspectRatio: DEFAULT_HERO_ASPECT_RATIO,
        imagePosition: (section.styleJson.imagePosition as string) || 'right',
      },
    })
  }

  const onContentRawChange = (value: string) => {
    setContentText(value)
    const parsed = parseJson(value, { jsonObjectRequired: t('jsonObjectRequired'), invalidJsonSyntax: t('invalidJsonSyntax') })
    if (!parsed.ok) {
      setContentError(parsed.error)
      return
    }

    setContentError('')
    patchSection({ contentJson: parsed.data })
  }

  const onStyleRawChange = (value: string) => {
    setStyleText(value)
    const parsed = parseJson(value, { jsonObjectRequired: t('jsonObjectRequired'), invalidJsonSyntax: t('invalidJsonSyntax') })
    if (!parsed.ok) {
      setStyleError(parsed.error)
      return
    }

    setStyleError('')
    patchSection({ styleJson: parsed.data })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none transition ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'cursor-pointer hover:ring-2 hover:ring-blue-200 hover:ring-offset-2'}`}
      onClick={(event) => {
        if (!isActive && (event.target as HTMLElement).closest('a')) {
          event.preventDefault()
        }
        onSelect()
      }}
      onKeyDown={(event) => {
        if (isInteractiveKeyboardTarget(event.target)) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      {isActive ? (<>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{t('sectionHeading', { number: index + 1, type: section.type || t('selectType') })}</h3>
        {isActive ? <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <AppActionButton size="sm" disabled={index === 0 || !canEdit} onClick={onMoveUp}>{t('moveUp')}</AppActionButton>
          <AppActionButton size="sm" disabled={index === total - 1 || !canEdit} onClick={onMoveDown}>{t('moveDown')}</AppActionButton>
          <AppActionButton size="sm" variant="danger" disabled={!canEdit} onClick={onRemove}>{t('remove')}</AppActionButton>
        </div> : null}
      </div>
      <div className="border-t border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('sectionType')}</span>
          <select
            value={section.type}
            disabled={!canEdit}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            onChange={(event) => applyTypeDefaults(event.target.value as SectionEditModel['type'])}
          >
            <option value="">{t('selectType')}</option>
            {sectionTypes.map((sectionType) => (
              <option key={sectionType} value={sectionType}>{sectionTypeLabel(sectionType)}</option>
            ))}
          </select>
          {typeError ? <p className="text-xs text-red-600">{typeError}</p> : null}
        </label>
      </div>
      </>) : null}

      <div className="border-t border-slate-100" onClick={(event) => isActive && event.stopPropagation()}>
        <SectionBlock
          section={section}
          mode={isActive ? 'edit' : 'render'}
          disabled={!canEdit}
          contextGroupId={contextGroupId}
          onUpdate={onUpdate}
        />
      </div>

      {isActive ? (
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="text-xs font-medium uppercase tracking-wide text-slate-600"
          onClick={() => setRawOpen((value) => !value)}
        >
          {rawOpen ? 'Hide Raw JSON' : 'Show Raw JSON'}
        </button>
        {rawOpen ? (
          <div className="mt-3 space-y-3">
            <RawJsonEditor
              label={t('contentJson')}
              value={contentText}
              parseError={contentError}
              disabled={!canEdit}
              onChange={onContentRawChange}
            />
            <RawJsonEditor
              label={t('styleJson')}
              value={styleText}
              parseError={styleError}
              disabled={!canEdit}
              onChange={onStyleRawChange}
            />
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}

export default SectionCardEditor
