import type { JsonMap, SectionType } from '../../types/page-editor'

type Props = {
  type: SectionType | ''
  contentJson: JsonMap
  styleJson: JsonMap
  disabled?: boolean
  onContentChange: (value: JsonMap) => void
  onStyleChange: (value: JsonMap) => void
}

const readText = (source: JsonMap, key: string) => {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

const SectionTypeFields = ({ type, contentJson, styleJson, disabled, onContentChange, onStyleChange }: Props) => {
  const patchContent = (patch: JsonMap) => onContentChange({ ...contentJson, ...patch })
  const patchStyle = (patch: JsonMap) => onStyleChange({ ...styleJson, ...patch })

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Section Type Helper Fields</p>

      {type === 'Hero' ? (
        <>
          <input
            value={readText(contentJson, 'headline')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="Headline"
            onChange={(event) => patchContent({ headline: event.target.value })}
          />
          <input
            value={readText(contentJson, 'subheadline')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="Subheadline"
            onChange={(event) => patchContent({ subheadline: event.target.value })}
          />
          <input
            value={readText(contentJson, 'backgroundImageUrl')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="Background image URL"
            onChange={(event) => patchContent({ backgroundImageUrl: event.target.value })}
          />
        </>
      ) : null}

      {type === 'RichText' ? (
        <textarea
          value={readText(contentJson, 'text')}
          disabled={disabled}
          rows={5}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
          placeholder="Rich text content"
          onChange={(event) => patchContent({ text: event.target.value })}
        />
      ) : null}

      {type === 'GroupList' ? (
        <>
          <input
            value={readText(contentJson, 'title')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="List title"
            onChange={(event) => patchContent({ title: event.target.value })}
          />
          <textarea
            value={readText(contentJson, 'description')}
            disabled={disabled}
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="List description"
            onChange={(event) => patchContent({ description: event.target.value })}
          />
        </>
      ) : null}

      {type === 'PageList' ? (
        <input
          value={readText(contentJson, 'title')}
          disabled={disabled}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
          placeholder="Page list title"
          onChange={(event) => patchContent({ title: event.target.value })}
        />
      ) : null}

      {type === 'SermonList' ? (
        <>
          <input
            value={readText(contentJson, 'title')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="Sermon list title"
            onChange={(event) => patchContent({ title: event.target.value })}
          />
          <input
            value={readText(contentJson, 'youtubeChannelId')}
            disabled={disabled}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
            placeholder="YouTube channel ID"
            onChange={(event) => patchContent({ youtubeChannelId: event.target.value })}
          />
        </>
      ) : null}

      {!['Hero', 'RichText', 'GroupList', 'PageList', 'SermonList'].includes(type) ? (
        <p className="text-xs text-slate-500">No helper fields for this section type. Use raw JSON editors below.</p>
      ) : null}

      <input
        value={readText(styleJson, 'className')}
        disabled={disabled}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
        placeholder="Optional style class"
        onChange={(event) => patchStyle({ className: event.target.value })}
      />
    </div>
  )
}

export default SectionTypeFields
