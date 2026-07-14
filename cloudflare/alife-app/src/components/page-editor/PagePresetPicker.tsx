import { ArrowRight, FileText, LayoutTemplate } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { localizeText } from '../../utils/localizedText'
import { PAGE_PRESETS, type PagePresetId } from '../page/pagePresets'
import AppPageShell from '../layout/AppPageShell'

type Props = {
  onSelect: (preset: PagePresetId) => void
}

const PagePresetPicker = ({ onSelect }: Props) => {
  const { language } = useAuthStore()
  const t = useUiText()

  return (
    <AppPageShell>
      <section className="mx-auto w-full max-w-6xl py-4 sm:py-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#176b5a]">{t('addPage')}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#18332d] sm:text-4xl">{t('choosePagePreset')}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{t('choosePagePresetDescription')}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_PRESETS.map((preset) => {
            const Icon = preset.id === 'blank' ? FileText : LayoutTemplate
            return (
              <button
                key={preset.id}
                type="button"
                className="group flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-200"
                onClick={() => onSelect(preset.id)}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#176b5a]">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="mt-4 text-lg font-black text-slate-950">{localizeText(preset.name, language)}</span>
                <span className="mt-2 text-sm leading-6 text-slate-600">{localizeText(preset.description, language)}</span>
                <span className="mt-4 text-xs leading-5 text-slate-500">
                  {preset.sectionNames.length > 0
                    ? preset.sectionNames.map((name) => localizeText(name, language)).join(' → ')
                    : t('noPresetSections')}
                </span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-[#176b5a]">
                  {t('usePagePreset')} <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </AppPageShell>
  )
}

export default PagePresetPicker
