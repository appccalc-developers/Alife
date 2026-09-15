import type { ReactNode } from 'react'
import type { MultilingualString } from '../../../types/event'

export const creationInput = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 text-sm font-normal text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40'
export const localText = (value: MultilingualString, zh: boolean) => (zh ? value.zh : value.en) || value.en || value.zh
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="min-w-0 text-sm font-semibold text-[#40554e]">{label}{children}</label>
}
export function BilingualField({ label, value, onChange, multiline, primaryLanguage, required = false, maxLength }: { label: string; value: MultilingualString; onChange: (value: MultilingualString) => void; multiline?: boolean; primaryLanguage?: 'en' | 'zh'; required?: boolean; maxLength?: number }) {
  if (primaryLanguage) {
    const secondary = primaryLanguage === 'zh' ? 'en' : 'zh'
    const control = (code: 'en' | 'zh') => <Field label={`${label} · ${code === 'zh' ? '中文' : 'English'}`}>{multiline
      ? <textarea rows={4} className={`${creationInput} py-2`} required={required} maxLength={maxLength} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} />
      : <input className={creationInput} required={required} maxLength={maxLength} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} />}</Field>
    return <fieldset className="min-w-0 md:col-span-2 space-y-2" onInvalidCapture={event => { const disclosure = (event.target as HTMLElement).closest('details'); if (disclosure) disclosure.open = true }}>
      <legend className="sr-only">{label}</legend>{control(primaryLanguage)}
      <details key={primaryLanguage} className="rounded-xl border border-[#2f4b42]/15 bg-white/70 p-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold text-[#176b5a]">{primaryLanguage === 'zh' ? '展开 English' : 'Expand 中文'}</summary><div className="pt-2">{control(secondary)}</div></details>
    </fieldset>
  }
  return <fieldset className="min-w-0 md:col-span-2"><legend className="text-sm font-semibold text-[#40554e]">{label}</legend><div className="grid gap-2 md:grid-cols-2">{(['zh', 'en'] as const).map(code => <Field key={code} label={code === 'zh' ? '中文' : 'English'}>{multiline ? <textarea rows={3} className={`${creationInput} py-2`} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} /> : <input className={creationInput} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} />}</Field>)}</div></fieldset>
}
