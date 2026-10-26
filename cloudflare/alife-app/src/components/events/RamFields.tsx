import { ramFieldsText } from '../../i18n/ramFields.ts'
import { createContext, useContext } from 'react'
import type { RamLevel, RamPolicyData, RamText } from '../../types/ramGovernance'
import { displayRamText } from '../../types/ramGovernance'
import EventPolicyHelp from './EventPolicyHelp'

export const RamEditingLanguage = createContext<boolean | null>(null)

export const ramInput = 'min-h-11 w-full rounded-xl border border-[#c7d9d1] bg-white px-3 py-2 text-sm text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a] disabled:bg-slate-50'
export const levelLabels: Record<RamLevel, RamText> = ramFieldsText.levelLabels
export const levelClass: Record<RamLevel, string> = { Green: 'bg-emerald-100 text-emerald-900', Yellow: 'bg-amber-100 text-amber-900', Red: 'bg-red-100 text-red-900', Incomplete: 'bg-slate-100 text-slate-700' }
export function RamLevelBadge({ level = 'Incomplete', zh }: { level?: RamLevel; zh: boolean }) {
  return <span className={`inline-block rounded-lg px-2 py-1 text-sm font-bold ${levelClass[level]}`}>{levelLabels[level]?.[zh ? 'zh' : 'en']}</span>
}
export function RamTextField({ label, value, onChange, disabled = false }: { label: string; value?: RamText; onChange: (value: RamText) => void; disabled?: boolean }) {
  const zh = useContext(RamEditingLanguage)
  const input = (lang: 'zh' | 'en') => <label className="block min-w-0 text-xs text-[#66766f]">{lang === 'zh' ? ramFieldsText.english.zh : ramFieldsText.english.en}<textarea className={ramInput} aria-label={`${label} (${lang})`} rows={2} disabled={disabled} value={value?.[lang] || ''} onChange={e => onChange({ en: value?.en || '', zh: value?.zh || '', [lang]: e.target.value })} /></label>
  return <fieldset className="min-w-0 space-y-2"><legend className="text-sm font-semibold">{label}</legend>{zh === null ? <div className="grid gap-2 sm:grid-cols-2">{input('zh')}{input('en')}</div> : <>{input(zh ? 'zh' : 'en')}<details><summary className="min-h-10 cursor-pointer py-2 text-xs text-[#176b5a]">{zh ? ramFieldsText.editChinese.zh : ramFieldsText.editChinese.en}</summary>{input(zh ? 'en' : 'zh')}</details></>}</fieldset>
}
export function RamMatrix({ policy, zh, onChange, showScaleHelp = false }: { policy: RamPolicyData; zh: boolean; onChange?: (data: RamPolicyData) => void; showScaleHelp?: boolean }) {
  const axis = (kind: 'likelihood' | 'impact', value: number) => {
    if (!showScaleHelp) return value
    const scale = policy[kind].find(item => item.value === value)
    const label = kind === 'likelihood' ? ramFieldsText.likelihoodLevel : ramFieldsText.impactLevel
    return <span className="inline-flex items-center justify-center font-semibold"><span>{value}</span><EventPolicyHelp zh={zh} label={zh ? label.zh(value) : label.en(value)}
      text={scale ? <><strong className="block font-semibold">{displayRamText(scale.label, zh)}</strong><p className="mt-1 whitespace-pre-wrap">{displayRamText(scale.description, zh)}</p></> : (zh ? ramFieldsText.scaleDefinitionUnavailable.zh : ramFieldsText.scaleDefinitionUnavailable.en)} /></span>
  }
  return <div className="overflow-x-auto"><table className="w-full min-w-[310px] border-separate border-spacing-1 text-center text-sm"><caption className={showScaleHelp ? 'sr-only' : 'mb-2 text-left text-sm font-semibold'}>{zh ? ramFieldsText.likelihoodImpactEachColourConfirmedByTheChurch.zh : ramFieldsText.likelihoodImpactEachColourConfirmedByTheChurch.en}</caption>
    <thead><tr><th>{zh ? ramFieldsText.lI.zh : ramFieldsText.lI.en}</th>{[1, 2, 3, 4, 5].map(n => <th scope="col" key={n}>{axis('impact', n)}</th>)}</tr></thead>
    <tbody>{[1, 2, 3, 4, 5].map(l => <tr key={l}><th scope="row">{axis('likelihood', l)}</th>{[1, 2, 3, 4, 5].map(i => {
      const level = policy.matrix.find(c => c.likelihood === l && c.impact === i)?.level || 'Incomplete'
      return <td key={i} className={`rounded-lg p-1 ${levelClass[level]}`}><span className="font-bold">{l * i}</span>{onChange ? <select aria-label={`${l} × ${i}`} value={level === 'Incomplete' ? '' : level} className="min-h-10 w-full min-w-0 rounded bg-transparent text-xs" onChange={e => onChange({ ...policy, matrix: policy.matrix.map(c => c.likelihood === l && c.impact === i ? { ...c, level: (e.target.value || null) as RamLevel | null } : c) })}>
        <option value="">{zh ? ramFieldsText.unconfirmed.zh : ramFieldsText.unconfirmed.en}</option>{(['Green', 'Yellow', 'Red'] as const).map(x => <option key={x} value={x}>{levelLabels[x][zh ? 'zh' : 'en']}</option>)}</select> : <div className="text-xs">{levelLabels[level][zh ? 'zh' : 'en']}</div>}</td>
    })}</tr>)}</tbody>
  </table></div>
}
