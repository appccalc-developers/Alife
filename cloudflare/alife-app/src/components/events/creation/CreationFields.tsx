import type { ReactNode } from 'react'
import type { MultilingualString } from '../../../types/event'

export const creationInput = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 text-sm font-normal text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40'
export const localText = (value: MultilingualString, zh: boolean) => (zh ? value.zh : value.en) || value.en || value.zh
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="min-w-0 text-sm font-semibold text-[#40554e]">{label}{children}</label>
}
export function BilingualField({ label, value, onChange, multiline }: { label: string; value: MultilingualString; onChange: (value: MultilingualString) => void; multiline?: boolean }) {
  return <fieldset className="min-w-0 md:col-span-2"><legend className="text-sm font-semibold text-[#40554e]">{label}</legend><div className="grid gap-2 md:grid-cols-2">{(['zh', 'en'] as const).map(code => <Field key={code} label={code === 'zh' ? '中文' : 'English'}>{multiline ? <textarea rows={3} className={`${creationInput} py-2`} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} /> : <input className={creationInput} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} />}</Field>)}</div></fieldset>
}
