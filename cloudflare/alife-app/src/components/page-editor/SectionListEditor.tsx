import { useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import SectionCardEditor from './SectionCardEditor'
import type { SectionEditModel, SectionType } from '../../types/page-editor'
import { useUiText } from '../../i18n/uiText'

type Props = {
  sections: SectionEditModel[]
  canEdit: boolean
  sectionTypeErrors: string[]
  onAdd: (type: SectionType, preset?: string) => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  contextGroupId?: string
}

const sectionPresets: Array<{ type: SectionType; preset?: string; label: string; description: string }> = [
  { type: 'Hero', preset: 'hero-home', label: 'Home hero', description: 'Large first screen with image, headline, copy, and CTA.' },
  { type: 'Hero', preset: 'hero-event', label: 'Event hero', description: 'Poster-style hero for a gathering or announcement.' },
  { type: 'RichText', preset: 'rich-welcome', label: 'Welcome text', description: 'Simple bilingual intro copy for a page.' },
  { type: 'RichText', preset: 'rich-faq', label: 'FAQ block', description: 'Questions about visit, language, children, and parking.' },
  { type: 'RichText', preset: 'rich-steps', label: 'What to expect', description: 'Step-by-step guidance for visitors or members.' },
  { type: 'Spotlight', preset: 'spotlight-visit', label: 'Visit spotlight', description: 'Image plus text for location or first visit info.' },
  { type: 'Spotlight', preset: 'spotlight-groups', label: 'Groups spotlight', description: 'Feature small groups and belonging.' },
  { type: 'Spotlight', preset: 'spotlight-sermons', label: 'Sermon spotlight', description: 'Feature a message, series, or teaching theme.' },
  { type: 'ListView', preset: 'list-events', label: 'Upcoming events', description: 'Dynamic list of upcoming events.' },
  { type: 'ListView', preset: 'list-groups', label: 'Group cards', description: 'Dynamic list of groups.' },
  { type: 'ListView', preset: 'list-sermons', label: 'Latest sermons', description: 'Dynamic latest sermon cards.' },
  { type: 'ListView', preset: 'list-pages', label: 'Page links', description: 'Dynamic list of pages.' },
  { type: 'ListView', preset: 'list-carousel', label: 'Carousel list', description: 'Horizontally scrolling card list.' },
  { type: 'Sermon', preset: 'sermon-embed', label: 'Embedded sermon', description: 'YouTube sermon embed with title.' },
]

const SectionListEditor = ({ sections, canEdit, sectionTypeErrors, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId }: Props) => {
  const t = useUiText()
  const [activeIndex, setActiveIndex] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (sections.length === 0) {
      setActiveIndex(0)
      return
    }
    if (activeIndex > sections.length - 1) {
      setActiveIndex(sections.length - 1)
    }
  }, [activeIndex, sections.length])

  const addAndSelect = (type: SectionType, preset?: string) => {
    onAdd(type, preset)
    setActiveIndex(sections.length)
    setCreateOpen(false)
  }

  const removeAndSelect = (index: number) => {
    onRemove(index)
    setActiveIndex(Math.max(0, Math.min(index, sections.length - 2)))
  }

  const moveAndSelect = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= sections.length) {
      return
    }
    direction === -1 ? onMoveUp(index) : onMoveDown(index)
    setActiveIndex(index + direction)
  }

  return (
    <section className="w-full min-w-0 space-y-3">
      {sections.length === 0 ? (
        <AppEmptyState
          title={t('noSectionsYet')}
          description={t('noSectionsDescription')}
          actionLabel={t('addSection')}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="w-full min-w-0 space-y-3">
          {sections.map((section, index) => (
            <SectionCardEditor
              key={`${section.id ?? 'new'}-${index}`}
              section={section}
              index={index}
              total={sections.length}
              canEdit={canEdit}
              typeError={sectionTypeErrors[index]}
              contextGroupId={contextGroupId}
              isActive={activeIndex === index}
              onSelect={() => setActiveIndex(index)}
              onUpdate={(nextSection) => onUpdate({ index, section: nextSection })}
              onRemove={() => removeAndSelect(index)}
              onMoveUp={() => moveAndSelect(index, -1)}
              onMoveDown={() => moveAndSelect(index, 1)}
            />
          ))}
        </div>
      )}
      <br />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t('selectedSectionOnly')}</p>
        <AppActionButton variant="primary" disabled={!canEdit} onClick={() => setCreateOpen(true)}>
          {t('addSection')}
        </AppActionButton>
      </div>
      {createOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={() => setCreateOpen(false)} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t('chooseSectionType')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('chooseSectionTypeDescription')}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setCreateOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="mt-5 grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {sectionPresets.map((item) => (
                <button
                  key={item.preset || item.type}
                  type="button"
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => addAndSelect(item.type, item.preset)}
                >
                  <span className="block font-bold text-slate-950">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export default SectionListEditor
