import type { RamLevel, RamPolicyData, RamText } from '../../types/ramGovernance'

export const ramInput = 'min-h-11 w-full rounded-xl border border-[#c7d9d1] bg-white px-3 py-2 text-sm text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a] disabled:bg-slate-50'
export const levelLabels: Record<RamLevel, RamText> = { Green: { en: 'Green', zh: '绿色' }, Yellow: { en: 'Yellow', zh: '黄色' }, Red: { en: 'Red', zh: '红色' }, Incomplete: { en: 'Incomplete', zh: '未完成' } }
export const levelClass: Record<RamLevel, string> = { Green: 'bg-emerald-100 text-emerald-900', Yellow: 'bg-amber-100 text-amber-900', Red: 'bg-red-100 text-red-900', Incomplete: 'bg-slate-100 text-slate-700' }
export function RamLevelBadge({ level = 'Incomplete', zh }: { level?: RamLevel; zh: boolean }) {
  return <span className={`inline-block rounded-lg px-2 py-1 text-sm font-bold ${levelClass[level]}`}>{levelLabels[level]?.[zh ? 'zh' : 'en']}</span>
}
export function RamTextField({ label, value, onChange, disabled = false }: { label: string; value?: RamText; onChange: (value: RamText) => void; disabled?: boolean }) {
  return <fieldset className="min-w-0 space-y-2"><legend className="text-sm font-semibold">{label}</legend><div className="grid gap-2 sm:grid-cols-2">
    {(['zh', 'en'] as const).map(lang => <label key={lang} className="min-w-0 text-xs text-[#66766f]">{lang === 'zh' ? '中文' : 'English'}<textarea className={ramInput} aria-label={`${label} (${lang})`} rows={2} disabled={disabled} value={value?.[lang] || ''} onChange={e => onChange({ en: value?.en || '', zh: value?.zh || '', [lang]: e.target.value })} /></label>)}
  </div></fieldset>
}
export function RamMatrix({ policy, zh, onChange }: { policy: RamPolicyData; zh: boolean; onChange?: (data: RamPolicyData) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[310px] border-separate border-spacing-1 text-center text-sm"><caption className="mb-2 text-left text-sm font-semibold">{zh ? '可能性 × 影响程度；每格颜色由教会确认' : 'Likelihood × impact; each colour confirmed by the church'}</caption>
    <thead><tr><th>{zh ? '可能性 ↓／影响 →' : 'L ↓ / I →'}</th>{[1, 2, 3, 4, 5].map(n => <th key={n}>{n}</th>)}</tr></thead>
    <tbody>{[1, 2, 3, 4, 5].map(l => <tr key={l}><th>{l}</th>{[1, 2, 3, 4, 5].map(i => {
      const level = policy.matrix.find(c => c.likelihood === l && c.impact === i)?.level || 'Incomplete'
      return <td key={i} className={`rounded-lg p-1 ${levelClass[level]}`}><span className="font-bold">{l * i}</span>{onChange ? <select aria-label={`${l} × ${i}`} value={level === 'Incomplete' ? '' : level} className="min-h-10 w-full min-w-0 rounded bg-transparent text-xs" onChange={e => onChange({ ...policy, matrix: policy.matrix.map(c => c.likelihood === l && c.impact === i ? { ...c, level: (e.target.value || null) as RamLevel | null } : c) })}>
        <option value="">{zh ? '待确认' : 'Unconfirmed'}</option>{(['Green', 'Yellow', 'Red'] as const).map(x => <option key={x} value={x}>{levelLabels[x][zh ? 'zh' : 'en']}</option>)}</select> : <div className="text-xs">{levelLabels[level][zh ? 'zh' : 'en']}</div>}</td>
    })}</tr>)}</tbody>
  </table></div>
}
