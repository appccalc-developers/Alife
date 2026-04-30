import { useState } from 'react'
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

type IconGridItem = { imageUrl: string; label: string; linkUrl: string; imageSource: 'url' | 'upload' }

const parseIconItems = (source: JsonMap): IconGridItem[] => {
  const raw = source.iconItems
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map((item) => {
    if (!item || typeof item !== 'object') {
      return { imageUrl: '', label: '', linkUrl: '', imageSource: 'url' }
    }
    const obj = item as Record<string, unknown>
    return {
      imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : '',
      label: typeof obj.label === 'string' ? obj.label : '',
      linkUrl: typeof obj.linkUrl === 'string' ? obj.linkUrl : '',
      imageSource: obj.imageSource === 'upload' ? 'upload' : 'url',
    }
  })
}

const toYouTubeEmbedUrl = (rawUrl: string) => {
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

const SectionTypeFields = ({ type, contentJson, styleJson, disabled, onContentChange, onStyleChange }: Props) => {
  const [selectedFileName, setSelectedFileName] = useState('')
  const [imageSourceMode, setImageSourceMode] = useState<'url' | 'upload'>('url')
  const patchContent = (patch: JsonMap) => onContentChange({ ...contentJson, ...patch })
  const patchStyle = (patch: JsonMap) => onStyleChange({ ...styleJson, ...patch })
  const rawHeroLayout = readText(styleJson, 'layout')
  const heroLayout = rawHeroLayout === 'classic' ? 'classic' : 'featured'
  const heroImagePosition = readText(styleJson, 'imagePosition') === 'left' ? 'left' : 'right'
  const heroBg = readText(contentJson, 'backgroundImage') || readText(contentJson, 'backgroundImageUrl')
  const heroTitle = readText(contentJson, 'title') || readText(contentJson, 'headline')
  const heroSub = readText(contentJson, 'subtitle') || readText(contentJson, 'subheadline')
  const heroBody = readText(contentJson, 'centerText') || readText(contentJson, 'body')
  const heroLinkLabel = readText(contentJson, 'linkLabel') || readText(contentJson, 'linkText') || readText(contentJson, 'ctaLabel')
  const heroLinkUrl = readText(contentJson, 'linkUrl') || readText(contentJson, 'ctaUrl') || readText(contentJson, 'href')
  const iconItems = parseIconItems(contentJson)
  const iconFeatureLayout = type === 'SermonSpotlight' ? 'sermonSpotlight' : 'iconFeatureGrid'
  const iconDisplayStyle = readText(styleJson, 'displayStyle') === 'newsGrid' ? 'newsGrid' : 'iconGrid'
  const iconImageShape = readText(styleJson, 'imageShape') === 'circle' ? 'circle' : 'square'
  const youtubeUrl = readText(contentJson, 'youtubeUrl')
  const youtubeEmbedUrl = toYouTubeEmbedUrl(youtubeUrl)

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Section Type Helper Fields</p>

      {type === 'Hero' ? (
        <>
          <p className="text-xs text-slate-500">Hero 可视化模版（与页面渲染一致），直接点文字填写内容。</p>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <section className="overflow-hidden rounded-lg border border-slate-200">
              <div
                className={`relative bg-cover bg-center px-4 py-8 text-white sm:px-5 sm:py-12 ${heroLayout === 'featured' ? 'min-h-[240px] sm:min-h-[320px]' : ''}`}
                style={{
                  backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${heroBg || ''})`,
                }}
              >
                {heroLayout === 'featured' ? (
                  <div className="flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
                    <h2
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="rounded px-2 py-1 text-3xl font-semibold tracking-wide text-yellow-300 outline-none focus:bg-black/20 sm:text-5xl"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ title: value, headline: value })
                      }}
                    >
                      {heroTitle || 'Hero Section'}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="whitespace-pre-wrap rounded px-2 py-1 text-sm text-slate-100 outline-none focus:bg-black/20"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ centerText: value, body: value })
                      }}
                    >
                      {heroBody || heroSub || 'No hero content yet.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <h2
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="inline-block rounded px-2 py-1 text-2xl font-bold outline-none focus:bg-black/20"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ title: value, headline: value })
                      }}
                    >
                      {heroTitle || 'Hero Section'}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="mt-2 inline-block whitespace-pre-wrap rounded px-2 py-1 text-sm text-slate-100 outline-none focus:bg-black/20"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ subtitle: value, subheadline: value })
                      }}
                    >
                      {heroSub || 'No subtitle yet.'}
                    </p>
                  </>
                )}

                {(heroLinkUrl || !disabled) ? (
                  <span className="mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow sm:absolute sm:bottom-5 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2">
                    <span
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="rounded px-1 outline-none focus:bg-white/20"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ linkLabel: value, linkText: value, ctaLabel: value })
                      }}
                    >
                      {heroLinkLabel.trim() || (heroLinkUrl ? heroLinkUrl : 'Button text')}
                    </span>
                  </span>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Hero Style</span>
              <select
                value={heroLayout}
                disabled={disabled}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                onChange={(event) => patchStyle({ layout: event.target.value })}
              >
                <option value="featured">Featured (center text + bottom button)</option>
                <option value="classic">Classic (title + subtitle + bottom button)</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span aria-hidden className="text-xs font-medium text-transparent select-none">Button link URL</span>
              <input
                value={heroLinkUrl}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                placeholder="Button link URL"
                onChange={(event) => patchContent({ linkUrl: event.target.value, ctaUrl: event.target.value, href: event.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={imageSourceMode}
              disabled={disabled}
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
              onChange={(event) => setImageSourceMode(event.target.value as 'url' | 'upload')}
            >
              <option value="url">URL</option>
              <option value="upload">Upload</option>
            </select>
            {imageSourceMode === 'upload' ? (
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setSelectedFileName(file?.name ?? '')
                  if (!file) {
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                    if (!dataUrl) {
                      return
                    }
                    patchContent({ backgroundImage: dataUrl, backgroundImageUrl: dataUrl })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            ) : (
              <input
                value={heroBg}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                placeholder="Background image URL"
                onChange={(event) => patchContent({ backgroundImage: event.target.value, backgroundImageUrl: event.target.value })}
              />
            )}
          </div>
          {selectedFileName ? (
            <p className="text-xs text-amber-700">
              Selected: {selectedFileName}. Preview is applied locally; backend upload API is not connected yet.
            </p>
          ) : null}
        </>
      ) : null}

      {type === 'IconFeatureGrid' || type === 'SermonSpotlight' ? (
        <>
          <p className="text-xs text-slate-500">
            {type === 'SermonSpotlight'
              ? 'Sermon Spotlight：YouTube + 标题内容 + 按钮链接。'
              : 'Icon Feature Grid：背景图 + 标题文案 + 多个图标链接项。'}
          </p>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            {iconFeatureLayout === 'sermonSpotlight' ? (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <div className="relative px-4 py-6 sm:px-5 sm:py-8">
                  <div className="mx-auto max-w-4xl text-center">
                    <h2
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="inline-block rounded px-2 py-1 text-2xl font-semibold text-slate-700 outline-none focus:bg-slate-200 sm:text-4xl"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ title: value, headline: value })
                      }}
                    >
                      {heroTitle || "Today's Sermon"}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="mt-1 inline-block rounded px-2 py-1 text-base text-slate-500 outline-none focus:bg-slate-200 sm:text-xl"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ subtitle: value, subheadline: value })
                      }}
                    >
                      {heroSub || 'God loves us all'}
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-center">
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                      {youtubeEmbedUrl ? (
                        <iframe
                          src={youtubeEmbedUrl}
                          referrerPolicy="strict-origin-when-cross-origin"
                          title="Sermon video"
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-sm text-slate-500">
                          Paste a YouTube URL to preview video
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                      <p
                        role="textbox"
                        contentEditable={!disabled}
                        suppressContentEditableWarning
                        className="inline-block whitespace-pre-wrap rounded px-2 py-1 text-lg font-semibold text-indigo-900 outline-none focus:bg-slate-200 sm:text-2xl"
                        onBlur={(event) => {
                          const value = event.currentTarget.textContent ?? ''
                          patchContent({ centerText: value, body: value })
                        }}
                      >
                        {heroBody || 'Sermon title and summary'}
                      </p>
                      <div>
                        <span className="inline-flex rounded bg-red-500 px-6 py-2 text-sm font-medium text-white shadow">
                          <span className="rounded px-1">View</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : iconDisplayStyle === 'newsGrid' ? (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div className="px-4 py-6 sm:px-5 sm:py-8">
                  <div className="mx-auto max-w-5xl text-center">
                    <h2
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="inline-block rounded px-2 py-1 text-2xl font-semibold text-slate-700 outline-none focus:bg-slate-200 sm:text-4xl"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ title: value, headline: value })
                      }}
                    >
                      {heroTitle || 'Latest News'}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="mt-1 inline-block rounded px-2 py-1 text-base text-slate-500 outline-none focus:bg-slate-200 sm:text-lg"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ subtitle: value, subheadline: value })
                      }}
                    >
                      {heroSub || 'God loves us all'}
                    </p>

                    <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 sm:grid-cols-2 md:grid-cols-3">
                      {iconItems.map((item, idx) => (
                        <a
                          key={`news-item-${idx}`}
                          href={item.linkUrl || undefined}
                          target={item.linkUrl ? '_blank' : undefined}
                          rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                          className="group flex flex-col items-center gap-3"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={
                                iconImageShape === 'circle'
                                  ? 'h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32'
                                  : 'h-28 w-full rounded-sm object-cover sm:h-40'
                              }
                            />
                          ) : (
                            <div
                              className={
                                iconImageShape === 'circle'
                                  ? 'flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 sm:h-32 sm:w-32'
                                  : 'flex h-28 w-full items-center justify-center rounded-sm border border-dashed border-slate-300 text-slate-400 sm:h-40'
                              }
                            >
                              +
                            </div>
                          )}
                          <span className="text-center text-xl text-slate-800 sm:text-3xl">{item.label || '[title]'}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="overflow-hidden rounded-lg border border-slate-200">
                <div
                  className="relative overflow-hidden bg-cover bg-center px-4 py-8 text-white sm:px-5 sm:py-10"
                  style={{
                    backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${heroBg || ''})`,
                  }}
                >
                  <div className="mx-auto max-w-4xl text-center">
                    <h2
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="inline-block rounded px-2 py-1 text-2xl font-semibold outline-none focus:bg-black/20 sm:text-4xl"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ title: value, headline: value })
                      }}
                    >
                      {heroTitle || 'Our Church main activities'}
                    </h2>
                    <p
                      role="textbox"
                      contentEditable={!disabled}
                      suppressContentEditableWarning
                      className="mt-2 inline-block rounded px-2 py-1 text-base text-slate-200 outline-none focus:bg-black/20 sm:text-lg"
                      onBlur={(event) => {
                        const value = event.currentTarget.textContent ?? ''
                        patchContent({ subtitle: value, subheadline: value })
                      }}
                    >
                      {heroSub || 'God loves us all'}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-3 md:grid-cols-6">
                      {iconItems.map((item, idx) => (
                        <a
                          key={`icon-item-${idx}`}
                          href={item.linkUrl || undefined}
                          target={item.linkUrl ? '_blank' : undefined}
                          rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                          className="group flex flex-col items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={iconImageShape === 'circle' ? 'h-10 w-10 rounded-full object-cover' : 'h-10 w-10 object-contain'}
                            />
                          ) : (
                            <span
                              className={`inline-flex h-10 w-10 items-center justify-center border border-dashed border-white/50 text-sm text-white/80 ${
                                iconImageShape === 'circle' ? 'rounded-full' : 'rounded'
                              }`}
                            >
                              +
                            </span>
                          )}
                          <span className="text-sm text-slate-100">{item.label || 'Untitled'}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {type === 'IconFeatureGrid' ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Display Style</span>
                <select
                  value={iconDisplayStyle}
                  disabled={disabled}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                  onChange={(event) => patchStyle({ displayStyle: event.target.value })}
                >
                  <option value="iconGrid">Icon Grid</option>
                  <option value="newsGrid">News Grid</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Image Shape</span>
                <select
                  value={iconImageShape}
                  disabled={disabled}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                  onChange={(event) => patchStyle({ imageShape: event.target.value })}
                >
                  <option value="square">Square</option>
                  <option value="circle">Circle</option>
                </select>
              </label>
            </div>
          ) : null}

          {type === 'IconFeatureGrid' ? (
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <select
                value={imageSourceMode}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                onChange={(event) => setImageSourceMode(event.target.value as 'url' | 'upload')}
              >
                <option value="url">URL</option>
                <option value="upload">Upload</option>
              </select>
              {imageSourceMode === 'upload' ? (
                <input
                  type="file"
                  accept="image/*"
                  disabled={disabled}
                  className="h-9 w-full rounded border border-slate-300 px-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    setSelectedFileName(file?.name ?? '')
                    if (!file) {
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => {
                      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                      if (!dataUrl) {
                        return
                      }
                      patchContent({ backgroundImage: dataUrl, backgroundImageUrl: dataUrl })
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              ) : (
                <input
                  value={heroBg}
                  disabled={disabled}
                  className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                  placeholder="Background image URL"
                  onChange={(event) => patchContent({ backgroundImage: event.target.value, backgroundImageUrl: event.target.value })}
                />
              )}
            </div>
          ) : null}

          {type === 'SermonSpotlight' ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sermon Spotlight Fields</p>
              <input
                value={youtubeUrl}
                disabled={disabled}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                placeholder="YouTube URL (watch?v=... or youtu.be/...)"
                onChange={(event) => patchContent({ youtubeUrl: event.target.value })}
              />
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Button link URL</span>
                <input
                  value={heroLinkUrl}
                  disabled={disabled}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                  placeholder="https://…"
                  onChange={(event) => patchContent({ linkUrl: event.target.value, ctaUrl: event.target.value, href: event.target.value })}
                />
              </label>
            </div>
          ) : type === 'IconFeatureGrid' ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Icon Items</p>
              {iconItems.map((item, idx) => (
                <div key={`item-editor-${idx}`} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1.2fr_auto]">
                  <input
                    value={item.label}
                    disabled={disabled}
                    className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                    placeholder="Item text"
                    onChange={(event) => {
                      const nextItems = iconItems.slice()
                      nextItems[idx] = { ...item, label: event.target.value }
                      patchContent({ iconItems: nextItems })
                    }}
                  />
                  <input
                    value={item.linkUrl}
                    disabled={disabled}
                    className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                    placeholder="https:// link"
                    onChange={(event) => {
                      const nextItems = iconItems.slice()
                      nextItems[idx] = { ...item, linkUrl: event.target.value }
                      patchContent({ iconItems: nextItems })
                    }}
                  />
                  <div className="grid gap-2 md:grid-cols-[120px_1fr]">
                    <select
                      value={item.imageSource ?? 'url'}
                      disabled={disabled}
                      className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                      onChange={(event) => {
                        const nextItems = iconItems.slice()
                        nextItems[idx] = { ...item, imageSource: event.target.value as 'url' | 'upload' }
                        patchContent({ iconItems: nextItems })
                      }}
                    >
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {item.imageSource === 'upload' ? (
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled}
                        className="h-9 w-full rounded border border-slate-300 px-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) {
                            return
                          }
                          const reader = new FileReader()
                          reader.onload = () => {
                            const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                            if (!dataUrl) {
                              return
                            }
                            const nextItems = iconItems.slice()
                            nextItems[idx] = { ...item, imageUrl: dataUrl, imageSource: 'upload' }
                            patchContent({ iconItems: nextItems })
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    ) : (
                      <input
                        value={item.imageUrl}
                        disabled={disabled}
                        className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                        placeholder="Image URL"
                        onChange={(event) => {
                          const nextItems = iconItems.slice()
                          nextItems[idx] = { ...item, imageUrl: event.target.value, imageSource: 'url' }
                          patchContent({ iconItems: nextItems })
                        }}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                    onClick={() => {
                      const nextItems = iconItems.filter((_, itemIndex) => itemIndex !== idx)
                      patchContent({ iconItems: nextItems })
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
                onClick={() => {
                  patchContent({ iconItems: [...iconItems, { imageUrl: '', label: '', linkUrl: '', imageSource: 'url' }] })
                }}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-base leading-none">+</span>
                Add Icon Item
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {type === 'MediaSpotlight' ? (
        <>
          <p className="text-xs text-slate-500">Media Spotlight 模版：图文并排 + 按钮链接，支持左右切换。</p>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="grid gap-4 p-4 md:grid-cols-2 md:items-center">
                <div className={`order-2 ${heroImagePosition === 'left' ? 'md:order-2' : ''}`}>
                  <h2
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="inline-block rounded px-2 py-1 text-2xl font-semibold text-slate-800 outline-none focus:bg-slate-200 sm:text-3xl"
                    onBlur={(event) => {
                      const value = event.currentTarget.textContent ?? ''
                      patchContent({ title: value, headline: value })
                    }}
                  >
                    {heroTitle || 'Welcome to Abundant Life Church'}
                  </h2>
                  <p
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="mt-2 inline-block whitespace-pre-wrap rounded px-2 py-1 text-base text-slate-700 outline-none focus:bg-slate-200"
                    onBlur={(event) => {
                      const value = event.currentTarget.textContent ?? ''
                      patchContent({ centerText: value, body: value, subtitle: value, subheadline: value })
                    }}
                  >
                    {heroBody || heroSub || 'Click to edit content'}
                  </p>
                  <div className="mt-4">
                    <span className="inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow">
                      <span
                        role="textbox"
                        contentEditable={!disabled}
                        suppressContentEditableWarning
                        className="rounded px-1 outline-none focus:bg-white/20"
                        onBlur={(event) => {
                          const value = event.currentTarget.textContent ?? ''
                          patchContent({ linkLabel: value, linkText: value, ctaLabel: value })
                        }}
                      >
                        {heroLinkLabel.trim() || 'Read More'}
                      </span>
                    </span>
                  </div>
                </div>
                <div className={`order-1 ${heroImagePosition === 'left' ? 'md:order-1' : ''}`}>
                  {heroBg ? (
                    <img src={heroBg} alt="" className="h-48 w-full rounded-lg object-cover sm:h-[220px] md:h-[260px]" />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500 sm:h-[220px] md:h-[260px]">
                      No image selected
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Image Position</span>
              <select
                value={heroImagePosition}
                disabled={disabled}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                onChange={(event) => patchStyle({ imagePosition: event.target.value })}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span aria-hidden className="text-xs font-medium text-transparent select-none">Button link URL</span>
              <input
                value={heroLinkUrl}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                placeholder="Button link URL"
                onChange={(event) => patchContent({ linkUrl: event.target.value, ctaUrl: event.target.value, href: event.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={imageSourceMode}
              disabled={disabled}
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
              onChange={(event) => setImageSourceMode(event.target.value as 'url' | 'upload')}
            >
              <option value="url">URL</option>
              <option value="upload">Upload</option>
            </select>
            {imageSourceMode === 'url' ? (
              <input
                value={heroBg}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                placeholder="Image URL"
                onChange={(event) => patchContent({ backgroundImage: event.target.value, backgroundImageUrl: event.target.value })}
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setSelectedFileName(file?.name ?? '')
                  if (!file) {
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                    if (!dataUrl) {
                      return
                    }
                    patchContent({ backgroundImage: dataUrl, backgroundImageUrl: dataUrl })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            )}
          </div>
          {selectedFileName ? (
            <p className="text-xs text-amber-700">
              Selected: {selectedFileName}. Preview is applied locally; backend upload API is not connected yet.
            </p>
          ) : null}
        </>
      ) : null}

      {type === 'RichText' ? (
        <>
          <p className="text-xs text-slate-500">RichText 可视化 Quote 模版：背景图 + 标题 + 引用内容。</p>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <section className="overflow-hidden rounded-lg border border-slate-200">
              <div
                className="bg-cover bg-center px-4 py-8 text-white sm:px-5 sm:py-10"
                style={{
                  backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${readText(contentJson, 'backgroundImage') || readText(contentJson, 'backgroundImageUrl') || ''})`,
                }}
              >
                <div className="mx-auto max-w-4xl text-center">
                  <h2
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="inline-block rounded px-2 py-1 text-2xl font-semibold outline-none focus:bg-black/20 sm:text-4xl"
                    onBlur={(event) => patchContent({ title: event.currentTarget.textContent ?? '' })}
                  >
                    {readText(contentJson, 'title') || 'Quote of the day'}
                  </h2>
                  <p
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="mt-1 inline-block rounded px-2 py-1 text-base text-slate-200 outline-none focus:bg-black/20 sm:text-lg"
                    onBlur={(event) => patchContent({ subtitle: event.currentTarget.textContent ?? '' })}
                  >
                    {readText(contentJson, 'subtitle') || 'God loves us all'}
                  </p>
                  <p
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="mt-6 inline-block whitespace-pre-wrap rounded px-2 py-1 text-2xl leading-relaxed italic text-slate-100 outline-none focus:bg-black/20 sm:mt-8 sm:text-4xl"
                    onBlur={(event) => patchContent({ text: event.currentTarget.textContent ?? '' })}
                  >
                    {readText(contentJson, 'text') || 'One thing I ask from the LORD...'}
                  </p>
                  <p
                    role="textbox"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="mt-4 inline-block rounded px-2 py-1 text-xl font-medium text-yellow-300 outline-none focus:bg-black/20 sm:text-3xl"
                    onBlur={(event) => patchContent({ quoteAuthor: event.currentTarget.textContent ?? '' })}
                  >
                    {readText(contentJson, 'quoteAuthor') || 'Psalm 27:4'}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_1.5fr]">
            <select
              value={imageSourceMode}
              disabled={disabled}
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
              onChange={(event) => setImageSourceMode(event.target.value as 'url' | 'upload')}
            >
              <option value="url">URL</option>
              <option value="upload">Upload</option>
            </select>
            {imageSourceMode === 'url' ? (
              <input
                value={readText(contentJson, 'backgroundImage') || readText(contentJson, 'backgroundImageUrl')}
                disabled={disabled}
                className="h-9 w-full rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                placeholder="Background image URL"
                onChange={(event) => patchContent({ backgroundImage: event.target.value, backgroundImageUrl: event.target.value })}
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setSelectedFileName(file?.name ?? '')
                  if (!file) {
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = typeof reader.result === 'string' ? reader.result : ''
                    if (!dataUrl) {
                      return
                    }
                    patchContent({ backgroundImage: dataUrl, backgroundImageUrl: dataUrl })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            )}
          </div>
          {selectedFileName ? (
            <p className="text-xs text-amber-700">
              Selected: {selectedFileName}. Preview is applied locally; backend upload API is not connected yet.
            </p>
          ) : null}
        </>
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

      {!['Hero', 'MediaSpotlight', 'IconFeatureGrid', 'SermonSpotlight', 'RichText', 'GroupList', 'PageList', 'SermonList'].includes(type) ? (
        <p className="text-xs text-slate-500">No helper fields for this section type. Use raw JSON editors below.</p>
      ) : null}

    </div>
  )
}

export default SectionTypeFields
